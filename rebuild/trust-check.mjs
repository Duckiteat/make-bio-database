#!/usr/bin/env node
// 독립 판정 (DEC-0088 Q2 · DEC-0089 — 사람 클릭에 기대지 않는 안전 구조의 첫 겹). 읽기만 한다.
//   node rebuild/trust-check.mjs <base> <head>     base 와 head 의 갈림점부터 head 까지의 "순 변경" 을 판정
// 왜: CI 의 다른 단계는 push 된 커밋 자신의 코드 · 워크플로로 돈다 — 같은 push 가 검사를 끄거나(C6) 의존 파일 한 줄로 판정을 바꾸고(N10)
//   병합 커밋 속에 변경을 숨길 수 있다(N9 — ci-zone 은 병합 커밋을 보지 않음). 이 파일은 main 의 사본으로만 돈다(.github/workflows/trust.yml —
//   pull_request_target: 워크플로 · 이 코드 · 의존 파일 모두 main 의 것, PR 은 git 객체로만 읽고 실행하지 않음).
// 판정 둘 — 커밋 하나하나가 아니라 갈림점 → head 의 순 변경으로 본다(병합 커밋 · 커밋 나누기와 상관없음):
//   ① 도장 등록부: 승인 도장 지우기 · 바꾸기 · 승인자 밖 새 승인 도장(judicial/attestation.js registryPolicy — 선언 없는 커밋과 같은 정책, RULE-0548)
//   ② 지키는 자리: 저장 지도의 L6 자리 + 판정 코드의 의존 닫힘(require · import 를 따라감 — 목록을 손으로 적지 않음, N10)을 바꾼 PR 은
//      사람 확인 필요로 실패한다. 사람은 GitHub 의 규칙 우회(기록이 남음)로만 병합 — 클릭이 아니라 기록된 예외.
// 한계: 사람과 AI 가 같은 GitHub 계정이면 ② 의 우회도 그 계정이 할 수 있다 — 신원 분리(DEC-0088 Q1) 뒤에 완성된다.
// 종료 코드: 0 = 통과 · 1 = 등록부 정책 위반 또는 지키는 자리 변경(사람 확인) · 2 = 판정 못 함
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATT = createRequire(import.meta.url)('../judicial/attestation.js');
const REGISTRY = 'attestations/registry.json', MAP = 'docs/textbook/storage-map.json';
// 판정 코드의 뿌리 — 여기서 require · import 를 따라간 닫힘 전체를 지킨다
export const JUDGE_ROOTS = ['rebuild/trust-check.mjs', 'rebuild/ci-zone.mjs', 'rebuild/gate.mjs', 'rebuild/bundle.mjs',
  'judicial/attestation.js', 'judicial/acceptance.js', 'judicial/transition_audit.js', 'judicial/approval.js', 'judicial/authority.js'];

const git = (args, root) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const show = (rev, file, root) => { try { return git(['show', `${rev}:${file}`], root); } catch { return null; } };
const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$');

// 글 하나의 상대 경로 의존 (순수) — require('./x') · import … from '../y' · import('./z') · createRequire(…)('../w')
export function depsOf(file, text) {
  const out = new Set(), re = /(?:require|import)\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]|\(\s*import\.meta\.url\s*\)\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
  for (const m of String(text || '').matchAll(re)) out.add(normalize(join(dirname(file), m[1] || m[2] || m[3] || m[4])).replace(/\\/g, '/'));
  return [...out];
}

// 의존 닫힘 (순수) — read(path) 가 글(없으면 null)을 준다. 확장자 없는 경로는 .js · .mjs · .cjs · .json 을 차례로
export function closure(roots, read) {
  const seen = new Set(), todo = [...roots];
  const resolve = (p) => { if (read(p) != null) return p; for (const e of ['.js', '.mjs', '.cjs', '.json']) if (read(p + e) != null) return p + e; return null; };
  while (todo.length) {
    const p = resolve(todo.pop()); if (!p || seen.has(p)) continue;
    seen.add(p); if (/\.(m|c)?js$/.test(p)) todo.push(...depsOf(p, read(p)));
  }
  return [...seen].sort();
}

