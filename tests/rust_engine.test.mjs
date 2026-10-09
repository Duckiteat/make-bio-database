// 1·1.5단계: Rust/WASM 운명 엔진 (engine/rust) — docs/design/engine-port-roadmap.md
//   ① WASM 이 소스와 맞음 (빌드 해시)  ② JS 기준 구현과 동등 (같은 IR·같은 결합 Rodas3: 궤적 상대 ≤ rtol, 운명·도달·결정·사건 같음, 단계 수 ±1%)
//   ③ 할당 0: WASM byteLength 불변, 네이티브 할당 계수 0   ④ 결정론 (Rust 다시 실행 = 같은 해시)   ⑤ 네이티브 = WASM (비트 단위)
//   ⑥ 사법부: Rust 원자료도 계약·독립 질량 검증·IR 검사를 통과
//   ⑦ 2단계 병렬 탐침: lanes 와 무관하게 결정 시각·격자·탐침 끝 상태가 직렬과 비트 단위로 같음 (WASM 워커 · 네이티브 스레드)
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
    // 4단계 ③: 사건 시각은 근 찾기(다시 적분) — 두 백엔드의 차는 근 찾기 폭(event_tol)·결정 이분 폭(commitment_tol) 안
    const near = (x, y, tol) => (x == null && y == null) || Math.abs(x - y) <= tol;
    assert.deepEqual(Object.keys(b.firstReach).sort(), Object.keys(a.firstReach).sort(), f);
    for (const s of Object.keys(a.firstReach)) assert.ok(near(b.firstReach[s], a.firstReach[s], a.coupling.event_tol), `${f}: 도달 ${s} ${a.firstReach[s]} ↔ ${b.firstReach[s]}`);
    a.commitment.forEach((c, i) => assert.ok(near(b.commitment[i].t, c.t, a.coupling.commitment_tol), `${f}: 결정 ${c.t} ↔ ${b.commitment[i].t}`));
    assert.deepEqual(b.events.map((e) => [e.type, e.bundle]), a.events.map((e) => [e.type, e.bundle]), f);
    a.events.forEach((e, i) => assert.ok(near(b.events[i].t, e.t, a.coupling.event_tol), `${f}: 사건 ${e.t} ↔ ${b.events[i].t}`));
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
  for (const k of [7, 900]) be.probeFrom(m.series[k].t, be.snapState(k)); // 2단계 경로(넘겨받은 시작 상태)도 자라지 않음
  for (const k of [7, 900]) be.advance(m.series[k].t, be.snapState(k), m.series[k].t + 37.5); // 4단계 ③ 다시 적분(격자 사이 끝)도 자라지 않음
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

