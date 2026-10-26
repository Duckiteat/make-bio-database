// 집행 구멍 메우기 (재건 5c) — 변이 시험에서 '집행 자리를 망가뜨려도 아무 시험도 빨개지지 않던' 규칙마다 그 자리를 직접 찌르는 시험.
//   각 시험 이름의 RULE 번호는 재건 규칙 장부의 규칙, 변이 명세는 집행 변이 장부의 같은 번호 행.
//   시험은 판정 코드를 바꾸지 않는다 — 지금 판정이 그 규칙대로 거부·표시하는지만 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import SCN from '../scenarios.js';

const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const C = req('../core.js'), J = req('../judicial/judicial.js'), ORCH = req('../orchestrator.js');
const RAW = JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8'));
const BASE = C.normalize(JSON.parse(JSON.stringify(RAW)));
const IX = C.index(BASE);
const id = (ref) => { const r = C.resolveRef(IX, ref); if (r.error) throw new Error(r.error); return r.id; };
// 원본 JSON 을 고쳐 정규화한 뒤 검사 (obs 는 값 층 values 의 보기라 정규화 뒤 객체를 고치면 사라진다)
const probe = (f) => { const d = JSON.parse(JSON.stringify(RAW)); f(d); return J.validate(C.normalize(d)); };
const has = (list, re) => list.some((e) => re.test(e.msg));
const valueOf = (d, subject, property) => Object.values(d.values).find((v) => v.subject === subject && v.property === property && !v.retracted && !v.superseded_by);

test('RULE-0114 정성 관찰: 읽을 거리 대상(readout.target)이 없으면 거부', () => {
  const q = Object.keys(RAW.observations).find((k) => RAW.observations[k].kind === 'qualitative' && typeof RAW.observations[k].expect === 'string');
  assert.ok(q, '정성 관찰이 있어야 함');
  assert.ok(!has(probe(() => {}).errors, /읽을 거리 대상/), '지금 저장소는 통과');
  assert.ok(has(probe((d) => { delete d.observations[q].readout.target; }).errors, /읽을 거리 대상\(readout\.target\)이 없음/));
});

test('RULE-0123 이동된 번호는 다시 쓰지 않는다: 이동 표에 있는 번호가 아직 표에 있으면 거부', () => {
  const [a, b] = Object.keys(RAW.senses).slice(0, 2);
  const e = probe((d) => { d.moved = { [a]: { kind: 'merge', to: [b], why: '시험', at: '2026-10-25T00:00:00.000Z' } }; }).errors;
  assert.ok(has(e, /이동된 번호가 아직 표에 있음/), JSON.stringify(e.slice(0, 3)));
});

test('RULE-0127 정의항 obs 의 문헌(curated) 측정값은 관찰 기록(from)을 가리켜야 한다', () => {
  const v = valueOf(RAW, 'D000116', 'compartment_volume');
  assert.ok(v && v.from && v.evidence.level === 'curated');
  const e = probe((d) => { delete valueOf(d, 'D000116', 'compartment_volume').from; }).errors;
  assert.ok(has(e, /관찰 기록 참조\(from\)가 없음/), JSON.stringify(e.slice(0, 3)));
});

test('RULE-0111 추정용만 모델 값의 출처: 검증용(validation) 관찰을 정의항 obs 의 from 으로 쓰면 거부', () => {
  const o = valueOf(RAW, 'D000116', 'compartment_volume').from[0];
  const e = probe((d) => { d.observations[o].use = 'validation'; }).errors;
  assert.ok(has(e, /용도가 validation 인 관찰은 모델 값의 출처로 쓸 수 없음/), JSON.stringify(e.slice(0, 3)));
});

test('RULE-0436 저분자에 ChEBI 모체(parent)만 있으면 경고 — 반응 참여자(physiological)를 함께 적는 규약', () => {
  const ATP = id('ATP');
  assert.ok(!probe(() => {}).warnings.some((w) => /중성 모체만/.test(w.msg)), '지금 저장소는 경고 없음');
  const w = probe((d) => { d.senses[ATP].xrefs = d.senses[ATP].xrefs.filter((x) => !(x.db === 'ChEBI' && x.role === 'physiological')); }).warnings;
  assert.ok(w.some((x) => /중성 모체만 적혀 있음/.test(x.msg)), JSON.stringify(w.slice(0, 3)));
});

