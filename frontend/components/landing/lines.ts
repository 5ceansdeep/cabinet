import type { Field } from "./CabinetScene";

// voice — 목소리로 읽을 문장이 자막과 다를 때 (닉네임은 자막에만)
// voiceKey — 음성 파일 이름. public/voice/{voiceKey}.mp3 (없으면 기계 음성)
export type Line = { text: string; voice?: string; voiceKey?: string; link?: { href: string; label: string } };

/* 자막·목소리 문구 — 서류함의 주인 (브루스 올마이티 신 페르소나, docs/voice-persona.md).
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
    alreadyExistsAction: "그 서랍 열러 가기",
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
    action: "돌아가지",
  },

  // 입력 상태 및 시스템
  CAPS_LOCK: "Caps Lock이 켜져 있네!! 그렇게 소리 안 질러도 다 들린다네!!",
  COOLDOWN: "천천히 하게. 난 영원히 기다릴 수 있거든. 말 그대로.",
  SUBMITTING: "서류 정리 중이네. 기적도 서류 작업은 필요하거든.",
  NO_ACCOUNT: "자네 이름은 내 서류함에 없군. 새 서랍 하나 짜줄까?",
  NO_ACCOUNT_ACTION: "새로 등록하기",
  ERROR: "이런, 내 손이 미끄러졌군. 다시 눌러보게. 비밀로 해주고.",

  // 성공 및 안내 — 자막은 닉네임을 넣는 함수, 목소리(_VOICE)는 닉네임 없이
  LOGIN_SUCCESS: (nickname: string) => `돌아왔군, ${nickname}. 자네 자리 그대로 비워뒀네.`,
  SIGNUP_SUCCESS: (nickname: string) => `완성됐네, ${nickname}! 어때, 천지창조보단 쉽지?`,
  WELCOME_BACK: (nickname: string) => `또 왔군, ${nickname}. 문은 열어뒀네.`,
  LOGIN_SUCCESS_VOICE: "돌아왔군. 자네 자리 그대로 비워뒀네.",
  SIGNUP_SUCCESS_VOICE: "완성됐네! 어때, 천지창조보단 쉽지?",
  WELCOME_BACK_VOICE: "또 왔군. 문은 열어뒀네.",
} as const;

const D = AUTH_DIALOGUE;

/* ─ 필드: 입력 규칙 + 위 문구 ─ */

// voiceKey = AUTH_DIALOGUE 의 묶음 이름. 문구 종류가 붙어 음성 파일이 된다 — 예: EMAIL.prompt.mp3, EMAIL.missing.mp3
const EMAIL: Field = { name: "email", type: "email", voiceKey: "EMAIL", ...D.EMAIL };
const PASSWORD: Field = { name: "password", type: "password", voiceKey: "PASSWORD_LOGIN", ...D.PASSWORD_LOGIN };
const NEW_PASSWORD: Field = { name: "password", type: "password", minLength: 8, voiceKey: "PASSWORD_SIGNUP", ...D.PASSWORD_SIGNUP };
const PASSWORD_CONFIRM: Field = { name: "passwordConfirm", type: "password", matches: "password", voiceKey: "PASSWORD_CONFIRM", ...D.PASSWORD_CONFIRM };
const NICKNAME: Field = { name: "nickname", type: "text", minLength: 2, maxLength: 12, pattern: "[가-힣A-Za-z0-9_]+", voiceKey: "NICKNAME", ...D.NICKNAME };

export const FIELDS = {
  login: [EMAIL, PASSWORD],
  signup: [EMAIL, NICKNAME, NEW_PASSWORD, PASSWORD_CONFIRM],
  forgot: [{ ...EMAIL, prompt: D.PASSWORD_RESET.prompt, promptKey: "PASSWORD_RESET.prompt" }],
} satisfies Record<string, Field[]>;

/* ─ 흐름 자막: 필드와 상관없이 흘러가는 말. voiceKey 가 곧 음성 파일 이름 ─ */

export const LINES = {
  // 페이지마다 서랍을 열기 전 첫 대사
  intro: {
    login: { text: D.INTRO, voiceKey: "INTRO" },
    signup: { text: D.INTRO_SIGNUP, voiceKey: "INTRO_SIGNUP" },
    forgot: { text: D.INTRO_FORGOT, voiceKey: "INTRO_FORGOT" },
  },
  stale: { text: D.COOLDOWN, voiceKey: "COOLDOWN" },
  capsLock: { text: D.CAPS_LOCK, voiceKey: "CAPS_LOCK" },
  escHint: "ESC — 앞 서류로", // 조작 안내라 페르소나 밖, 읽지 않음
  soundHint: "화면 아무 곳이나 클릭하면 음성이 나옵니다.", // 브라우저가 소리를 막고 있을 때 — 조작 안내라 페르소나 밖, 읽지 않음
  checking: { text: D.SUBMITTING, voiceKey: "SUBMITTING" },
  wrong: { text: D.PASSWORD_LOGIN.incorrect, voiceKey: "PASSWORD_LOGIN.incorrect" },
  noAccount: { text: D.NO_ACCOUNT, voiceKey: "NO_ACCOUNT", link: { href: "/signup", label: D.NO_ACCOUNT_ACTION } },
  emailTaken: { text: D.EMAIL.alreadyExists, voiceKey: "EMAIL.alreadyExists", link: { href: "/", label: D.EMAIL.alreadyExistsAction } },
  server: { text: D.ERROR, voiceKey: "ERROR" },
  welcomeBack: (nickname: string): Line => ({ text: D.LOGIN_SUCCESS(nickname), voice: D.LOGIN_SUCCESS_VOICE, voiceKey: "LOGIN_SUCCESS_VOICE" }),
  welcomeNew: (nickname: string): Line => ({ text: D.SIGNUP_SUCCESS(nickname), voice: D.SIGNUP_SUCCESS_VOICE, voiceKey: "SIGNUP_SUCCESS_VOICE" }),
  returning: (nickname: string): Line => ({ text: D.WELCOME_BACK(nickname), voice: D.WELCOME_BACK_VOICE, voiceKey: "WELCOME_BACK_VOICE" }),
  loading: { text: D.LOADING, voiceKey: "LOADING" },
  // 계정이 있든 없든 같은 말 — 누가 가입했는지 새어 나가지 않게
  resetSent: { text: D.PASSWORD_RESET.sent, voiceKey: "PASSWORD_RESET.sent", link: { href: "/", label: D.PASSWORD_RESET.action } },
} satisfies Record<string, Line | string | ((nickname: string) => Line) | Record<keyof typeof FIELDS, Line>>;

/* ─ 화면 구석 링크 ─ */
export const NAV = {
  signup: "처음 왔나? — 등록하기",
  forgot: "열쇠를 잃어버렸나?",
  login: "이미 등록했나? — 들어가기",
  back: "돌아가기",
  notMe: (nickname: string) => `${nickname} 말고 다른 사람인가? — 다른 이름으로`, // 받침 상관없게 "말고"
};

// 자동 재촉까지 기다리는 시간
export const STALE_MS = 30_000;
