import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '@shared/guards/rbac.guard'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = new Date()

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status:  'ok',
      version: process.env['APP_VERSION'] ?? '1.0.0',
      uptime:  Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      env:     process.env['NODE_ENV'] ?? 'development',
    }
  }
}
