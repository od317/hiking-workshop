import { IsString, MaxLength } from 'class-validator';

export class UpdateStepNoteDto {
  @IsString()
  @MaxLength(2000)
  note!: string;
}
