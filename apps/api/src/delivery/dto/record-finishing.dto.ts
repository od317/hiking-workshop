import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordFinishingDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
