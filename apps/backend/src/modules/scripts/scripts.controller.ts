import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ScriptsService } from './scripts.service';
import { ScriptFieldsService } from './script-fields.service';
import { ScriptResponsesService } from './script-responses.service';
import {
  CreateScriptDto, UpdateScriptDto,
  CreateFieldDto, UpdateFieldDto, ReorderFieldsDto,
  SaveResponseDto,
} from './scripts.dto';

@UseGuards(JwtAuthGuard)
@Controller('scripts')
export class ScriptsController {
  constructor(
    private readonly scripts: ScriptsService,
    private readonly fields: ScriptFieldsService,
    private readonly responses: ScriptResponsesService,
  ) {}

  // ── Scripts ────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Req() req: any, @Query() q: any) {
    return this.scripts.findAll(req.tenantId, q);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.scripts.findOne(req.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateScriptDto) {
    return this.scripts.create(req.tenantId, req.user.id, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateScriptDto) {
    return this.scripts.update(req.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.scripts.remove(req.tenantId, id);
  }

  @Get(':id/export')
  async exportCsv(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const csv = await this.scripts.exportCsv(req.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="script_${id}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  }

  // ── Fields ─────────────────────────────────────────────────────────────────

  @Get(':scriptId/fields')
  getFields(@Req() req: any, @Param('scriptId') scriptId: string) {
    return this.fields.findAll(req.tenantId, scriptId);
  }

  @Post(':scriptId/fields')
  addField(@Req() req: any, @Param('scriptId') scriptId: string, @Body() dto: CreateFieldDto) {
    return this.fields.create(req.tenantId, scriptId, dto);
  }

  @Patch(':scriptId/fields/reorder')
  reorderFields(@Req() req: any, @Param('scriptId') scriptId: string, @Body() dto: ReorderFieldsDto) {
    return this.fields.reorder(req.tenantId, scriptId, dto);
  }

  @Patch(':scriptId/fields/:fieldId')
  updateField(
    @Req() req: any,
    @Param('scriptId') scriptId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.fields.update(req.tenantId, scriptId, fieldId, dto);
  }

  @Delete(':scriptId/fields/:fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteField(
    @Req() req: any,
    @Param('scriptId') scriptId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.fields.remove(req.tenantId, scriptId, fieldId);
  }

  // ── Responses ──────────────────────────────────────────────────────────────

  @Post(':scriptId/responses')
  saveResponse(@Req() req: any, @Param('scriptId') scriptId: string, @Body() dto: SaveResponseDto) {
    return this.responses.save(req.tenantId, scriptId, req.user.id, dto);
  }

  @Get(':scriptId/responses')
  getHistory(@Req() req: any, @Param('scriptId') scriptId: string, @Query() q: any) {
    return this.responses.getHistory(req.tenantId, scriptId, q);
  }

  @Get(':scriptId/responses/call/:callId')
  getActiveForCall(@Req() req: any, @Param('scriptId') scriptId: string, @Param('callId') callId: string) {
    return this.responses.getActiveForCall(req.tenantId, callId, scriptId);
  }

  @Get(':scriptId/responses/:responseId')
  getResponse(@Req() req: any, @Param('responseId') responseId: string) {
    return this.responses.findOne(req.tenantId, responseId);
  }
}
