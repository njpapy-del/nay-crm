import {
  Body, Controller, Delete, Get, Param,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { InternalChatService } from './internal-chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('internal-chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternalChatController {
  constructor(private readonly service: InternalChatService) {}

  // ─── Channels ──────────────────────────────────────────────────────────────

  @Get('channels')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  async getChannels(@CurrentUser() user: any) {
    // Auto-créer le canal général si absent
    await this.service.getOrCreateDefaultChannel(user.tenantId, user.id);
    return this.service.getChannels(user.tenantId);
  }

  @Post('channels')
  @Roles('ADMIN', 'MANAGER')
  createChannel(
    @CurrentUser() user: any,
    @Body('name') name: string,
    @Body('description') description?: string,
  ) {
    return this.service.createChannel(user.tenantId, user.id, name, description);
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  @Get('channels/:channelId/messages')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  getMessages(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.service.getMessages(user.tenantId, channelId, +(limit ?? 50), before);
  }

  @Post('channels/:channelId/messages')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  sendMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body('content') content: string,
  ) {
    return this.service.sendMessage(user.tenantId, channelId, user.id, content);
  }

  @Delete('messages/:messageId')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  deleteMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
    @Query('channelId') channelId: string,
  ) {
    const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
    return this.service.deleteMessage(user.tenantId, messageId, user.id, isAdmin);
  }
}
