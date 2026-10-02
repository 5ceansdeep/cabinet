import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { DescribeService } from './describe.js';
import { CollectDto, GrowDto, TrackDto } from './dto.js';
import { PoolService } from './pool.js';
import { SoundService } from './sound.js';

/* 수집은 외부 API(iTunes·Last.fm)를 몰아 부르므로 관리자만.
   관리자 = .env 의 ADMIN_EMAILS(쉼표로 여러 개). 비어 있으면 아무도 못 부른다 */
const isAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly pool: PoolService,
    private readonly sound: SoundService,
    private readonly describe: DescribeService,
  ) {}

  @Get('tracks')
  @ApiOperation({ summary: '갖춰 둔 곡 목록' })
  @ApiResponse({ status: 200, type: [TrackDto] })
  list() {
    return this.catalog.list();
  }

  @Get('budget')
  @ApiOperation({ summary: '오늘 남은 유튜브 검색 횟수' })
  budget() {
    return this.catalog.budget();
  }

  @Post('collect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 정보 수집 (관리자) — 커버·미리듣기(iTunes) + 태그(Last.fm). 영상 ID 는 재생목록·밤 배치에서' })
  @ApiResponse({ status: 201, type: [TrackDto] })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  collect(@Body() dto: CollectDto, @Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('수집은 관리자만 할 수 있네');
    return this.catalog.collectMany(dto.tracks, dto.force ?? false);
  }

  @Post('grow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 풀 넓히기 시작 (관리자) — 검색 기록·장르 태그·애플 한국·미국 차트에서 곡을 모은다. 뒤에서 돌고 바로 상태를 돌려준다' })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  grow(@Body() dto: GrowDto, @Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 풀은 관리자만 넓힐 수 있네');
    return this.pool.start(dto.target, dto.tags);
  }

  @Get('grow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 풀 넓히기 진행 상황 (관리자)' })
  growStatus(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 풀은 관리자만 넓힐 수 있네');
    return this.pool.getStatus();
  }

  @Post('sound')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '소리 숫자 채우기 시작 (관리자) — 숫자가 없는 곡의 미리듣기를 ReccoBeats 에 올린다. 뒤에서 돌고 바로 상태를 돌려준다' })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  analyzeSound(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('소리 분석은 관리자만 할 수 있네');
    return this.sound.start();
  }

  @Get('sound')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '소리 숫자 채우기 진행 상황 (관리자)' })
  soundStatus(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('소리 분석은 관리자만 볼 수 있네');
    return this.sound.getStatus();
  }

  @Post('describe')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 설명·임베딩 채우기 시작 (관리자) — 가사(LRCLIB)와 소리 숫자로 Gemini 가 설명을 쓴다. 뒤에서 돌고 바로 상태를 돌려준다 [Gemini]' })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  describeTracks(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 설명은 관리자만 쓸 수 있네');
    return this.describe.start();
  }

  @Get('describe')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 설명·임베딩 채우기 진행 상황 (관리자)' })
  describeStatus(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 설명은 관리자만 볼 수 있네');
    return this.describe.getStatus();
  }

  /* 새벽 배치 셋(4시 넓히기 → 5시 소리 → 6시 설명)을 지금 한 번에 — 앞 배치가 끝나면 다음을. 새 곡만 손대니 DB 통째 다시 쓰기는 아니다.
     영상 ID 는 추천에 안 쓰여 빼 둔다(재생목록을 열 때·밤 배치가 찾는다) */
  @Post('refill')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 풀 넓히기 → 소리 분석 → 곡 설명을 이어서 (관리자) — 새 곡이 추천에 나오기까지 한 번에. 뒤에서 돌고 바로 상태를 돌려준다 [Gemini]' })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  refill(@Body() dto: GrowDto, @Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 풀은 관리자만 넓힐 수 있네');
    const until = async (busy: () => boolean) => {
      while (busy()) await new Promise((ok) => setTimeout(ok, 5000));
    };
    this.pool.start(dto.target, dto.tags);
    void (async () => {
      await until(() => this.pool.getStatus().running);
      this.sound.start();
      await until(() => this.sound.getStatus().running);
      this.describe.start();
    })();
    return this.refillStatus(req);
  }

  @Get('refill')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '이어 돌기 진행 상황 (관리자) — 넓히기·소리·설명 셋' })
  refillStatus(@Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('곡 풀은 관리자만 볼 수 있네');
    return { grow: this.pool.getStatus(), sound: this.sound.getStatus(), describe: this.describe.getStatus() };
  }
}
