import {
  Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus, Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les factures' })
  @ApiQuery({ name: 'status', enum: InvoiceStatus, required: false })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto & { status?: InvoiceStatus }) {
    return this.invoicesService.findAll(user.tenantId, query);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Statistiques factures' })
  stats(@CurrentUser() user: JwtPayload) {
    return this.invoicesService.stats(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.invoicesService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Créer une facture' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: JwtPayload) {
    return this.invoicesService.create(dto, user.tenantId, user.sub);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: JwtPayload) {
    return this.invoicesService.update(id, dto, user.tenantId);
  }

  @Patch(':id/pay')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Marquer comme payée' })
  markPaid(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.invoicesService.markPaid(id, user.tenantId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger le PDF de la facture' })
  async pdf(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.invoicesService.generatePdf(id, user.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
