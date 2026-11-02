// 시계 안전망 시험 (PLAN-092) — 엔진이 시간을 세는 방법의 지금 동작을 못 박는다 (docs/reports/2026-11-01-engine-teardown.md §2 · -2.md §3)
//   목적: 시계 정리(PLAN-093)가 의도한 곳만 바꾸는지 확인할 기준. 정리 전에는 결함(K1·K3·K4)도 "지금 이렇게 틀린다"로 적어 둔다.
//   ① 정상 격자(t_end 가 dt_slow 의 배수): 기록 시각이 정확히 dt·i 이고 JS = Rust            — 정리 뒤에도 그대로여야 하는 시험
//   ② 출하 시나리오의 t_end·신호 시각이 모두 dt_slow 의 배수 — 결함 K3·K4 를 한 번도 안 밟은 이유. 새 시나리오가 이를 깨면 처음 밟는다
//   ③ K3 (알려진 결함): 마지막 구간이 dt 보다 짧으면 기록 시각이 t+dt 인데 상태는 t_end 의 것
//   ④ K4 (알려진 결함): 격자 사이의 신호 시각은 다음 격자점에서 적용 (100 s 신호 = 120 s 신호)
//   ⑤ K1 (알려진 결함): 속도 엔진은 t_end 가 dt 의 배수가 아니면 t_end 를 넘겨 돈다
// ③④⑤의 "알려진 결함" 줄은 PLAN-093 이 고칠 때 의도적으로 새 올바른 값으로 갱신한다 — 그 밖의 줄은 그대로여야 한다.
import SCN from '../scenarios.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../core.js'), F = require('../engine/fate_engine.js');
const DB = C.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const DIR = new URL('../examples/scenarios/', import.meta.url);
const SRC = 'D000174', RATE_PATH = 'LPS–TLR4–NF-κB 신호 전달';
const base = SCN.read(new URL('fate-effector-pulse-short-hypothetical.json', DIR)); // 신호 { D000163|extracellular: [{t:0,n:600},{t:3600,n:0}] } · dt_slow 60
const SIGKEY = Object.keys(base.signals)[0];
const run = (over, engine) => F.simulateFate(DB, SRC, { scenario: { ...base, ...over }, engine, commitment: false });
const both = (over) => [run(over, 'js'), run(over, 'rust')];
const relDiff = (a, b) => { let w = 0; for (const k of a.keys) w = Math.max(w, Math.abs(a.final.N[k] - b.final.N[k]) / Math.max(1, Math.abs(b.final.N[k]))); return w; };

test('① 정상 격자: t_end 가 dt_slow 의 배수이면 기록 시각이 정확히 dt·i (JS = Rust)', () => {
  const want = Array.from({ length: 10 }, (_, i) => (i + 1) * 60);
  for (const r of both({ t_end: 600, dt_slow: 60 })) {
    assert.deepEqual(Array.from(r.process.times), want, `${r.engine}: 기록 시각`);
    assert.equal(r.t_end, 600);
  }
});

test('② 출하 시나리오는 모두 t_end·신호 시각이 dt_slow 의 배수 — 결함 K3·K4 를 밟지 않음 (깨지면 먼저 PLAN-093 시계 정리)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const aligned = (t, dt) => Math.abs(t / dt - Math.round(t / dt)) < 1e-12;
  let fate = 0;
  const raw = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  for (const f of files) {
    let sc = raw(f);
    if (sc.base) sc = { ...raw(sc.base), ...sc }; // 파생 시나리오는 기준을 이어받음
    const dt = sc.dt_slow || 60, tEnd = sc.t_end != null ? sc.t_end : 48 * 3600;
    if (sc.t_end != null || sc.signals) fate++;
    assert.ok(aligned(tEnd, dt), `${f}: t_end ${tEnd} 가 dt_slow ${dt} 의 배수가 아님 — K3(기록 시각이 틀림)을 처음 밟음`);
    for (const [b, list] of Object.entries(sc.signals || {})) for (const e of list) assert.ok(aligned(e.t, dt), `${f}: 신호 ${b} 의 시각 ${e.t} 가 dt_slow ${dt} 의 배수가 아님 — K4(신호가 늦게 적용됨)를 처음 밟음`);
  }
  assert.ok(files.length >= 20 && fate >= 10, `시나리오 ${files.length} 개 · 운명 시나리오 ${fate} 개를 봄`);
});

