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
// 정의항(규칙이 아닌) obs 의 문헌 측정값 하나 — 번호를 박지 않고 찾는다 (실제 값이 바뀌어도 시험은 그대로)
const CUR = Object.values(RAW.values).find((v) => !v.subject.includes('/') && v.evidence && v.evidence.level === 'curated' && (v.from || []).length && !v.retracted && !v.superseded_by);

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
  const v = valueOf(RAW, CUR.subject, CUR.property);
  assert.ok(v && v.from && v.evidence.level === 'curated');
  const e = probe((d) => { delete valueOf(d, CUR.subject, CUR.property).from; }).errors;
  assert.ok(has(e, /관찰 기록 참조\(from\)가 없음/), JSON.stringify(e.slice(0, 3)));
});

test('RULE-0111 추정용만 모델 값의 출처: 검증용(validation) 관찰을 정의항 obs 의 from 으로 쓰면 거부', () => {
  const o = valueOf(RAW, CUR.subject, CUR.property).from[0];
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

test('RULE-0052 수렴 기준해는 그 시나리오 적분 허용 오차의 1/1000 (등록부 ref_tol_factor) — 고정 숫자가 아님', () => {
  const COUPLING = req('../engine/coupling.js');
  const f = COUPLING.resolve({}).ref_tol_factor;
  assert.equal(f, 1e-3);
  assert.deepEqual(ORCH.refScenario({}).integrator, { rtol: 1e-9, atol: 1e-5 }, '기본 허용 오차에서는 예전 값과 비트까지 같다');
  const tight = ORCH.refScenario({ integrator: { rtol: 1e-8, atol: 1e-4 }, t_end: 5 });
  assert.deepEqual(tight.integrator, { rtol: 1e-8 * f, atol: 1e-4 * f }, '시나리오가 좁히면 기준해도 따라 좁아진다');
  assert.equal(tight.t_end, 5, '다른 칸은 그대로');
});

test('RULE-0066 자동 보강은 원본 값이 asserted 값과 달라도 --sync 없이는 바꾸지 않는다', () => {
  const DRAFT = req('../legislative/augment_draft.js'), sid = 'D000053';
  const old = BASE.senses[sid].obs.find((o) => o.property === 'sequence_length' && o.context.species === '9606');
  const up = BASE.senses[sid].xrefs.find((x) => x.db === 'UniProt');
  assert.ok(old && up);
  const verdict = { rows: [{ outcome: 'verified', kind: 'uniprot_entry', sense: sid, detail: '시험', src: '시험', facts: { db: 'UniProt', from: up.id, id: up.id, format: 'json', length: old.value + 1, taxon: '9606' } }], tasks: [] };
  const len = (d) => { const s = d.patch.senses.find((x) => x.id === sid); return (s && s.obs ? s.obs : BASE.senses[sid].obs).find((o) => o.property === 'sequence_length' && o.context.species === '9606').value; };
  const keep = DRAFT.draftPatch(BASE, verdict, { date: '2026-10-26' });
  assert.equal(len(keep), old.value, 'sync 없음 — 값 유지');
  assert.match(keep.rows[0].detail, /서열 길이 충돌/);
  assert.equal(len(DRAFT.draftPatch(BASE, verdict, { date: '2026-10-26', sync: true })), old.value + 1, 'sync — 원본 값으로');
});

test('RULE-0327 뜻이 여러 개인 이름은 거부하고 후보를 보이고, 없는 이름은 비슷한 이름을 제안하고, 여러 개념과 겹치는 이름은 패치에서 거부', () => {
  const multi = [...IX.termSenses].find(([, v]) => v.length > 1), name = BASE.terms[multi[0]].names.ko;
  const r = C.resolveRef(IX, name);
  assert.ok(r.error && multi[1].every((d) => r.error.includes(d)), r.error);
  assert.match(C.resolveRef(IX, '에피네프란').error, /비슷한 이름: 에피네프린/);
  const LEG = req('../legislative/legislative.js'), d = JSON.parse(JSON.stringify(RAW)), [a, b] = Object.keys(d.terms);
  for (const t of [a, b]) d.terms[t].aliases = [...(d.terms[t].aliases || []), '겹친 이름'];
  const m = LEG.merge(C.normalize(d), { format: 'definition-db-patch', version: 9, why: '시험', recorded_at: '2026-10-26T00:00:00.000Z', senses: [{ id: 'D+1', term: '겹친 이름', kind: 'protein', tier: 'T1', desc: [{ text: '시험', field: '생화학', context: { scope: '시험' } }] }] });
  assert.ok(m.report.errors.some((e) => /이름 '겹친 이름' 이 여러 개념과 겹침/.test(e.msg)), JSON.stringify(m.report.errors.slice(0, 3)));
});

test('RULE-0245 무결성 증명서: 엔진 감사에 AUDIT_MASS 가 있으면 FAIL', () => {
  const F = req('../engine/fate_engine.js'), FA = req('../judicial/fate_audit.js'), PR = req('../judicial/process_report.js');
  const ir = IRB.buildFateIR(C.normalize(RAW), SRC, MAT), r = F.simulateFate(RAW, SRC, { engine: 'rust', scenario: MAT, ir });
  assert.ok(!r.error, r.error);
  const v = FA.judgeFate(RAW, r, { scenario: MAT, ir }), rerunHash = FA.trajectoryHash(F.simulateFate(RAW, SRC, { engine: 'rust', scenario: MAT, ir }));
  assert.ok(PR.processReport(v, { scenario: MAT, ir, rerunHash }).pass, '오염 전에는 통과');
  const bad = { ...v, audit: [...v.audit, { code: 'AUDIT_MASS', fault: 'ENGINE_DEFECT', where: '시험', msg: '부분 구조 수지 어긋남 (시험)', suggestion: '' }] };
  const rep = PR.processReport(bad, { scenario: MAT, ir, rerunHash });
  assert.equal(rep.pass, false);
  assert.ok(rep.checks.some((c) => /AUDIT_MASS 없음/.test(c.name) && c.ok === false));
});

// 5d — 코드에서 찾은 규칙(from_code)의 검사 자리
test('RULE-0505 패치는 JSON 객체여야 한다 — 객체가 아니면 병합 거부', () => {
  const LEG = req('../legislative/legislative.js');
  for (const p of [null, [], 'patch']) assert.ok(LEG.merge(BASE, p).report.errors.some((e) => e.rule === 'RULE-0505' && /JSON 객체가 아님/.test(e.msg)), JSON.stringify(p));
});

test('RULE-0359 패치 참여자의 특징 "부위:특징" 은 콜론으로 나뉜다 — 형식이 틀리면 거부', () => {
  const LEG = req('../legislative/legislative.js'), sid = Object.keys(RAW.steps)[0], st = JSON.parse(JSON.stringify(RAW.steps[sid]));
  const p = st.inputs.find((x) => x.ref) || st.inputs[0];
  const patch = { format: 'definition-db-patch', version: 9, why: '시험', recorded_at: '2026-10-26T00:00:00.000Z', steps: [{ ...st, id: sid, inputs: [{ ref: p.ref || p.b.split('|')[0], features: ['콜론없음'], location: p.location || p.b.split('|').pop() }] }] };
  const errs = LEG.merge(BASE, patch).report.errors;
  assert.ok(errs.some((e) => e.rule === 'RULE-0359' && /형식/.test(e.msg)), JSON.stringify(errs.slice(0, 3)));
});

test('RULE-0510 사전 새 항목은 객체여야 하고 vocab 의 register·키만 받는다', () => {
  const DA = req('../judicial/dictionary_audit.js');
  const v = DA.checkProposals([], [null]);
  assert.equal(v.ok, false); assert.equal(v.rules[0], 'RULE-0510'); assert.match(v.errors[0], /객체가 아님/);
  const w = DA.checkProposals([], [{ register: '없는표', key: 'x', label_en: 'x', meaning_en: 'x', since: '2026-10-26', xref: null }]);
  assert.ok(w.errors.some((e, i) => /register 어휘 밖/.test(e) && w.rules[i] === 'RULE-0510'));
});

test('RULE-0509 병합 기록 재생: 형식 변환 스크립트가 기록과 다르거나 지금 db 가 기록의 끝과 다르면 거부', () => {
  const LA = req('../judicial/log_audit.js'), ATT = req('../judicial/attestation.js'), sha = (x) => req('crypto').createHash('sha256').update(x).digest('hex');
  const X = 'a'.repeat(64), Y = 'b'.repeat(64), genesis = { format: 'definition-db-log', db_sha256: X, root: sha('genesis\n' + X) };
  const body = { seq: 1, prev: genesis.root, kind: 'migration', script: 'migrations/012.js', script_sha256: 'c'.repeat(64), db_sha256: Y };
  const events = [{ ...body, root: sha(body.prev + '\n' + ATT.canon(body)) }];
  const ok = LA.replayVerdict(genesis, events, { snapshot_sha256: X, shas: [Y], scriptShas: { 0: 'c'.repeat(64) } }, Y);
  assert.ok(ok.ok, ok.errors.join(' · '));
  const bad = LA.replayVerdict(genesis, events, { snapshot_sha256: X, shas: [Y], scriptShas: { 0: 'd'.repeat(64) } }, Y);
  assert.ok(bad.errors.some((e, i) => /형식 변환 스크립트가 기록된 것과 다름/.test(e) && bad.rules[i] === 'RULE-0509'));
  const edited = LA.replayVerdict(genesis, events, { snapshot_sha256: X, shas: [Y], scriptShas: { 0: 'c'.repeat(64) } }, 'e'.repeat(64));
  assert.ok(edited.errors.some((e, i) => /기록을 거치지 않은 쓰기/.test(e) && edited.rules[i] === 'RULE-0509'));
});

test('RULE-0507 서기는 봉인된 db 와 쓰려는 db 가 같을 때만 형식 변환을 쓴다', async () => {
  const CLERK = await import('../legislative/clerk.mjs'), ATT = req('../judicial/attestation.js');
  const v = J.validate(BASE), seal = ATT.sealVerdict({ ok: !v.errors.length, errors: v.errors, warnings: v.warnings }, BASE);
  const other = JSON.parse(JSON.stringify(RAW)); other.meta = { ...(other.meta || {}), _시험: 1 };
  assert.throws(() => CLERK.commitMigration({ dbPath: join(tmpdir(), 'never', 'db.json'), db: other, seal, script: 'migrations/012.js', scriptText: '', fromSha: 'x' }),
    (e) => e.rule === 'RULE-0507' && /봉인된 db 와 쓰려는 db 가 다름/.test(e.message));
});
