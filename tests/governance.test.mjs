// 삼권 분립 시험 (Tripartite Governance & Isolation) — docs/design/tripartite-governance.md
//   ① 쓰기 권한: 파일을 쓰는 코드는 입법 서기(legislative/clerk.mjs)와 형식 변환(migrations/)에만
//   ② 행정부(core.js·engine/)는 사법·입법·조정자를 부르지 않고, 감사 코드·'verified' 선언·판결 필드가 없다
//   ③ 사법부(judicial/)는 엔진을 실행하지 않고 쓰지 않는다 · 입법부 초안(legislative/*.js)은 검사하지 않는다
//   ④ 증명 등록부: 도장 없는 'verified' 거부, 변조·위조 도장 거부 · 서기는 봉인 없는 쓰기를 거부
//   ⑤ 독립 검증: 원자료를 몰래 바꾸면 사법부 검증기가 잡는다 · ⑥ 결합점 등록부: 엔진을 고치지 않고 값을 데이터 쪽으로
// 실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const C = req('../core.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), ORCH = req('../orchestrator.js');
const ATT = req('../judicial/attestation.js'), FA = req('../judicial/fate_audit.js'), F = req('../engine/fate_engine.js'), COUPLING = req('../engine/coupling.js');
const BASE = C.normalize(JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8')));
const FIX = join(ROOT, 'tests/fixtures/augment');

// 저장소의 코드 파일 (테스트·node_modules·.git 제외)
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'tests'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p)]; });
const CODE = walk(ROOT).filter((p) => /\.(js|mjs|html)$/.test(p));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); // 주석 제거 (문자열 속 // 는 대부분 URL 이라 보존)
const src = (p) => strip(readFileSync(join(ROOT, p), 'utf8'));
const WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|renameSync|unlinkSync|rmSync|mkdirSync|createWriteStream|copyFileSync)\b/;

test('① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만', () => {
  const writers = CODE.filter((p) => WRITE.test(src(p)));
  assert.deepEqual(writers.filter((p) => p !== 'legislative/clerk.mjs' && !p.startsWith('migrations/')), [], '서기 밖의 쓰기');
  assert.ok(writers.includes('legislative/clerk.mjs'));
  assert.ok(!/execFileSync|child_process/.test(src('dbtool.mjs')), 'dbtool 은 받기(curl)도 서기에게');
});

