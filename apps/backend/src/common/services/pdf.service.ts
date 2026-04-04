import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface PdfDocumentData {
  type: 'DEVIS' | 'FACTURE';
  number: string;
  date: Date;
  validUntil?: Date | null;
  dueDate?: Date | null;
  clientName: string;
  clientCompany?: string | null;
  clientEmail?: string | null;
  clientPhone?: string;
  notes?: string | null;
  lines: PdfLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  tenantName: string;
}

@Injectable()
export class PdfService {
  async generate(data: PdfDocumentData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, data);
      this.renderAddresses(doc, data);
      this.renderDates(doc, data);
      this.renderLinesTable(doc, data.lines);
      this.renderTotals(doc, data);
      if (data.notes) this.renderNotes(doc, data.notes);
      this.renderFooter(doc, data.tenantName);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1d4ed8')
      .text(data.tenantName, 50, 50);

    doc.fontSize(18).fillColor('#111827')
      .text(`${data.type} N° ${data.number}`, 50, 85);

    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);
  }

  private renderAddresses(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text('CLIENT', 50, 130);
    doc.font('Helvetica').fillColor('#111827');
    doc.text(`${data.clientName}`, 50, 145);
    if (data.clientCompany) doc.text(data.clientCompany);
    if (data.clientEmail) doc.text(data.clientEmail);
    if (data.clientPhone) doc.text(data.clientPhone);
  }

  private renderDates(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR');
    const x = 350;
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text('DATE', x, 130);
    doc.font('Helvetica').fillColor('#111827').text(fmt(data.date), x, 145);

    if (data.validUntil) {
      doc.fillColor('#6b7280').font('Helvetica-Bold').text('VALIDE JUSQU\'AU', x, 165);
      doc.font('Helvetica').fillColor('#111827').text(fmt(data.validUntil), x, 180);
    }
    if (data.dueDate) {
      doc.fillColor('#6b7280').font('Helvetica-Bold').text('ÉCHÉANCE', x, 165);
      doc.font('Helvetica').fillColor('#ef4444').text(fmt(data.dueDate), x, 180);
    }
  }

  private renderLinesTable(doc: PDFKit.PDFDocument, lines: PdfLine[]) {
    const top = 230;
    const cols = { desc: 50, qty: 290, price: 355, tax: 420, total: 480 };

    // En-tête tableau
    doc.rect(50, top, 495, 22).fill('#f3f4f6');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
    doc.text('DÉSIGNATION', cols.desc + 4, top + 7);
    doc.text('QTÉ', cols.qty, top + 7);
    doc.text('P.U. HT', cols.price, top + 7);
    doc.text('TVA', cols.tax, top + 7);
    doc.text('TOTAL HT', cols.total, top + 7);

    // Lignes
    let y = top + 28;
    doc.font('Helvetica').fillColor('#111827');

    for (const line of lines) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fontSize(8);
      doc.text(line.description, cols.desc + 4, y, { width: 230 });
      doc.text(String(line.quantity), cols.qty, y);
      doc.text(this.fmt(line.unitPrice), cols.price, y);
      doc.text(`${line.taxRate}%`, cols.tax, y);
      doc.text(this.fmt(line.total), cols.total, y);
      doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor('#f3f4f6').stroke();
      y += 20;
    }

    doc.moveDown();
  }

  private renderTotals(doc: PDFKit.PDFDocument, data: PdfDocumentData) {
    const x = 370;
    let y = doc.y + 10;

    const row = (label: string, value: string, bold = false) => {
      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(bold ? '#1d4ed8' : '#374151')
        .text(label, x, y).text(value, x + 110, y, { align: 'right', width: 65 });
      y += 16;
    };

    row('Sous-total HT', this.fmt(data.subtotal));
    row('TVA', this.fmt(data.taxAmount));
    doc.moveTo(x, y).lineTo(x + 175, y).strokeColor('#d1d5db').stroke();
    y += 6;
    row('TOTAL TTC', this.fmt(data.total), true);
  }

  private renderNotes(doc: PDFKit.PDFDocument, notes: string) {
    doc.moveDown(1.5).fontSize(8).fillColor('#6b7280')
      .font('Helvetica-Bold').text('NOTES')
      .font('Helvetica').fillColor('#374151').text(notes);
  }

  private renderFooter(doc: PDFKit.PDFDocument, tenantName: string) {
    doc.fontSize(7).fillColor('#9ca3af')
      .text(`Document généré par ${tenantName} — LNAYCRM`, 50, 780, { align: 'center', width: 495 });
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  }
}
