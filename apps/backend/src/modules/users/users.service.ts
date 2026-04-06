import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { buildPaginationMeta, PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Champs renvoyés (jamais le password)
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  tenantId: true,
  lastLoginAt: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: PaginationDto) {
    const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const { search } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(dto: CreateUserDto, tenantId: string) {
    const exists = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { ...dto, password: hashed, tenantId },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Utilisateur désactivé' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Mot de passe modifié' };
  }

  async resetPassword(id: string, tenantId: string, newPassword: string) {
    await this.findOne(id, tenantId);
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return { message: 'Mot de passe réinitialisé' };
  }

  async toggleActive(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });
    return updated;
  }

  async getAgents(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getActivityHistory(userId: string, tenantId: string) {
    const [calls, sales] = await Promise.all([
      this.prisma.callLog.findMany({
        where: { agentId: userId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { call: { select: { direction: true, status: true } } },
      }),
      this.prisma.sale.count({ where: { agentId: userId, tenantId } }),
    ]);
    return { recentCalls: calls, totalSales: sales };
  }
}
