// 1·1.5단계: Rust/WASM 운명 엔진 (engine/rust) — docs/design/engine-port-roadmap.md
//   ① WASM 이 소스와 맞음 (빌드 해시)  ② JS 기준 구현과 동등 (같은 IR·같은 결합 Rodas3: 궤적 상대 ≤ rtol, 운명·도달·결정·사건 같음, 단계 수 ±1%)
//   ③ 할당 0: WASM byteLength 불변, 네이티브 할당 계수 0   ④ 결정론 (Rust 다시 실행 = 같은 해시)   ⑤ 네이티브 = WASM (비트 단위)
//   ⑥ 사법부: Rust 원자료도 계약·독립 질량 검증·IR 검사를 통과
// 실행: node --test tests/*.test.mjs   (네이티브 비교는 cargo 가 있을 때 — CI 는 Rust 를 설치한다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const C = req('../core.js'), F = req('../engine/fate_engine.js'), RB = req('../engine/fate_rust.js'), IRB = req('../compiler/ir_builder.js');
const FA = req('../judicial/fate_audit.js'), K = req('../judicial/contract.js'), VER = req('../judicial/verifier.js'), ORCH = req('../orchestrator.js');
const BASE = C.normalize(JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8')));
const SC = readdirSync(join(ROOT, 'examples/scenarios')).filter((f) => f.startsWith('fate-')).map((f) => ({ f, sc: JSON.parse(readFileSync(join(ROOT, 'examples/scenarios', f), 'utf8')) }));
const RUST = join(ROOT, 'engine/rust');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const relWorst = (a, b) => { let w = 0; for (let j = 0; j < a.series.length; j++) for (let i = 0; i < a.keys.length; i++) { const x = a.series[j][i], y = b.series[j][i]; w = Math.max(w, Math.abs(x - y) / Math.max(1, Math.abs(x))); } return w; };

test('① WASM 은 지금 소스로 빌드된 것 (engine/rust/build.sh 의 소스 해시)', () => {
  const meta = JSON.parse(readFileSync(join(RUST, 'pkg/fate_core.wasm.json'), 'utf8'));
  const files = ['Cargo.toml', 'Cargo.lock', ...readdirSync(join(RUST, 'src'), { recursive: true }).filter((f) => f.endsWith('.rs')).map((f) => join('src', f)).sort()];
  const src = sha(Buffer.concat(files.map((f) => readFileSync(join(RUST, f)))));
  assert.equal(src, meta.src_sha256, 'Rust 소스가 바뀌었는데 WASM 을 다시 빌드하지 않음 — sh engine/rust/build.sh');
  assert.equal(sha(readFileSync(join(RUST, 'pkg/fate_core.wasm'))), meta.wasm_sha256);
});

test('② JS 기준 구현과 동등 — 8 시나리오 (결정 탐침 포함)', () => {
  for (const { f, sc } of SC) {
    const a = F.simulateFate(BASE, 'D000174', { scenario: sc }), b = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust' });
    assert.equal(b.engine, 'rust');
    assert.ok(relWorst(a, b) <= a.coupling.rtol, `${f}: 궤적 상대 차 ${relWorst(a, b)} > rtol ${a.coupling.rtol}`);
    assert.equal(b.final.state, a.final.state, f);
    assert.deepEqual(b.firstReach, a.firstReach, f);
    assert.deepEqual(b.commitment.map((c) => c.t), a.commitment.map((c) => c.t), f);
    assert.deepEqual(b.events, a.events, f);
    // 받아들임·거부 결정이 libm 마지막 ulp 로 갈리면 단계 순서가 달라질 수 있다 — 그 차이는 단계 제어 허용 오차 안이어야 한다
    assert.ok(Math.abs(b.integrator.steps - a.integrator.steps) <= 0.01 * a.integrator.steps, `${f}: 단계 ${a.integrator.steps} ↔ ${b.integrator.steps}`);
    assert.equal(b.stats.hMinHits, a.stats.hMinHits, f);
  }
});

test('③ 할당 0 — WASM 선형 메모리가 실행·탐침 동안 자라지 않음', () => {
  const sc = SC.find((x) => /mixed-optimal/.test(x.f)).sc, ir = IRB.buildFateIR(BASE, 'D000174', sc);
  // 앞단과 같은 시작 상태·일정으로 백엔드를 직접 연다 (pack 입력은 fate_engine 이 만드는 것과 같다)
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', ir, commitment: false });
  const keys = raw.keys, at = new Map(keys.map((b, i) => [b, i]));
  const sched = raw.process.schedule.map((s) => ({ i: at.get(s.bundle), list: s.list }));
  const reservoirs = Object.keys(raw.reservoirs).map((b) => at.get(b));
  const be = RB.open({ IR: ir, N0: raw.process.N0, sched, reservoirs, dt: raw.dt, tEnd: raw.t_end, horizon: ir.coupling.commitment_horizon, CP: ir.coupling, recordEvery: 1 });
  const before = be.memory.bytes();
  const m = be.main();
  for (const k of [0, 50, 100, 500, m.series.length - 1]) be.probe(k);
  assert.equal(be.memory.bytes(), before, `byteLength ${before} → ${be.memory.bytes()}`);
  assert.equal(before, be.memory.initBytes);
  // 같은 백엔드 결과 = 앞단을 거친 결과
  assert.deepEqual(Array.from(m.N), Object.values(raw.final.N));
});

test('④ 결정론 — Rust 를 다시 돌리면 비트 단위로 같은 궤적', () => {
  const sc = SC.find((x) => /glucose-withheld/.test(x.f)).sc;
  const a = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', commitment: false }), b = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', commitment: false });
  assert.equal(FA.trajectoryHash(a), FA.trajectoryHash(b));
});

