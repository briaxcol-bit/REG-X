import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AuthService } from '../../application/services/auth.service'
import { Public } from '@shared/guards/rbac.guard'
import type { Request } from 'express'

class LoginDto {
  @ApiProperty({ example: 'user@empresa.com' }) @IsEmail() email!: string
  @ApiProperty({ example: 'password123' }) @IsString() @MinLength(6) password!: string
}

class RegisterDto {
  @ApiProperty({ example: 'user@empresa.com' }) @IsEmail() email!: string
  @ApiProperty({ example: 'password123' }) @IsString() @MinLength(8) password!: string
  @ApiProperty({ example: 'Juan Pérez' }) @IsString() @IsNotEmpty() fullName!: string
}

class RefreshDto {
  @ApiProperty() @IsString() refreshToken!: string
}

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 per min
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.fullName)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate refresh token' })
  @ApiBearerAuth()
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken)
  }
}
