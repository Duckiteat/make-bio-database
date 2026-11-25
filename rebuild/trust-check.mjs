#!/usr/bin/env node
// 독립 판정 (DEC-0088 Q2 · DEC-0089 — 사람 클릭에 기대지 않는 안전 구조의 첫 겹). 읽기만 한다.
//   node rebuild/trust-check.mjs <base> <head>     base 와 head 의 갈림점부터 head 까지의 "순 변경" 을 판정
// 왜: CI 의 다른 단계는 push 된 커밋 자신의 코드 · 워크플로로 돈다 — 같은 push 가 검사를 끄거나(C6) 의존 파일 한 줄로 판정을 바꾸고(N10)
//   병합 커밋 속에 변경을 숨길 수 있다(N9 — ci-zone 은 병합 커밋을 보지 않음). 이 파일은 main 의 사본으로만 돈다(.github/workflows/trust.yml —
//   pull_request_target: 워크플로 · 이 코드 · 의존 파일 모두 main 의 것, PR 은 git 객체로만 읽고 실행하지 않음).
// 판정 둘 — 커밋 하나하나가 아니라 갈림점 → head 의 순 변경으로 본다(병합 커밋 · 커밋 나누기와 상관없음):
//   ① 도장 등록부: 승인 도장 지우기 · 바꾸기 · 승인자 밖 새 승인 도장(judicial/attestation.js registryPolicy — 선언 없는 커밋과 같은 정책, RULE-0548)
//   ② 지키는 자리: 저장 지도의 L6 자리(글롭 — .github/** 처럼 폴더 전부, 새 파일도) + 판정 코드의 의존 닫힘(require · import 를 따라감 — 목록을 손으로 적지 않음, N10)은
//      사람 서명 커밋으로만 바꿀 수 있다(PLAN-135 · DEC-0101 · RULE-0553): 그 자리를 바꾼 커밋이 모두 사람 서명(GitHub 이 검증한 서명 + 커미터가 사람 계정 —
//      서명 사실은 워크플로가 GitHub API 로 모아 --signatures 로) · 병합 커밋이 부모에 없던 내용을 넣지 않음. 사실이 없으면 사람이 아니다(fail-closed).
//      사람의 승인(머리 커밋에 묶인 코드 소유자 리뷰)은 이 판정이 보지 않는다 — 리뷰 이벤트는 main 의 코드로 돌 수 없어 GitHub 규칙 세트(코드 소유자 리뷰 ·
//      지난 승인 무효)가 병합 전에, workflow approval 이 병합 뒤에 본다.
// 종료 코드: 0 = 통과 · 1 = 등록부 정책 위반 또는 지키는 자리 변경(사람 확인) · 2 = 판정 못 함
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { HUMANS, humanSigned } from './ci-zone.mjs'; // 사람 서명 = GitHub 이 검증한 서명 + 커미터가 사람 계정 (DEC-0094 — 판정 하나를 함께 씀)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATT = createRequire(import.meta.url)('../judicial/attestation.js');
const REGISTRY = 'attestations/registry.json', MAP = 'docs/textbook/storage-map.json';
const SIGN_RULE = 'RULE-0553'; // 지키는 자리는 사람 서명 커밋으로만 (PLAN-135)
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

// 지키는 자리를 바꾼 길 (순수 — PLAN-135 · DEC-0098 · DEC-0101): 사람 서명 커밋으로만 바꿀 수 있다.
//   touches = { 경로: [그 경로를 바꾼 병합 아닌 커밋 sha …] } · merges = [{ c, paths: { 경로: { self, parents: [blob…] } } }] · signed(sha) → 사람 서명이면 true
//   ① 그 경로를 바꾼 커밋이 모두 사람 서명 ② 병합 커밋 속에서 새로 생긴 내용이 없음(병합 커밋의 그 경로 내용 = 부모 중 하나 — 몰래 넣은 병합 막기)
//   ③ 바꾼 커밋이 하나도 없는데 순 변경이 있으면(설명되지 않는 변경) 실패. 사람의 승인(머리 커밋에 묶인 코드 소유자 리뷰)은 GitHub 규칙 세트가 병합 전에,
//   병합 뒤에는 workflow approval 이 사실로 본다 — 이 판정은 승인 리뷰를 보지 않는다(리뷰 이벤트는 main 의 코드로 돌 수 없어서, DEC-0101)
export function signedPaths({ guarded, touches, merges, signed }) {
  const unsigned = [], evil = [], unexplained = [];
  for (const p of guarded) {
    const cs = (touches && touches[p]) || [];
    if (!cs.length) unexplained.push(p);
    for (const c of cs) if (!signed(c)) unsigned.push({ path: p, commit: c });
    for (const m of merges || []) { const x = m.paths && m.paths[p]; if (x && !x.parents.includes(x.self)) evil.push({ path: p, commit: m.c }); }
  }
  return { ok: !unsigned.length && !evil.length && !unexplained.length, unsigned, evil, unexplained };
}

// 판정 (순수): reg = { before, after } (등록부 글, 없으면 null) · changed = 순 변경 경로 · isGuarded · how = 지키는 자리를 바꾼 길(signedPaths 의 재료, 없으면 사람 서명 없음으로)
export function judge({ reg, changed, isGuarded, how = null }) {
  const stamps = reg ? ATT.registryPolicy(reg.before ? JSON.parse(reg.before) : { stamps: [] }, reg.after ? JSON.parse(reg.after) : { stamps: [] }, null) : [];
  const guarded = changed.filter(isGuarded);
  const sp = signedPaths({ guarded, touches: how ? how.touches : {}, merges: how ? how.merges : [], signed: how ? how.signed : () => false });
  return { ...sp, ok: !stamps.length && sp.ok, stamps, guarded }; // sp.ok 는 지키는 자리만의 것 — 등록부 정책과 함께 덮어쓴다
}

