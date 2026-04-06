import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: PaginationDto) {
    const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? 50), 10) || 50));
    const { search } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async create(dto: CreateProductDto, tenantId: string) {
    return this.prisma.product.create({ data: { ...dto, tenantId } });
  }

  async update(id: string, dto: UpdateProductDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { message: 'Produit archivé' };
  }
}
