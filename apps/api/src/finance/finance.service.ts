import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, WorkshopLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(orderId: string, dto: CreateInvoiceDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true, customerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.invoice.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        totalMinor: dto.totalMinor,
        note: dto.note?.trim(),
        createdById: userId,
      },
      include: { payments: true },
    });
  }

  async recordCustomerPayment(
    invoiceId: string,
    dto: CreateCustomerPaymentDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, deletedAt: null },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot pay a void invoice');
      }

      const alreadyPaid = invoice.payments.reduce(
        (sum, p) => sum + p.amountMinor,
        0,
      );
      const remaining = invoice.totalMinor - alreadyPaid;

      if (dto.amountMinor > remaining) {
        throw new BadRequestException(
          `Payment (${dto.amountMinor}) exceeds remaining balance (${remaining})`,
        );
      }

      const payment = await tx.customerPayment.create({
        data: {
          invoiceId,
          amountMinor: dto.amountMinor,
          method: dto.method?.trim(),
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      const newPaid = alreadyPaid + dto.amountMinor;
      const newStatus =
        newPaid >= invoice.totalMinor
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus, version: { increment: 1 } },
      });

      return {
        payment,
        invoice: {
          id: updatedInvoice.id,
          status: updatedInvoice.status,
          totalMinor: updatedInvoice.totalMinor,
          paidMinor: newPaid,
          remainingMinor: updatedInvoice.totalMinor - newPaid,
        },
      };
    });
  }

  async createExpense(dto: CreateExpenseDto, userId: string) {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, deletedAt: null },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Order not found');
    }

    return this.prisma.expense.create({
      data: {
        orderId: dto.orderId,
        category: dto.category.trim(),
        amountMinor: dto.amountMinor,
        note: dto.note?.trim(),
        createdById: userId,
      },
    });
  }

  async getOrderFinance(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const [invoices, orderMaterials, workshopCharges, expenses] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: {
            orderId,
            deletedAt: null,
            status: { not: InvoiceStatus.VOID },
          },
          include: { payments: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.orderMaterial.findMany({
          where: { orderId, deletedAt: null },
          include: { material: { select: { unitCostMinor: true } } },
        }),
        this.prisma.workshopLedgerEntry.aggregate({
          where: {
            type: WorkshopLedgerEntryType.CHARGE,
            batch: { orderId },
          },
          _sum: { amountMinor: true },
        }),
        this.prisma.expense.findMany({
          where: { orderId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const totalInvoicedMinor = invoices.reduce((s, i) => s + i.totalMinor, 0);
    const totalPaidMinor = invoices.reduce(
      (s, i) => s + i.payments.reduce((ps, p) => ps + p.amountMinor, 0),
      0,
    );
    const customerBalanceDueMinor = totalInvoicedMinor - totalPaidMinor;

    const materialCostMinor = orderMaterials.reduce((sum, om) => {
      const unitCost = om.material?.unitCostMinor ?? 0;
      return sum + Math.round(Number(om.quantity) * unitCost);
    }, 0);

    const workshopCostMinor = workshopCharges._sum.amountMinor ?? 0;
    const otherExpensesMinor = expenses.reduce((s, e) => s + e.amountMinor, 0);
    const totalCostMinor =
      materialCostMinor + workshopCostMinor + otherExpensesMinor;

    const profitMinor = totalInvoicedMinor - totalCostMinor;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      revenue: {
        totalInvoicedMinor,
        totalPaidMinor,
        customerBalanceDueMinor,
      },
      costs: {
        materialCostMinor,
        workshopCostMinor,
        otherExpensesMinor,
        totalCostMinor,
      },
      profitMinor,
      invoices,
      expenses,
    };
  }
}
