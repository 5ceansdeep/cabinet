import { describe, expect, it } from 'vitest';
import { greetingText } from './voice.js';

describe('이름을 부르는 인사', () => {
  it('첫 문장에 이름이 들어가고 쉼은 그대로 — 자막 두 줄과 맞는다', () => {
    expect(greetingText('login', '수현')).toBe('Welcome back, 수현.<break time="0.5s"/>I kept your spot right where you left it.');
    expect(greetingText('returning', 'Mina').split('<break')).toHaveLength(2);
  });
  it('밑줄은 띄어 읽는다', () => {
    expect(greetingText('signup', 'night_owl')).toContain('All set, night owl!');
  });
});
