import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaterialKind, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { AddOrderMaterialDto } from './dto/add-order-material.dto';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMaterialDto, userId: string) {
    return this.prisma.material.create({
      data: {
        kind: dto.kind,
        name: dto.name.trim(),
        color: dto.color?.trim(),
        unit: dto.unit.trim(),
        unitCostMinor: dto.unitCostMinor,
        attachmentId: dto.attachmentId,
        note: dto.note?.trim(),
        createdById: userId,
      },
      include: { attachment: true },
    });
  }

  async findAll(filters?: { kind?: MaterialKind; search?: string }) {
    const materials = await this.prisma.material.findMany({
      where: {
        deletedAt: null,
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { color: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { attachment: true },
      orderBy: { createdAt: 'desc' },
    });

    if (materials.length === 0) return [];

    const sums = await this.prisma.stockMovement.groupBy({
      by: ['materialId'],
      where: { materialId: { in: materials.map((m) => m.id) } },
      _sum: { quantity: true },
    });
    const stockMap = new Map(
      sums.map((s) => [s.materialId, Number(s._sum.quantity ?? 0)]),
    );

    return materials.map((m) => ({
      ...m,
      currentStock: stockMap.get(m.id) ?? 0,
    }));
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      include: {
        attachment: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!material) throw new NotFoundException('Material not found');

    const agg = await this.prisma.stockMovement.aggregate({
      where: { materialId: id },
      _sum: { quantity: true },
    });

    return {
      ...material,
      currentStock: Number(agg._sum.quantity ?? 0),
    };
  }

  async recordMovement(
    materialId: string,
    dto: CreateMovementDto,
    userId: string,
  ) {
    if (dto.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }
    if (
      (dto.type === StockMovementType.IN ||
        dto.type === StockMovementType.OUT) &&
      dto.quantity < 0
    ) {
      throw new BadRequestException('Quantity must be positive for IN and OUT');
    }

    const signedQty =
      dto.type === StockMovementType.OUT ? -dto.quantity : dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: materialId, deletedAt: null },
      });
      if (!material) throw new NotFoundException('Material not found');

      const agg = await tx.stockMovement.aggregate({
        where: { materialId },
        _sum: { quantity: true },
      });
      const currentStock = Number(agg._sum.quantity ?? 0);
      const nextStock = currentStock + signedQty;

      if (nextStock < 0) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentStock} ${material.unit}`,
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          materialId,
          type: dto.type,
          quantity: new Prisma.Decimal(signedQty),
          orderId: dto.orderId,
          note: dto.note?.trim(),
          createdById: userId,
        },
      });

      return { movement, currentStock: nextStock };
    });
  }

  async addOrderMaterial(
    orderId: string,
    dto: AddOrderMaterialDto,
    userId: string,
  ) {
    if (!dto.materialId && !dto.customName?.trim()) {
      throw new BadRequestException(
        'Either materialId or customName is required',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      let unit = dto.unit?.trim();

      if (dto.materialId) {
        const material = await tx.material.findFirst({
          where: { id: dto.materialId, deletedAt: null },
        });
        if (!material) throw new NotFoundException('Material not found');
        unit = unit || material.unit;

        if (dto.deductFromStock !== false) {
          const agg = await tx.stockMovement.aggregate({
            where: { materialId: dto.materialId },
            _sum: { quantity: true },
          });
          const currentStock = Number(agg._sum.quantity ?? 0);
          if (currentStock - dto.quantity < 0) {
            throw new BadRequestException(
              `Insufficient stock for ${material.name}. Available: ${currentStock} ${material.unit}`,
            );
          }

          await tx.stockMovement.create({
            data: {
              materialId: dto.materialId,
              type: StockMovementType.OUT,
              quantity: new Prisma.Decimal(-dto.quantity),
              orderId,
              note: dto.note?.trim() ?? 'Reserved for order',
              createdById: userId,
            },
          });
        }
      }

      if (!unit) {
        throw new BadRequestException('unit is required for custom materials');
      }

      return tx.orderMaterial.create({
        data: {
          orderId,
          kind: dto.kind,
          materialId: dto.materialId,
          customName: dto.customName?.trim(),
          customColor: dto.customColor?.trim(),
          customAttachmentId: dto.customAttachmentId,
          quantity: new Prisma.Decimal(dto.quantity),
          unit,
          note: dto.note?.trim(),
          createdById: userId,
        },
        include: {
          material: true,
          customAttachment: true,
        },
      });
    });
  }

  listOrderMaterials(orderId: string, kind?: MaterialKind) {
    return this.prisma.orderMaterial.findMany({
      where: {
        orderId,
        deletedAt: null,
        ...(kind ? { kind } : {}),
      },
      include: {
        material: { include: { attachment: true } },
        customAttachment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
