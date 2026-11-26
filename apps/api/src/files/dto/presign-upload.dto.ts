import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_PURPOSES = [
  'order',
  'pattern',
  'sample',
  'material',
  'delivery',
] as const;

export class PresignUploadDto {
  @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10 MB max
  sizeBytes!: number;

  @IsString()
  @IsIn(ALLOWED_PURPOSES)
  purpose!: string;
}
