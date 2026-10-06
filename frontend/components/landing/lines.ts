import type { Field } from "./CabinetScene";

// voice — 목소리로 읽을 문장이 자막과 다를 때 (닉네임은 자막에만)
// voiceKey — 음성 파일 이름. public/voice/{voiceKey}.mp3 (없으면 소리 없이 자막만)
export type Line = { text: string; voice?: string; voiceKey?: string; link?: { href: string; label: string } };

/* 자막·목소리 문구 — 서류함의 주인. 속은 브루스 올마이티의 신이지만 정체는 드러내지 않는 관리인 (docs/voice-persona.md).
   문구는 여기 AUTH_DIALOGUE 한 곳만 고치면 된다. 아래 FIELDS·LINES 는 이걸 화면 구조에 맞게 엮을 뿐 */
export const AUTH_DIALOGUE = {
  // 진입 및 대기
  INTRO: "거기 누구 있나? 발소리 다 들렸네. 이리 와보게.", // 로그인 첫 대사
  INTRO_SIGNUP: "처음 보는 얼굴이군. 자네 서랍 하나 새로 짜주지.", // 회원가입 첫 대사
  INTRO_FORGOT: "뭘 잃어버렸나? 잃어버린 건 이 서랍에 다 있네. 가까이 오게.", // 열쇠 찾기 첫 대사
  LOADING: "자네 취향을 찾는 중이네. 아이고, 서랍이 좀 깊어서 말이야.",

  // 이메일
  EMAIL: {
    label: "EMAIL",
    prompt: "소식받을 이메일 하나 남겨보게. 스팸은 안 보내네, 약속하지.",
    missing: "주소가 없으면 자네를 어떻게 찾나?",
    invalid: "내가 만든 세상엔 이런 주소가 없는데? @는 어디 두고 왔나.",
    alreadyExists: "그 주소는 이미 내 서랍에 있네. 자네, 나보다 건망증이 심하군.",
    alreadyExistsAction: "로그인하기",
  },

  // 비밀번호 (로그인)
  PASSWORD_LOGIN: {
    label: "PASSWORD",
    prompt: "우리 둘만 아는 비밀을 적어보게. 난 안 보는 척하지.",
    missing: "열쇠도 없이 문을 열겠다고?",
    incorrect: "땡. 비밀이 틀렸네. 천천히 다시 떠올려보게.",
  },

  // 비밀번호 (회원가입)
  PASSWORD_SIGNUP: {
    label: "PASSWORD",
    prompt: "비밀을 하나 정하게. 여덟 자는 넘겨야 하네, 규칙이거든.",
    missing: "열쇠도 없이 문을 잠그겠다고?",
    invalid: "그 정도면 지나가던 개도 맞히겠네.",
  },

  // 비밀번호 확인
  PASSWORD_CONFIRM: {
    label: "CONFIRM PASSWORD",
    prompt: "한 번만 더 적어보게. 나도 중요한 건 두 번 확인하거든.",
    missing: "한 번 더라니까. 딱 한 번이면 되네.",
    mismatch: "방금 적은 거랑 다른데? 벌써 잊었나. 괜찮네, 나도 가끔 그래.",
  },

  // 닉네임
  NICKNAME: {
    label: "NICKNAME",
    prompt: "자네를 뭐라고 부를까?",
    missing: "이름이 없으면 '아무개'라고 부를 수밖에 없네.",
    tooShort: "한 글자는 좀 짧군.",
    invalid: "한글, 영문, 숫자면 충분하네. 장식은 넣어두게.",
  },

  // 비밀번호 찾기
  PASSWORD_RESET: {
    prompt: "열쇠를 또 잃어버렸나? 괜찮네, 다들 그래. 이메일부터 대보게.",
    sent: "그 주소가 내 서류함에 있다면, 새 열쇠를 소포로 보냈네. 이번엔 잘 챙기게.",
    action: "처음으로",
    // 메일 링크로 들어온 새 열쇠 화면(/reset)
    intro: "소포는 잘 받았나? 새 열쇠를 깎을 차례네.",
    newPrompt: "새 비밀을 정하게. 이번엔 자네만 아는 걸로.",
    expired: "이 열쇠는 기한이 지났네. 소포를 새로 부쳐주지.",
    expiredAction: "다시 받기",
  },

  // 입력 상태 및 시스템
  CAPS_LOCK: "Caps Lock이 켜져 있네!! 그렇게 소리 안 질러도 다 들린다네!!",
  COOLDOWN: "천천히 하게. 난 영원히 기다릴 수 있거든. 말 그대로.",
  SUBMITTING: "서류 정리 중이네. 기적도 서류 작업은 필요하거든.",
  NO_ACCOUNT: "자네 이름은 내 서류함에 없군. 새 서랍 하나 짜줄까?",
  NO_ACCOUNT_ACTION: "처음부터 다시",
  ERROR: "이런, 내 손이 미끄러졌군. 다시 눌러보게. 비밀로 해주고.",

  // 성공 및 안내 — 자막은 닉네임을 넣는 함수, 목소리(_VOICE)는 닉네임 없이
  LOGIN_SUCCESS: (nickname: string) => `돌아왔군, ${nickname}. 자네 자리 그대로 비워뒀네.`,
  SIGNUP_SUCCESS: (nickname: string) => `완성됐네, ${nickname}! 어때, 천지창조보단 쉽지?`,
  WELCOME_BACK: (nickname: string) => `또 왔군, ${nickname}. 문은 열어뒀네.`,
  RESET_SUCCESS: (nickname: string) => `새 열쇠가 딱 맞네, ${nickname}. 들어오게.`,
  RESET_SUCCESS_VOICE: "새 열쇠가 딱 맞네. 들어오게.",
  LOGIN_SUCCESS_VOICE: "돌아왔군. 자네 자리 그대로 비워뒀네.",
  SIGNUP_SUCCESS_VOICE: "완성됐네! 어때, 천지창조보단 쉽지?",
  WELCOME_BACK_VOICE: "또 왔군. 문은 열어뒀네.",
} as const;

