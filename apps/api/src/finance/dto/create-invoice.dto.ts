import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsInt()
  @Min(1)
  totalMinor!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
