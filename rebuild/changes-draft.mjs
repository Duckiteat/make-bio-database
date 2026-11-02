#!/usr/bin/env node
// CHANGES 초안 (STG-11e · DEC-0047) — 바뀐 파일과 장부 · 계획 사건에서 CHANGES 행의 범위 칸 · 확인 칸을 채운 초안을 낸다.
//   node rebuild/changes-draft.mjs         초안 한 행을 표준 출력으로 (파일을 쓰지 않는다 — 붙여 넣는 것은 손으로)
// 이유 · 영향 칸과 제목은 손으로 쓴다 — 기계가 아는 것은 "무엇이 바뀌었나" 뿐이다. 끝나는 조건: 범위 칸 ⊇ git diff 의 파일.
// 생성물(rebuild/status · docs/plan · 중심 문서)은 폴더로 묶어 적는다 — 파일 하나하나는 CHANGES 에 의미가 없다.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, root) => { try { return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 }); } catch { return ''; } };

// 묶어 적는 생성물 — [시작 글, 적을 이름]
export const GENERATED = [['rebuild/status/', 'rebuild/status/ (생성 문서)'], ['docs/plan/', 'docs/plan/ (생성 문서)'], ['workspace/receipts/', 'workspace/receipts/ (영수증)']];
const HUB = new Set(['CLAUDE.md']);

// git 이 보는 바뀐 파일 — 스테이지 · 작업 트리 · 새 파일 (이름이 바뀐 것은 새 이름)
export function changedFiles(root = ROOT) {
  return git(['status', '--porcelain', '-uall'], root).split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
}

// 범위 칸 — 파일 목록에서 만든다. 생성물은 폴더로 묶고 나머지는 파일 이름 그대로
export function scopeOf(files) {
  const groups = new Map(), plain = [];
  for (const f of [...new Set(files)].sort()) {
    const g = GENERATED.find(([pre]) => f.startsWith(pre));
    if (g) groups.set(g[1], (groups.get(g[1]) || 0) + 1);
    else if (HUB.has(f) || /^docs\/modes\/|^\.claude\/skills\//.test(f)) groups.set('중심 문서 · 모드 문서 · 스킬 (생성)', (groups.get('중심 문서 · 모드 문서 · 스킬 (생성)') || 0) + 1);
    else plain.push(f);
  }
  return [...plain.map((f) => `\`${f}\``), ...[...groups].map(([k, n]) => `${k} ${n}`)].join(' · ');
}

// 범위 칸이 파일을 덮는가 — 끝나는 조건의 검사 (파일 이름이 그대로 있거나 묶음 이름 아래에 든다)
export function covers(scope, file) {
  if (scope.includes(`\`${file}\``)) return true;
  const g = GENERATED.find(([pre]) => file.startsWith(pre));
  if (g) return scope.includes(g[1]);
  return (HUB.has(file) || /^docs\/modes\/|^\.claude\/skills\//.test(file)) && scope.includes('중심 문서 · 모드 문서 · 스킬 (생성)');
}

// HEAD 이후 줄이 더해진 JSONL 사건들 (장부 · 계획 기록은 덧붙이기만)
export function addedRows(root, file) {
  return git(['diff', 'HEAD', '-U0', '--', file], root).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => { try { return JSON.parse(l.slice(1)); } catch { return null; } }).filter(Boolean);
}

// 확인 칸 — 새로 생긴 변이 시험 결과와 장부 · 계획 사건 수
export function checkOf(root = ROOT) {
  const led = addedRows(root, 'rebuild/rules/changes.jsonl'), plan = addedRows(root, 'rebuild/state/plan-log.jsonl'), enf = addedRows(root, 'rebuild/rules/enforcement.jsonl');
  const bits = [];
  if (enf.length) bits.push(`변이 ${enf.map((e) => `${e.rule} ${e.result}`).join(' · ')}`);
  if (led.length) bits.push(`규칙 장부 사건 ${led.length}`);
  if (plan.length) bits.push(`계획 사건 ${plan.length}${[...new Set(plan.map((p) => p.item))].length ? ` (${[...new Set(plan.map((p) => p.item))].slice(0, 6).join(' · ')})` : ''}`);
  bits.push('돈 시험: (손으로 — finish 결과)');
  return bits.join(' · ');
}

export function draftRow(root = ROOT, today = new Date().toISOString().slice(0, 10)) {
  const files = changedFiles(root), scope = scopeOf(files);
  return { files, scope, row: `| ${today} · (제목을 손으로) | ${scope || '(바뀐 파일 없음)'} | (이유를 손으로) | (영향을 손으로) | ${checkOf(root)} |` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { files, scope, row } = draftRow();
  const miss = files.filter((f) => !covers(scope, f));
  console.log(row);
  if (miss.length) { console.error(`범위 칸이 덮지 못한 파일 ${miss.length}: ${miss.join(' · ')}`); process.exit(1); }
}
