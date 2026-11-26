import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateWorkshopPaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
