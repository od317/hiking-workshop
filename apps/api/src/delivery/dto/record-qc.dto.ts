import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordQualityCheckDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsInt()
  @Min(0)
  passedQty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rejectedQty?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
