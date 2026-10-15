// 사법부 통계·관찰 판정 (4단계 ②) — judicial/stats.js · judicial/obs_compare.js · compiler/obs_operator.js predict
//   ① 특수 함수가 알려진 값과 같음 ② 귀무 가설 아래 기각률 ≈ α (검정이 보정되어 있음) ③ 검정력 공식 = 모의 기각률
//   ④ 관찰 3 판정(CONSISTENT·CONFLICT·INDISTINGUISHABLE)과 필요한 정밀도 ⑤ 관찰 연산자: 운명 원자료 → 측정량
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const S = req('../judicial/stats.js'), OC = req('../judicial/obs_compare.js'), OP = req('../compiler/obs_operator.js'), DefDB = req('../core.js'), F = req('../engine/fate_engine.js');
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

test('① 특수 함수: χ²·정규·KS·F·lnΓ 의 알려진 값', () => {
  close(S.chi2Sf(3.841458820694124, 1), 0.05, 1e-13, 'χ²₁ 0.95 분위');
  close(S.chi2Sf(11.070497693516351, 5), 0.05, 1e-13, 'χ²₅ 0.95 분위');
  close(S.normInv(0.975), 1.959963984540054, 1e-13, 'Φ⁻¹(0.975)');
  close(S.normSf(5), 2.866515718791939e-7, 1e-19, '정규 꼬리 z = 5');
  close(S.ksSf(1.3580986393225505), 0.05, 1e-6, '콜모고로프 0.95');
  close(S.fCdf(1, 10, 10), 0.5, 1e-12, 'F(10,10) 중앙값');
  close(S.lnGamma(10), Math.log(362880), 1e-13, 'lnΓ(10)');
  close(S.betaI(2, 3, 0.4), 0.5248, 1e-12, 'I_0.4(2,3)');
  close(S.ncChi2Cdf(3.841458820694124, 1, 0), 0.95, 1e-13, '비중심 λ = 0');
});

test('② 보정: 귀무 가설 아래 기각률 ≈ α (χ² 적합도·분할표·이산 AD 두 표본·KS)', () => {
  const u = S.rng(7), p = [0.1, 0.2, 0.3, 0.4];
  const draw = (n) => { const c = S.drawCounts(p, n, u), xs = []; c.forEach((k, j) => { for (let i = 0; i < k; i++) xs.push(j); }); return { c, xs }; };
  let gof = 0, cont = 0, ad = 0, ks = 0; const R = 400, Rad = 120;
  for (let i = 0; i < R; i++) {
    const a = draw(200), b = draw(200);
    if (S.chi2GOF(a.c, p).p < 0.05) gof++;
    if (S.chi2Contingency([a.c, b.c]).p < 0.05) cont++;
    const x = Array.from({ length: 50 }, () => u()), y = Array.from({ length: 50 }, () => u());
    if (S.ks2(x, y).p < 0.05) ks++;
    if (i < Rad && S.ad2Sample(draw(60).xs, draw(60).xs, { perm: 200, seed: i + 1 }).p < 0.05) ad++;
  }
  for (const [name, k, n] of [['χ² 적합도', gof, R], ['분할표', cont, R], ['KS 두 표본', ks, R], ['이산 AD 두 표본', ad, Rad]]) {
    const rate = k / n; assert.ok(rate > 0.01 && rate < 0.1, `${name} 기각률 ${rate} — α 0.05 근처여야 함`);
  }
  // 한 표본 이산 AD: 귀무에서 크고, 어긋나면 작음
  const c = S.drawCounts(p, 300, S.rng(3));
  assert.ok(S.adDiscrete(c, p, { boot: 400 }).p > 0.01);
  assert.ok(S.adDiscrete(c, [0.4, 0.3, 0.2, 0.1], { boot: 400 }).p < 0.01);
});

test('③ 검정력: 비중심 χ² 공식 = 모의 기각률, z 검정 필요 표준 오차', () => {
  const p0 = [0.5, 0.5], p1 = [0.6, 0.4], n = 200, pw = S.powerChi2GOF(p0, p1, n);
  const u = S.rng(11); let rej = 0; const R = 1500;
  for (let i = 0; i < R; i++) if (S.chi2GOF(S.drawCounts(p1, n, u), p0).p < 0.05) rej++;
  close(rej / R, pw.power, 0.04, '검정력');
  const se = S.requiredSE(1); close(S.powerZ(1, se), 0.8, 1e-5, '필요 표준 오차에서 검정력 0.8 (반대쪽 꼬리 몫만큼 위)'); assert.ok(S.powerZ(1, se) >= 0.8);
});