// 지키는 자리 (순수): 저장 지도의 L6 (글롭 포함) + 의존 닫힘
export function guardedOf(map, deps) {
  // 영수증(write_keys gate — 문지기가 쓰는 선언)은 뺀다: 모든 세션이 바꾸고, 판정의 기준이 아니라 증거 후보다 (ci-zone 도 판정에서 뺌)
  const l6 = ((map && map.files) || []).filter((f) => f.level === 'L6' && !(f.write_keys || []).every((k) => k === 'gate')).map((f) => f.path);
  const exact = new Set([...l6.filter((p) => !p.includes('*')), ...deps]), globs = l6.filter((p) => p.includes('*')).map(glob);
  return (p) => exact.has(p) || globs.some((g) => g.test(p));
}

// 판정 (순수): reg = { before, after } (등록부 글, 없으면 null) · changed = 순 변경 경로 · isGuarded
export function judge({ reg, changed, isGuarded }) {
  const stamps = reg ? ATT.registryPolicy(reg.before ? JSON.parse(reg.before) : { stamps: [] }, reg.after ? JSON.parse(reg.after) : { stamps: [] }, null) : [];
  const guarded = changed.filter(isGuarded);
  return { ok: !stamps.length && !guarded.length, stamps, guarded };
}

export function trustCheck(base, head, root = ROOT, trusted = ROOT) {
  let mb;
  try { mb = git(['merge-base', base, head], root).trim(); } catch { return { exit: 2, lines: [`갈림점(${base}, ${head})을 찾을 수 없음 — 전체 역사가 필요 (fetch-depth: 0)`] }; }
  const changed = git(['diff', '--name-only', '--no-renames', mb, head], root).split('\n').filter(Boolean);
  // 지키는 자리의 기준은 판정하는 쪽(main 사본 = trusted)의 파일 — PR 이 자기 지도를 낮춰 빠져나가지 못하게
  const readT = (p) => { try { return readFileSync(join(trusted, p), 'utf8'); } catch { return null; } }; // 파일로 읽음 — GIT_DIR 이 판정 대상을 가리켜도 섞이지 않게
  let map = null; try { map = JSON.parse(readT(MAP)); } catch { return { exit: 2, lines: [`판정 쪽에 ${MAP} 이 없음`] }; }
  const deps = closure(JUDGE_ROOTS, readT);
  const reg = changed.includes(REGISTRY) ? { before: show(mb, REGISTRY, root), after: show(head, REGISTRY, root) } : null;
  const r = judge({ reg, changed, isGuarded: guardedOf(map, deps) });
  const lines = [`독립 판정 (main 의 코드) — 갈림점 ${mb.slice(0, 8)} → ${head.slice(0, 8)} · 순 변경 ${changed.length} 파일 · 지키는 자리 ${deps.length} 의존 + 저장 지도 L6`];
  for (const v of r.stamps) lines.push(`✗ 도장 등록부 [${v.rule}] ${v.msg}`);
  if (r.guarded.length) lines.push(`✗ 지키는 자리 변경 ${r.guarded.length} — 사람 확인 필요 (GitHub 규칙 우회로만 병합, 기록이 남음): ${r.guarded.slice(0, 20).join(' · ')}${r.guarded.length > 20 ? ' …' : ''}`);
  if (r.ok) lines.push('통과 — 등록부 정책 위반 0 · 지키는 자리 변경 0');
  return { exit: r.ok ? 0 : 1, lines, ...r, changed, deps };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) { console.error('사용: node rebuild/trust-check.mjs <base> <head>'); process.exit(2); }
  // 판정 대상 저장소는 GIT_DIR(또는 지금 폴더), 판정 기준(지도 · 의존)은 이 파일이 놓인 사본
  const r = trustCheck(base, head, process.cwd(), ROOT); console.log(r.lines.join('\n')); process.exit(r.exit);
}
