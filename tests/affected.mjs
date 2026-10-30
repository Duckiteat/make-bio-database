#!/usr/bin/env node
// 바뀐 것만 시험 (DEC-0037: 커밋 = 바뀐 것에 닿는 시험만, push = 전체)
//   node tests/affected.mjs           닿는 시험만 — 시험마다 마지막으로 통과했을 때 읽은 파일 중 바뀐 것이 있을 때만 돌림
//   node tests/affected.mjs --full    전체 + 추적 구멍 검사 (환경 BIODB_TEST_SCOPE=full 도 같음 — 문지기 finish --full 이 넘김)
//   node tests/affected.mjs --list    고르기만 — 시험마다 돌리는(건너뛰는) 까닭
// 지도: 시험 파일마다 { tree(통과했을 때의 작업 파일 스냅숏), head, files, dirs, git } — tests/trace.mjs 가 실제 읽기에서 계산하고 손으로 쓰지 않는다.
//   저장소 밖 임시 폴더에 저장소마다 하나(서기 초안). 없으면(새 컨테이너) 모두 돌림. 돌린 묶음이 모두 통과했을 때만 그 시험들의 항목을 새로 쓴다.
// 고르기 (시험 T · 항목 e · 지금 스냅숏 S): e 없음 → 돌림 · e.tree 와 S 사이에 바뀐 파일이 T 자신 · e.files · e.dirs(목록을 읽은 폴더) ·
//   추적 기계(HARNESS)에 닿음 → 돌림 · e.git 이고 HEAD 가 바뀜 → 돌림 · 그 밖 → 건너뜀. 근거: 시험은 결정론이라 같은 입력이면 같은 결과이고,
//   새 의존은 이미 읽힌 파일(가져오는 쪽)이 바뀌어야 생긴다. 새 파일은 그 폴더를 목록으로 읽은 시험이 잡는다.
// 추적 구멍 검사 (전체일 때): 건너뛸 수 있었던 시험이 지도에 없는 파일을 새로 읽으면 실패 — 추적이 보지 못한 입력이 있다는 뜻.
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { snapshotTree, treeDiff, headOf } from './snapshot.mjs';
import * as CLERK from '../legislative/clerk.mjs';

// 저장소 = 부른 자리의 git 최상위 (문지기와 같은 방식 — 명령은 저장소 최상위에서). 추적기는 이 파일 곁의 것
export const rootOf = (cwd) => execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
const TRACER = new URL('./trace.mjs', import.meta.url).href;
export const HARNESS = ['tests/affected.mjs', 'tests/trace.mjs', 'tests/snapshot.mjs'];
export const mapFile = (root) => join(tmpdir(), `biodb-testmap-${createHash('sha256').update(resolve(root)).digest('hex').slice(0, 12)}.json`);
export const testFiles = (root) => readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => 'tests/' + f);

