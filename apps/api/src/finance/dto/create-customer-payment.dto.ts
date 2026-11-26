import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCustomerPaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