test('③ 알려진 결함 K3: 마지막 구간이 dt 보다 짧으면 기록 시각이 t+dt — 상태는 t_end 의 것 (PLAN-093 이 [60, 100] 으로 고친다)', () => {
  const [js, rs] = both({ t_end: 100, dt_slow: 60 });
  for (const r of [js, rs]) assert.deepEqual(Array.from(r.process.times), [60, 120], `${r.engine}: 지금은 마지막 기록 시각이 120 (바른 값 100)`);
  // 상태는 정말 100 s 의 것 — 한 구간으로 100 s 까지 적분한 값과 같고, 120 s 의 값과는 다르다
  for (const r of [js, rs]) {
    const at100 = run({ t_end: 100, dt_slow: 100 }, r.engine), at120 = run({ t_end: 120, dt_slow: 60 }, r.engine);
    assert.ok(relDiff(r, at100) < 1e-6, `${r.engine}: 마지막 기록의 상태가 100 s 와 다름 ${relDiff(r, at100)}`);
    assert.ok(relDiff(r, at120) > 1e-3, `${r.engine}: 100 s 와 120 s 의 상태가 구별되지 않음 — 시험의 힘이 없음`);
  }
});

test('④ 알려진 결함 K4: 격자 사이의 신호 시각은 다음 격자점에서 적용 — 100 s 에 끈 신호는 120 s 에 꺼진 것과 같음', () => {
  const sigAt = (t) => ({ [SIGKEY]: base.signals[SIGKEY].map((e) => (e.t > 0 ? { ...e, t } : e)) });
  const at100 = both({ signals: sigAt(100), t_end: 300, dt_slow: 60 }), at120 = both({ signals: sigAt(120), t_end: 300, dt_slow: 60 });
  for (let q = 0; q < 2; q++) {
    const a = at100[q], b = at120[q];
    assert.deepEqual(JSON.parse(JSON.stringify(a.process.sig)), [[600], [600], [0], [0], [0]], `${a.engine}: 100 s 신호의 기록된 값 (바른 값은 [600],[0]… 이 100 s 에서 바뀜)`);
    assert.deepEqual(JSON.parse(JSON.stringify(a.process.sig)), JSON.parse(JSON.stringify(b.process.sig)), `${a.engine}: 100 s 신호 = 120 s 신호`);
    assert.deepEqual(Array.from(a.final.N), Array.from(b.final.N), `${a.engine}: 끝 상태도 120 s 신호와 비트까지 같음 (100 s 에 끈 효과가 없음)`);
  }
});

test('⑤ 알려진 결함 K1: 속도 엔진은 t_end 가 dt 의 배수가 아니면 t_end 를 넘겨 돈다 (배수면 정확)', () => {
  const sc = SCN.read(new URL('lps-hypothetical.json', DIR));
  const last = (T, dt) => { const r = C.simulateRate(DB, RATE_PATH, { scenario: sc, t_end: T, dt, trace: 'full' }); return { r, ts: r.series.map((x) => x.t) }; };
  const a = last(0.5, 0.07), b = last(1, 0.3), c = last(0.5, 0.01);
  assert.equal(a.ts[a.ts.length - 1], 0.56, '0.5 s 를 요청했는데 0.56 s 까지 돎 (바른 값 0.5)');
  assert.equal(a.r.t_end, 0.5, '보고된 t_end 는 요청값 그대로 — 실제 적분 길이와 다름');
  assert.equal(b.ts[b.ts.length - 1], 1.2, '1 s 를 요청했는데 1.2 s 까지 돎 (바른 값 1)');
  assert.equal(c.ts[c.ts.length - 1], 0.5, '배수이면 정확');
  c.ts.forEach((t, i) => assert.equal(t, +(i * 0.01).toFixed(9), `시계는 곱셈 ${i}·dt 를 소수 9 자리로 자른 값`));
});
