import { MaterialKind } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddOrderMaterialDto {
  @IsEnum(MaterialKind)
  kind!: MaterialKind;

  @IsOptional()
  @IsUUID('4')
  materialId?: string;

  @IsOptional()
  @IsString()
  customName?: string;

  @IsOptional()
  @IsString()
  customColor?: string;

  @IsOptional()
  @IsUUID('4')
  customAttachmentId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  deductFromStock?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
