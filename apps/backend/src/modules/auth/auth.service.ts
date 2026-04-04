import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BruteForceGuard } from '../../common/guards/brute-force.guard';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────
  async login(dto: LoginDto, ip = '0.0.0.0') {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      BruteForceGuard.recordFailure(ip, dto.email);
      await this._logSecurity(user?.tenantId, user?.id, 'LOGIN_FAILED', ip, { email: dto.email });
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    BruteForceGuard.clearFailures(ip, dto.email);

    await Promise.all([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this._logSecurity(user.tenantId, user.id, 'LOGIN_SUCCESS', ip),
    ]);

    return this.generateTokenPair(user.id, user.tenantId, user.role, user.email);
  }

  // ── Register (admin only) ──────────────────────────────────────────────
  async register(dto: RegisterDto, tenantId: string) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
    });
    if (exists) throw new ConflictException('Email déjà utilisé dans ce tenant');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    return user;
  }

  // ── Refresh token ──────────────────────────────────────────────────────
  async refreshTokens(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const { user } = stored;
    return this.generateTokenPair(user.id, user.tenantId, user.role, user.email);
  }

  // ── Logout ────────────────────────────────────────────────────────────
  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Déconnexion réussie' };
  }

  // ── Me ────────────────────────────────────────────────────────────────
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, tenantId: true, lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ── Security log ──────────────────────────────────────────────────────
  private async _logSecurity(
    tenantId: string | undefined,
    userId: string | undefined,
    event: string,
    ip: string,
    details?: Record<string, any>,
  ) {
    try {
      await this.prisma.securityLog.create({
        data: { tenantId, userId, event: event as any, ip, details },
      });
    } catch {}
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private async generateTokenPair(
    userId: string, tenantId: string, role: string, email: string,
  ) {
    const payload = { sub: userId, tenantId, role, email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
