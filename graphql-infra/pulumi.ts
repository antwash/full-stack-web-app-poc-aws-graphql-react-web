import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create a VPC with a custom CIDR block range
const vpc = new aws.ec2.Vpc("my-graphql-custom-vpc", {
  cidrBlock: "10.0.0.0/16",
  tags: {
    Name: "my-graphql-custom-vpc",
  },
});

// Create an Internet Gateway and attach it to the VPC
const internetGateway = new aws.ec2.InternetGateway("my-internet-gateway", {
  vpcId: vpc.id,
  tags: {
    Name: "my-internet-gateway",
  },
});

// Create the two public subnets and routing table rules
const publicSubnetOne = new aws.ec2.Subnet("public-subnet-1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.0.0/24",
  availabilityZone: aws
    .getAvailabilityZones({
      state: "available",
    })
    .then((zones) => zones.names[0]),
  tags: {
    Name: "public-subnet-1",
  },
});
const publicSubnetTwo = new aws.ec2.Subnet("public-subnet-2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: aws
    .getAvailabilityZones({
      state: "available",
    })
    .then((zones) => zones.names[1]),
  tags: {
    Name: "public-subnet-2",
  },
});
[publicSubnetOne, publicSubnetTwo].map((subnet, index) => {
  const subNetRoutingTable = new aws.ec2.RouteTable(
    `public-subnet-${index + 1}-route-table`,
    {
      vpcId: vpc.id,
      routes: [
        { cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id },
        {
          cidrBlock: vpc.cidrBlock,
          gatewayId: "local",
        },
      ],
      tags: {
        Name: `public-subnet-${index + 1}-route-table`,
      },
    }
  );
  new aws.ec2.RouteTableAssociation(
    `public-subnet-${index + 1}-route-table-association`,
    {
      subnetId: subnet.id,
      routeTableId: subNetRoutingTable.id,
    }
  );
});

// Create two NAT Gateways each in a public subnet with an allocated Elastic IP
const natGatewayOneElasticIp = new aws.ec2.Eip(
  "public-subnet-1-nat-gateway-eip",
  {
    tags: {
      Name: "public-subnet-1-nat-gateway-eip",
    },
  }
);
const publicSubnetOneNatGateway = new aws.ec2.NatGateway(
  "public-subnet-1-nat-gateway",
  {
    allocationId: natGatewayOneElasticIp.allocationId,
    subnetId: publicSubnetOne.id,
    connectivityType: "public",
    tags: {
      Name: "public-subnet-1-nat-gateway",
    },
  }
);
const natGatewayTwoElasticIp = new aws.ec2.Eip(
  "public-subnet-2-nat-gateway-eip",
  {
    tags: {
      Name: "public-subnet-2-nat-gateway-eip",
    },
  }
);
const publicSubnetTwoNatGateway = new aws.ec2.NatGateway(
  "public-subnet-2-nat-gateway",
  {
    allocationId: natGatewayTwoElasticIp.allocationId,
    subnetId: publicSubnetTwo.id,
    connectivityType: "public",
    tags: {
      Name: "public-subnet-2-nat-gateway",
    },
  }
);

// Create the two private subnets and routing table rules
const privateSubnetOne = new aws.ec2.Subnet("private-subnet-1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.10.0/24",
  availabilityZone: aws
    .getAvailabilityZones({
      state: "available",
    })
    .then((zones) => zones.names[0]),
  tags: {
    Name: "private-subnet-1",
  },
});
const privateSubnetTwo = new aws.ec2.Subnet("private-subnet-2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.11.0/24",
  availabilityZone: aws
    .getAvailabilityZones({
      state: "available",
    })
    .then((zones) => zones.names[1]),
  tags: {
    Name: "private-subnet-2",
  },
});
const publicNatGateways: aws.ec2.NatGateway[] = [
  publicSubnetOneNatGateway,
  publicSubnetTwoNatGateway,
];
[privateSubnetOne, privateSubnetTwo].map((subnet, index) => {
  const subNetRoutingTable = new aws.ec2.RouteTable(
    `private-subnet-${index + 1}-route-table`,
    {
      vpcId: vpc.id,
      routes: [
        { cidrBlock: "0.0.0.0/0", gatewayId: publicNatGateways[index].id },
        {
          cidrBlock: vpc.cidrBlock,
          gatewayId: "local",
        },
      ],
      tags: {
        Name: `private-subnet-${index + 1}-route-table`,
      },
    }
  );
  new aws.ec2.RouteTableAssociation(
    `private-subnet-${index + 1}-route-table-association`,
    {
      subnetId: subnet.id,
      routeTableId: subNetRoutingTable.id,
    }
  );
});

