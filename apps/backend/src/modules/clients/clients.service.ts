import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { FilterClientsDto } from './dto/filter-clients.dto';
import { QualifyClientDto } from './dto/qualify-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  company: true,
  address: true,
  postalCode: true,
  status: true,
  notes: true,
  qualification: true,
  qualifiedAt: true,
  qualifiedById: true,
  assignedAgentId: true,
  createdAt: true,
  updatedAt: true,
  assignedAgent: {
    select: { id: true, firstName: true, lastName: true },
  },
  qualifiedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: FilterClientsDto) {
    const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const { search, status, assignedAgentId } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(assignedAgentId && { assignedAgentId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { company: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: CLIENT_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data: clients, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      select: CLIENT_SELECT,
    });
    if (!client) throw new NotFoundException('Client introuvable');
    return client;
  }

  async create(dto: CreateClientDto, tenantId: string) {
    return this.prisma.client.create({
      data: { ...dto, tenantId },
      select: CLIENT_SELECT,
    });
  }

  async update(id: string, dto: UpdateClientDto, tenantId: string, userRole: Role) {
    const existing = await this.findOne(id, tenantId);

    // Si qualifié et que l'utilisateur est AGENT → interdit
    if (existing.qualification && userRole === Role.AGENT) {
      throw new ForbiddenException('Ce client est qualifié. Seul un Manager ou Admin peut le modifier.');
    }

    // L'agent ne peut modifier que les champs info (pas qualification/status)
    let data: any = dto;
    if (userRole === Role.AGENT) {
      const { firstName, lastName, phone, email, address, postalCode, notes } = dto as any;
      data = { firstName, lastName, phone, email, address, postalCode, notes };
      // Retirer les undefined
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    }

    return this.prisma.client.update({
      where: { id },
      data,
      select: CLIENT_SELECT,
    });
  }

  async qualify(id: string, dto: QualifyClientDto, tenantId: string, qualifiedById: string) {
    await this.findOne(id, tenantId);
    return this.prisma.client.update({
      where: { id },
      data: {
        qualification: dto.qualification,
        qualifiedAt: new Date(),
        qualifiedById,
      },
      select: CLIENT_SELECT,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.client.delete({ where: { id } });
    return { message: 'Client supprimé' };
  }

  async stats(tenantId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.client.count({ where: { tenantId } }),
      this.prisma.client.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    };
  }
}
