import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET")
      })
    })
  ],
  controllers: [PlatformController],
  providers: [PlatformService]
})
export class PlatformModule {}
