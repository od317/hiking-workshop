import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStepStatus, OrderStepType, SampleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findUnmetDependencies } from '../orders/order-step-rules';
import { CreatePatternDto } from './dto/create-pattern.dto';
import { CreateSampleDto } from './dto/create-sample.dto';
import { DecideSampleDto } from './dto/decide-sample.dto';

@Injectable()
export class DesignService {
  constructor(private readonly prisma: PrismaService) {}

  async createPattern(orderId: string, dto: CreatePatternDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.pattern.findFirst({
        where: { orderId },
        orderBy: { versionNum: 'desc' },
        select: { versionNum: true },
      });
      const versionNum = (latest?.versionNum ?? 0) + 1;

      const pattern = await tx.pattern.create({
        data: {
          orderId,
          versionNum,
          note: dto.note?.trim(),
          createdById: userId,
          ...(dto.attachmentIds?.length
            ? {
                attachments: {
                  create: dto.attachmentIds.map((attachmentId) => ({
                    attachmentId,
                  })),
                },
              }
            : {}),
        },
        include: { attachments: { include: { attachment: true } } },
      });

      const patternStep = order.steps.find(
        (s) => s.type === OrderStepType.PATTERN,
      );
      if (patternStep && patternStep.status !== OrderStepStatus.DONE) {
        const now = new Date();
        await tx.orderStep.update({
          where: { id: patternStep.id },
          data: {
            status: OrderStepStatus.DONE,
            startedAt: patternStep.startedAt ?? now,
            doneAt: now,
            version: { increment: 1 },
          },
        });
      }

      return pattern;
    });
  }

  listPatterns(orderId: string) {
    return this.prisma.pattern.findMany({
      where: { orderId, deletedAt: null },
      orderBy: { versionNum: 'desc' },
      include: { attachments: { include: { attachment: true } } },
    });
  }

  async createSample(orderId: string, dto: CreateSampleDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(
      OrderStepType.SAMPLE,
      OrderStepStatus.IN_PROGRESS,
      order.steps,
    );
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot create sample; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    const activeSample = await this.prisma.sample.findFirst({
      where: {
        orderId,
        deletedAt: null,
        status: { in: [SampleStatus.PENDING, SampleStatus.APPROVED] },
      },
    });
    if (activeSample?.status === SampleStatus.PENDING) {
      throw new BadRequestException(
        'A pending sample already exists. Approve or reject it before creating a new attempt.',
      );
    }
    if (activeSample?.status === SampleStatus.APPROVED) {
      throw new BadRequestException(
        'A sample has already been approved for this order.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.sample.findFirst({
        where: { orderId },
        orderBy: { attemptNum: 'desc' },
        select: { attemptNum: true },
      });
      const attemptNum = (latest?.attemptNum ?? 0) + 1;

      const sample = await tx.sample.create({
        data: {
          orderId,
          attemptNum,
          status: SampleStatus.PENDING,
          note: dto.note?.trim(),
          createdById: userId,
          ...(dto.attachmentIds?.length
            ? {
                attachments: {
                  create: dto.attachmentIds.map((attachmentId) => ({
                    attachmentId,
                  })),
                },
              }
            : {}),
        },
        include: { attachments: { include: { attachment: true } } },
      });

      const sampleStep = order.steps.find(
        (s) => s.type === OrderStepType.SAMPLE,
      );
      if (sampleStep && sampleStep.status !== OrderStepStatus.IN_PROGRESS) {
        const now = new Date();
        await tx.orderStep.update({
          where: { id: sampleStep.id },
          data: {
            status: OrderStepStatus.IN_PROGRESS,
            startedAt: sampleStep.startedAt ?? now,
            doneAt: null,
            version: { increment: 1 },
          },
        });
      }

      return sample;
    });
  }

  listSamples(orderId: string) {
    return this.prisma.sample.findMany({
      where: { orderId, deletedAt: null },
      orderBy: { attemptNum: 'desc' },
      include: { attachments: { include: { attachment: true } } },
    });
  }

  async decideSample(sampleId: string, dto: DecideSampleDto, userId: string) {
    const sample = await this.prisma.sample.findFirst({
      where: { id: sampleId, deletedAt: null },
      include: { order: { include: { steps: true } } },
    });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.status !== SampleStatus.PENDING) {
      throw new BadRequestException('Sample has already been decided');
    }

    const now = new Date();
    const newStatus =
      dto.decision === 'APPROVED'
        ? SampleStatus.APPROVED
        : SampleStatus.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sample.update({
        where: { id: sampleId },
        data: {
          status: newStatus,
          decisionNote: dto.note?.trim(),
          decidedAt: now,
          decidedById: userId,
          version: { increment: 1 },
        },
        include: { attachments: { include: { attachment: true } } },
      });

      const sampleStep = sample.order.steps.find(
        (s) => s.type === OrderStepType.SAMPLE,
      );
      if (sampleStep) {
        await tx.orderStep.update({
          where: { id: sampleStep.id },
          data: {
            status:
              newStatus === SampleStatus.APPROVED
                ? OrderStepStatus.DONE
                : OrderStepStatus.IN_PROGRESS,
            doneAt: newStatus === SampleStatus.APPROVED ? now : null,
            version: { increment: 1 },
          },
        });
      }

      return updated;
    });
  }
}
