import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@ApiTags('Quotes')
@ApiBearerAuth()
@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les devis' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.quotesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.quotesService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Créer un devis' })
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: JwtPayload) {
    return this.quotesService.create(dto, user.tenantId, user.sub);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto, @CurrentUser() user: JwtPayload) {
    return this.quotesService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.quotesService.remove(id, user.tenantId);
  }

  @Post(':id/convert')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Convertir devis → facture' })
  convert(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.quotesService.convertToInvoice(id, user.tenantId, user.sub);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger le PDF du devis' })
  async pdf(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.quotesService.generatePdf(id, user.tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="devis-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