test('⑤ 네이티브 = WASM (비트 단위) · 네이티브 루프 할당 0', (t) => {
  const cargo = spawnSync('cargo', ['--version']);
  if (cargo.status !== 0) { t.skip('cargo 없음 — CI 는 Rust 를 설치해 이 시험을 돌린다'); return; }
  execFileSync('cargo', ['build', '--release', '--quiet', '--bin', 'fate_cli'], { cwd: RUST });
  const sc = SC.find((x) => /effector-il12/.test(x.f)).sc, ir = IRB.buildFateIR(BASE, 'D000174', sc);
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', ir, commitment: false });
  const keys = raw.keys, at = new Map(keys.map((b, i) => [b, i]));
  const args = { IR: ir, N0: raw.process.N0, sched: raw.process.schedule.map((s) => ({ i: at.get(s.bundle), list: s.list })), reservoirs: Object.keys(raw.reservoirs).map((b) => at.get(b)), dt: raw.dt, tEnd: raw.t_end, horizon: ir.coupling.commitment_horizon, CP: ir.coupling, recordEvery: 1 };
  const blob = RB.pack(args), probes = [10, 77, 120];
  const out = new Float64Array(new Uint8Array(execFileSync(join(RUST, 'target/release/fate_cli'), probes.map(String), { input: Buffer.from(blob.buffer), maxBuffer: 1 << 28 })).buffer);
  const parts = []; for (let p = 0; p < out.length;) { const n = out[p]; parts.push(out.subarray(p + 1, p + 1 + n)); p += 1 + n; }
  const be = RB.open(args), m = be.main();
  const wasm = { t: m.series.map((s) => s.t), N: m.series.flatMap((s) => Array.from(s.N)), lo: m.series.flatMap((s) => Array.from(s.lo)), cum: m.series.flatMap((s) => Array.from(s.cumDD)) };
  const same = (x, y) => x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
  assert.ok(same(Array.from(parts[0]), wasm.t) && same(Array.from(parts[1]), wasm.N) && same(Array.from(parts[2]), wasm.lo) && same(Array.from(parts[3]), wasm.cum), '기록점 t·N·LO·누적 진행량이 비트 단위로 같아야 함');
  assert.ok(same(Array.from(parts[5]), Array.from(m.N)), '끝 상태');
  const pw = probes.flatMap((k) => Array.from(be.probe(k)));
  assert.ok(same(Array.from(parts[6]), pw), '탐침 끝 상태');
  assert.equal(parts[7][0], 0, `네이티브 본 실행·탐침 동안 힙 할당 ${parts[7][0]}회`);
});

test('⑥ 사법부는 Rust 원자료도 같은 기준으로 판정 — 계약·독립 질량 검증 ≤ 1e-14·IR 검사·증명서 PASS', () => {
  for (const { f, sc } of SC.filter((x) => /il12|glucose-withheld|fa-withheld/.test(x.f))) {
    const v = ORCH.runFate(BASE, 'D000174', { scenario: { ...sc, commitment: { horizon: 3600, coarse: 3600 } }, engine: 'rust' });
    assert.ok(!v.error, v.error);
    assert.ok(K.checkFateRaw(Object.fromEntries(Object.entries(v).filter(([k]) => !['audit', 'arrest', 'postMortem', 'verification', 'contract', 'irCheck'].includes(k)).map(([k, x]) => [k, k === 'mass' ? { moieties: x.moieties, start: x.start, end: x.end, channels: x.channels } : k === 'process' ? Object.fromEntries(Object.entries(x).filter(([q]) => !['factorsAt', 'rawDistance', 'distance', 'hash'].includes(q))) : x]))).ok, f);
    assert.ok(v.contract.ok && v.verification.pass && v.mass.worst <= 1e-14 && v.mass.replayWorst <= 1e-14, f);
    assert.ok(v.irCheck.ok && v.irCheck.consumed, f);
    assert.ok(!v.audit.some((a) => ['ENGINE_DEFECT', 'COMPILER_DEFECT'].includes(a.fault)), f);
  }
});
