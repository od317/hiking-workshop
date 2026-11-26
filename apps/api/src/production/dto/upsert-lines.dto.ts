import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OrderLineInputDto {
  @IsString()
  @MinLength(1)
  color!: string;

  @IsString()
  @MinLength(1)
  size!: string;

  @IsInt()
  @Min(1)
  orderedQty!: number;
}

export class UpsertOrderLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];
}
