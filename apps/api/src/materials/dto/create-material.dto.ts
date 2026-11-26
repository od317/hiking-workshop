import { MaterialKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMaterialDto {
  @IsEnum(MaterialKind)
  kind!: MaterialKind;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitCostMinor?: number;

  @IsOptional()
  @IsUUID('4')
  attachmentId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
