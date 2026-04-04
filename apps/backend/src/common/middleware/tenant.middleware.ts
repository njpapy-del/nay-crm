import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface TenantRequest extends Request {
  tenantId?: string;
  user?: { id: string; tenantId: string; role: string; email: string };
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  use(req: TenantRequest, _res: Response, next: NextFunction) {
    // 1. Extract tenantId from JWT if present
    const auth = req.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify(auth.slice(7), {
          secret: this.config.get('jwt.secret'),
        }) as any;
        req.tenantId = payload.tenantId;
        req.user = { id: payload.sub, tenantId: payload.tenantId, role: payload.role, email: payload.email };
      } catch {}
    }

    // 2. Override via header (internal service calls)
    if (req.headers['x-tenant-id']) {
      req.tenantId = req.headers['x-tenant-id'] as string;
    }

    // 3. Subdomain detection (optional)
    const host = req.hostname;
    const parts = host.split('.');
    if (parts.length >= 3 && parts[0] !== 'www') {
      (req as any).subdomain = parts[0];
    }

    next();
  }
}
