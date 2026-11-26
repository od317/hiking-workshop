import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async presign(dto: PresignUploadDto, userId: string) {
    const id = randomUUID();
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = EXT_MAP[dto.mimeType] ?? 'bin';
    const key = `${dto.purpose}/${yyyy}/${mm}/${id}.${ext}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        id,
        key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        purpose: dto.purpose,
        createdById: userId,
      },
    });

    const uploadUrl = await this.storage.createUploadUrl(key, dto.mimeType);

    return {
      attachmentId: attachment.id,
      key: attachment.key,
      uploadUrl,
    };
  }

  async confirm(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException('Attachment not found');
    }

    const exists = await this.storage.exists(attachment.key);
    if (!exists) {
      throw new BadRequestException('File was not uploaded to storage');
    }

    const updated = await this.prisma.attachment.update({
      where: { id },
      data: { status: 'READY', version: { increment: 1 } },
    });

    const url = await this.storage.createDownloadUrl(updated.key);
    return { id: updated.id, key: updated.key, status: updated.status, url };
  }

  async getSignedUrl(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment || attachment.deletedAt || attachment.status !== 'READY') {
      throw new NotFoundException('Attachment not found');
    }
    const url = await this.storage.createDownloadUrl(attachment.key);
    return { id: attachment.id, url };
  }
}