test('② 행정부: 사법·입법·조정자를 부르지 않고, 감사 코드·verified 선언이 없다', () => {
  const exec = ['core.js', ...CODE.filter((p) => p.startsWith('engine/'))];
  for (const p of exec) {
    const s = src(p);
    assert.ok(!/require\(['"][./]*(judicial|legislative|orchestrator)/.test(s), `${p}: 다른 권력을 부름`);
    assert.ok(!/AUDIT_[A-Z]/.test(s), `${p}: 감사 코드(판정)를 냄`);
    assert.ok(!/status\s*[:=]\s*['"]verified['"]/.test(s), `${p}: verified 를 선언함`);
    assert.ok(!/\b(validate|gate|patchReport|limitationStatus|gapSuggest|kineticIssues)\s*\(/.test(s), `${p}: 검사·판정 함수를 부름`);
  }
});

test('② 행정부 결과에는 판결 필드가 없다 (원자료만)', () => {
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/lps-hypothetical.json'), 'utf8'));
  const pid = Object.keys(BASE.senses).find((k) => BASE.senses[k].kind === 'pathway' && /TLR4|LPS/.test(JSON.stringify(BASE.terms[BASE.senses[k].term])));
  const r = C.simulateRate(BASE, pid, { scenario: sc, t_end: 1, dt: 0.01 });
  for (const k of ['audit', 'postMortem', 'cycles']) assert.ok(!(k in r), `simulateRate.${k}`);
  assert.ok(Array.isArray(r.facts) && r.series[1].ledger, '원자료: 사실·기록점 원장');
  const fsc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-il12-hypothetical.json'), 'utf8')); fsc.t_end = 2 * 3600;
  const f = F.simulateFate(BASE, 'D000174', { scenario: fsc, commitment: false });
  for (const k of ['audit', 'postMortem', 'arrest']) assert.ok(!(k in f), `simulateFate.${k}`);
  for (const k of ['worst', 'tolerance', 'series', 'replayWorst', 'replaySeries']) assert.ok(!(k in f.mass), `simulateFate.mass.${k}`);
  for (const k of ['hash', 'factorsAt', 'distance', 'rawDistance']) assert.ok(!(k in f.process), `simulateFate.process.${k}`);
  assert.ok(f.process.lo.length === f.series.length && f.process.cumDD.length === f.series.length, '검증용 원자료: LO·누적 진행량(double-double)');
});

test('③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다', () => {
  for (const p of CODE.filter((x) => x.startsWith('judicial/'))) {
    const s = src(p);
    assert.ok(!/require\(['"][./]*(core\.js|engine\/|orchestrator|legislative)/.test(s), `${p}: 행정·입법 모듈을 부름`);
    assert.ok(!/\b(simulate|simulateRate|simulateFate)\s*\(/.test(s), `${p}: 시뮬레이션을 실행함`);
    assert.ok(!WRITE.test(s), `${p}: 파일을 씀`);
  }
  for (const p of ['legislative/legislative.js', 'legislative/augment_draft.js']) {
    const s = src(p);
    assert.ok(!/require\(['"][./]*(judicial|core\.js|engine\/)/.test(s) && !/DefDBJudicial/.test(s), `${p}: 사법·행정을 부름`);
    assert.ok(!/\b(validate|gate|checkAttestations|verifyIdentity)\s*\(/.test(s), `${p}: 스스로 검사함`);
  }
});

test('④ 증명 등록부: 도장 없는 verified 는 오류, 변조·위조 도장은 무효', () => {
  const b = ORCH.augmentBuild(BASE, { dir: FIX, date: '2026-10-08' }), res = LEG.merge(BASE, b.patch);
  assert.ok(b.stamps.length >= 3, '판결의 verified 행마다 도장');
  assert.ok(J.validate(res.db, { attestations: [] }).errors.some((e) => /사법부 증명/.test(e.msg)), '도장 없음 → 오류');
  assert.ok(J.validate(res.db).warnings.some((e) => /증명 등록부와 대조하지 않음/.test(e.msg)), '등록부를 주지 않으면 경고 (브라우저 보기)');
  const keys = b.stamps.map((st) => ATT.verifyStamp(st, res.db, { root: ROOT }));
  assert.ok(keys.every((v) => v.ok), keys.map((v) => v.reasons).join(' / '));
  assert.equal(J.validate(res.db, { attestations: keys.map((v) => v.key) }).errors.filter((e) => /사법부 증명/.test(e.msg)).length, 0);
  // 변조: 값을 바꾸고 digest 를 그대로 → digest 불일치
  const st = JSON.parse(JSON.stringify(b.stamps.find((x) => x.subject.ns === 'UniProt')));
  const t1 = { ...st, subject: { ...st.subject, value: 'P99999' } };
  assert.match(ATT.verifyStamp(t1, res.db, { root: ROOT }).reasons.join(), /digest/);
  // 위조: 값을 바꾸고 digest 도 다시 계산 → 재확인(같은 확인 재실행)이 거부
  const t2 = { ...t1 }; t2.digest = ATT.digestOf(t2);
  assert.ok(!ATT.verifyStamp(t2, res.db, { root: ROOT }).ok, '위조 도장은 재확인에서 실패');
  // 증거 바꿔치기: sha256 을 바꾸고 digest 재계산 → 증거 파일 불일치
  const t3 = { ...st, evidence: { ...st.evidence, sha256: '0'.repeat(64) } }; t3.digest = ATT.digestOf(t3);
  assert.match(ATT.verifyStamp(t3, res.db, { root: ROOT }).reasons.join(), /sha256 불일치/);
  // 데이터가 스스로 verified 를 선언하는 패치 (판결 없이) → 관문 거부
  const self = { format: 'definition-db-patch', version: 9, why: 'test', senses: [{ id: 'D000165', xrefs: BASE.senses.D000165.xrefs.map((x) => ({ ...x, status: 'verified' })) }] };
  const g = J.gate(BASE, LEG.ingest(BASE, self), { attestations: [] });
  assert.ok(!g.ok && g.errors.some((e) => /스스로 verified/.test(e.msg)));
});

test('④ 입법 서기: 봉인 없는·변조된·다른 db 의 판결로는 쓰지 않는다 · 보호 위치에 보고서를 쓰지 않는다', async () => {
  const CLERK = await import('../legislative/clerk.mjs');
  const dbPath = join(tmpdir(), `clerk-test-${process.pid}`, 'db.json');
  const res = LEG.ingest(BASE, { format: 'definition-db-patch', version: 9, why: 't', terms: [{ id: 'T+1', names: { ko: '서기시험개념' } }], senses: [{ id: 'D+1', term: 'T+1', kind: 'concept', desc: [{ text: '시험', field: '생화학', context: { scope: '시험' } }] }] });
  const g = J.gate(BASE, res, {}), seal = ATT.sealVerdict(g, res.db);
  assert.throws(() => CLERK.commitMerge({ dbPath, db: res.db, records: [], seal: null }), /봉인/);
  assert.throws(() => CLERK.commitMerge({ dbPath, db: res.db, records: [], seal: { ...seal, ok: true, errors: 0, db_sha256: 'x' } }), /변조/);
  assert.throws(() => CLERK.commitMerge({ dbPath, db: BASE, records: [], seal }), /봉인된 db 와 쓰려는 db 가 다름/);
  const bad = ATT.sealVerdict({ ...g, ok: false }, res.db);
  assert.throws(() => CLERK.commitMerge({ dbPath, db: res.db, records: [], seal: bad }), /거부/);
  assert.throws(() => CLERK.writeReport(join(ROOT, 'data', 'x.md'), 'x'), /보호된 위치/);
  assert.throws(() => CLERK.writeDraft(join(ROOT, 'x.json'), {}), /저장소 밖/);
  assert.throws(() => CLERK.appendAttestations({ root: ROOT, stamps: [{ subject: { sense: 'D000165', field: 'xref', ns: 'UniProt', value: 'Q9UL17' }, claim: 'verified', digest: 'x', evidence: {} }], db: BASE }), /도장/);
});

test('⑤ 독립 검증: 엔진 원자료를 몰래 바꾸면 사법부 검증기·판결이 잡는다', () => {
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-il12-hypothetical.json'), 'utf8')); sc.t_end = 2 * 3600;
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false });
  const ok = FA.judgeFate(BASE, raw, { scenario: sc });
  assert.ok(ok.verification.pass && ok.mass.worst <= 1e-14 && ok.mass.replayWorst <= 1e-14);
  // 기록점 하나의 저장소를 1 분자 바꿈 (규칙 진행량 밖의 변경)
  const i = raw.keys.findIndex((b) => !raw.signals.includes(b) && raw.series[60][raw.keys.indexOf(b)] > 10);
  const series = raw.series.map((N, j) => (j === 60 ? Float64Array.from(N, (v, k) => (k === i ? v + 1 : v)) : N));
  const bad = FA.judgeFate(BASE, { ...raw, series }, { scenario: sc });
  assert.ok(!bad.verification.pass && bad.mass.replayWorst > 1e-14 && bad.audit.some((a) => a.code === 'AUDIT_MASS' && a.where === '재생'));
  // 엔진이 데이터베이스와 다른 화학량을 주장하면 화학량 대조가 잡는다
  const ruleInfo = raw.process.ruleInfo.map((R, k) => (k === 0 ? { ...R, prods: [...R.prods, [R.prods[0] ? R.prods[0][0] : raw.keys[0], 1]] } : R));
  assert.ok(FA.judgeFate(BASE, { ...raw, process: { ...raw.process, ruleInfo } }, { scenario: sc }).verification.stoichMismatch.length > 0);
});

test('⑥ 결합점 등록부: 시나리오 → 데이터(params) → 기본값, 엔진 코드를 고치지 않고 값이 바뀐다', () => {
  const d = COUPLING.resolve({}, {});
  assert.equal(d.explicit_fraction, 0.1); assert.equal(d.saturation_K, C.SAT_K); assert.deepEqual([d.gate.K_up, d.gate.K_down, d.gate.M, d.gate.W], [15, 8, 5, 20]);
  const p = COUPLING.resolve({ shock_threshold: 0.3 }, { shock_threshold: 0.25, explicit_fraction: 0.05 });
  assert.equal(p.shock_threshold, 0.3); assert.equal(p._source.shock_threshold, 'scenario');
  assert.equal(p.explicit_fraction, 0.05); assert.equal(p._source.explicit_fraction, 'data');
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-il12-hypothetical.json'), 'utf8')); sc.t_end = 1800;
  const a = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false }), b = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false, coupling: { explicit_fraction: 0.05 } });
  assert.ok(b.gate.nsub.max > a.gate.nsub.max, '데이터 쪽 값이 엔진 N_sub 를 바꿈');
  assert.equal(b.coupling._source.explicit_fraction, 'data');
  for (const e of COUPLING.REGISTRY) if (typeof e.default === 'number' && e.key !== 'saturation_K') assert.ok(!new RegExp(`\\b${e.scenario.split('.').pop()}\\b\\s*\\|\\|\\s*${e.default}\\b`).test(src('engine/fate_engine.js')), `엔진에 ${e.key} 기본값이 박혀 있음`);
});

test('⑦ 원자료 계약 (FFI): 엔진 출력은 schemas/ffi/fate-raw.schema.json 을 지키고, 어기면 사법부가 판정하지 않는다', () => {
  const K = req('../judicial/contract.js');
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-glucose-withheld-hypothetical.json'), 'utf8')); sc.t_end = 3 * 3600;
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc });
  const ok = K.checkFateRaw(raw);
  assert.ok(ok.ok, JSON.stringify(ok.violations.slice(0, 3)));
  const bad = (mut, re) => { const r = mut({ ...raw, process: { ...raw.process } }); const c = K.checkFateRaw(r); assert.ok(!c.ok && c.violations.some((v) => re.test(v.path + ' ' + v.msg)), `${re}: ${JSON.stringify(c.violations.slice(0, 2))}`); return r; };
  bad((r) => Object.assign(r, { audit: [] }), /\$\.audit.*계약에 없는 필드/); // 엔진이 판결 필드를 내면 거부
  bad((r) => Object.assign(r, { mass: { ...r.mass, worst: 0 } }), /mass\.worst/);
  bad((r) => { r.process.cumDD = r.process.cumDD.map((x, j) => (j === 3 ? x.slice(0, 4) : x)); return r; }, /cumDD\[3\] 길이/);
  bad((r) => Object.assign(r, { events: [...r.events, { t: 1, type: 'exhausted', bundle: 'D999999|cytosol' }] }), /∉ keys/);
  bad((r) => Object.assign(r, { keys: r.keys.map((k, i) => (i ? k : 'not-a-bundle')) }), /keys\[0\]/);
  // Float64Array 도 배열로 본다 (WASM 메모리 뷰를 그대로 검사)
  assert.ok(ArrayBuffer.isView(raw.series[0]) && K.checkFateRaw(raw).ok);
  const j = FA.judgeFate(BASE, Object.assign({ ...raw }, { audit: [] }), { scenario: sc });
  assert.ok(j.error && j.audit.every((a) => a.code === 'AUDIT_SCHEMA'), '계약 위반 원자료는 판정·보고서 없이 거부');
  const v = FA.judgeFate(BASE, raw, { scenario: sc });
  assert.ok(v.contract.ok && v.ix !== raw.ix, '사법부는 자기 색인을 쓴다');
});

test('⑧ 컴파일러 IR (0.5단계): 순수 · 엔진은 IR 만 먹음 · 사법부가 해시·법칙·기호 도함수를 독립 검증', () => {
  const IRB = req('../compiler/ir_builder.js'), DV = req('../judicial/derivative.js');
  for (const p of CODE.filter((x) => x.startsWith('compiler/'))) {
    const s = src(p);
    assert.ok(!WRITE.test(s), `${p}: 파일을 씀`);
    assert.ok(!/require\(['"][./]*(judicial|legislative|orchestrator|core\.js|engine\/fate)/.test(s), `${p}: 권력 모듈·엔진을 부름`);
  }
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-glucose-withheld-hypothetical.json'), 'utf8')); sc.t_end = 2 * 3600;
  const ir = IRB.buildFateIR(BASE, 'D000174', sc);
  assert.equal(IRB.buildFateIR(BASE, 'D000174', sc).hash, ir.hash, 'IR 은 결정론적');
  assert.ok(ir.jac.sizes.nF === ir.jac.fast.length && ir.jac.nnz < ir.jac.sizes.nF ** 2, '희소 패턴');
  const v = DV.verifyIR(BASE, ir, sc);
  assert.ok(v.ok && v.derivWorst <= 1e-14 && v.rateWorst <= 1e-14 && v.fdWorst <= 1e-6, JSON.stringify(v).slice(0, 300));
  // 변조: 도함수 테이프의 상수 하나를 바꾸고 해시를 다시 계산 → 해시는 맞아도 자동미분 대비 도함수가 어긋남
  const bad = JSON.parse(JSON.stringify(ir)); const t = bad.jac.dRate[bad.jac.fast[0]][0].t; t[1] = t[1] * (1 + 1e-9); bad.hash = IRB.irHash(bad);
  const vb = DV.verifyIR(BASE, bad, sc);
  assert.ok(vb.hashOK && !vb.ok && vb.derivWorst > 1e-14, '조작된 도함수는 잡힌다');
  // 해시를 다시 계산하지 않은 변조 → 해시 불일치
  const bad2 = JSON.parse(JSON.stringify(ir)); bad2.rules[0].Vr *= 2;
  assert.ok(!DV.verifyIR(BASE, bad2, sc).hashOK);
  // 엔진은 넘겨받은 IR 을 먹고 그 해시를 원자료에 적는다 · 사법부는 다른 IR 과의 불일치를 잡는다
  const raw = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false, ir });
  assert.equal(raw.irHash, ir.hash);
  const j = FA.judgeFate(BASE, raw, { scenario: sc, ir });
  assert.ok(j.irCheck.ok && j.irCheck.consumed);
  const other = IRB.buildFateIR(BASE, 'D000174', { ...sc, saturation_K: 2e-6 });
  const jx = FA.judgeFate(BASE, raw, { scenario: sc, ir: other });
  assert.ok(!jx.irCheck.ok && !jx.irCheck.consumed && jx.audit.some((a) => a.code === 'AUDIT_SCHEMA' && /IR/.test(a.msg)));
  // 해석적 야코비안: 유한차분 대비 잔차 계산이 줄고 결과(운명·도달)는 같다
  const fd = F.simulateFate(BASE, 'D000174', { scenario: { ...sc, jacobian: 'fd' }, commitment: false });
  assert.ok(raw.stats.residEvals < fd.stats.residEvals / 5 && raw.stats.jacEvals > 0 && fd.stats.jacEvals === 0);
  assert.equal(raw.final.state, fd.final.state);
});