const obs = (o) => Object.assign({ observable: { kind: 'amount', target: 'D000165|nucleoplasm' }, value: 1000, unit: 'molecule', uncertainty: { kind: 'measurement', model: 'normal', sd: 50 }, replicates: 4, condition: { species: '9606' }, use: 'validation', evidence: { level: 'computed', tool: 'synthetic' }, provenance: { source: { db: 'DOI', id: '10.0000/synthetic-obs' } } }, o);

test('④ 관찰 판정: 세 판정·필요 정밀도·추정용 거부·결정론의 퍼짐 공백', () => {
  // 표준 오차 25 (sd 50 / √4). 가설 하나의 일치는 선언된 δ 로만 (M1) — δ 는 근거 등급이 붙는 값
  // 일치는 사전 등록된 규약의 검증 세트 관찰에서만 (L3) — 여기서는 규약 판정이 통과했다고 두고 판정 규칙만 본다 (규약 자체는 tests/protocol.test.mjs)
  const PV = { declared: true, ok: true, problems: [], validation: ['O900001'] };
  const EQ = (delta, o) => ({ protocol: PV, observationId: 'O900001', equivalence: Object.assign({ delta, evidence: { level: 'curated', sources: [{ db: 'DOI', id: '10.0000/synthetic', citation: '합성, 2026' }] } }, o) });
  assert.equal(OC.verdict(obs(), [1010]).verdict, 'INDISTINGUISHABLE', 'δ 없이 기각 못 함은 일치가 아님');
  assert.match(OC.verdict(obs(), [1010], null, { protocol: PV, observationId: 'O900001' }).limitation.requirement, /δ 가 선언되지 않음/);
  assert.equal(OC.verdict(obs(), [1010], null, EQ(100)).verdict, 'CONSISTENT');
  const c = OC.verdict(obs(), [1200]); assert.equal(c.verdict, 'CONFLICT'); assert.equal(c.fault, 'DOMAIN_CONFLICT');
  // 두 가설 1000·1030 은 표준 오차 25 로 가를 수 없음 → Observation_Gap, 필요한 반복 수에서는 검정력 0.8
  const v = OC.verdict(obs({ value: 1015 }), [1000], [1030]);
  assert.equal(v.verdict, 'INDISTINGUISHABLE'); assert.equal(v.fault, 'DATA_GAP'); assert.equal(v.limitation.type, 'Observation_Gap');
  const r = v.required.replicates_at_sd; assert.ok(r > 4);
  assert.ok(S.powerZ(30, 50 / Math.sqrt(r)) >= 0.8 && S.powerZ(30, 50 / Math.sqrt(r - 1)) < 0.8, '필요 반복 수가 최소');
  assert.equal(OC.design(obs(), [1000], [1030]).replicates, r, '관찰 없이 설계해도 같은 반복 수');
  // 정밀하면 한쪽을 고름
  const sharp = OC.verdict(obs({ value: 1000, uncertainty: { kind: 'measurement', model: 'normal', sd: 5 } }), [1000], [1030]);
  assert.equal(sharp.verdict, 'CONSISTENT'); assert.equal(sharp.preferred, 'A');
  // 추정용·철회 관찰은 판정하지 않음
  assert.match(OC.verdict(obs({ use: 'estimation' }), [1000]).error, /추정용 관찰은 판정하지 않음/);
  // 생물 변이: 결정론 예측은 퍼짐을 판정할 수 없다고 적고, 앙상블은 F 검정
  const bio = obs({ uncertainty: { kind: 'biological', model: 'normal', sd: 100 }, replicates: 30 });
  assert.ok(OC.verdict(bio, [1000]).A.notes.some((x) => /확률 앙상블 필요/.test(x)));
  const u = S.rng(5), ens = Array.from({ length: 200 }, () => 1000 + 100 * S.normInv(u()));
  const ok = OC.verdict(bio, ens, null, EQ(100)); assert.equal(ok.verdict, 'CONSISTENT'); assert.ok(ok.A.spread);
  const narrow = Array.from({ length: 200 }, () => 1000 + 20 * S.normInv(u()));
  assert.equal(OC.verdict(bio, narrow).verdict, 'CONFLICT', '모델 퍼짐이 생물 변이보다 훨씬 좁음');
  // 로그정규·계수·검출 한계
  assert.equal(OC.verdict(obs({ uncertainty: { kind: 'measurement', model: 'lognormal', sd: 0.1 } }), [1050], null, EQ(0.2, { scale: 'ln' })).verdict, 'CONSISTENT');
  assert.match(OC.verdict(obs({ uncertainty: { kind: 'measurement', model: 'lognormal', sd: 0.1 } }), [1050], null, EQ(100)).limitation.requirement, /척도/);
  assert.equal(OC.verdict(obs({ value: 3, uncertainty: { kind: 'measurement', model: 'poisson', sd: 0 }, replicates: 1 }), [5], null, EQ(10)).verdict, 'CONSISTENT');
  // 검출 한계: δ 없이 "확신 상한" — 오차가 크면 아래라고 확신할 수 없음 (규약은 여전히 필요)
  assert.equal(OC.verdict(obs({ value: 10, detection_limit: 20 }), [5], null, EQ(1)).verdict, 'INDISTINGUISHABLE');
  assert.equal(OC.verdict(obs({ value: 10, detection_limit: 20, uncertainty: { kind: 'measurement', model: 'normal', sd: 2 } }), [5], null, EQ(1)).verdict, 'CONSISTENT');
  assert.equal(OC.verdict(obs({ value: 10, detection_limit: 20, uncertainty: { kind: 'measurement', model: 'normal', sd: 2 } }), [5]).verdict, 'INDISTINGUISHABLE', '규약 없이는 확신 상한도 일치가 아님');
  assert.equal(OC.verdict(obs({ value: 10, detection_limit: 20 }), [500]).verdict, 'CONFLICT');
  // 도달 시각: 도달하지 않은 실행은 중도 절단, 모두 못 하면 모순
  const et = obs({ observable: { kind: 'event_time', target: 'D000175' }, value: 7200, unit: 's', uncertainty: { kind: 'measurement', model: 'normal', sd: 600 }, replicates: 3 });
  assert.equal(OC.verdict(et, [Infinity]).verdict, 'CONFLICT');
  assert.ok(OC.verdict(et, [7000, Infinity]).A.notes.some((x) => /중도 절단/.test(x)));
});

