import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

const attempts = new Map<string, { count: number; lastAt: number }>();
const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class BruteForceGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const ip: string = req.ip ?? req.headers['x-forwarded-for'] ?? '0.0.0.0';
    const key = `bf:${ip}:${req.body?.email ?? ''}`;
    const now = Date.now();
    const entry = attempts.get(key);

    if (entry) {
      if (now - entry.lastAt > WINDOW_MS) {
        attempts.delete(key);
      } else if (entry.count >= MAX) {
        const waitMin = Math.ceil((WINDOW_MS - (now - entry.lastAt)) / 60000);
        throw new HttpException(
          `Trop de tentatives. Réessayez dans ${waitMin} minutes.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  static recordFailure(ip: string, email: string) {
    const key = `bf:${ip}:${email}`;
    const entry = attempts.get(key) ?? { count: 0, lastAt: Date.now() };
    entry.count++;
    entry.lastAt = Date.now();
    attempts.set(key, entry);
  }

  static clearFailures(ip: string, email: string) {
    attempts.delete(`bf:${ip}:${email}`);
  }
}
