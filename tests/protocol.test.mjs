// 모의 실험 규약과 사전 등록 (build-plan 3) — judicial/protocol.js · legislative/clerk.mjs registerPrereg
//   ① 구조: 필수 항목 · 음성 대조 · 반복 수(검정력) · 검증 세트(추정과 분리) · 최상위 equivalence 금지
//   ② 사전 등록: 봉인 없이는 쓰지 않음 · 등록 뒤 고치면 미등록 · 실행보다 앞선 등록만 · 사슬 변조 검출
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const req = createRequire(import.meta.url);
const C = req('../core.js'), PROTO = req('../judicial/protocol.js'), ATT = req('../judicial/attestation.js'), S = req('../judicial/stats.js');
const BASE = C.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const OBS = (use, extra) => Object.assign({ observable: { kind: 'amount', target: 'D000165|nucleoplasm' }, value: 1000, unit: 'molecule', uncertainty: { kind: 'measurement', model: 'normal', sd: 50 }, replicates: 4, condition: { species: '9606' }, use, provenance: { source: { db: 'DOI', id: '10.0000/synthetic' } } }, extra);
const DB = (() => { const d = JSON.parse(JSON.stringify(BASE)); d.observations = { ...d.observations, O900001: OBS('validation'), O900002: OBS('estimation'), O900003: OBS('validation', { retracted: { note: '시험' } }) }; return d; })();
const SC = (p, extra) => Object.assign({ name: '규약 시험', hypothetical: true, protocol: Object.assign({
  question: '음성 대조와 비교해 표지가 늘어나는가',
  matched_experiment: { source: { db: 'DOI', id: '10.0000/synthetic-exp' }, system: { species: '9606', cell: 'T cell', condition: '시험' }, readout_times_s: [3600] },
  controls: { negative: { description: '신호 없음' } },
  readouts: [{ observable: { kind: 'amount', target: 'D000165|nucleoplasm' }, time_s: 3600 }],
  validation: ['O900001'], stopping: { fixed_n: true } }, p) }, extra);

test('① 규약 구조: 완결하면 통과, 빠지면 사유', () => {
  assert.ok(PROTO.protocolStructure(DB, SC()).ok, PROTO.protocolStructure(DB, SC()).problems.join(' · '));
  assert.equal(PROTO.protocolStructure(DB, { name: 'x' }).declared, false);
  const miss = (p, re) => assert.ok(PROTO.protocolStructure(DB, SC(p)).problems.some((x) => re.test(x)), String(re));
  miss({ question: '' }, /question/);
  miss({ controls: {} }, /음성 대조/);
  miss({ matched_experiment: { source: { db: 'ISBN', id: '1' }, system: { species: '9606', cell: 'T', condition: 'c' }, readout_times_s: [1] } }, /DOI·PMID/);
  miss({ readouts: [{ observable: { kind: 'mood', target: 'x' } }] }, /observable/);
  miss({ stopping: {} }, /fixed_n/);
  miss({ validation: ['O900002'] }, /추정용 관찰로 검증하면 순환/);
  miss({ validation: ['O900003'] }, /철회/);
  miss({ validation: ['O999999'] }, /관찰 기록이 없음/);
  assert.ok(PROTO.protocolStructure(DB, SC({}, { equivalence: [] })).problems.some((x) => /protocol 안에만/.test(x)));
  // 검증 관찰이 어떤 상수의 근거로 쓰이면 분리 위반
  const d2 = JSON.parse(JSON.stringify(DB)); const s = Object.values(d2.senses).find((x) => (x.rule || []).length);
  s.rule[0].kinetics = { law: 'mass_action', k: 1, from: [{ param: 'k', obs: 'O900001' }] };
  assert.ok(PROTO.protocolStructure(d2, SC()).problems.some((x) => /추정·검증 분리 위반/.test(x)));
});

test('① 반복 수: 확률 실행은 n ≥ ⌈(z₁₋α/₂ + z_power)²σ²/Δ²⌉, 결정론은 1', () => {
  const r = { effect_size: 10, sd: 50 }, need = PROTO.requiredReplicates(r);
  const z = S.normInv(0.975) + S.normInv(0.8);
  assert.equal(need, Math.ceil(z * z * 25), '공식');
  assert.ok(need === 197 || need === 196, `n = ${need}`);
  const st = (n) => PROTO.protocolStructure(DB, SC({ replicates: { n, ...r } }, { stochastic: { seed: 1 } }));
  assert.ok(st(need).ok); assert.ok(st(need - 1).problems.some((x) => /검정력 요구/.test(x)));
  assert.ok(PROTO.protocolStructure(DB, SC({ replicates: { n: 5 } }, { stochastic: { seed: 1 } })).problems.some((x) => /effect_size·sd/.test(x)));
  assert.ok(PROTO.protocolStructure(DB, SC({ replicates: { n: 3 } })).problems.some((x) => /결정론 실행인데/.test(x)));
});

test('② 사전 등록: 봉인·중복·사후 수정·실행 시각·사슬 변조', async () => {
  const CLERK = await import('../legislative/clerk.mjs');
  const dir = join(tmpdir(), `prereg-test-${process.pid}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const sc = SC(), seal = (x) => ATT.sealVerdict({ ok: true, errors: [], warnings: [] }, x);
  assert.throws(() => CLERK.registerPrereg({ dataDir: dir, scenario: sc, seal: null }), /봉인/);
  assert.throws(() => CLERK.registerPrereg({ dataDir: dir, scenario: sc, seal: seal(SC({ question: '다른 것' })) }), /다름/);
  const e = CLERK.registerPrereg({ dataDir: dir, scenario: sc, seal: seal(sc) });
  assert.throws(() => CLERK.registerPrereg({ dataDir: dir, scenario: sc, seal: seal(sc) }), /이미 등록/);
  const prereg = CLERK.readPrereg(dir), later = new Date(Date.parse(e.at) + 1000).toISOString(), earlier = new Date(Date.parse(e.at) - 1000).toISOString();
  assert.ok(PROTO.protocolVerdict(DB, sc, { prereg, runAt: later }).ok, '등록 뒤 실행 = 통과');
  assert.ok(PROTO.protocolVerdict(DB, sc, { prereg, runAt: earlier }).problems.some((x) => /앞서지 않음/.test(x)), '실행보다 늦은 등록');
  // 등록 뒤 시나리오를 고치면(예측·상수 무엇이든) 미등록
  assert.ok(PROTO.protocolVerdict(DB, { ...sc, expect: { final: 'D000175' } }, { prereg, runAt: later }).problems.some((x) => /사전 등록되지 않은/.test(x)));
  // 키 순서는 해시에 영향 없음 (정준 JSON)
  const reordered = JSON.parse(JSON.stringify({ protocol: sc.protocol, hypothetical: true, name: sc.name }));
  assert.ok(PROTO.protocolVerdict(DB, reordered, { prereg, runAt: later }).ok, '같은 내용 다른 키 순서');
  // 사슬 변조: 등록 시각을 앞당기면 root 불일치
  const forged = prereg.map((x) => ({ ...x, at: '2000-01-01T00:00:00.000Z' }));
  assert.ok(PROTO.protocolVerdict(DB, sc, { prereg: forged, runAt: later }).problems.some((x) => /내용이 바뀜/.test(x)));
  rmSync(dir, { recursive: true, force: true });
});