test('RULE-0153 힐 상수 없는 조절 규칙은 한계가 없으면 Regulatory_Gap 후보가 된다', () => {
  assert.deepEqual(J.detectGaps(BASE).filter((g) => g.type === 'Regulatory_Gap'), [], '지금 저장소는 모두 등록됨');
  const d = JSON.parse(JSON.stringify(RAW)); d.limitations = {};
  const mods = Object.entries(RAW.senses).flatMap(([sid, s]) => (s.rule || []).filter((r) => r.type === 'modulation' && !r.kinetics).map((r) => `${sid}/rule/${r.id}`));
  assert.ok(mods.length > 0);
  const got = new Set(J.detectGaps(d).filter((g) => g.type === 'Regulatory_Gap').map((g) => g.target));
  assert.deepEqual(mods.filter((m) => !got.has(m)), [], '한계가 없으면 상수 없는 조절 규칙이 모두 후보');
});

test('RULE-0289 수집 후보: read_value 인데 값이 없으면 INCOMPLETE (출처·인용이 있어도 검토로 넘기지 않음)', () => {
  const CA = req('../judicial/collection_audit.js');
  const v = CA.auditCollection(RAW, [{ outcome: 'read_value', unit: 's^-1', source: { db: 'DOI', id: '10.1111/febs.14782' }, quote: 'kcat = 170 s-1', use: 'estimation' }]).verdict;
  assert.equal(v, 'INCOMPLETE');
});

test('RULE-0182 규약 없는 실행은 탐색 실행: 규약 판정이 통과로 나오지 않는다', () => {
  const PROTO = req('../judicial/protocol.js');
  const s = PROTO.protocolStructure(RAW, { name: '규약 없음' });
  assert.equal(s.declared, false); assert.equal(s.ok, false);
  assert.ok(s.problems.some((p) => /탐색 실행/.test(p)), s.problems.join(' · '));
});

test('RULE-0374 시뮬레이션 보고는 기본값·무한 풀 시작량을 농도 공백으로 표시하고 등록된 한계를 적는다', () => {
  const t = ORCH.simulateText(BASE, 'LPS–TLR4–NF-κB 신호 전달', {});
  assert.match(t, /⚠ 농도 공백: 시작량 \d+개가 기본값, \d+개가 무한 풀/);
  assert.match(t, /L000002/, '무한 풀 한계(L000002)가 보고에 있어야 함');
});

test('RULE-0451 가정 원장: 기원(origin) 어휘 밖의 새 기록은 거부', () => {
  const AA = req('../judicial/assumption_audit.js');
  const OK = { slot: { kind: 'kinetics', key: 'D000205/rule/division_attrition', param: 'k' }, value: 1e-19, unit: null, origin: 'assumed', limitations: ['L000116'], basis: '시험 — 열린 한계 L000116 이 다루는 상수' };
  const EV = SCN.ledger();
  assert.ok(AA.checkProposals(EV, [OK], RAW).ok, AA.checkProposals(EV, [OK], RAW).errors.join());
  const bad = AA.checkProposals(EV, [{ ...OK, origin: 'guessed' }], RAW);
  assert.equal(bad.ok, false); assert.match(bad.errors.join('\n'), /기원 'guessed'/);
});

// 컴파일러 · 사법부 독립 검증 — 운명 IR (MHC 기전 시나리오: 막 단계가 있다)
const IRB = req('../compiler/ir_builder.js'), DER = req('../judicial/derivative.js');
const MAT = SCN.read(join(ROOT, 'examples/scenarios/mhc-dc-maturation-lps-hypothetical.json')), SRC = 'D000202';

test('RULE-0169 막에서만 일어나는 단계의 반응 부피는 시나리오 volumes[막] 이다', () => {
  const ir = IRB.buildFateIR(RAW, SRC, MAT), V = req('../vocab.js');
  const steps = ir.rules.filter((r) => r.kind === 'step' && r.k);
  assert.ok(steps.some((r) => V.locations[r.loc].dim === '2D'), '막 단계가 있어야 시험이 된다');
  for (const r of steps) { const v = MAT.volumes[r.loc]; assert.equal(r.Vr, v.value * C.VOL[v.unit], `${r.ref} @ ${r.loc}`); }
});

