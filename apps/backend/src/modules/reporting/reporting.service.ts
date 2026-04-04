import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KpiService } from '../kpi/kpi.service';
import * as ExcelJS from 'exceljs';

export interface ReportConfig {
  dateFrom: string;
  dateTo: string;
  agentId?: string;
  campaignId?: string;
  metrics: string[];
  groupBy?: string;
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiService: KpiService,
  ) {}

  // ─── Rapports sauvegardés ─────────────────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.report.findMany({
      where: { tenantId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async save(tenantId: string, userId: string, name: string, config: ReportConfig, description?: string) {
    return this.prisma.report.create({
      data: { tenantId, createdById: userId, name, description, config: config as any },
    });
  }

  async update(tenantId: string, id: string, data: { name?: string; config?: ReportConfig }) {
    return this.prisma.report.updateMany({ where: { id, tenantId }, data: data as any });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.report.deleteMany({ where: { id, tenantId } });
  }

  // ─── Exécuter un rapport ──────────────────────────────────────────────────

  async run(tenantId: string, config: ReportConfig) {
    const { dateFrom, dateTo, agentId, campaignId, metrics, groupBy } = config;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (groupBy === 'agent') {
      return this.kpiService.byAgent(tenantId, from, to, campaignId);
    }

    if (groupBy === 'campaign') {
      const campaigns = await this.prisma.campaign.findMany({
        where: { tenantId }, select: { id: true, name: true },
      });
      return Promise.all(campaigns.map(async (c) => ({
        campaign: c,
        kpi: await this.kpiService.compute({ tenantId, campaignId: c.id, dateFrom: from, dateTo: to }),
      })));
    }

    const kpi = await this.kpiService.compute({ tenantId, agentId, campaignId, dateFrom: from, dateTo: to });
    return this._pickMetrics(kpi, metrics);
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────

  async exportCsv(tenantId: string, config: ReportConfig): Promise<Buffer> {
    const data = await this.run(tenantId, config);
    const rows = Array.isArray(data) ? data : [data];
    const headers = Object.keys(rows[0] ?? {});
    const lines = [
      headers.join(';'),
      ...rows.map((r: any) => headers.map((h) => String(r[h] ?? '')).join(';')),
    ];
    return Buffer.from('\ufeff' + lines.join('\n'), 'utf8');
  }

  // ─── Export Excel (XLSX) ──────────────────────────────────────────────────

  async exportXlsx(tenantId: string, config: ReportConfig, reportName = 'Rapport'): Promise<Buffer> {
    const data = await this.run(tenantId, config);
    const rows = Array.isArray(data) ? data : [data];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'LNAYCRM';
    const ws = wb.addWorksheet(reportName.substring(0, 31));

    // En-tête stylisé
    const headers = Object.keys(rows[0] ?? {});
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    ws.getRow(1).alignment = { horizontal: 'center' };

    rows.forEach((r: any) => {
      ws.addRow(headers.map((h) => {
        const v = r[h];
        return typeof v === 'number' ? +v.toFixed(2) : v;
      }));
    });

    ws.columns.forEach((col) => { col.width = 18; });

    // Metadata
    const meta = wb.addWorksheet('Métadonnées');
    meta.addRow(['Rapport', reportName]);
    meta.addRow(['Généré le', new Date().toLocaleString('fr-FR')]);
    meta.addRow(['Période', `${config.dateFrom} → ${config.dateTo}`]);

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  // ─── Résumé rapide pour dashboard ─────────────────────────────────────────

  async getDashboardSummary(tenantId: string) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const now = new Date();

    const [today, month] = await Promise.all([
      this.kpiService.compute({ tenantId, dateFrom: todayStart, dateTo: now }),
      this.kpiService.compute({ tenantId, dateFrom: monthStart, dateTo: now }),
    ]);
    return { today, month };
  }

  // ─── Privé ────────────────────────────────────────────────────────────────

  private _pickMetrics(kpi: Record<string, any>, metrics: string[]): Record<string, any> {
    if (!metrics || metrics.length === 0) return kpi;
    const result: Record<string, any> = {};
    metrics.forEach((m) => { if (m in kpi) result[m] = kpi[m]; });
    return result;
  }
}
