import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class SendMessageDto {
  @IsString() message: string;
}

class CreateReminderDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsString() clientId?: string;
}

class SnoozeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) minutes?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private chatbot: ChatbotService,
    private reminders: RemindersService,
  ) {}

  // ── Chat ─────────────────────────────────────────────────────────────

  @Post('message')
  async message(@CurrentUser() u: JwtPayload, @Body() dto: SendMessageDto) {
    return this.chatbot.sendMessage(
      { userId: u.sub, tenantId: u.tenantId, firstName: u.email.split('@')[0], role: u.role },
      dto.message,
    );
  }

  @Get('history')
  history(@CurrentUser() u: JwtPayload, @Query('limit') limit?: string) {
    return this.chatbot.getHistory(u.sub, u.tenantId, limit ? +limit : 50);
  }

  @Delete('history')
  clearHistory(@CurrentUser() u: JwtPayload) {
    return this.chatbot.clearHistory(u.sub, u.tenantId);
  }

  @Get('summary')
  summary(@CurrentUser() u: JwtPayload) {
    return this.chatbot.getDailySummary({
      userId: u.sub, tenantId: u.tenantId,
      firstName: u.email.split('@')[0], role: u.role,
    });
  }

  // ── Alertes qualité ───────────────────────────────────────────────────

  @Get('alerts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'QUALITY', 'AGENT')
  alerts(@CurrentUser() u: JwtPayload) {
    return this.chatbot.getQualityAlerts(u.tenantId);
  }

  // ── Rappels ───────────────────────────────────────────────────────────

  @Get('reminders')
  myReminders(@CurrentUser() u: JwtPayload, @Query('pending') pending?: string) {
    return this.reminders.findMine(u.sub, u.tenantId, pending === '1' || pending === 'true');
  }

  @Get('reminders/due')
  dueReminders(@CurrentUser() u: JwtPayload) {
    return this.reminders.findDueNow(u.sub, u.tenantId);
  }

  @Post('reminders')
  createReminder(@CurrentUser() u: JwtPayload, @Body() dto: CreateReminderDto) {
    return this.reminders.create({
      tenantId: u.tenantId,
      userId: u.sub,
      clientId: dto.clientId,
      title: dto.title,
      description: dto.description,
      dueAt: new Date(dto.dueAt),
    });
  }

  @Patch('reminders/:id/done')
  markDone(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.reminders.markDone(id, u.sub);
  }

  @Patch('reminders/:id/snooze')
  snooze(@Param('id') id: string, @CurrentUser() u: JwtPayload, @Body() dto: SnoozeDto) {
    return this.reminders.snooze(id, u.sub, dto.minutes ?? 30);
  }

  @Delete('reminders/:id')
  deleteReminder(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.reminders.delete(id, u.sub);
  }

  // ── Stats overdue (manager/admin) ──────────────────────────────────────
  @Get('reminders/overdue-stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  overdueStats(@CurrentUser() u: JwtPayload) {
    return this.reminders.getOverdueStats(u.tenantId);
  }
}
