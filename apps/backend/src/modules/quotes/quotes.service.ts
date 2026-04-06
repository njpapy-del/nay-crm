import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService, PdfDocumentData } from '../../common/services/pdf.service';
import { buildPaginationMeta, PaginationDto } from '../../common/dto/pagination.dto';
import { CreateQuoteDto, QuoteLineDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const QUOTE_INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: { orderBy: { position: 'asc' as const } },
  invoice: { select: { id: true } },
};

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService, private pdfService: PdfService) {}

  async findAll(tenantId: string, query: PaginationDto) {
    const page = Math.max(1, parseInt(String(query.page ?? 1), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
    const skip = (page - 1) * limit;
    const where = { tenantId };

    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({ where, include: QUOTE_INCLUDE, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.quote.count({ where }),
    ]);
    return { data: quotes, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, tenantId: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, tenantId }, include: QUOTE_INCLUDE });
    if (!quote) throw new NotFoundException('Devis introuvable');
    return quote;
  }

  async create(dto: CreateQuoteDto, tenantId: string, userId: string) {
    const number = await this.generateNumber(tenantId, 'DEV');
    const totals = this.computeTotals(dto.lines);

    return this.prisma.quote.create({
      data: {
        tenantId, clientId: dto.clientId, createdById: userId,
        number, notes: dto.notes,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        ...totals,
        lines: {
          create: dto.lines.map((l, i) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate ?? 20,
            total: l.quantity * l.unitPrice,
            position: l.position ?? i,
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateQuoteDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const { lines, status, ...rest } = dto;
    const totals = lines ? this.computeTotals(lines) : {};

    return this.prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.quoteLine.deleteMany({ where: { quoteId: id } });
        await tx.quoteLine.createMany({
          data: lines.map((l, i) => ({
            quoteId: id, productId: l.productId,
            description: l.description, quantity: l.quantity,
            unitPrice: l.unitPrice, taxRate: l.taxRate ?? 20,
            total: l.quantity * l.unitPrice, position: l.position ?? i,
          })),
        });
      }
      return tx.quote.update({ where: { id }, data: { ...rest, status, ...totals }, include: QUOTE_INCLUDE });
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.quote.delete({ where: { id } });
    return { message: 'Devis supprimé' };
  }

  async convertToInvoice(id: string, tenantId: string, userId: string) {
    const quote = await this.findOne(id, tenantId);
    if (quote.invoice) throw new BadRequestException('Ce devis a déjà une facture');

    const number = await this.generateNumber(tenantId, 'FAC');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return this.prisma.invoice.create({
      data: {
        tenantId, clientId: quote.clientId, quoteId: id,
        createdById: userId, number,
        subtotal: quote.subtotal, taxAmount: quote.taxAmount, total: quote.total,
        dueDate, notes: quote.notes,
        lines: {
          create: quote.lines.map((l) => ({
            description: l.description, quantity: l.quantity,
            unitPrice: l.unitPrice, taxRate: l.taxRate,
            total: l.total, position: l.position,
          })),
        },
      },
      include: { client: true, lines: true },
    });
  }

  async generatePdf(id: string, tenantId: string): Promise<Buffer> {
    const quote = await this.findOne(id, tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    const data: PdfDocumentData = {
      type: 'DEVIS', number: quote.number, date: quote.createdAt,
      validUntil: quote.validUntil,
      clientName: `${quote.client.firstName} ${quote.client.lastName}`,
      clientCompany: quote.client.company, clientEmail: quote.client.email,
      clientPhone: quote.client.phone,
      notes: quote.notes,
      lines: quote.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, total: l.total })),
      subtotal: quote.subtotal, taxAmount: quote.taxAmount, total: quote.total,
      tenantName: tenant?.name ?? 'LNAYCRM',
    };

    return this.pdfService.generate(data);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private computeTotals(lines: QuoteLineDto[]) {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const taxAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice * ((l.taxRate ?? 20) / 100), 0);
    return { subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal + taxAmount).toFixed(2) };
  }

  private async generateNumber(tenantId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = prefix === 'DEV'
      ? await this.prisma.quote.count({ where: { tenantId } })
      : await this.prisma.invoice.count({ where: { tenantId } });
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
