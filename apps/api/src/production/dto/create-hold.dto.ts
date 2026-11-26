import { OrderStepType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHoldDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsEnum(OrderStepType)
  stage!: OrderStepType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(2)
  reason!: string;
}
