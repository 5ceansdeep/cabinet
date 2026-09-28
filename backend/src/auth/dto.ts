import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'archivist@cabinet.kr' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '수현', minLength: 2, maxLength: 12, description: '한글·영문·숫자·밑줄' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(12)
  @Matches(/^[가-힣A-Za-z0-9_]+$/, { message: '한글, 영문, 숫자면 충분하네' })
  nickname!: string;

  // bcrypt 는 72바이트 뒤를 잘라 버린다 — 더 길면 앞 72바이트만 같아도 같은 비밀번호로 통과한다
  @ApiProperty({ example: 'cabinet-secret', minLength: 8, description: '8자 이상, 72바이트 이하(한글은 한 글자 3바이트)' })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72, { message: '비밀이 너무 길군. 72바이트 안으로 줄이게' })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'archivist@cabinet.kr' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'cabinet-secret' })
  @IsString()
  @MaxLength(200)
  password!: string;
}

export class MeDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() nickname!: string;
}

export class TokenDto {
  @ApiProperty({ description: 'JWT — Authorization: Bearer {token}' })
  accessToken!: string;

  @ApiProperty({ type: MeDto })
  user!: MeDto;
}
