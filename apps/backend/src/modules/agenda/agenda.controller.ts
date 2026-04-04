import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgendaService } from './agenda.service';
import { UpsertAppointmentDto } from './dto/upsert-appointment.dto';
import { FilterAppointmentDto } from './dto/filter-appointment.dto';

@Controller('agenda')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findAll(@CurrentUser() user: any, @Query() dto: FilterAppointmentDto) {
    return this.agendaService.findAll(user.tenantId, dto);
  }

  @Get('workload')
  @Roles('ADMIN', 'MANAGER')
  workload(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string) {
    return this.agendaService.agentWorkload(user.tenantId, from, to);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.agendaService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  create(@CurrentUser() user: any, @Body() dto: UpsertAppointmentDto) {
    return this.agendaService.create(user.tenantId, dto);
  }

  @Post(':id/dispatch')
  @Roles('ADMIN', 'MANAGER')
  dispatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.agendaService.dispatch(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<UpsertAppointmentDto>) {
    return this.agendaService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.agendaService.remove(user.tenantId, id);
  }
}
