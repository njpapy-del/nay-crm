import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Res, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ContactListService } from './contact-list.service';
import { CreateListDto, UpdateListDto, FilterListsDto } from './dto/list.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('lists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactListController {
  constructor(private readonly service: ContactListService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() filters: FilterListsDto) {
    return this.service.findAll(user.tenantId, filters);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Get(':id/stats')
  getStats(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getStats(user.tenantId, id);
  }

  @Get(':id/export')
  async exportCsv(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(user.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="list-${id}.csv"`);
    res.status(HttpStatus.OK).send('\uFEFF' + csv);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@CurrentUser() user: any, @Body() dto: CreateListDto) {
    return this.service.create(user.tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
