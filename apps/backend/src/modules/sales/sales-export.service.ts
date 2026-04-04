import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel } from 'docx';

type SaleRow = {
  id: string;
  createdAt: Date | string;
  agent: { firstName: string; lastName: string } | null;
  client: { firstName: string; lastName: string; company?: string | null } | null;
  campaign: { name: string } | null;
  status: string;
  amount: string | number | object;
  qualification: string;
  notes: string | null;
  call: { recording: { filePath: string } | null } | null;
};

@Injectable()
export class SalesExportService {

  // ── Excel ─────────────────────────────────────────────────

  toXlsx(sales: SaleRow[]): Buffer {
    const rows = sales.map((s) => ({
      'ID':              s.id,
      'Date':            new Date(s.createdAt).toLocaleDateString('fr-FR'),
      'Agent':           s.agent ? `${s.agent.firstName} ${s.agent.lastName}` : '—',
      'Client':          s.client ? `${s.client.firstName} ${s.client.lastName}` : '—',
      'Société':         s.client?.company ?? '—',
      'Campagne':        s.campaign?.name ?? '—',
      'Statut':          s.status,
      'Montant (€)':     parseFloat(String(s.amount)).toFixed(2),
      'Qualification':   s.qualification,
      'Notes':           s.notes ?? '',
      'Enregistrement':  s.call?.recording?.filePath ?? '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
      { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      { wch: 16 }, { wch: 30 }, { wch: 50 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ── Word ──────────────────────────────────────────────────

  async toDocx(sales: SaleRow[]): Promise<Buffer> {
    const headerRow = new TableRow({
      children: ['Date', 'Agent', 'Client', 'Campagne', 'Statut', 'Montant', 'Enregistrement'].map(
        (text) => new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        }),
      ),
    });

    const dataRows = sales.map(
      (s) =>
        new TableRow({
          children: [
            new Date(s.createdAt).toLocaleDateString('fr-FR'),
            s.agent ? `${s.agent.firstName} ${s.agent.lastName}` : '—',
            s.client ? `${s.client.firstName} ${s.client.lastName}` : '—',
            s.campaign?.name ?? '—',
            s.status,
            `${parseFloat(String(s.amount)).toFixed(2)} €`,
            s.call?.recording?.filePath ?? '—',
          ].map(
            (text) => new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text })] })],
            }),
          ),
        }),
    );

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: `Rapport des ventes — ${new Date().toLocaleDateString('fr-FR')}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: `Total : ${sales.length} vente(s)`, spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      }],
    });

    return Packer.toBuffer(doc);
  }
}
