import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './infrastructure/controllers/auth.controller'
import { AuthService } from './application/services/auth.service'
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES', '15m') },
      }),
    }),
  ],
  providers:   [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports:     [AuthService, JwtModule],
})
export class AuthModule {}
