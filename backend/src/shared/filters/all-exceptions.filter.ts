import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

interface ErrorResponse {
  statusCode: number
  message: string | string[]
  error: string
  timestamp: string
  path: string
  traceId?: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp()
    const req    = ctx.getRequest<Request>()
    const res    = ctx.getResponse<Response>()

    let status  = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'
    let error   = 'InternalServerError'

    if (exception instanceof HttpException) {
      status  = exception.getStatus()
      const r = exception.getResponse()
      if (typeof r === 'string') {
        message = r
        error   = exception.name
      } else if (typeof r === 'object' && r !== null) {
        const obj = r as Record<string, unknown>
        message = (obj['message'] as string | string[]) ?? message
        error   = (obj['error'] as string)    ?? exception.name
      }
    } else if (exception instanceof Error) {
      message = exception.message
    }

    const body: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: req.url,
    }

    if (status >= 500) {
      this.logger.error(
        `[${req.method}] ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else {
      this.logger.warn(`[${req.method}] ${req.url} → ${status}: ${JSON.stringify(message)}`)
    }

    res.status(status).json(body)
  }
}
