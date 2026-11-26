import { ReturnDisposition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnItemInputDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(ReturnDisposition)
  disposition!: ReturnDisposition;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateReturnDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}
