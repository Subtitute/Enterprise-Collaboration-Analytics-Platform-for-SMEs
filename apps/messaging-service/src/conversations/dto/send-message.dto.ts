import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /conversations/:id/messages. */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}
