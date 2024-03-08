import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class Car {
  @Field()
  id: string;

  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;
}
