#!/usr/bin/env bash
# PreToolUse(Bash|PowerShell) — git 에서 절대 어기면 안 되는 것만 막는다. 막으면 exit 2 + stderr.
#  1. 강제 푸시(--force, --force-with-lease, -f)
#  2. 커밋 메시지에 클로드 서명(Co-Authored-By: Claude, noreply@anthropic.com, Generated with Claude)
#  3. 이 저장소에 로컬 user.email 이 없는 채로 커밋 — 전역(회사) 계정으로 작성자가 찍히는 것 방지
#  4. .env / *.db 가 스테이징된 채로 커밋
#  5. 검증용 puppeteer-core 가 package.json 에 들어간 채로 커밋
INPUT="$(cat)" node -e '
const { execSync } = require("child_process");
const fs = require("fs");
const input = JSON.parse(process.env.INPUT || "{}");
const cmd = String((input.tool_input || {}).command || "");
const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const git = (args) => { try { return execSync(`git ${args}`, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const block = (msg) => { console.error(`차단: ${msg}`); process.exit(2); };

// 명령을 ; && || 로 나눠 git 부분만 본다
for (const part of cmd.split(/;|&&|\|\|/)) {
  if (!/\bgit\b/.test(part)) continue;

  if (/\bpush\b/.test(part) && /(\s--force(-with-lease)?\b|\s-(?!-)[a-zA-Z]*f)/.test(part)) {
    block("강제 푸시는 금지다. 원격 기록을 덮어쓴다 — 필요하면 사용자가 직접 한다.");
  }

  if (/\bcommit\b/.test(part)) {
    // 메시지: -m "..." 는 명령 안에, -F 파일은 읽어서 본다.
    // Git Bash 경로(/c/..., /tmp/...)는 node 가 못 읽으니 cygpath 로 윈도 경로로 바꿔 본다
    let msg = part;
    const f = part.match(/(?:-F|--file)[=\s]+("([^"]+)"|\x27([^\x27]+)\x27|(\S+))/);
    if (f) {
      const p = f[2] || f[3] || f[4];
      let win = "";
      try { win = execSync(`cygpath -w "${p}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
      for (const cand of [p, win, p.replace(/^\/([a-zA-Z])\//, "$1:/")]) {
        try { msg += "\n" + fs.readFileSync(cand, "utf8"); break; } catch {}
      }
    }
    if (/co-authored-by:\s*claude|noreply@anthropic\.com|generated with \[?claude/i.test(msg)) {
      block("커밋에 클로드 서명을 넣지 않는다. Co-Authored-By 줄을 빼고 다시 커밋해라.");
    }
    if (!git("config --local user.email").trim()) {
      block("이 저장소에 로컬 user.email 이 없다 — 전역(회사) 계정으로 작성자가 찍힌다. 사용자에게 작성자를 확인받고 git config user.email 을 먼저 설정해라.");
    }
    // -a 로 커밋하면 추적 중인 변경도 같이 들어간다
    const staged = git("diff --cached --name-only") + (/\s-(?!-)[a-zA-Z]*a|--all\b/.test(part) ? git("diff --name-only") : "");
    const bad = staged.split("\n").filter((f) => /(^|\/)\.env(\.(?!example$)[^/]+)?$|\.db(-journal)?$/.test(f));
    if (bad.length) block(`비밀값·DB 파일이 커밋에 들어가 있다: ${bad.join(", ")}. git reset 으로 빼라.`);
    if (/puppeteer-core/.test(git("diff --cached -- \"*package.json\""))) {
      block("검증용 puppeteer-core 가 package.json 에 들어가 있다. npm uninstall puppeteer-core 후 다시 스테이징해라.");
    }
  }
}
'
