import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ?? req.socket?.remoteAddress ?? req.ip;
    this.requestContextService.run(
      { method: req.method, url: req.originalUrl || req.url, clientIp },
      next,
    );
  }
}
