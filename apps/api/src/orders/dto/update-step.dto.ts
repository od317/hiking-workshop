import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStepStatus } from '@prisma/client';

export class UpdateStepDto {
  @IsEnum(OrderStepStatus)
  status!: OrderStepStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