test('④′ 동등성(TOST, M1): δ 근거 등급 · 정밀도 부족 · 차가 δ 이상 · 척도', () => {
  const ev = (level, extra) => Object.assign({ level }, extra);
  const doi = { sources: [{ db: 'DOI', id: '10.0000/synthetic', citation: '합성, 2026' }] };
  const PV = { declared: true, ok: true, problems: [], validation: ['O900001'] };
  const v = (delta, evidence, o, pred) => OC.verdict(obs(o), pred || [1010], null, { protocol: PV, observationId: 'O900001', equivalence: { delta, evidence } });
  // 근거 등급: curated+DOI → parameter (판정), asserted → reference (판정 안 함), abstracted+DOI → S3·D2 = reference, 근거 없음 → reference
  assert.equal(v(100, ev('curated', doi)).verdict, 'CONSISTENT');
  assert.equal(v(100, ev('curated', doi)).equivalence.grade, 'parameter');
  for (const e of [ev('asserted'), ev('abstracted', doi), undefined]) {
    const r = v(100, e); assert.equal(r.verdict, 'INDISTINGUISHABLE'); assert.match(r.limitation.requirement, /근거 등급이 reference/);
  }
  // 정밀도 부족: δ 40, 차 10, 표준 오차 25 → 필요한 표준 오차 = (40 − 10) / z_0.95
  const weak = v(40, ev('curated', doi)); assert.equal(weak.verdict, 'INDISTINGUISHABLE');
  close(weak.equivalence.required_se, 30 / S.normInv(0.95), 1e-12, '필요 표준 오차');
  // 그 표준 오차에서는 (경계에서) 보인다: sd = 필요 se × √4 보다 조금 작게
  const sdOk = weak.equivalence.required_se * 2 * 0.99;
  assert.equal(v(40, ev('curated', doi), { uncertainty: { kind: 'measurement', model: 'normal', sd: sdOk } }).verdict, 'CONSISTENT');
  // 차가 δ 이상: 기각은 못 해도(모순 아님) 동등성은 어떤 정밀도로도 불가
  const far = v(5, ev('curated', doi)); assert.equal(far.verdict, 'INDISTINGUISHABLE'); assert.match(far.limitation.requirement, /어떤 정밀도로도/);
  // 모순은 δ 와 무관하게 모순
  assert.equal(v(1000, ev('curated', doi), {}, [1200]).verdict, 'CONFLICT');
  // 잘못된 δ
  assert.match(v(-1, ev('curated', doi)).limitation.requirement, /양의 유한수/);
  // 두 가설 비교는 그대로 (가르는 판정)
  assert.equal(OC.verdict(obs({ value: 1000, uncertainty: { kind: 'measurement', model: 'normal', sd: 5 } }), [1000], [1030]).verdict, 'CONSISTENT');
  // 판정 강도 = min(δ, 관찰): 출처 식별자 없는 관찰은 δ 가 좋아도 일치를 결론으로 쓰지 않음
  const noSrc = v(100, ev('curated', doi), { provenance: undefined });
  assert.equal(noSrc.verdict, 'INDISTINGUISHABLE'); assert.match(noSrc.limitation.requirement, /검증 관찰의 등급이 reference/);
  assert.equal(v(100, ev('curated', doi)).equivalence.observation_grade, 'parameter');
  // 규약 (L3): 없으면 탐색 실행, 위반이면 그 사유, 검증 세트 밖 관찰이면 사후 선택
  const base = { equivalence: { delta: 100, evidence: ev('curated', doi) } };
  assert.match(OC.verdict(obs(), [1010], null, base).limitation.requirement, /규약이 없음/);
  assert.match(OC.verdict(obs(), [1010], null, { ...base, protocol: { declared: true, ok: false, problems: ['사전 등록되지 않은 시나리오'] } }).limitation.requirement, /규약 위반: 사전 등록되지 않은/);
  assert.match(OC.verdict(obs(), [1010], null, { ...base, protocol: PV, observationId: 'O900002' }).limitation.requirement, /검증 세트\(protocol.validation\)에 없음/);
  assert.match(OC.verdict(obs(), [1010], null, { ...base, protocol: PV }).limitation.requirement, /번호 없음/);
  // 보고서 줄에 동등성이 실린다
  assert.match(OC.verdictText(v(100, ev('curated', doi))), /동등성\(TOST\): δ 100/);
});

