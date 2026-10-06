import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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

export class DescribeDto {
  @ApiProperty({ required: false, maximum: 500, description: '이번에 설명을 붙일 곡 수 — 비우면 설명 없는 곡 전부. 곡당 Gemini 2번(돈이 든다)이라 나눠 돌릴 때 쓴다' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class GrowDto {
  @ApiProperty({ required: false, default: 30, maximum: 500, description: '새로 담을 곡 수 — iTunes 제한 때문에 곡당 3초쯤 걸린다(500곡 ≈ 25분)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  target?: number;

  @ApiProperty({ required: false, type: [String], example: ['j-pop', 'chanson'], description: '이 Last.fm 태그의 인기곡만 모은다 — 비우면 검색 기록·장르·차트를 섞어서' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}
