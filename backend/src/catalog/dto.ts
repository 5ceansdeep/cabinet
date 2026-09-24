import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class TrackRefDto {
  @ApiProperty({ example: 'Everything' }) @IsString() title!: string;
  @ApiProperty({ example: '검정치마' }) @IsString() artist!: string;
}

export class CollectDto {
  @ApiProperty({ type: [TrackRefDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackRefDto)
  tracks!: TrackRefDto[];

  @ApiProperty({ required: false, description: '이미 갖춘 곡도 다시 찾는다' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class TrackDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() artist!: string;
  @ApiProperty({ nullable: true, description: 'iTunes 앨범 커버(600x600)' }) artwork!: string | null;
  @ApiProperty({ nullable: true, description: 'iTunes 30초 미리듣기' }) previewUrl!: string | null;
  @ApiProperty({ nullable: true, description: '유튜브 영상 ID — 재생목록에 담을 때 쓴다' }) videoId!: string | null;
}
