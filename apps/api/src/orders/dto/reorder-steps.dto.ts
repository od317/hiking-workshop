import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
} from 'class-validator';
import { OrderStepType } from '@prisma/client';

export class ReorderStepsDto {
  @IsArray()
  @ArrayMinSize(9)
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsEnum(OrderStepType, { each: true })
  order!: OrderStepType[];
}
