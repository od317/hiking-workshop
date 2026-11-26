import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStepStatus,
  OrderStepType,
  ReturnDisposition,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findUnmetDependencies } from '../orders/order-step-rules';
import { RecordFinishingDto } from './dto/record-finishing.dto';
import { RecordQualityCheckDto } from './dto/record-qc.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreateReturnDto } from './dto/create-return.dto';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordFinishing(
    orderId: string,
    dto: RecordFinishingDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.FINISHING,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot record finishing; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.orderLine.findFirst({
        where: { id: dto.orderLineId, orderId },
      });
      if (!line) throw new NotFoundException('Order line not found on order');

      const [receivedAgg, repairAgg, finishedAgg] = await Promise.all([
        tx.workshopBatchReceipt.aggregate({
          where: { batch: { orderLineId: dto.orderLineId } },
          _sum: { quantity: true },
        }),
        tx.returnItem.aggregate({
          where: {
            orderLineId: dto.orderLineId,
            disposition: ReturnDisposition.REPAIR,
          },
          _sum: { quantity: true },
        }),
        tx.finishingRecord.aggregate({
          where: { orderLineId: dto.orderLineId },
          _sum: { quantity: true },
        }),
      ]);

      const available =
        (receivedAgg._sum.quantity ?? 0) +
        (repairAgg._sum.quantity ?? 0) -
        (finishedAgg._sum.quantity ?? 0);

      if (dto.quantity > available) {
        throw new BadRequestException(
          `Cannot finish ${dto.quantity} pieces. Only ${available} available from workshop/repair.`,
        );
      }

      const record = await tx.finishingRecord.create({
        data: {
          orderLineId: dto.orderLineId,
          quantity: dto.quantity,
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      const step = order.steps.find((s) => s.type === OrderStepType.FINISHING);
      if (step && step.status === OrderStepStatus.NOT_STARTED) {
        await tx.orderStep.update({
          where: { id: step.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }

      return record;
    });
  }

  async recordQualityCheck(
    orderId: string,
    dto: RecordQualityCheckDto,
    userId: string,
  ) {
    const rejectedQty = dto.rejectedQty ?? 0;
    const totalChecked = dto.passedQty + rejectedQty;
    if (totalChecked <= 0) {
      throw new BadRequestException(
        'passedQty + rejectedQty must be greater than zero',
      );
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.FINAL_CHECK,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot record final check; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.orderLine.findFirst({
        where: { id: dto.orderLineId, orderId },
      });
      if (!line) throw new NotFoundException('Order line not found on order');

      const [finishedAgg, qcAgg] = await Promise.all([
        tx.finishingRecord.aggregate({
          where: { orderLineId: dto.orderLineId },
          _sum: { quantity: true },
        }),
        tx.qualityCheck.aggregate({
          where: { orderLineId: dto.orderLineId },
          _sum: { passedQty: true, rejectedQty: true },
        }),
      ]);

      const alreadyChecked =
        (qcAgg._sum.passedQty ?? 0) + (qcAgg._sum.rejectedQty ?? 0);
      const available = (finishedAgg._sum.quantity ?? 0) - alreadyChecked;

      if (totalChecked > available) {
        throw new BadRequestException(
          `Cannot check ${totalChecked} pieces. Only ${available} finished pieces awaiting QC.`,
        );
      }

      const qc = await tx.qualityCheck.create({
        data: {
          orderLineId: dto.orderLineId,
          passedQty: dto.passedQty,
          rejectedQty,
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      const step = order.steps.find(
        (s) => s.type === OrderStepType.FINAL_CHECK,
      );
      if (step && step.status === OrderStepStatus.NOT_STARTED) {
        await tx.orderStep.update({
          where: { id: step.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }

      return qc;
    });
  }

  async createDelivery(
    orderId: string,
    dto: CreateDeliveryDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true, lines: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.DELIVERY,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot create delivery; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    const lineIds = new Set(order.lines.map((l) => l.id));
    for (const item of dto.items) {
      if (!lineIds.has(item.orderLineId)) {
        throw new BadRequestException(
          `Order line ${item.orderLineId} does not belong to this order`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const [passedAgg, deliveredAgg] = await Promise.all([
          tx.qualityCheck.aggregate({
            where: { orderLineId: item.orderLineId },
            _sum: { passedQty: true },
          }),
          tx.deliveryItem.aggregate({
            where: { orderLineId: item.orderLineId },
            _sum: { quantity: true },
          }),
        ]);

        const available =
          (passedAgg._sum.passedQty ?? 0) - (deliveredAgg._sum.quantity ?? 0);
        if (item.quantity > available) {
          throw new BadRequestException(
            `Cannot deliver ${item.quantity} pieces for line ${item.orderLineId}. Only ${available} ready.`,
          );
        }
      }

      const delivery = await tx.delivery.create({
        data: {
          orderId,
          note: dto.note?.trim(),
          createdById: userId,
          items: {
            create: dto.items.map((i) => ({
              orderLineId: i.orderLineId,
              quantity: i.quantity,
            })),
          },
        },
        include: {
          items: {
            include: { orderLine: { select: { color: true, size: true } } },
          },
        },
      });

      const step = order.steps.find((s) => s.type === OrderStepType.DELIVERY);
      if (step && step.status === OrderStepStatus.NOT_STARTED) {
        await tx.orderStep.update({
          where: { id: step.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }

      return delivery;
    });
  }

  async createReturn(orderId: string, dto: CreateReturnDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const lineIds = new Set(order.lines.map((l) => l.id));
    for (const item of dto.items) {
      if (!lineIds.has(item.orderLineId)) {
        throw new BadRequestException(
          `Order line ${item.orderLineId} does not belong to this order`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const [deliveredAgg, returnedAgg] = await Promise.all([
          tx.deliveryItem.aggregate({
            where: { orderLineId: item.orderLineId },
            _sum: { quantity: true },
          }),
          tx.returnItem.aggregate({
            where: { orderLineId: item.orderLineId },
            _sum: { quantity: true },
          }),
        ]);

        const maxReturnable =
          (deliveredAgg._sum.quantity ?? 0) - (returnedAgg._sum.quantity ?? 0);
        if (item.quantity > maxReturnable) {
          throw new BadRequestException(
            `Cannot return ${item.quantity} pieces for line ${item.orderLineId}. Only ${maxReturnable} delivered.`,
          );
        }
      }

      return tx.return.create({
        data: {
          orderId,
          reason: dto.reason?.trim(),
          createdById: userId,
          items: {
            create: dto.items.map((i) => ({
              orderLineId: i.orderLineId,
              quantity: i.quantity,
              disposition: i.disposition,
              note: i.note?.trim(),
            })),
          },
        },
        include: {
          items: {
            include: { orderLine: { select: { color: true, size: true } } },
          },
        },
      });
    });
  }

  async getFulfillmentSummary(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        lines: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
        returns: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const lineIds = order.lines.map((l) => l.id);
    if (lineIds.length === 0) {
      return { orderId, lines: [], deliveries: [], returns: [] };
    }

    const [finishingSums, qcSums, deliveredSums, returnSums] =
      await Promise.all([
        this.prisma.finishingRecord.groupBy({
          by: ['orderLineId'],
          where: { orderLineId: { in: lineIds } },
          _sum: { quantity: true },
        }),
        this.prisma.qualityCheck.groupBy({
          by: ['orderLineId'],
          where: { orderLineId: { in: lineIds } },
          _sum: { passedQty: true, rejectedQty: true },
        }),
        this.prisma.deliveryItem.groupBy({
          by: ['orderLineId'],
          where: { orderLineId: { in: lineIds } },
          _sum: { quantity: true },
        }),
        this.prisma.returnItem.groupBy({
          by: ['orderLineId'],
          where: { orderLineId: { in: lineIds } },
          _sum: { quantity: true },
        }),
      ]);

    const finMap = new Map(
      finishingSums.map((r) => [r.orderLineId, r._sum.quantity ?? 0]),
    );
    const qcMap = new Map(
      qcSums.map((r) => [
        r.orderLineId,
        { passed: r._sum.passedQty ?? 0, rejected: r._sum.rejectedQty ?? 0 },
      ]),
    );
    const delMap = new Map(
      deliveredSums.map((r) => [r.orderLineId, r._sum.quantity ?? 0]),
    );
    const retMap = new Map(
      returnSums.map((r) => [r.orderLineId, r._sum.quantity ?? 0]),
    );

    return {
      orderId,
      lines: order.lines.map((l) => {
        const qc = qcMap.get(l.id) ?? { passed: 0, rejected: 0 };
        const deliveredQty = delMap.get(l.id) ?? 0;
        return {
          id: l.id,
          color: l.color,
          size: l.size,
          orderedQty: l.orderedQty,
          finishedQty: finMap.get(l.id) ?? 0,
          qcPassedQty: qc.passed,
          qcRejectedQty: qc.rejected,
          readyToDeliverQty: Math.max(0, qc.passed - deliveredQty),
          deliveredQty,
          returnedQty: retMap.get(l.id) ?? 0,
        };
      }),
      deliveries: order.deliveries,
      returns: order.returns,
    };
  }
}
