import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStepStatus,
  OrderStepType,
  WorkshopLedgerEntryType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findUnmetDependencies } from '../orders/order-step-rules';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { ReceiveBatchDto } from './dto/receive-batch.dto';
import { CreateWorkshopPaymentDto } from './dto/create-payment.dto';

@Injectable()
export class WorkshopsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWorkshopDto, userId: string) {
    return this.prisma.workshop.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        address: dto.address?.trim(),
        note: dto.note?.trim(),
        createdById: userId,
      },
    });
  }

  async findAll(search?: string) {
    const workshops = await this.prisma.workshop.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (workshops.length === 0) return [];

    const sums = await this.prisma.workshopLedgerEntry.groupBy({
      by: ['workshopId'],
      where: { workshopId: { in: workshops.map((w) => w.id) } },
      _sum: { amountMinor: true },
    });
    const balanceMap = new Map(
      sums.map((s) => [s.workshopId, s._sum.amountMinor ?? 0]),
    );

    return workshops.map((w) => ({
      ...w,
      balanceMinor: balanceMap.get(w.id) ?? 0,
    }));
  }

  async findOne(id: string) {
    const workshop = await this.prisma.workshop.findFirst({
      where: { id, deletedAt: null },
      include: {
        ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 50 },
        batches: {
          orderBy: { createdAt: 'desc' },
          include: {
            order: { select: { id: true, orderNumber: true, title: true } },
            orderLine: { select: { id: true, color: true, size: true } },
            receipts: true,
          },
        },
      },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const agg = await this.prisma.workshopLedgerEntry.aggregate({
      where: { workshopId: id },
      _sum: { amountMinor: true },
    });

    return {
      ...workshop,
      balanceMinor: agg._sum.amountMinor ?? 0,
      batches: workshop.batches.map((b) => {
        const receivedQty = b.receipts.reduce((sum, r) => sum + r.quantity, 0);
        return {
          ...b,
          receivedQty,
          remainingQty: Math.max(0, b.sentQty - receivedQty),
        };
      }),
    };
  }

  async createBatch(orderId: string, dto: CreateBatchDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.WORKSHOP,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot send to workshop; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const [line, workshop] = await Promise.all([
        tx.orderLine.findFirst({
          where: { id: dto.orderLineId, orderId },
        }),
        tx.workshop.findFirst({
          where: { id: dto.workshopId, deletedAt: null },
        }),
      ]);
      if (!line) throw new NotFoundException('Order line not found on order');
      if (!workshop) throw new NotFoundException('Workshop not found');

      const [cutAgg, sentAgg] = await Promise.all([
        tx.cuttingRecord.aggregate({
          where: { orderLineId: dto.orderLineId },
          _sum: { quantity: true },
        }),
        tx.workshopBatch.aggregate({
          where: { orderLineId: dto.orderLineId },
          _sum: { sentQty: true },
        }),
      ]);

      const totalCut = cutAgg._sum.quantity ?? 0;
      const alreadySent = sentAgg._sum.sentQty ?? 0;
      const availableToSend = totalCut - alreadySent;

      if (dto.sentQty > availableToSend) {
        throw new BadRequestException(
          `Cannot send ${dto.sentQty} pieces. Only ${availableToSend} cut pieces available to send.`,
        );
      }

      const batch = await tx.workshopBatch.create({
        data: {
          orderId,
          orderLineId: dto.orderLineId,
          workshopId: dto.workshopId,
          sentQty: dto.sentQty,
          ratePerPieceMinor: dto.ratePerPieceMinor,
          note: dto.note?.trim(),
          createdById: userId,
        },
        include: {
          workshop: { select: { id: true, name: true } },
          orderLine: { select: { id: true, color: true, size: true } },
        },
      });

      const workshopStep = order.steps.find(
        (s) => s.type === OrderStepType.WORKSHOP,
      );
      if (workshopStep && workshopStep.status === OrderStepStatus.NOT_STARTED) {
        await tx.orderStep.update({
          where: { id: workshopStep.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }

      return { ...batch, receivedQty: 0, remainingQty: batch.sentQty };
    });
  }

  async listOrderBatches(orderId: string) {
    const batches = await this.prisma.workshopBatch.findMany({
      where: { orderId },
      include: {
        workshop: { select: { id: true, name: true } },
        orderLine: { select: { id: true, color: true, size: true } },
        receipts: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches.map((b) => {
      const receivedQty = b.receipts.reduce((sum, r) => sum + r.quantity, 0);
      return {
        ...b,
        receivedQty,
        remainingQty: Math.max(0, b.sentQty - receivedQty),
      };
    });
  }

  async receiveFromBatch(
    batchId: string,
    dto: ReceiveBatchDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.workshopBatch.findUnique({
        where: { id: batchId },
        include: { receipts: true },
      });
      if (!batch) throw new NotFoundException('Workshop batch not found');

      const alreadyReceived = batch.receipts.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );
      const remaining = batch.sentQty - alreadyReceived;

      if (dto.quantity > remaining) {
        throw new BadRequestException(
          `Cannot receive ${dto.quantity} pieces. Only ${remaining} remaining in this batch.`,
        );
      }

      const receipt = await tx.workshopBatchReceipt.create({
        data: {
          batchId,
          quantity: dto.quantity,
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      const chargeMinor = dto.quantity * batch.ratePerPieceMinor;
      let ledgerEntry = null;
      if (chargeMinor > 0) {
        ledgerEntry = await tx.workshopLedgerEntry.create({
          data: {
            workshopId: batch.workshopId,
            type: WorkshopLedgerEntryType.CHARGE,
            amountMinor: chargeMinor,
            batchId: batch.id,
            note:
              dto.note?.trim() ??
              `Received ${dto.quantity} pcs @ ${batch.ratePerPieceMinor}`,
            createdById: userId,
          },
        });
      }

      const newReceived = alreadyReceived + dto.quantity;
      return {
        receipt,
        ledgerEntry,
        batchSummary: {
          batchId: batch.id,
          sentQty: batch.sentQty,
          receivedQty: newReceived,
          remainingQty: batch.sentQty - newReceived,
        },
      };
    });
  }

  async recordPayment(
    workshopId: string,
    dto: CreateWorkshopPaymentDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workshop = await tx.workshop.findFirst({
        where: { id: workshopId, deletedAt: null },
        select: { id: true },
      });
      if (!workshop) throw new NotFoundException('Workshop not found');

      const entry = await tx.workshopLedgerEntry.create({
        data: {
          workshopId,
          type: WorkshopLedgerEntryType.PAYMENT,
          amountMinor: -dto.amountMinor,
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      const agg = await tx.workshopLedgerEntry.aggregate({
        where: { workshopId },
        _sum: { amountMinor: true },
      });

      return {
        entry,
        balanceMinor: agg._sum.amountMinor ?? 0,
      };
    });
  }
}
