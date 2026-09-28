import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class TrackRefDto {
  @ApiProperty({ example: 'Everything' }) @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiProperty({ example: '검정치마' }) @IsString() @IsNotEmpty() @MaxLength(200) artist!: string;
}

export class CollectDto {
  // 한 번에 20곡까지 — 곡마다 유튜브 검색 1회(100 단위)라 한 요청이 하루 상한을 다 먹지 않게
  @ApiProperty({ type: [TrackRefDto], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
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
