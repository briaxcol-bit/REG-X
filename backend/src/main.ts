import './tracing'             // Must be first — OTel setup
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import * as compression from 'compression'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from '@shared/filters/all-exceptions.filter'
import { ResponseInterceptor } from '@shared/interceptors/response.interceptor'
import { LoggingInterceptor } from '@shared/interceptors/logging.interceptor'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  })

  const config = app.get(ConfigService)
  const port    = config.get<number>('APP_PORT', 3000)
  const nodeEnv = config.get<string>('NODE_ENV', 'development')

  // ── Security ────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: nodeEnv === 'production',
    crossOriginEmbedderPolicy: false,
  }))

  app.enableCors({
    origin: [
      config.get('FRONTEND_URL', 'http://localhost:5173'),
      'http://localhost:5174',
      /\.regx\.app$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-branch-id', 'x-api-key', 'x-app-version'],
  })

  // ── Compression ─────────────────────────────────────────
  app.use(compression())

  // ── API versioning ──────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // ── Global prefix ───────────────────────────────────────
  app.setGlobalPrefix('api')

  // ── Global pipes ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── Global filters ──────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter())

  // ── Global interceptors ─────────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor(), new LoggingInterceptor())

  // ── Swagger ─────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('REG-X API')
      .setDescription('REG-X ERP/POS SaaS Enterprise — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
      .addTag('Auth')
      .addTag('Products')
      .addTag('Inventory')
      .addTag('Sales')
      .addTag('Customers')
      .addTag('Reports')
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`)
  }

  // ── Shutdown hooks ──────────────────────────────────────
  app.enableShutdownHooks()

  await app.listen(port, '0.0.0.0')
  logger.log(`🚀 REG-X Backend running on http://localhost:${port}/api`)
  logger.log(`🌍 Environment: ${nodeEnv}`)
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err)
  process.exit(1)
})