// signatures = { sha: { verified, committer } } — 워크플로가 GitHub API 로 모은 서명 사실(DEC-0094 와 같은 모양). 없으면 아무 커밋도 사람 서명이 아님(fail-closed)
export function trustCheck(base, head, root = ROOT, trusted = ROOT, signatures = {}) {
  let mb;
  try { mb = git(['merge-base', base, head], root).trim(); } catch { return { exit: 2, lines: [`갈림점(${base}, ${head})을 찾을 수 없음 — 전체 역사가 필요 (fetch-depth: 0)`] }; }
  const changed = git(['diff', '--name-only', '--no-renames', mb, head], root).split('\n').filter(Boolean);
  // 지키는 자리의 기준은 판정하는 쪽(main 사본 = trusted)의 파일 — PR 이 자기 지도를 낮춰 빠져나가지 못하게
  const readT = (p) => { try { return readFileSync(join(trusted, p), 'utf8'); } catch { return null; } }; // 파일로 읽음 — GIT_DIR 이 판정 대상을 가리켜도 섞이지 않게
  let map = null; try { map = JSON.parse(readT(MAP)); } catch { return { exit: 2, lines: [`판정 쪽에 ${MAP} 이 없음`] }; }
  const deps = closure(JUDGE_ROOTS, readT);
  const reg = changed.includes(REGISTRY) ? { before: show(mb, REGISTRY, root), after: show(head, REGISTRY, root) } : null;
  const isGuarded = guardedOf(map, deps), guarded = changed.filter(isGuarded), sig = signatures || {};
  const blob = (rev, p) => { try { return git(['rev-parse', '--verify', '-q', `${rev}:${p}`], root).trim(); } catch { return null; } };
  const touches = Object.fromEntries(guarded.map((p) => [p, git(['log', '--format=%H', '--no-merges', `${mb}..${head}`, '--', p], root).split('\n').filter(Boolean)]));
  const merges = guarded.length ? git(['rev-list', '--merges', `${mb}..${head}`], root).split('\n').filter(Boolean).map((c) => {
    const ps = git(['rev-list', '--parents', '-n', '1', c], root).trim().split(' ').slice(1);
    return { c, paths: Object.fromEntries(guarded.map((p) => [p, { self: blob(c, p), parents: ps.map((x) => blob(x, p)) }])) };
  }) : [];
  const r = judge({ reg, changed, isGuarded, how: { touches, merges, signed: (c) => humanSigned(sig[c]) } });
  const lines = [`독립 판정 (main 의 코드) — 갈림점 ${mb.slice(0, 8)} → ${head.slice(0, 8)} · 순 변경 ${changed.length} 파일 · 지키는 자리 ${deps.length} 의존 + 저장 지도 L6`];
  for (const v of r.stamps) lines.push(`✗ 도장 등록부 [${v.rule}] ${v.msg}`);
  if (r.guarded.length) lines.push(`${r.unsigned.length || r.evil.length || r.unexplained.length ? '✗' : '✓'} 지키는 자리 변경 ${r.guarded.length}: ${r.guarded.slice(0, 20).join(' · ')}${r.guarded.length > 20 ? ' …' : ''}`);
  for (const u of r.unsigned) lines.push(`✗ [${SIGN_RULE}] ${u.path} 을 바꾼 커밋 ${u.commit.slice(0, 8)} 은 사람 서명 커밋이 아님 (검증된 서명 + 커미터 ${HUMANS.join(' · ')})`);
  for (const e of r.evil) lines.push(`✗ [${SIGN_RULE}] 병합 커밋 ${e.commit.slice(0, 8)} 이 ${e.path} 에 부모 어디에도 없던 내용을 넣음`);
  for (const p of r.unexplained) lines.push(`✗ [${SIGN_RULE}] ${p} 의 변경을 설명하는 커밋이 없음`);
  if (r.ok) lines.push(r.guarded.length ? `통과 — 등록부 정책 위반 0 · 지키는 자리 변경은 모두 사람 서명 커밋 (사람의 승인은 GitHub 규칙 세트가 병합 전에)` : '통과 — 등록부 정책 위반 0 · 지키는 자리 변경 0');
  return { exit: r.ok ? 0 : 1, lines, ...r, changed, deps };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2), si = argv.indexOf('--signatures');
  let signatures = {};
  if (si >= 0) { try { signatures = JSON.parse(readFileSync(argv[si + 1], 'utf8')); } catch (e) { console.error(`서명 사실 '${argv[si + 1]}' 을 읽을 수 없음: ${e.message}`); process.exit(2); } argv.splice(si, 2); }
  const [base, head] = argv;
  if (!base || !head) { console.error('사용: node rebuild/trust-check.mjs <base> <head> [--signatures <파일>]'); process.exit(2); }
  // 판정 대상 저장소는 GIT_DIR(또는 지금 폴더), 판정 기준(지도 · 의존)은 이 파일이 놓인 사본
  const r = trustCheck(base, head, process.cwd(), ROOT, signatures); console.log(r.lines.join('\n')); process.exit(r.exit);
}
