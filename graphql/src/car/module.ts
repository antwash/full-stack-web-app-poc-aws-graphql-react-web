import { Module } from "@nestjs/common";
import { CarResolver } from "./resolver";

@Module({
  providers: [CarResolver],
})
export class CarModule {}
