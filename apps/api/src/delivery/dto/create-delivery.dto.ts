import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryItemInputDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateDeliveryDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemInputDto)
  items!: DeliveryItemInputDto[];
}
