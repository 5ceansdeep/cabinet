#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit) — 비밀값·DB 파일은 클로드가 고치지 못하게 막는다.
# 막으면 exit 2 + stderr (클로드에게 이유가 전달된다). 통과면 exit 0.
# 막는 것: .env, .env.<무엇> (단 .env.example 은 허용), *.db, *.db-journal
INPUT="$(cat)" node -e '
const input = JSON.parse(process.env.INPUT || "{}");
const t = input.tool_input || {};
const file = String(t.file_path || t.notebook_path || "");
const name = file.split(/[\\/]/).pop();
const secret = /^\.env(\..+)?$/.test(name) && name !== ".env.example";
const db = /\.db(-journal)?$/.test(name);
if (secret || db) {
  console.error(`차단: ${name} 은(는) 고칠 수 없다 — ${secret ? "비밀값 파일이다. 새 키는 .env.example 에 적고 사용자에게 .env 를 채워 달라고 해라" : "로컬 DB 파일이다. 스키마·마이그레이션으로만 바꾼다"}.`);
  process.exit(2);
}
'