const D = AUTH_DIALOGUE;

/* ─ 필드: 입력 규칙 + 위 문구 ─ */

// voiceKey = AUTH_DIALOGUE 의 묶음 이름. 문구 종류가 붙어 음성 파일이 된다 — 예: EMAIL.prompt.mp3, EMAIL.missing.mp3
// 브라우저 기본 이메일 검사는 "a@b" 도 통과시킨다 — 서버(IsEmail)처럼 점 뒤 끝말까지 있어야 한다
const EMAIL: Field = { name: "email", type: "email", pattern: String.raw`[^@\s]+@[^@\s]+\.[^@\s]{2,}`, voiceKey: "EMAIL", ...D.EMAIL };
const PASSWORD: Field = { name: "password", type: "password", voiceKey: "PASSWORD_LOGIN", ...D.PASSWORD_LOGIN };
// 72자까지 — 서버(bcrypt)가 72바이트 뒤를 잘라 버리니 그보다 길게 못 치게 한다
const NEW_PASSWORD: Field = { name: "password", type: "password", minLength: 8, maxLength: 72, voiceKey: "PASSWORD_SIGNUP", ...D.PASSWORD_SIGNUP };
const PASSWORD_CONFIRM: Field = { name: "passwordConfirm", type: "password", matches: "password", voiceKey: "PASSWORD_CONFIRM", ...D.PASSWORD_CONFIRM };
const NICKNAME: Field = { name: "nickname", type: "text", minLength: 2, maxLength: 12, pattern: "[가-힣A-Za-z0-9_]+", voiceKey: "NICKNAME", ...D.NICKNAME };

export const FIELDS = {
  login: [EMAIL, PASSWORD],
  signup: [EMAIL, NICKNAME, NEW_PASSWORD, PASSWORD_CONFIRM],
  forgot: [{ ...EMAIL, prompt: D.PASSWORD_RESET.prompt, promptKey: "PASSWORD_RESET.prompt" }],
  reset: [{ ...NEW_PASSWORD, prompt: D.PASSWORD_RESET.newPrompt, promptKey: "PASSWORD_RESET.newPrompt" }, PASSWORD_CONFIRM],
} satisfies Record<string, Field[]>;

/* ─ 흐름 자막: 필드와 상관없이 흘러가는 말. voiceKey 가 곧 음성 파일 이름 ─ */

