import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CuttingEntryDto {
  @IsUUID('4')
  orderLineId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RecordCuttingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CuttingEntryDto)
  entries!: CuttingEntryDto[];
}
