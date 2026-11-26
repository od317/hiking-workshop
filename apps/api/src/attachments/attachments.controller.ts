import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentStatus } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export enum AttachmentEntityType {
  ORDER = 'ORDER',
  PATTERN = 'PATTERN',
  SAMPLE = 'SAMPLE',
  MATERIAL = 'MATERIAL',
  ORDER_MATERIAL = 'ORDER_MATERIAL',
  ORDER_STEP = 'ORDER_STEP',
}

const uploadDir = join(process.cwd(), 'uploads');
mkdirSync(uploadDir, { recursive: true });

const toDto = (a: {
  id: string;
  key: string;
  mimeType: string;
  createdAt: Date;
}) => ({
  id: a.id,
  url: `/uploads/${a.key}`,
  mimeType: a.mimeType,
  createdAt: a.createdAt,
});

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '.jpg') || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        cb(null, /^image\/(jpe?g|png|webp|heic)$/.test(file.mimetype)),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('entityType', new ParseEnumPipe(AttachmentEntityType))
    entityType: AttachmentEntityType,
    @Body('entityId', ParseUUIDPipe) entityId: string,
    @Req() req: { user: { id: string } },
  ) {
    if (!file) throw new BadRequestException('Image file is required');

    try {
      await this.assertEntityExists(entityType, entityId);
      return await this.save(file, entityType, entityId, req.user.id);
    } catch (err) {
      // Don't leave an orphan file on disk if the DB part failed
      await unlink(join(uploadDir, file.filename)).catch(() => undefined);
      throw err;
    }
  }

  private async assertEntityExists(type: AttachmentEntityType, id: string) {
    const found = await (async () => {
      switch (type) {
        case AttachmentEntityType.ORDER:
          return this.prisma.order.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
        case AttachmentEntityType.PATTERN:
          return this.prisma.pattern.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
        case AttachmentEntityType.SAMPLE:
          return this.prisma.sample.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
        case AttachmentEntityType.MATERIAL:
          return this.prisma.material.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
        case AttachmentEntityType.ORDER_MATERIAL:
          return this.prisma.orderMaterial.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
        case AttachmentEntityType.ORDER_STEP:
          return this.prisma.orderStep.findUnique({
            where: { id },
            select: { id: true },
          });
      }
    })();
    if (!found) throw new NotFoundException(`${type} not found`);
  }

  private save(
    file: Express.Multer.File,
    entityType: AttachmentEntityType,
    entityId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          key: file.filename,
          mimeType: file.mimetype || 'image/jpeg',
          sizeBytes: file.size,
          purpose: entityType,
          status: AttachmentStatus.READY,
          createdById: userId,
        },
      });

      switch (entityType) {
        case AttachmentEntityType.ORDER:
          await tx.orderAttachment.create({
            data: { orderId: entityId, attachmentId: attachment.id },
          });
          break;
        case AttachmentEntityType.PATTERN:
          await tx.patternAttachment.create({
            data: { patternId: entityId, attachmentId: attachment.id },
          });
          break;
        case AttachmentEntityType.SAMPLE:
          await tx.sampleAttachment.create({
            data: { sampleId: entityId, attachmentId: attachment.id },
          });
          break;
        case AttachmentEntityType.MATERIAL:
          await tx.material.update({
            where: { id: entityId },
            data: { attachmentId: attachment.id },
          });
          break;
        case AttachmentEntityType.ORDER_MATERIAL:
          await tx.orderMaterial.update({
            where: { id: entityId },
            data: { customAttachmentId: attachment.id },
          });
          break;
        case AttachmentEntityType.ORDER_STEP:
          await tx.orderStepAttachment.create({
            data: { orderStepId: entityId, attachmentId: attachment.id },
          });
          break;
      }

      return toDto(attachment);
    });
  }

  @Get()
  async list(
    @Query('entityType', new ParseEnumPipe(AttachmentEntityType))
    entityType: AttachmentEntityType,
    @Query('entityId', ParseUUIDPipe) entityId: string,
  ) {
    switch (entityType) {
      case AttachmentEntityType.ORDER: {
        const rows = await this.prisma.orderAttachment.findMany({
          where: { orderId: entityId, attachment: { deletedAt: null } },
          include: { attachment: true },
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => toDto(r.attachment));
      }
      case AttachmentEntityType.PATTERN: {
        const rows = await this.prisma.patternAttachment.findMany({
          where: { patternId: entityId, attachment: { deletedAt: null } },
          include: { attachment: true },
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => toDto(r.attachment));
      }
      case AttachmentEntityType.SAMPLE: {
        const rows = await this.prisma.sampleAttachment.findMany({
          where: { sampleId: entityId, attachment: { deletedAt: null } },
          include: { attachment: true },
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => toDto(r.attachment));
      }
      case AttachmentEntityType.MATERIAL: {
        const mat = await this.prisma.material.findUnique({
          where: { id: entityId },
          include: { attachment: true },
        });
        return mat?.attachment && !mat.attachment.deletedAt
          ? [toDto(mat.attachment)]
          : [];
      }
      case AttachmentEntityType.ORDER_MATERIAL: {
        const om = await this.prisma.orderMaterial.findUnique({
          where: { id: entityId },
          include: {
            customAttachment: true,
            material: { include: { attachment: true } },
          },
        });
        const img = om?.customAttachment ?? om?.material?.attachment;
        return img && !img.deletedAt ? [toDto(img)] : [];
      }
      case AttachmentEntityType.ORDER_STEP: {
        const rows = await this.prisma.orderStepAttachment.findMany({
          where: { orderStepId: entityId, attachment: { deletedAt: null } },
          include: { attachment: true },
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => toDto(r.attachment));
      }
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }
}