test('RULE-0168 결합 적분은 질량 작용·가역 결합·MM 만 — 다른 법칙의 단계는 끄고 사실(step_law_unsupported)로 보고', () => {
  const ref = 'D000191/rule/er_exit', sc = JSON.parse(JSON.stringify(MAT));
  sc.kinetics[ref] = { law: 'hill', K: 1e-6, n: 1, fmax: 2, evidence: { level: 'predicted', confidence: 0 } };
  const ir = IRB.buildFateIR(RAW, SRC, sc);
  assert.ok(ir.facts.some((f) => f.kind === 'step_law_unsupported' && f.ref === ref && f.law === 'hill'), JSON.stringify(ir.facts.slice(0, 3)));
  assert.ok(!ir.rules.some((r) => r.ref === ref && r.k), '그 단계는 꺼져야 함');
});

test('RULE-0033 희소 LU 기호 분석은 사법부 checkLU 가 검증 — 대각 위치가 틀린 패턴은 거부', () => {
  const ir = IRB.buildFateIR(RAW, SRC, MAT);
  assert.deepEqual(DER.checkLU(ir).problems, []);
  const bad = structuredClone(ir), L = bad.jac.lu, r = [...L.diagPos.keys()].find((i) => L.rowPtr[i + 1] - L.rowPtr[i] > 1) ?? 0;
  L.diagPos[r] = L.diagPos[r] === L.rowPtr[r] ? L.rowPtr[r] + 1 : L.rowPtr[r];
  assert.ok(DER.checkLU(bad).problems.some((p) => /대각 위치가 틀림/.test(p)), DER.checkLU(bad).problems.join(' · '));
});

test('RULE-0064 physiological 의 확인은 Rhea 반응 참여 ≥ 3 — 2 회면 거부', () => {
  const AUG = req('../judicial/identity.js'), dir = mkdtempSync(join(tmpdir(), 'rhea-'));
  try {
    cpSync(join(ROOT, 'data/fetched'), dir, { recursive: true });
    const f = join(dir, 'rhea', 'CHEBI_30616.json'), lines = readFileSync(f, 'utf8').split('\n');
    writeFileSync(f, lines.slice(0, 3).join('\n') + '\n'); // 머리 + 반응 2 개
    const ATP = id('ATP'), d = JSON.parse(JSON.stringify(RAW));
    d.senses[ATP].xrefs = [{ db: 'ChEBI', id: 'CHEBI:15422', status: 'verified', role: 'parent' }, { db: 'ChEBI', id: 'CHEBI:30616', status: 'asserted', role: 'physiological' }];
    const row = AUG.verifyIdentity(C.normalize(d), { dir }).rows.find((x) => x.sense === ATP && x.kind === 'chebi_entity' && x.key === 'CHEBI:30616');
    assert.equal(row.outcome, 'rejected', row.detail);
    assert.match(row.detail, /반응 참여 2회 < 3/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// 추세 — 합의 수신함과 창
const TR = req('../judicial/trend.js'), ATT = req('../judicial/attestation.js');

test('RULE-0223 합의 수신함은 신원 수신함의 하위 폴더이고 같은 폴더가 아니다 (신원 도장의 증거를 덮지 않음)', () => {
  assert.equal(TR.CONSENSUS, 'data/fetched/consensus');
});

test('RULE-0224 창 표에 없는 원천의 추세 도장은 만료 — 창을 지어내지 않는다', () => {
  const reg = ATT.readRegistry(ROOT), S = C.VOCAB.consensus.sources, saved = { ...S };
  const live = TR.verdicts(BASE, reg, { root: ROOT, reverify: false, today: '2026-10-11' });
  assert.ok(Object.keys(live.map).length > 0, '창 안의 추세 도장이 있어야 시험이 된다');
  try {
    for (const k of Object.keys(S)) delete S[k]; // 원천 표를 비운다 → 모든 도장이 '창 없음'
    const v = TR.verdicts(BASE, reg, { root: ROOT, reverify: false, today: '2026-10-11' });
    assert.equal(Object.keys(v.map).length, 0);
    assert.ok(v.expired.length === Object.keys(live.map).length && v.expired.every((x) => x.window == null));
  } finally { Object.assign(S, saved); }
});

test('RULE-0330 어휘 목록에 없는 값은 거부하고 가까운 값을 제안한다 (전체 목록이 아니라 비슷한 값)', () => {
  const M = req('../model.js');
  assert.deepEqual(M.mapVocab('kinds', 'protien'), { error: "kind 'protien' 은(는) 어휘 목록에 없음 — 가능한 값: protein" });
  assert.match(M.mapVocab('locations', 'cytosl').error, /가능한 값: cytosol$/);
  assert.deepEqual(M.mapVocab('kinds', 'protein'), { key: 'protein' });
});
