import { IsString, Length } from 'class-validator';

export class BoardGroupCreateDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