test('⑤ 네이티브 = WASM (비트 단위) · 네이티브 루프 할당 0 · 네이티브 스레드 병렬 탐침 = 직렬 (비트)', (t) => {
  const cargo = spawnSync('cargo', ['--version']);
  if (cargo.status !== 0) { t.skip('cargo 없음 — CI 는 Rust 를 설치해 이 시험을 돌린다'); return; }
  execFileSync('cargo', ['build', '--release', '--quiet', '--bin', 'fate_cli'], { cwd: RUST });
  const sc = SC.find((x) => /effector-il12/.test(x.f)).sc, ir = IRB.buildFateIR(BASE, 'D000174', sc);
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', ir, commitment: false });
  const keys = raw.keys, at = new Map(keys.map((b, i) => [b, i]));
  const args = { IR: ir, N0: raw.process.N0, sched: raw.process.schedule.map((s) => ({ i: at.get(s.bundle), list: s.list })), reservoirs: Object.keys(raw.reservoirs).map((b) => at.get(b)), dt: raw.dt, tEnd: raw.t_end, horizon: ir.coupling.commitment_horizon, CP: ir.coupling, recordEvery: 1 };
  const blob = RB.pack(args), probes = [10, 77, 120, 300, 700, 1300, 2000];
  const out = new Float64Array(new Uint8Array(execFileSync(join(RUST, 'target/release/fate_cli'), ['--threads', '3', ...probes.map(String)], { input: Buffer.from(blob.buffer), maxBuffer: 1 << 28 })).buffer);
  const parts = []; for (let p = 0; p < out.length;) { const n = out[p]; parts.push(out.subarray(p + 1, p + 1 + n)); p += 1 + n; }
  const be = RB.open(args), m = be.main();
  const wasm = { t: m.series.map((s) => s.t), N: m.series.flatMap((s) => Array.from(s.N)), lo: m.series.flatMap((s) => Array.from(s.lo)), cum: m.series.flatMap((s) => Array.from(s.cumDD)) };
  const same = (x, y) => x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
  assert.ok(same(Array.from(parts[0]), wasm.t) && same(Array.from(parts[1]), wasm.N) && same(Array.from(parts[2]), wasm.lo) && same(Array.from(parts[3]), wasm.cum), '기록점 t·N·LO·누적 진행량이 비트 단위로 같아야 함');
  assert.ok(same(Array.from(parts[5]), Array.from(m.N)), '끝 상태');
  const pw = probes.flatMap((k) => Array.from(be.probe(k)));
  assert.ok(same(Array.from(parts[6]), pw), '탐침 끝 상태');
  assert.equal(parts[7][0], 0, `네이티브 본 실행·탐침 동안 힙 할당 ${parts[7][0]}회`);
  assert.ok(same(Array.from(parts[8]), Array.from(parts[6])), '스레드 3 개 병렬 탐침 = 직렬 탐침 (비트)');
  assert.equal(parts[9][0], 0, `병렬 탐침 루프 동안 스레드 힙 할당 ${parts[9][0]}회`);
  assert.equal(parts[9][3], 3);
});