export const LINES = {
  // 페이지마다 서랍을 열기 전 첫 대사
  intro: {
    login: { text: D.INTRO, voiceKey: "INTRO" },
    signup: { text: D.INTRO_SIGNUP, voiceKey: "INTRO_SIGNUP" },
    forgot: { text: D.INTRO_FORGOT, voiceKey: "INTRO_FORGOT" },
    reset: { text: D.PASSWORD_RESET.intro, voiceKey: "PASSWORD_RESET.intro" },
  },
  stale: { text: D.COOLDOWN, voiceKey: "COOLDOWN" },
  capsLock: { text: D.CAPS_LOCK, voiceKey: "CAPS_LOCK" },
  escKey: "ESC:", // 키보드가 있는 화면에서만 앞에 붙는다
  escHint: "앞 서류로", // 조작 안내라 페르소나 밖, 읽지 않음. 누르는 버튼이기도 하다(폰엔 ESC 가 없다)
  nextLabel: "다음", // 입력칸 옆 화살표 버튼(읽지 않음)
  soundHint: "화면 아무 곳이나 누르면 음성이 나옵니다.", // 브라우저가 소리를 막고 있을 때 — 조작 안내라 페르소나 밖, 읽지 않음
  checking: { text: D.SUBMITTING, voiceKey: "SUBMITTING" },
  wrong: { text: D.PASSWORD_LOGIN.incorrect, voiceKey: "PASSWORD_LOGIN.incorrect" },
  noAccount: { text: D.NO_ACCOUNT, voiceKey: "NO_ACCOUNT", link: { href: "/", label: D.NO_ACCOUNT_ACTION } }, // 이메일 확인과 로그인 사이에 계정이 지워졌을 때뿐 — 처음부터 다시
  emailTaken: { text: D.EMAIL.alreadyExists, voiceKey: "EMAIL.alreadyExists", link: { href: "/", label: D.EMAIL.alreadyExistsAction } },
  server: { text: D.ERROR, voiceKey: "ERROR" },
  welcomeBack: (nickname: string): Line => ({ text: D.LOGIN_SUCCESS(nickname), voice: D.LOGIN_SUCCESS_VOICE, voiceKey: "LOGIN_SUCCESS_VOICE" }),
  welcomeNew: (nickname: string): Line => ({ text: D.SIGNUP_SUCCESS(nickname), voice: D.SIGNUP_SUCCESS_VOICE, voiceKey: "SIGNUP_SUCCESS_VOICE" }),
  returning: (nickname: string): Line => ({ text: D.WELCOME_BACK(nickname), voice: D.WELCOME_BACK_VOICE, voiceKey: "WELCOME_BACK_VOICE" }),
  loading: { text: D.LOADING, voiceKey: "LOADING" },
  // 계정이 있든 없든 같은 말 — 누가 가입했는지 새어 나가지 않게
  resetSent: { text: D.PASSWORD_RESET.sent, voiceKey: "PASSWORD_RESET.sent", link: { href: "/", label: D.PASSWORD_RESET.action } },
  resetExpired: { text: D.PASSWORD_RESET.expired, voiceKey: "PASSWORD_RESET.expired", link: { href: "/forgot", label: D.PASSWORD_RESET.expiredAction } },
  resetDone: (nickname: string): Line => ({ text: D.RESET_SUCCESS(nickname), voice: D.RESET_SUCCESS_VOICE, voiceKey: "RESET_SUCCESS_VOICE" }),
} satisfies Record<string, Line | string | ((nickname: string) => Line) | Record<keyof typeof FIELDS, Line>>;

/* ─ 화면 구석 링크 — 버튼·링크·안내 글은 평범한 말투(10/2 사용자). 신의 말투는 자막(목소리로 나오는 대사)에만 ─ */
export const NAV = {
  forgot: "비밀번호 찾기",
  login: "로그인",
  back: "돌아가기",
  notMe: (nickname: string) => `${nickname} 님이 아니라면 다른 계정으로`,
};

// 자동 재촉까지 기다리는 시간
export const STALE_MS = 30_000;

