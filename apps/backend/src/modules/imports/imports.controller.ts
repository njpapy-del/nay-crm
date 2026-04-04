import {
  Controller, Post, Get, Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportsService } from './imports.service';
import { ColumnMapDto, PreviewImportDto, FilterHistoryDto } from './dto/import.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const csvUpload = () =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype.includes('csv') || file.originalname.endsWith('.csv'));
    },
  });

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  /** Step 1bis : retourner les headers du CSV uploadé */
  @Post('headers')
  @UseInterceptors(csvUpload())
  getHeaders(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier requis');
    return { headers: this.service.getHeaders(file.buffer) };
  }

  /** Step 3 : preview avant import */
  @Post('preview/:listId')
  @UseInterceptors(csvUpload())
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Param('listId') listId: string,
    @Body() dto: PreviewImportDto,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    return { rows: this.service.previewRows(file.buffer, dto.columnMap, dto.maxRows) };
  }

  /** Step 5 : import final */
  @Post('list/:listId')
  @UseInterceptors(csvUpload())
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Param('listId') listId: string,
    @Body('columnMap') columnMapRaw: string,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    let columnMap: ColumnMapDto;
    try {
      columnMap = JSON.parse(columnMapRaw);
    } catch {
      throw new BadRequestException('columnMap JSON invalide');
    }
    return this.service.importCsv(
      user.tenantId, user.id, listId,
      file.buffer, file.originalname, columnMap,
    );
  }

  @Get('history')
  getHistory(@CurrentUser() user: any, @Query() filters: FilterHistoryDto) {
    return this.service.getHistory(user.tenantId, filters);
  }

  @Get(':id')
  getImport(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getImport(user.tenantId, id);
  }
}
