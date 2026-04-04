import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFieldDto, UpdateFieldDto, ReorderFieldsDto } from './scripts.dto';

@Injectable()
export class ScriptFieldsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, scriptId: string) {
    await this._assertScript(tenantId, scriptId);
    return this.prisma.scriptField.findMany({
      where: { scriptId },
      orderBy: { order: 'asc' },
    });
  }

  async create(tenantId: string, scriptId: string, dto: CreateFieldDto) {
    await this._assertScript(tenantId, scriptId);
    const count = await this.prisma.scriptField.count({ where: { scriptId } });
    return this.prisma.scriptField.create({
      data: {
        ...dto,
        scriptId,
        order: dto.order ?? count,
        options: dto.options ?? undefined,
        conditions: (dto.conditions as any) ?? undefined,
      },
    });
  }

  async update(tenantId: string, scriptId: string, fieldId: string, dto: UpdateFieldDto) {
    await this._assertField(tenantId, scriptId, fieldId);
    return this.prisma.scriptField.update({
      where: { id: fieldId },
      data: {
        ...dto,
        options: dto.options ?? undefined,
        conditions: (dto.conditions as any) ?? undefined,
      },
    });
  }

  async remove(tenantId: string, scriptId: string, fieldId: string) {
    await this._assertField(tenantId, scriptId, fieldId);
    await this.prisma.scriptField.delete({ where: { id: fieldId } });
  }

  async reorder(tenantId: string, scriptId: string, dto: ReorderFieldsDto) {
    await this._assertScript(tenantId, scriptId);
    await Promise.all(
      dto.ids.map((id, index) =>
        this.prisma.scriptField.updateMany({
          where: { id, scriptId },
          data: { order: index },
        }),
      ),
    );
    return this.prisma.scriptField.findMany({ where: { scriptId }, orderBy: { order: 'asc' } });
  }

  private async _assertScript(tenantId: string, scriptId: string) {
    const s = await this.prisma.script.findFirst({ where: { id: scriptId, tenantId } });
    if (!s) throw new NotFoundException('Script introuvable');
    return s;
  }

  private async _assertField(tenantId: string, scriptId: string, fieldId: string) {
    await this._assertScript(tenantId, scriptId);
    const f = await this.prisma.scriptField.findFirst({ where: { id: fieldId, scriptId } });
    if (!f) throw new NotFoundException('Champ introuvable');
    return f;
  }
}
