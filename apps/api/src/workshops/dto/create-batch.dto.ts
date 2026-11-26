import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBatchDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsUUID('4')
  workshopId!: string;

  @IsInt()
  @Min(1)
  sentQty!: number;

  @IsInt()
  @Min(0)
  ratePerPieceMinor!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
