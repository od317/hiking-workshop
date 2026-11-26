import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReceiveBatchDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