test('⑦ 병렬 탐침 (WASM 워커): lanes 1·2·4 에서 결정 시각·격자·궤적 해시가 같고 탐침 끝 상태가 비트 단위로 같음', () => {
  const PP = req('../engine/probe_pool.js');
  for (const { f, sc } of SC.filter((x) => /mixed-optimal|memory-il15/.test(x.f))) {
    const runs = [1, 2, 4].map((w) => F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', workers: w }));
    const key = (r) => JSON.stringify(r.commitment.map((c) => [c.t, c.step, c.monotone, c.grid && c.grid.map((g) => g.pass)]));
    for (const r of runs.slice(1)) { assert.equal(key(r), key(runs[0]), f); assert.equal(FA.trajectoryHash(r), FA.trajectoryHash(runs[0]), f); }
    assert.deepEqual(runs.map((r) => r.stats.probeLanes), [1, 2, 4]);
    assert.ok(runs[2].stats.probeRounds < runs[0].stats.probeRounds, `${f}: 라운드 ${runs[0].stats.probeRounds} → ${runs[2].stats.probeRounds}`);
  }
  // 탐침 끝 상태: 워커 인스턴스 = 본 인스턴스 (비트)
  const sc = SC.find((x) => /effector-il12/.test(x.f)).sc, ir = IRB.buildFateIR(BASE, 'D000174', sc);
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', ir, commitment: false });
  const at = new Map(raw.keys.map((b, i) => [b, i]));
  const args = { IR: ir, N0: raw.process.N0, sched: raw.process.schedule.map((s) => ({ i: at.get(s.bundle), list: s.list })), reservoirs: Object.keys(raw.reservoirs).map((b) => at.get(b)), dt: raw.dt, tEnd: raw.t_end, horizon: ir.coupling.commitment_horizon, CP: ir.coupling, recordEvery: 1 };
  const be = RB.open(args); be.main();
  const ks = [5, 90, 400, 900, 1500, 2100, 2800], snaps = be.snapshots();
  const serial = ks.map((k) => be.probe(k));
  const par = PP.attach(be, args, 4).probeMany(ks.map((k) => ({ t0: snaps[k].t, N: be.snapState(k) })));
  ks.forEach((k, j) => assert.ok(serial[j].every((v, i) => Object.is(v, par[j][i])), `탐침 ${k}`));
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

test('⑧ 확률 층 (4단계 ⑤): 출생–사멸은 JS = Rust 비트 · 운명 프로그램은 같은 분포 · 네이티브 = WASM 비트 · 루프 할당 0', (t) => {
  const SA = req('../judicial/stoch_audit.js');
  const BD = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/stochastic-birth-death-hypothetical.json'), 'utf8'));
  const leap = { ...BD, amounts: { 'D000165|nucleoplasm': 1000 }, kinetics: { ...BD.kinetics, 'D000165/rule/synthesis': { ...BD.kinetics['D000165/rule/synthesis'], k: BD.kinetics['D000165/rule/synthesis'].k * 40 } } };
  // 연속 부분이 자명한 계: 같은 (seed, 궤적) → 두 백엔드의 발화·궤적이 비트 단위로 같다
  for (const sc of [BD, leap]) for (const trajectory of [0, 1, 2]) {
    const a = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'js', trajectory }), b = F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', trajectory });
    assert.equal(FA.trajectoryHash(b), FA.trajectoryHash(a));
    assert.deepEqual(b.stochastic, a.stochastic);
  }
  // 운명 프로그램: 결정론 부분의 libm 마지막 ulp 차이가 도약 한계·추첨으로 증폭되어 경로는 갈라진다 — 동등성은 분포로 (두 표본 검정)
  const sc = { ...SC.find((x) => /mixed-optimal/.test(x.f)).sc, t_end: 6 * 3600, stochastic: { seed: 5 } };
  const js = Array.from({ length: 30 }, (_, i) => F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'js', trajectory: i }));
  const rs = Array.from({ length: 30 }, (_, i) => F.simulateFate(BASE, 'D000174', { scenario: sc, engine: 'rust', trajectory: 100 + i }));
  const v = SA.compareMethods(js, rs, js[0].markers, { perm: 300 });
  assert.ok(v.ok, `JS 대 Rust 분포가 다름: ${JSON.stringify(v.tests.map((x) => x.p))}, 운명 ${v.fate.p}`);
  for (const r of rs) assert.ok(!SA.auditTrajectory(BASE, r, { scenario: sc }).audit.some((x) => x.fault === 'ENGINE_DEFECT'));
  // 네이티브 = WASM (같은 덩어리, 확률 블록 포함) · 루프 할당 0
  const cargo = spawnSync('cargo', ['--version']);
  if (cargo.status !== 0) { t.skip('cargo 없음'); return; }
  execFileSync('cargo', ['build', '--release', '--quiet', '--bin', 'fate_cli'], { cwd: RUST });
  const ir = IRB.buildFateIR(BASE, 'D000174', sc), raw = rs[0], at = new Map(raw.keys.map((b, i) => [b, i]));
  const args = { IR: ir, N0: raw.process.N0, sched: raw.process.schedule.map((s) => ({ i: at.get(s.bundle), list: s.list })), reservoirs: Object.keys(raw.reservoirs).map((b) => at.get(b)), dt: raw.dt, tEnd: raw.t_end, horizon: ir.coupling.commitment_horizon, CP: ir.coupling, recordEvery: 1,
    sto: { seed: 5, trajectory: 7, reach: raw.states.map((sid) => BASE.senses[sid].signature.map((m) => ({ i: at.get(`${m.ref}|${m.location}`), t: sc.thresholds[`${m.ref}|${m.location}`], high: m.level === 'high' })).filter((m) => m.t)) } };
  const out = new Float64Array(new Uint8Array(execFileSync(join(RUST, 'target/release/fate_cli'), ['--threads', '1'], { input: Buffer.from(RB.pack(args).buffer), maxBuffer: 1 << 28 })).buffer);
  const parts = []; for (let p = 0; p < out.length;) { const n = out[p]; parts.push(out.subarray(p + 1, p + 1 + n)); p += 1 + n; }
  const be = RB.open(args), m = be.main(), same = (x, y) => x.length === y.length && x.every((q, i) => Object.is(q, y[i]));
  assert.ok(same(Array.from(parts[1]), m.series.flatMap((x) => Array.from(x.N))) && same(Array.from(parts[5]), Array.from(m.N)), '확률 궤적 네이티브 = WASM (비트)');
  assert.equal(parts[7][0], 0, `확률 본 실행 동안 힙 할당 ${parts[7][0]}회`);
  assert.ok(m.sto.stats.draws > 0 && m.sto.firedLeap.some((x) => x > 0));
});

