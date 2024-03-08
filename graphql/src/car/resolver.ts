import { Args, Query, Resolver } from "@nestjs/graphql";
import { Car } from "./model";
import { mockCars } from "./mocks";

@Resolver(() => Car)
export class CarResolver {
  @Query(() => Car)
  async car(@Args("id") id: string) {
    return mockCars.find((car) => car.id === id);
  }

  @Query(() => [Car])
  async cars() {
    return mockCars;
  }
}