test('⑤ 관찰 연산자: 운명 원자료(결정론) → 분자 수(격자 보간)·농도·비율·도달 시각', () => {
  const db = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
  const sc = JSON.parse(readFileSync(new URL('../examples/scenarios/fate-mixed-optimal-hypothetical.json', import.meta.url), 'utf8'));
  const raw = F.simulateFate(db, 'D000174', { scenario: sc, engine: 'js', commitment: false });
  const k = raw.keys.indexOf('D000165|nucleoplasm'), T = raw.process.times, j = 100;
  assert.equal(OP.predict(obs({ condition: { species: '9606', time_s: T[j] } }), [raw])[0], raw.series[j][k], '기록점에서는 그 값');
  const mid = OP.predict(obs({ condition: { species: '9606', time_s: (T[j] + T[j + 1]) / 2 } }), [raw])[0];
  close(mid, (raw.series[j][k] + raw.series[j + 1][k]) / 2, 1e-9 * Math.abs(mid), '기록점 사이 선형 보간');
  assert.equal(OP.predict(obs(), [raw])[0], raw.series[raw.series.length - 1][k], '시각 없으면 끝 상태');
  const conc = OP.predict(obs({ observable: { kind: 'concentration', target: 'D000165|nucleoplasm' } }), [raw])[0];
  close(conc, raw.series[raw.series.length - 1][k] / (req('../model.js').NA * raw.volumes.nucleoplasm), 1e-20, '농도 = N / (NA·V)');
  const reach = raw.firstReach.D000175;
  assert.equal(OP.predict(obs({ observable: { kind: 'event_time', target: 'D000175' } }), [raw])[0], reach);
  assert.deepEqual(OP.predict(obs({ observable: { kind: 'fraction', target: 'D000175' }, condition: { species: '9606', time_s: reach - 1 } }), [raw, raw]), [0, 0]);
  assert.deepEqual(OP.predict(obs({ observable: { kind: 'fraction', target: 'D000176' } }), [raw]), [0], '도달 안 한 상태');
});
