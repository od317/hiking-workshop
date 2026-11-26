import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePatternDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
