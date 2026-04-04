import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UploadedFile, UseInterceptors, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findAll(
    @CurrentUser() user: any,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      campaignId,
      status,
      limit: limit ? +limit : 50,
      skip: skip ? +skip : 0,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@CurrentUser() user: any, @Body() dto: CreateLeadDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @CurrentUser() user: any,
    @Query('campaignId') campaignId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.importCsv(user.tenantId, campaignId, file.buffer);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
