import { IsOptional, IsString } from 'class-validator';

export class ResolveHoldDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
