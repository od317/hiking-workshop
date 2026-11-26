import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class EnsureColorsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  names!: string[];
}
