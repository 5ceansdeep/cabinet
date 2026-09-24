import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'cabinet-secret', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'archivist@cabinet.kr' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'cabinet-secret' })
  @IsString()
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