/* ─ 4번 결과: 꺼낸 디스크를 전부 던져 버렸을 때 ─ */
export const RESULT_DIALOGUE = {
  EMPTY: "하나도 안 남기고 던졌네? 까다롭기로는 자네가 나보다 한 수 위야. 다시 뒤져 보지.",
  RETRY: "던진 곡 빼고 다시 찾기", // 던진 곡들 쪽에서 멀어지게 다시 꺼낸다
  MORE: "같은 편지로 더 찾기", // 이어서 더 꺼낸다
  DRY: "이 편지로는 서랍이 텅 비었네. 새로 한 장 써 주면 또 뒤져 보지.",
  DRY_ACTION: "새 편지 쓰기",
  FAILED: "서랍이 뻑뻑해서 안 열리네. 이 서랍장도 나만큼 오래돼서 말이야. 한 번 더 당겨 보게.", // 서버 오류
  FAILED_ACTION: "다시 찾기",
  // 서랍에 넣을 때 네임택(읽지 않는 안내, 평범한 말투)
  NAME_HINT: "서랍 이름표. 고쳐 써도 돼요",
  NAME_ACTION: "이름 붙이기",
  // 편지에 쓴 가수 곡이 서류함에 없을 때 — 화면 머리에 한 줄(읽지 않는 안내, 평범한 말투)
  MISSING_ARTIST: (name: string, kin: string[]) =>
    kin.length ? `아직 ${name} 님 곡은 서류함에 없어요. 결이 비슷한 ${kin.join("·")} 곡으로 골랐어요. 곧 채워 둘게요.` : `아직 ${name} 님 곡은 서류함에 없어요. 비슷한 결로 골랐어요. 곧 채워 둘게요.`,
  MISSING_SONG: (song: string) => `「${song}」은 아직 서류함에 없어요. 결이 비슷한 곡으로 골랐어요. 곧 채워 둘게요.`,
  FEW_ARTIST: (name: string, kin: string[]) => `${name} 님 곡이 아직 적어서 결이 비슷한 ${kin.join("·")} 곡도 함께 골랐어요.`,
  /* 처음 결과 화면 투어 — 화면을 뿌옇게 깔고 헷갈릴 만한 곳을 차례로 비춘다(10/6 사용자: 구석 영어 한 줄 대신).
     target = 비출 DOM(data-tour), area = 3D 자리(디스크 하나·디스크 줄). touch = 터치 화면용 글 */
  TOUR: [
    { area: "disc", title: "디스크를 누르면 들려요", body: "가운데 디스크를 누르면 아래 드라이브에 꽂혀 30초 미리듣기가 나와요.", touch: "가운데 디스크를 탭하면 아래 드라이브에 꽂혀 30초 미리듣기가 나와요." },
    { area: "row", title: "옆 디스크로 넘기기", body: "마우스 휠을 굴리거나 ← → 키로 넘겨요. 디스크를 잡고 끌면 돌려 볼 수도 있어요.", touch: "디스크 위를 옆으로 밀어 넘겨요." },
    { area: "disc", title: "별로면 위로 던지기", body: "디스크를 잡고 위로 휙 던지면 목록에서 빠져요.", touch: "디스크를 위로 휙 밀어 올리면 목록에서 빠져요." },
    { target: "playlist", title: "곡 목록", body: "추천 순위대로 놓인 곡이에요. 누르면 바로 재생돼요.", touch: "PLAYLIST 를 누르면 목록이 펼쳐져요. 곡을 누르면 바로 재생돼요." },
    { target: "store", title: "마음에 들면 서랍에 넣기", body: "이 곡들을 내 서랍에 넣고 영수증 카드로 남겨요. 링크로 공유할 수 있어요." },
  ],
  TOUR_NEXT: "다음",
  TOUR_SKIP: "건너뛰기",
  TOUR_DONE: "시작하기",
  TOUR_NEVER: "다시 보지 않기",
} as const;

export const RESULT_LINES = {
  empty: { text: RESULT_DIALOGUE.EMPTY, voiceKey: "RESULT_EMPTY" },
  dry: { text: RESULT_DIALOGUE.DRY, voiceKey: "RESULT_DRY", link: { href: "/search", label: RESULT_DIALOGUE.DRY_ACTION } },
  failed: { text: RESULT_DIALOGUE.FAILED, voiceKey: "RESULT_FAILED" },
} satisfies Record<string, Line>;

