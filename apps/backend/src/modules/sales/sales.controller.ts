import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { SalesExportService } from './sales-export.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { FilterSaleDto } from './dto/filter-sale.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly exportService: SalesExportService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findAll(@CurrentUser() user: any, @Query() dto: FilterSaleDto) {
    return this.salesService.findAll(user.tenantId, dto);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  stats(@CurrentUser() user: any) {
    return this.salesService.stats(user.tenantId);
  }

  @Get('export/xlsx')
  @Roles('ADMIN', 'MANAGER')
  async exportXlsx(@CurrentUser() user: any, @Query() dto: FilterSaleDto, @Res() res: Response) {
    const { data } = await this.salesService.findAll(user.tenantId, { ...dto, limit: 5000 });
    const buffer = this.exportService.toXlsx(data as any);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ventes-${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('export/docx')
  @Roles('ADMIN', 'MANAGER')
  async exportDocx(@CurrentUser() user: any, @Query() dto: FilterSaleDto, @Res() res: Response) {
    const { data } = await this.salesService.findAll(user.tenantId, { ...dto, limit: 5000 });
    const buffer = await this.exportService.toDocx(data as any);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="ventes-${Date.now()}.docx"`,
    });
    res.send(buffer);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  create(@CurrentUser() user: any, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.salesService.update(user.tenantId, id, user.id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.remove(user.tenantId, id);
  }
}
