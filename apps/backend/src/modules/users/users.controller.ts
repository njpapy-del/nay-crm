import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Lister les utilisateurs du tenant' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.usersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Détail utilisateur' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user.tenantId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.remove(id, user.tenantId);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Changer son mot de passe' })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.sub, dto);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe d\'un utilisateur' })
  resetPassword(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body('password') password: string) {
    return this.usersService.resetPassword(id, user.tenantId, password ?? 'Temp1234!');
  }

  @Patch(':id/toggle-active')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activer/désactiver un utilisateur' })
  toggleActive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.toggleActive(id, user.tenantId);
  }

  @Get('agents/list')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Liste des agents actifs' })
  getAgents(@CurrentUser() user: JwtPayload) {
    return this.usersService.getAgents(user.tenantId);
  }

  @Get(':id/activity')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Historique activité agent' })
  getActivity(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.getActivityHistory(id, user.tenantId);
  }
}