/* ─ 5번 보관함: 아직 넣은 서랍이 없을 때 (읽지 않는 짧은 안내) ─ */
export const ARCHIVE_DIALOGUE = {
  NO_NOTE: "이 곡은 아직 설명이 없어요.", // 디스크를 눌렀을 때 곡 카드 — 설명 없는 곡(브라우저에만 있는 옛 서랍 등)
  EMPTY: "아직 저장한 서랍이 없어요. 편지를 써서 곡을 받아 보세요.",
  WRITE: "편지 쓰기",
  CLOSE: "서랍 닫기", // 연 서랍에서 서류함으로 돌아가기(ESC·빈 곳 클릭도 같다)
  HINT: "CLICK A DRAWER TO OPEN", // 화면 아래 한 줄 — 터치 화면은 TAP
  HINT_TOUCH: "TAP A DRAWER TO OPEN",
};

/* ─ 5번 보관함: 서랍을 유튜브에서 이어 듣기 (읽지 않는 짧은 안내) ─ */
export const PLAYLIST_DIALOGUE = {
  ACTION: "유튜브에서 이어 듣기",
  WORKING: "영상을 찾는 중이에요.",
  OPEN: "재생목록 열기",
  ALL: "모든 곡을 찾았어요.",
  SOME: (n: number) => `${n}곡은 영상을 못 찾았어요. 아래에서 직접 찾아 들어 주세요.`,
  TIRED: "오늘 검색 한도를 다 썼어요. 나머지는 직접 찾아 들어 주세요.",
  LOCAL: "이 서랍은 이 브라우저에만 저장돼 있어요. 곡마다 직접 찾아 들어 주세요.",
  FAIL: "문제가 생겼어요. 다시 눌러 주세요.",
  // 공유 카드 — 누르면 결과 화면과 같은 카드 화면(CardReveal)이 뜬다
  SHARE: "공유 카드",
  CLOSE: "닫기",
} as const;

/* 공유 링크로 들어온 서랍(/s/:id) — 처음 온 사람이 본다 */
export const SHARED_DIALOGUE = {
  YOUTUBE: "유튜브에서 이어 듣기",
  SOME_MISSING: (n: number) => `${n}곡은 영상을 못 찾았어요. 아래에서 직접 찾아 들어요.`,
  SEARCH: "곡마다 유튜브에서 찾아 듣기",
  CTA: "나도 편지 써 보기",
} as const;

/* 서랍에 넣고 나면 인쇄돼 나오는 공유 카드 */
export const CARD_DIALOGUE = {
  TITLE: "공유 카드", // 대화상자 이름(스크린리더)
  PRINTING: "카드를 인쇄하는 중이에요.",
  DOWNLOAD: "사진 다운로드", // 10/3 사용자 — 스토리 공유 창 대신 그림 파일로
  COPY: "링크 복사",
  COPIED: "링크를 복사했어요.",
  ARCHIVE: "보관함으로",
  FAIL: "카드를 만들지 못했어요. 보관함에서 다시 만들 수 있어요.",
} as const;

/* ─ 없는 주소·오류 화면 (app/not-found.tsx·app/error.tsx) — 안내 글이라 평범한 말투 ─ */
export const PAGE_DIALOGUE = {
  NOT_FOUND: "이 서랍은 비어 있어요.",
  NOT_FOUND_SUB: "주소가 바뀌었거나 없는 서랍이에요.",
  ERROR: "서랍이 잠깐 걸렸어요.",
  ERROR_SUB: "다시 열어 보거나 새 편지를 써 주세요.",
  RETRY: "다시 시도",
  WRITE: "새 편지 쓰기",
} as const;

/* ─ 3번 편지지 — 안내 글이라 평범한 말투, "신" 같은 직접적인 단어 금지(.claude/rules/ui.md) ─ */
export const LETTER = {
  // 10/3 사용자: 장르를 적으라는 말과 어떻게 쓰면 잘 찾는지 안내 — 10/4: 아래 작은 글씨 대신 입력칸 placeholder 로
  GUIDE: "지금 상황과 기분을 편하게 적어 주세요. 듣고 싶은 장르(재즈·인디·힙합…)나 좋아하는 가수, 비슷했으면 하는 곡을 함께 쓰면 더 잘 찾아요.",
  SIGN: "— 서류함 앞에서", // 편지 끝 서명 — 줄표까지 서명의 일부(10/3 사용자: 빼지 말 것)
  SEND: "편지 부치기",
} as const;