// 항목 e 가 경로 p 에 닿나 — 읽은 파일이거나, 목록을 읽은 폴더(재귀 '/**' · 저장소 전체 '**') 안
export function covers(e, p) {
  if (e.files.includes(p)) return true;
  const d = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.';
  return e.dirs.some((x) => x === d || x === '**' || (x.endsWith('/**') && p.startsWith(x.slice(0, -2))));
}
// 고르기 (순수) — diff(tree): 그 스냅숏 이후 바뀐 경로 · head: 지금 HEAD
export function choose({ tests, map, diff, head }) {
  return tests.map((t) => {
    const e = map && map.tests && map.tests[t];
    if (!e) return { test: t, run: true, why: '지도에 없음' };
    const ch = diff(e.tree), hits = ch.filter((p) => p === t || HARNESS.includes(p) || covers(e, p));
    if (hits.length) return { test: t, run: true, why: `읽은 파일이 바뀜: ${hits.slice(0, 3).join(' · ')}${hits.length > 3 ? ` 외 ${hits.length - 3}` : ''}` };
    if (e.git && e.head !== head) return { test: t, run: true, why: 'git 역사를 읽음 — HEAD 가 바뀜' };
    return { test: t, run: false, why: `닿는 변경 없음 (그 뒤 바뀐 파일 ${ch.length})` };
  });
}
// 추적 구멍 (순수) — 건너뛸 수 있었던 시험(run false)이 이번 추적에서 지도에 없는 것을 읽음
export function holes(chosen, map, fresh) {
  const out = [];
  for (const c of chosen) {
    const e = !c.run && map.tests[c.test], f = e && fresh[c.test];
    if (!f) continue;
    const files = f.files.filter((x) => !covers(e, x)), dirs = f.dirs.filter((x) => !e.dirs.includes(x)), git = f.git && !e.git;
    if (files.length || dirs.length || git) out.push({ test: c.test, files, dirs, git });
  }
  return out;
}
// 추적 기록 → { 시험: { files, dirs, git } } — 줄: 't 시험' · 'f 파일' · 'd 폴더' · 'g HEAD'
export function readTraces(dir) {
  const by = {};
  for (const n of readdirSync(dir).filter((x) => x.endsWith('.trace'))) {
    const lines = readFileSync(join(dir, n), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
    const t = lines.length && lines[0][0] === 't' ? lines[0][1] : null;
    if (!t) continue;
    const e = (by[t] = by[t] || { files: new Set(), dirs: new Set(), git: false });
    for (const [k, v] of lines.slice(1)) { if (k === 'f') e.files.add(v); else if (k === 'd') e.dirs.add(v); else if (k === 'g') e.git = true; }
  }
  return Object.fromEntries(Object.entries(by).map(([t, e]) => [t, { files: [...e.files].sort(), dirs: [...e.dirs].sort(), git: e.git }]));
}
// 새 지도 (순수) — 돌린 시험 중 자기 파일을 읽은 기록이 있는 것만 새 항목(추적이 비면 다음에 다시 돌게 항목을 지운다), 사라진 시험은 뺀다
export function nextMap(old, { tests, ran, fresh, tree, head }) {
  const out = { version: 1, tests: {} };
  for (const t of tests) {
    if (ran.includes(t)) { const f = fresh[t]; if (f && f.files.includes(t)) out.tests[t] = { tree, head, ...f }; }
    else if (old && old.tests && old.tests[t]) out.tests[t] = old.tests[t];
  }
  return out;
}
const readMap = (root) => { try { const m = JSON.parse(readFileSync(mapFile(root), 'utf8')); return m && m.version === 1 && m.tests ? m : null; } catch { return null; } };

function runTraced(root, files) {
  const dir = mkdtempSync(join(tmpdir(), 'biodb-trace-'));
  const env = { ...process.env, BIODB_TRACE_DIR: dir, BIODB_TRACE_ROOT: root, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${TRACER}`.trim() };
  delete env.BIODB_TRACE_TEST; delete env.NODE_TEST_CONTEXT; // 시험 안에서 불려도 시험 파일마다 따로 띄우게 (그래야 추적이 시험 이름을 안다)
  delete env.BIODB_TEST_SCOPE; // 범위는 이 실행의 것 — 시험이 부르는 도구에 새지 않게
  try {
    const r = spawnSync(process.execPath, ['--test', ...files], { cwd: root, env, stdio: 'inherit' });
    return { ok: r.status === 0, fresh: readTraces(dir) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2), full = argv.includes('--full') || process.env.BIODB_TEST_SCOPE === 'full';
  const root = rootOf(process.cwd()), tests = testFiles(root), map = readMap(root), tree = snapshotTree(root), head = headOf(root);
  const memo = new Map(), diff = (t) => { if (!memo.has(t)) { let d; try { d = treeDiff(root, t, tree); } catch { d = HARNESS; } memo.set(t, d); } return memo.get(t); }; // 없는 트리(지워진 개체)는 모두 바뀐 것으로
  const chosen = choose({ tests, map, diff, head });
  if (argv.includes('--list')) { for (const c of chosen) console.log(`${c.run ? '돌림  ' : '건너뜀'} ${c.test} — ${c.why}`); process.exit(0); }
  const ran = full ? tests : chosen.filter((c) => c.run).map((c) => c.test);
  console.log(`${full ? '전체' : '닿는 시험'} ${ran.length}/${tests.length}${map ? '' : ' (지도 없음 — 모두)'}${full ? '' : chosen.filter((c) => !c.run).map((c) => `\n  건너뜀 ${c.test} — ${c.why}`).join('')}`);
  if (!ran.length) { console.log('닿는 시험 0 — 돌릴 것 없음'); process.exit(0); }
  const { ok, fresh } = runTraced(root, ran);
  if (!ok) process.exit(1);
  if (snapshotTree(root) !== tree) { console.error('시험이 도는 동안 작업 파일이 바뀌었다 — 지도를 고치지 않음 (시험은 저장소에 쓰지 않아야 한다)'); process.exit(1); }
  const h = full && map ? holes(chosen, map, fresh) : [];
  CLERK.writeDraft(mapFile(root), nextMap(map, { tests, ran, fresh, tree, head }));
  if (h.length) {
    console.error(`추적 구멍 ${h.length} — 건너뛸 수 있었던 시험이 지도에 없는 입력을 읽었다 (추적이 보지 못한 의존):`);
    for (const x of h) console.error(`  ${x.test}: ${[...x.files, ...x.dirs.map((d) => d + ' (목록)'), ...(x.git ? ['git 역사'] : [])].slice(0, 8).join(' · ')}`);
    process.exit(1);
  }
}
