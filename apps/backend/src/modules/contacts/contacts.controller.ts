import {
  Controller, Get, Patch, Delete, Post, Body, Param, Query,
  UseGuards, Res, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ContactsService } from './contacts.service';
import { UpdateContactDto, FilterContactsDto, BulkStatusDto, CheckBlacklistDto } from './dto/contact.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get('list/:listId')
  findAll(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Query() filters: FilterContactsDto,
  ) {
    return this.service.findAll(user.tenantId, listId, filters);
  }

  @Get('list/:listId/export')
  async exportCsv(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Query() filters: FilterContactsDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(user.tenantId, listId, filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${listId}.csv"`);
    res.status(HttpStatus.OK).send('\uFEFF' + csv);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post('bulk-status')
  @Roles('ADMIN', 'MANAGER')
  bulkUpdateStatus(@CurrentUser() user: any, @Body() dto: BulkStatusDto) {
    return this.service.bulkUpdateStatus(user.tenantId, dto);
  }

  @Post('check-blacklist')
  checkBlacklist(@CurrentUser() user: any, @Body() dto: CheckBlacklistDto) {
    return this.service.isBlacklisted(user.tenantId, dto.phone, dto.campaignId)
      .then((blacklisted) => ({ blacklisted, phone: dto.phone }));
  }
}
