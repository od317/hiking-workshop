import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStepStatus, OrderStepType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { ALL_ORDER_STEPS, findUnmetDependencies } from './order-step-rules';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.$transaction(async (tx) => {
      const [{ num }] = await tx.$queryRaw<Array<{ num: string }>>`
        SELECT 'ORD-' || lpad(nextval('order_number_seq')::text, 4, '0') AS num
      `;

      return tx.order.create({
        data: {
          orderNumber: num,
          customerId: dto.customerId,
          title: dto.title?.trim(),
          note: dto.note?.trim(),
          createdById: userId,
          steps: {
            create: ALL_ORDER_STEPS.map((type, index) => ({
              type,
              sortOrder: index + 1,
            })),
          },
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
        include: {
          customer: true,
          steps: { orderBy: { sortOrder: 'asc' } },
          attachments: { include: { attachment: true } },
        },
      });
    });
  }

  findAll(filters?: { customerId?: string; search?: string }) {
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.search
          ? {
              OR: [
                {
                  orderNumber: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
                { title: { contains: filters.search, mode: 'insensitive' } },
                {
                  customer: {
                    name: { contains: filters.search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        steps: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        steps: true,
        attachments: { include: { attachment: true } },
        patterns: {
          where: { deletedAt: null },
          orderBy: { versionNum: 'desc' },
          include: { attachments: { include: { attachment: true } } },
        },
        samples: {
          where: { deletedAt: null },
          orderBy: { attemptNum: 'desc' },
          include: { attachments: { include: { attachment: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStep(
    orderId: string,
    stepType: OrderStepType,
    dto: UpdateStepDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { steps: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const unmet = findUnmetDependencies(stepType, dto.status, order.steps);
    if (unmet.length > 0) {
      throw new BadRequestException(
        `Cannot move ${stepType} to ${dto.status}; unmet prerequisites: ${unmet.join(', ')}`,
      );
    }

    const existing = order.steps.find((s) => s.type === stepType);
    if (!existing) throw new NotFoundException('Step not found');

    const now = new Date();
    return this.prisma.orderStep.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        ...(dto.note !== undefined ? { note: dto.note.trim() } : {}),
        startedAt:
          dto.status === OrderStepStatus.IN_PROGRESS && !existing.startedAt
            ? now
            : existing.startedAt,
        doneAt: dto.status === OrderStepStatus.DONE ? now : null,
        version: { increment: 1 },
      },
    });
  }
  async reorderSteps(orderId: string, dto: ReorderStepsDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.$transaction(
      dto.order.map((type, index) =>
        this.prisma.orderStep.update({
          where: { orderId_type: { orderId, type } },
          data: {
            sortOrder: index + 1,
            version: { increment: 1 },
          },
        }),
      ),
    );

    return this.prisma.orderStep.findMany({
      where: { orderId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