const albSecurityGroup = new aws.ec2.SecurityGroup("alb-security-group", {
  description: "Allow HTTP traffic from anywhere",
  vpcId: vpc.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

const graphqlFargateSecurityGroup = new aws.ec2.SecurityGroup(
  "graphql-fargate-security-group",
  {
    description: "Allow subnet level and alb traffic",
    vpcId: vpc.id,
    ingress: [
      {
        // local traffic within the subnet
        fromPort: 80,
        toPort: 80,
        protocol: "TCP",
        cidrBlocks: [vpc.cidrBlock],
      },
      {
        // traffic from the abl load balancer
        fromPort: 80,
        toPort: 80,
        protocol: "TCP",
        securityGroups: [albSecurityGroup.id],
      },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  }
);

// Create application load balancer and port 80 listener
const graphqlApiAlb = new aws.lb.LoadBalancer("graphql-api-alb", {
  loadBalancerType: "application",
  internal: false,
  enableCrossZoneLoadBalancing: true,
  subnets: [publicSubnetOne.id, publicSubnetTwo.id],
  securityGroups: [albSecurityGroup.id],
});

const defaultAlbTargetGroup = new aws.lb.TargetGroup(
  "default-alb-target-group",
  {
    vpcId: vpc.id,
    protocol: "HTTP",
    port: 80,
    targetType: "ip",
    healthCheck: {
      path: "/health",
    },
  }
);
new aws.lb.Listener("alb-listener", {
  port: 80,
  protocol: "HTTP",
  loadBalancerArn: graphqlApiAlb.arn,
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: defaultAlbTargetGroup.arn,
    },
  ],
});

const graphqlApiCluster = new aws.ecs.Cluster("graphql-api-cluster");
const graphqlApiClusterRepository = new aws.ecr.Repository(
  "graphql-api-repository",
  {
    forceDelete: true,
  }
);

const graphqlApiImage = new awsx.ecr.Image("graphql-api-image", {
  repositoryUrl: graphqlApiClusterRepository.repositoryUrl,
  context: "../",
  dockerfile: "../graphql/Dockerfile",
  platform: "linux/amd64",
  args: {
    NODE_ENV: "production",
    PORT: "80",
    BUILD_FLAG: "--production",
  },
});

new awsx.ecs.FargateService("graphql-api-fargate-service", {
  cluster: graphqlApiCluster.arn,
  desiredCount: 2,
  networkConfiguration: {
    subnets: [privateSubnetOne.id, privateSubnetTwo.id],
    securityGroups: [graphqlFargateSecurityGroup.id],
  },
  loadBalancers: [
    {
      targetGroupArn: defaultAlbTargetGroup.arn,
      containerName: "graphql",
      containerPort: 80,
    },
  ],
  taskDefinitionArgs: {
    container: {
      name: "graphql",
      image: graphqlApiImage.imageUri,
      cpu: 128,
      memory: 512,
      essential: true,
      environment: [{ name: "PORT", value: "80" }],
      portMappings: [
        {
          containerPort: 80,
          protocol: "TCP",
        },
      ],
    },
  },
});

export const albUrl = graphqlApiAlb.dnsName;
