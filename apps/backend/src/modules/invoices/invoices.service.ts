import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService, PdfDocumentData } from '../../common/services/pdf.service';
import { buildPaginationMeta, PaginationDto } from '../../common/dto/pagination.dto';
import { CreateInvoiceDto, InvoiceLineDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const INVOICE_INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lines: { orderBy: { position: 'asc' as const } },
  quote: { select: { id: true, number: true } },
};

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService, private pdfService: PdfService) {}

  async findAll(tenantId: string, query: PaginationDto & { status?: InvoiceStatus }) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;
    const where = { tenantId, ...(status && { status }) };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: INVOICE_INCLUDE, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: invoices, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    return invoice;
  }

  async create(dto: CreateInvoiceDto, tenantId: string, userId: string) {
    const number = await this.generateNumber(tenantId);
    const totals = this.computeTotals(dto.lines);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : this.defaultDueDate();

    return this.prisma.invoice.create({
      data: {
        tenantId, clientId: dto.clientId, createdById: userId,
        number, notes: dto.notes, dueDate, ...totals,
        lines: {
          create: dto.lines.map((l, i) => ({
            description: l.description, quantity: l.quantity,
            unitPrice: l.unitPrice, taxRate: l.taxRate ?? 20,
            total: l.quantity * l.unitPrice, position: l.position ?? i,
          })),
        },
      },
      include: INVOICE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateInvoiceDto, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);
    const { lines, status, ...rest } = dto;
    const totals = lines ? this.computeTotals(lines) : {};
    const paidAt = status === InvoiceStatus.PAID && !invoice.paidAt ? new Date() : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: lines.map((l, i) => ({
            invoiceId: id, description: l.description, quantity: l.quantity,
            unitPrice: l.unitPrice, taxRate: l.taxRate ?? 20,
            total: l.quantity * l.unitPrice, position: l.position ?? i,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data: { ...rest, status, ...totals, ...(paidAt && { paidAt }) },
        include: INVOICE_INCLUDE,
      });
    });
  }

  async markPaid(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      include: INVOICE_INCLUDE,
    });
  }

  async stats(tenantId: string) {
    const [byStatus, totalAmount] = await Promise.all([
      this.prisma.invoice.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true } }),
    ]);
    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all, amount: s._sum.total ?? 0 })),
      totalRevenue: totalAmount._sum.total ?? 0,
    };
  }

  async generatePdf(id: string, tenantId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    const data: PdfDocumentData = {
      type: 'FACTURE', number: invoice.number, date: invoice.createdAt,
      dueDate: invoice.dueDate,
      clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
      clientCompany: invoice.client.company, clientEmail: invoice.client.email,
      clientPhone: invoice.client.phone,
      notes: invoice.notes,
      lines: invoice.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, total: l.total })),
      subtotal: invoice.subtotal, taxAmount: invoice.taxAmount, total: invoice.total,
      tenantName: tenant?.name ?? 'LNAYCRM',
    };

    return this.pdfService.generate(data);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private computeTotals(lines: InvoiceLineDto[]) {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const taxAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice * ((l.taxRate ?? 20) / 100), 0);
    return { subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal + taxAmount).toFixed(2) };
  }

  private async generateNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    return `FAC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private defaultDueDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }
}
