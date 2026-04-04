import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
  Res, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BlacklistService } from './blacklist.service';
import {
  CreateBlacklistDto, AddEntryDto, BulkAddEntriesDto, FilterBlacklistDto,
} from './dto/blacklist.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('blacklist')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlacklistController {
  constructor(private readonly service: BlacklistService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@CurrentUser() user: any, @Body() dto: CreateBlacklistDto) {
    return this.service.create(user.tenantId, user.id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  // ── Entrées ───────────────────────────────────────────

  @Get(':id/entries')
  getEntries(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query() filters: FilterBlacklistDto,
  ) {
    return this.service.getEntries(user.tenantId, id, filters);
  }

  @Post(':id/entries')
  @Roles('ADMIN', 'MANAGER')
  addEntry(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddEntryDto) {
    return this.service.addEntry(user.tenantId, id, user.id, dto);
  }

  @Post(':id/entries/bulk')
  @Roles('ADMIN', 'MANAGER')
  bulkAdd(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: BulkAddEntriesDto) {
    return this.service.bulkAddEntries(user.tenantId, id, user.id, dto);
  }

  @Post(':id/entries/import')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5_000_000 } }))
  async importCsv(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('phoneColumn') phoneColumn?: string,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    return this.service.importCsv(user.tenantId, id, user.id, file.buffer, phoneColumn);
  }

  @Delete('entries/:entryId')
  @Roles('ADMIN', 'MANAGER')
  removeEntry(@CurrentUser() user: any, @Param('entryId') entryId: string) {
    return this.service.removeEntry(user.tenantId, entryId);
  }

  @Get(':id/export')
  async exportCsv(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(user.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="blacklist-${id}.csv"`);
    res.status(HttpStatus.OK).send('\uFEFF' + csv);
  }

  @Post('check')
  checkPhone(
    @CurrentUser() user: any,
    @Body('phone') phone: string,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.service.checkPhone(user.tenantId, phone, campaignId);
  }
}
