import { StockMovementType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateMovementDto {
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  // Positive for IN/OUT (OUT is stored as negative); signed for ADJUST
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
