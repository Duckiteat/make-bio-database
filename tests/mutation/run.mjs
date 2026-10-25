#!/usr/bin/env node
// 집행 변이 시험 (재건 5c) — "기계가 막는다" 는 규칙마다 그 집행 자리를 일부러 망가뜨리고 시험이 빨개지는지 본다.
//   node tests/mutation/run.mjs --spec <명세.jsonl>          명세의 모든 행을 다시 돌려 표준 출력에 JSONL
//     --rules 0011,0052  그 규칙만 · --jobs 3  사본 3 개로 나눠 돌림 (기본 1) · --check  기록된 result 와 다른 행만 출력, 있으면 종료 코드 1
//   명세 파일은 인자로만 받는다 — 관리 구역을 가리키는 경로를 코드에 두지 않는다(tests/rebuild.test.mjs ②).
// 계약: 변이는 저장소 밖 임시 사본(git worktree)에서만 한다 — 저장소 안 파일은 읽기만. 결과 기록은 사람이 명세 파일로 옮긴다.
// op: disable(find 앞에 'false && ') · replace(find → repl) · inject(파일 끝에 code) · delete(폴더의 첫 .json 고정 파일 지움)
//     static(설정 파일에 contains 가 있는지만 — 실행 시험 아님) · test_only(그 시험이 통과하는지만 — 자리를 망가뜨리지 않음)
// 판정: 망가뜨린 뒤 시험이 하나라도 빨개지면 caught, 모두 통과하면 missed(집행 구멍).
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SPEC = arg('--spec'); if (!SPEC) throw new Error('--spec <명세.jsonl> 이 필요함');
const SLOW = ['rebuild', 'mhc', 'stochastic', 'rust_engine']; // 느린 시험 — 행이 tests 로 부를 때만 (관리 파일 시험은 파일이 바뀌면 늘 빨개져 판정에 못 씀)
const SKIP = '^P[345] |v9 Fate-Test'; // 은퇴한 P3–P5 층 — 변이와 무관하게 느림
const FIRST = 'tests/governance.test.mjs'; // 먼저 돌리는 빠른 묶음 — 여기서 잡히면 나머지는 안 돌린다

const inside = (w) => { const r = relative(ROOT, w); return !r.startsWith('..') && !isAbsolute(r); };
function runTests(W, files) {
  const r = spawnSync('node', ['--test', '--test-reporter=tap', `--test-skip-pattern=${SKIP}`, ...files], { cwd: W, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 900000 });
  const red = [...(r.stdout || '').matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]).filter((x) => !/^tests\/|\.test\.mjs$/.test(x));
  return { ok: r.status === 0, red };
}
function one(W, m) {
  const reset = () => { execFileSync('git', ['checkout', '-q', '--', '.'], { cwd: W }); execFileSync('git', ['clean', '-fdq'], { cwd: W }); };
  reset();
  const out = { ...m }; delete out.red; delete out.error;
  try {
    if (m.op === 'static') { out.result = readFileSync(join(W, m.file), 'utf8').includes(m.contains) ? (m.template ? 'present_template' : 'present') : 'absent'; return out; }
    if (m.op === 'test_only') { out.result = runTests(W, m.tests).ok ? 'test_passes' : 'test_fails'; return out; }
    const f = join(W, m.file);
    if (m.op === 'delete') unlinkSync(join(f, readdirSync(f).filter((x) => x.endsWith('.json') && x !== 'EXPECT.json').sort()[0]));
    else {
      let s = readFileSync(f, 'utf8');
      if (m.op === 'inject') s += m.code;
      else { const n = s.split(m.find).length - 1; if (n !== 1) throw new Error(`자리 '${m.find.slice(0, 50)}' 가 ${n} 번 나옴`); s = s.replace(m.find, () => (m.op === 'disable' ? 'false && ' + m.find : m.repl)); }
      writeFileSync(f, s);
      if (/\.m?js$/.test(f)) { const c = spawnSync('node', ['--check', f], { encoding: 'utf8' }); if (c.status) throw new Error('문법 오류: ' + c.stderr.split('\n').slice(0, 3).join(' ')); }
    }
    const first = [FIRST, ...(m.tests || [])];
    let r = runTests(W, first);
    if (r.ok) r = runTests(W, readdirSync(join(W, 'tests')).filter((x) => x.endsWith('.test.mjs') && !SLOW.includes(x.replace('.test.mjs', ''))).map((x) => 'tests/' + x).filter((x) => !first.includes(x)));
    out.result = r.ok ? 'missed' : 'caught';
    if (r.red.length) out.red = r.red[0];
  } catch (e) { out.result = 'error'; out.error = String(e.message).slice(0, 200); }
  finally { reset(); }
  return out;
}

const rows = readFileSync(SPEC, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const only = arg('--rules') && new Set(arg('--rules').split(',').map((x) => 'RULE-' + x.replace(/^RULE-/, '')));
const todo = rows.filter((r) => !only || only.has(r.rule));
const shard = arg('--shard'), wt = arg('--worktree');
if (shard) { // 일꾼: 주어진 사본에서 자기 몫만
  if (!wt || inside(wt)) throw new Error('--worktree 는 저장소 밖 사본이어야 함');
  const [k, n] = shard.split('/').map(Number);
  todo.forEach((m, i) => { if (i % n === k) process.stdout.write(JSON.stringify(one(wt, m)) + '\n'); });
} else {
  const jobs = Number(arg('--jobs') || 1), base = mkdtempSync(join(tmpdir(), 'mut-')), trees = [];
  for (let i = 0; i < jobs; i++) { const w = join(base, 'w' + i); execFileSync('git', ['worktree', 'add', '-q', '--detach', w, 'HEAD'], { cwd: ROOT }); trees.push(w); }
  const kids = trees.map((w, i) => new Promise((res) => { let buf = ''; const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--shard', `${i}/${jobs}`, '--worktree', w, '--spec', SPEC, ...(only ? ['--rules', arg('--rules')] : [])], { stdio: ['ignore', 'pipe', 'inherit'] }); p.stdout.on('data', (d) => { buf += d; }); p.on('close', () => res(buf)); }));
  const got = (await Promise.all(kids)).join('').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const w of trees) execFileSync('git', ['worktree', 'remove', '--force', w], { cwd: ROOT });
  rmSync(base, { recursive: true, force: true });
  const order = new Map(todo.map((m, i) => [m.rule, i]));
  got.sort((a, b) => order.get(a.rule) - order.get(b.rule));
  if (process.argv.includes('--check')) {
    const was = new Map(rows.map((r) => [r.rule, r.result])), diff = got.filter((g) => g.result !== was.get(g.rule));
    for (const d of diff) process.stdout.write(JSON.stringify({ rule: d.rule, was: was.get(d.rule), now: d.result, red: d.red, error: d.error }) + '\n');
    process.exitCode = diff.length ? 1 : 0;
  } else for (const g of got) process.stdout.write(JSON.stringify(g) + '\n');
}
