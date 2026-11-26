import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HoldStatus, OrderStepStatus, OrderStepType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findUnmetDependencies } from '../orders/order-step-rules';
import { UpsertOrderLinesDto } from './dto/upsert-lines.dto';
import { RecordCuttingDto } from './dto/record-cutting.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { ResolveHoldDto } from './dto/resolve-hold.dto';

const ACTIVITY_COUNTS = {
  cuttingRecords: true,
  holds: true,
  workshopBatches: true,
  finishingRecords: true,
  qualityChecks: true,
  deliveryItems: true,
  returnItems: true,
} as const;

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertLines(orderId: string, dto: UpsertOrderLinesDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true },
    });

    await this.prisma.orderColor.createMany({
      data: [...new Set(dto.lines.map((l) => l.color.trim()))].map((name) => ({
        orderId,
        name,
      })),
      skipDuplicates: true,
    });

    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.$transaction(
      dto.lines.map((line) => {
        const color = line.color.trim();
        const size = line.size.trim();
        return this.prisma.orderLine.upsert({
          where: { orderId_color_size: { orderId, color, size } },
          create: { orderId, color, size, orderedQty: line.orderedQty },
          update: { orderedQty: line.orderedQty, version: { increment: 1 } },
        });
      }),
    );
  }

  async getBoard(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const lines = await this.prisma.orderLine.findMany({
      where: { orderId },
      orderBy: [{ color: 'asc' }, { size: 'asc' }],
    });

    const lineIds = lines.map((l) => l.id);

    const [cutSums, openHolds] = await Promise.all([
      lineIds.length
        ? this.prisma.cuttingRecord.groupBy({
            by: ['orderLineId'],
            where: { orderLineId: { in: lineIds } },
            _sum: { quantity: true },
          })
        : [],
      this.prisma.hold.findMany({
        where: { orderId, status: HoldStatus.OPEN },
        include: { orderLine: { select: { color: true, size: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const cutMap = new Map(
      cutSums.map((c) => [c.orderLineId, c._sum.quantity ?? 0]),
    );

    const holdMap = new Map<string, number>();
    for (const h of openHolds) {
      holdMap.set(
        h.orderLineId,
        (holdMap.get(h.orderLineId) ?? 0) + h.quantity,
      );
    }

    const enrichedLines = lines.map((line) => {
      const cutQty = cutMap.get(line.id) ?? 0;
      const openHoldQty = holdMap.get(line.id) ?? 0;
      return {
        ...line,
        cutQty,
        remainingToCut: Math.max(0, line.orderedQty - cutQty),
        openHoldQty,
      };
    });

    const totals = enrichedLines.reduce(
      (acc, l) => ({
        orderedQty: acc.orderedQty + l.orderedQty,
        cutQty: acc.cutQty + l.cutQty,
        openHoldQty: acc.openHoldQty + l.openHoldQty,
      }),
      { orderedQty: 0, cutQty: 0, openHoldQty: 0 },
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totals,
      lines: enrichedLines,
      openHolds,
    };
  }

  async recordCutting(orderId: string, dto: RecordCuttingDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true, lines: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.CUTTING,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot record cutting; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    const lineMap = new Map(order.lines.map((l) => [l.id, l]));
    for (const entry of dto.entries) {
      if (entry.quantity === 0) {
        throw new BadRequestException('Cutting quantity cannot be zero');
      }
      if (!lineMap.has(entry.orderLineId)) {
        throw new BadRequestException(
          `Order line ${entry.orderLineId} does not belong to this order`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        const agg = await tx.cuttingRecord.aggregate({
          where: { orderLineId: entry.orderLineId },
          _sum: { quantity: true },
        });
        const currentCut = agg._sum.quantity ?? 0;
        const nextCut = currentCut + entry.quantity;
        if (nextCut < 0) {
          throw new BadRequestException(
            'Total cut quantity cannot be negative',
          );
        }

        await tx.cuttingRecord.create({
          data: {
            orderLineId: entry.orderLineId,
            quantity: entry.quantity,
            note: entry.note?.trim(),
            createdById: userId,
          },
        });
      }

      const cuttingStep = order.steps.find(
        (s) => s.type === OrderStepType.CUTTING,
      );
      if (cuttingStep && cuttingStep.status === OrderStepStatus.NOT_STARTED) {
        await tx.orderStep.update({
          where: { id: cuttingStep.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
    });

    return this.getBoard(orderId);
  }

  async createHold(orderId: string, dto: CreateHoldDto, userId: string) {
    const line = await this.prisma.orderLine.findFirst({
      where: { id: dto.orderLineId, orderId },
    });
    if (!line) {
      throw new NotFoundException('Order line not found on this order');
    }

    return this.prisma.hold.create({
      data: {
        orderId,
        orderLineId: dto.orderLineId,
        stage: dto.stage,
        quantity: dto.quantity,
        reason: dto.reason.trim(),
        createdById: userId,
      },
      include: { orderLine: { select: { color: true, size: true } } },
    });
  }

  async resolveHold(holdId: string, dto: ResolveHoldDto, userId: string) {
    const hold = await this.prisma.hold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.status === HoldStatus.RESOLVED) {
      throw new BadRequestException('Hold is already resolved');
    }

    return this.prisma.hold.update({
      where: { id: holdId },
      data: {
        status: HoldStatus.RESOLVED,
        resolutionNote: dto.resolutionNote?.trim(),
        resolvedAt: new Date(),
        resolvedById: userId,
        version: { increment: 1 },
      },
    });
  }

  listColors(orderId: string) {
    return this.prisma.orderColor.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
  }

  async ensureColors(orderId: string, names: string[]) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (clean.length) {
      await this.prisma.orderColor.createMany({
        data: clean.map((name) => ({ orderId, name })),
        skipDuplicates: true,
      });
    }
    return this.listColors(orderId);
  }

  async deleteColor(orderId: string, colorId: string) {
    const color = await this.prisma.orderColor.findFirst({
      where: { id: colorId, orderId },
    });
    if (!color) throw new NotFoundException('Color not found');

    const lines = await this.prisma.orderLine.findMany({
      where: { orderId, color: color.name },
      include: { _count: { select: ACTIVITY_COUNTS } },
    });
    if (lines.some((l) => Object.values(l._count).some((n) => n > 0))) {
      throw new BadRequestException(
        'Cannot delete a color that already has production activity',
      );
    }

    await this.prisma.$transaction([
      this.prisma.orderLine.deleteMany({
        where: { id: { in: lines.map((l) => l.id) } },
      }),
      this.prisma.orderColor.delete({ where: { id: colorId } }),
    ]);
    return { deleted: true };
  }

  async deleteLine(orderId: string, lineId: string) {
    const line = await this.prisma.orderLine.findFirst({
      where: { id: lineId, orderId },
      include: {
        count: { select: ACTIVITY_COUNTS },
      },
    });
    if (!line) throw new NotFoundException('Order line not found');
    if (Object.values(line._count).some((n) => n > 0)) {
      throw new BadRequestException(
        'Cannot delete a line that already has production activity',
      );
    }
    await this.prisma.orderLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }
}
