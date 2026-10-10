// 삼권 분립 시험 (Tripartite Governance & Isolation) — docs/design/tripartite-governance.md
//   ① 쓰기 권한: 파일을 쓰는 코드는 입법 서기(legislative/clerk.mjs)와 형식 변환(migrations/)에만
//   ② 행정부(core.js·engine/)는 사법·입법·조정자를 부르지 않고, 감사 코드·'verified' 선언·판결 필드가 없다
//   ③ 사법부(judicial/)는 엔진을 실행하지 않고 쓰지 않는다 · 입법부 초안(legislative/*.js)은 검사하지 않는다
//   ④ 증명 등록부: 도장 없는 'verified' 거부, 변조·위조 도장 거부 · 서기는 봉인 없는 쓰기를 거부
//   ②′ 행정부는 관찰을 모른다 (4단계) · ⑤ 독립 검증: 원자료를 몰래 바꾸면 사법부 검증기가 잡는다 · ⑥ 결합점 등록부: 엔진을 고치지 않고 값을 데이터 쪽으로
// 실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const C = req('../core.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), ORCH = req('../orchestrator.js');
const ATT = req('../judicial/attestation.js'), FA = req('../judicial/fate_audit.js'), F = req('../engine/fate_engine.js'), COUPLING = req('../engine/coupling.js');
const BASE = C.normalize(JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8')));
const FIX = join(ROOT, 'tests/fixtures/augment');
// 자동 보강 시험의 출발 상태: 확인 전으로 되돌린 사본 (원본 대조가 끝난 저장소에는 올릴 것이 남아 있지 않다 — rules.test.mjs 의 PRE 와 같은 규칙)
const PRE = (() => {
  const db = JSON.parse(JSON.stringify(BASE));
  for (const d of Object.values(db.senses)) {
    for (const x of d.xrefs || []) if (x.status === 'verified') { x.status = 'asserted'; delete x.note; }
    if (d.fingerprint && ['computed', 'verified'].includes(d.fingerprint.status)) delete d.fingerprint; // 지문도 사법부 도장이 있어야 verified
    if (d.obs) d.obs = d.obs.filter((o) => !(o.property === 'sequence_length' && o.evidence && o.evidence.level === 'computed'));
    // ChEBI 역할(규약) 전 상태: 항목 하나만, 역할 표시 없음 — 합성 시험 자료는 규약 전에 만든 것
    const ch = (d.xrefs || []).filter((x) => x.db === 'ChEBI');
    if (ch.length) { const one = ch.find((x) => x.role === 'parent') || ch[0]; delete one.role; d.xrefs = (d.xrefs || []).filter((x) => x.db !== 'ChEBI' || x === one); }
  }
  return C.normalize(db);
})();

// 저장소의 코드 파일 (테스트·node_modules·.git 제외)
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'tests', 'target'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p)]; });
const CODE = walk(ROOT).filter((p) => /\.(js|mjs|html)$/.test(p));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); // 주석 제거 (문자열 속 // 는 대부분 URL 이라 보존)
const src = (p) => strip(readFileSync(join(ROOT, p), 'utf8'));
const WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|renameSync|unlinkSync|rmSync|mkdirSync|createWriteStream|copyFileSync)\b/;

test('① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만', () => {
  const writers = CODE.filter((p) => WRITE.test(src(p)));
  assert.deepEqual(writers.filter((p) => p !== 'legislative/clerk.mjs' && !p.startsWith('migrations/')), [], '서기 밖의 쓰기');
  assert.ok(writers.includes('legislative/clerk.mjs'));
  assert.ok(!/execFileSync|child_process/.test(src('dbtool.mjs')), 'dbtool 은 받기(curl)도 서기에게');
  // Rust 행정부: 파일 쓰기 없음 (fate_cli 는 표준 출력만)
  const rs = readdirSync(join(ROOT, 'engine/rust/src'), { recursive: true }).filter((f) => f.endsWith('.rs'));
  for (const f of rs) assert.ok(!/std::fs|File::create|OpenOptions|fs::write/.test(readFileSync(join(ROOT, 'engine/rust/src', f), 'utf8')), `engine/rust/src/${f}: 파일 쓰기`);
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

test('② 행정부는 관찰을 모른다: 관찰 기록·관찰 연산자·관찰 판정을 읽지 않음 (4단계 — 관찰에 맞추느라 결함을 덮는 순환 방지)', () => {
  const exec = ['core.js', ...CODE.filter((p) => p.startsWith('engine/'))];
  for (const p of exec) {
    const s = src(p);
    assert.ok(!/\bobservations\b/.test(s), `${p}: 관찰 기록을 읽음`);
    assert.ok(!/obs_operator|obs_compare|judicial\/stats/.test(s), `${p}: 관찰 연산자·판정을 부름`);
  }
  const rs = readdirSync(join(ROOT, 'engine/rust/src'), { recursive: true }).filter((f) => f.endsWith('.rs'));
  for (const f of rs) assert.ok(!/observation/.test(readFileSync(join(ROOT, 'engine/rust/src', f), 'utf8')), `engine/rust/src/${f}: 관찰을 읽음`);
  // 사법부 통계·관찰 판정도 엔진을 부르지 않는다 (예측 표본은 조정자가 넘김)
  for (const p of ['judicial/stats.js', 'judicial/obs_compare.js', 'compiler/obs_operator.js']) assert.ok(!/require\(['"][./]*(engine|core|orchestrator|legislative)/.test(src(p)), `${p}: 엔진·입법·조정자를 부름`);
});

test('② 행정부 결과에는 판결 필드가 없다 (원자료만)', () => {
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/lps-hypothetical.json'), 'utf8'));
  const pid = Object.keys(BASE.senses).find((k) => BASE.senses[k].kind === 'pathway' && /TLR4|LPS/.test(JSON.stringify(BASE.terms[BASE.senses[k].term])));
  const r = C.simulateRate(BASE, pid, { scenario: sc, t_end: 1, dt: 0.01 });
  assert.match(r.irHash, /^[0-9a-f]{64}$/, '경로 시뮬레이션도 IR(compiler/rate_ir.js) 위에서 돈다');
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
  const b = ORCH.augmentBuild(PRE, { dir: FIX, date: '2026-10-08' }), res = LEG.merge(PRE, b.patch);
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
  const self = { format: 'definition-db-patch', version: 9, why: 'test', senses: [{ id: 'D000165', xrefs: PRE.senses.D000165.xrefs.map((x) => ({ ...x, status: 'verified' })) }] };
  const g = J.gate(PRE, LEG.ingest(PRE, self), { attestations: [] });
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

test('④′ 구역(Zone): 쓰기는 모두 구역을 지나고, 저장소 안의 다른 구역에 쓰려 하면 거부된다', async () => {
  const CLERK = await import('../legislative/clerk.mjs');
  // 서기 안에서 파일에 쓰는 함수는 하나(put)뿐이고, 그 하나가 구역을 받는다 — 구역 없이 쓸 길이 없다
  const clerk = src('legislative/clerk.mjs');
  assert.equal((clerk.match(/writeFileSync\(/g) || []).length, 1, 'writeFileSync 는 put 안에 하나만');
  const zones = Object.keys(CLERK.ZONES);
  for (const m of clerk.matchAll(/\bput\(([^,]+),/g)) {
    const z = m[1].trim().replace(/^'|'$/g, '');
    assert.ok(zones.includes(z), `put 의 첫 인자가 구역이 아님: ${m[1]}`);
  }
  // curl 로 직접 받는 길(put 을 지나지 않음)도 같은 구역 검사를 받는다
  assert.match(clerk, /zoned\('evidence', t\.file \+ ext\)/, '받기도 증거 구역 검사를 지나야 한다');

  // 봉인이 **유효한데도** 저장소 안의 다른 구역이면 거부 — 경로가 실제 경계로 작동하는지
  const res = LEG.ingest(BASE, { format: 'definition-db-patch', version: 9, why: 't', terms: [{ id: 'T+1', names: { ko: '구역시험개념' } }], senses: [{ id: 'D+1', term: 'T+1', kind: 'concept', desc: [{ text: '시험', field: '생화학', context: { scope: '시험' } }] }] });
  const seal = ATT.sealVerdict(J.gate(BASE, res, {}), res.db);
  for (const bad of ['judicial/db.json', 'engine/db.json', 'attestations/db.json'])
    assert.throws(() => CLERK.commitMerge({ dbPath: join(ROOT, bad), db: res.db, records: [], seal }), /입법 구역 .* 아닌 자리/, bad);
  // 증거 구역: 수동 과제·받기는 수신함(과 시험 자료) 안에만
  assert.throws(() => CLERK.writeRetrievalTasks(join(ROOT, 'engine'), 'x'), /증거 구역 .* 아닌 자리/);
  assert.throws(() => CLERK.fetchToInbox([{ file: join(ROOT, 'compiler/evil'), urls: ['https://example.invalid/x.json'] }]), /증거 구역 .* 아닌 자리/);
  // 파생·보고서·초안 구역
  assert.throws(() => CLERK.writeDerived('없는것', 'x'), /알 수 없는 파생 문서/);
  assert.throws(() => CLERK.writeReport(join(ROOT, 'docs', 'x.json'), 'x'), /보호된 위치/);
  assert.throws(() => CLERK.writeDraft(join(ROOT, 'x.json'), {}), /저장소 밖/);
  // 저장소 **밖**(tmp 사본·다른 저장소)은 구역 표가 다루지 않는다 — 막는 대상이 '저장소 안의 다른 구역' 이기 때문
  const out = join(tmpdir(), `clerk-zone-${process.pid}`, 'draft.json');
  assert.equal(CLERK.writeDraft(out, { ok: 1 }), out);
  rmSync(dirname(out), { recursive: true, force: true });
  // 구역마다 규칙 문구가 있다 (문서가 코드에서 나오게)
  for (const [k, z] of Object.entries(CLERK.ZONES)) assert.ok(z.label && z.rule, k);
});

test('④″ CI 설정이 실제로 파싱되는가 — 검사가 조용히 죽지 않게', () => {
  // ccabd83 이후 워크플로의 name 값에 ': ' 가 들어가 YAML 이 깨져 CI 가 아예 돌지 않았다 (2026-10-10 발견).
  // YAML 모듈 없이, 그 실패 방식만 겨눈 검사: 평문 스칼라에는 ': ' 를 둘 수 없다.
  const yml = readFileSync(join(ROOT, '.github/workflows/check.yml'), 'utf8'), lines = yml.split('\n');
  const bad = [];
  lines.forEach((ln, i) => {
    const m = /^\s*(?:- )?(name|run|if):\s(.*)$/.exec(ln);
    if (!m) return;
    const v = m[2].trim();
    if (!v || v.startsWith("'") || v.startsWith('"') || v.startsWith('|') || v.startsWith('>')) return;
    if (/:\s/.test(v) || /:$/.test(v)) bad.push(`${i + 1}: ${ln.trim().slice(0, 80)}`);
  });
  assert.deepEqual(bad, [], `평문 스칼라에 ': ' 가 있어 YAML 이 깨진다 — 따옴표로 감쌀 것:\n${bad.join('\n')}`);
  // 검사가 실제로 저장소의 관문을 돌리는지 (이 목록이 줄면 CI 가 느슨해진 것)
  for (const cmd of ['node --test tests/*.test.mjs', 'dbtool.mjs validate', 'dbtool.mjs attest', 'dbtool.mjs limitations --detect', 'dbtool.mjs trend', 'dbtool.mjs textbook --check'])
    assert.ok(yml.includes(cmd), `CI 에 '${cmd}' 가 없음`);
  assert.match(yml, /cmp .*index\.html .*viewer\.html|cmp .*viewer\.html .*index\.html/, 'CI 가 화면 사본을 대조하지 않음');
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
  assert.equal(d.rtol, 1e-6); assert.equal(d.saturation_K, C.SAT_K); assert.deepEqual([d.atol, d.h0, d.safety, d.fac_min, d.fac_max], [1e-2, 1, 0.9, 0.2, 5]);
  const p = COUPLING.resolve({ integrator: { rtol: 1e-8 } }, { rtol: 1e-7, atol: 0.1 });
  assert.equal(p.rtol, 1e-8); assert.equal(p._source.rtol, 'scenario');
  assert.equal(p.atol, 0.1); assert.equal(p._source.atol, 'data');
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-il12-hypothetical.json'), 'utf8')); sc.t_end = 1800;
  const a = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false }), b = F.simulateFate(BASE, 'D000174', { scenario: sc, commitment: false, coupling: { rtol: 1e-9 } });
  assert.ok(b.integrator.steps > a.integrator.steps && b.integrator.rtol === 1e-9, '데이터 쪽 값이 엔진 단계 제어를 바꿈');
  assert.equal(b.coupling._source.rtol, 'data');
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
  assert.ok(ir.jac.sizes.nA === ir.jac.active.length && ir.jac.nnz < ir.jac.sizes.nA ** 2, '희소 패턴');
  const v = DV.verifyIR(BASE, ir, sc);
  assert.ok(v.ok && v.derivWorst <= 1e-14 && v.rateWorst <= 1e-14 && v.fdWorst <= 1e-6, JSON.stringify(v).slice(0, 300));
  // 변조: 도함수 테이프의 상수 하나를 바꾸고 해시를 다시 계산 → 해시는 맞아도 자동미분 대비 도함수가 어긋남
  const bad = JSON.parse(JSON.stringify(ir)); const t = bad.jac.dRate[bad.jac.active.find((j) => bad.jac.dRate[j].length)][0].t; t[1] = t[1] * (1 + 1e-9); bad.hash = IRB.irHash(bad);
  const vb = DV.verifyIR(BASE, bad, sc);
  assert.ok(vb.hashOK && !vb.ok && vb.derivWorst > 1e-14, '조작된 도함수는 잡힌다');
  // 희소 LU (3단계): 패턴 검사 통과 · 값 위치를 하나 바꾸면 해시를 다시 맞춰도 사법부가 잡는다 · 밀집보다 연산이 적다
  assert.ok(v.lu.problems.length === 0 && v.lu.checked > 0 && ir.jac.lu.flops < ir.jac.lu.denseFlops, JSON.stringify(v.lu));
  const badLU = JSON.parse(JSON.stringify(ir)); const sl = badLU.jac.scatter.rate.find((x) => x.length && x[0].length)[0]; sl[0] = (sl[0] + 1) % badLU.jac.lu.nnz; badLU.hash = IRB.irHash(badLU);
  const vl = DV.verifyIR(BASE, badLU, sc);
  assert.ok(vl.hashOK && !vl.ok && vl.lu.problems.some((m) => /값 위치/.test(m)), JSON.stringify(vl.lu));
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
  // 결합 Rodas3 (1.5단계): 시도 단계마다 해석적 야코비안 한 번 + 속도 평가 세 번 (유한차분·뉴턴·명시 대체 경로는 판정 뒤 제거 — 군더더기 금지)
  const tries = raw.stats.steps + raw.stats.rejected;
  assert.ok(raw.stats.jac === tries && raw.stats.rhs === 3 * tries && raw.stats.singular === 0, JSON.stringify(raw.stats));
  for (const f of ['engine/fate_engine.js', 'engine/rust/src/engine.rs']) assert.ok(!/jacobian\s*===\s*'fd'|xi\[c\] \+= d|newton|explicit_fast|explicitFast|p5_dynamic_gate/i.test(src(f)), `${f}: 옛 분할 적분(뉴턴·명시 대체·관문) 경로가 남아 있음`);
});

test('⑨ 결함 출처 태그: 모든 감사 항목이 6 분류 중 하나 — 결과는 FINDING, 엔진·컴파일러·수치·데이터 결함은 각자의 층으로', () => {
  const FT = req('../judicial/fault.js'), IRB = req('../compiler/ir_builder.js');
  // 경로 감사 (모든 경로) — 태그 없는 항목 0
  const paths = Object.keys(BASE.senses).filter((k) => BASE.senses[k].kind === 'pathway');
  const all = paths.flatMap((p) => ORCH.auditRun(BASE, p, { t_end: 0.5, dt: 0.01 }));
  assert.ok(all.length > 0 && FT.untagged(all).length === 0, JSON.stringify(FT.untagged(all).slice(0, 2)));
  // 큰 Δt → 적분 안정성 감사는 NUMERICAL (생물 상수를 고치라고 하지 않음)
  const tca = paths.find((p) => /시트르산 회로/.test(BASE.terms[BASE.senses[p].term].names.ko));
  const stiff = ORCH.runRate(BASE, tca, { scenario: JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/tca-co2-equilibrium-hypothetical.json'), 'utf8')), t_end: 300, dt: 0.1 });
  assert.ok(stiff.audit.some((a) => a.fault === 'NUMERICAL' && /Δt/.test(a.msg)), '큰 Δt → NUMERICAL');
  assert.ok(stiff.audit.filter((a) => /사후 분석/.test(a.msg)).every((a) => a.fault === 'FINDING'), '사후 분석(정지 원인)은 결과');
  // 운명: 분화 정지는 FINDING · 부피 공백은 DATA_GAP · 원자료 변조는 ENGINE_DEFECT · IR 변조는 COMPILER_DEFECT
  const sc = JSON.parse(readFileSync(join(ROOT, 'examples/scenarios/fate-effector-glucose-withheld-hypothetical.json'), 'utf8'));
  const v = ORCH.runFate(BASE, 'D000174', { scenario: { ...sc, commitment: { horizon: 3600, coarse: 3600 } } });
  assert.ok(v.audit.length && FT.untagged(v.audit).length === 0);
  assert.ok(v.audit.some((a) => a.code === 'AUDIT_FATE' && a.fault === 'FINDING'), '고갈로 인한 정지는 결과');
  const noVol = { ...sc, t_end: 3600, volumes: { ...sc.volumes } }; delete noVol.volumes.nucleoplasm;
  assert.ok(ORCH.runFate(BASE, 'D000174', { scenario: noVol, commitment: false }).audit.some((a) => a.code === 'AUDIT_CONCENTRATION' && a.fault === 'DATA_GAP'));
  const s2 = { ...sc, t_end: 2 * 3600 }, ir = IRB.buildFateIR(BASE, 'D000174', s2), raw = F.simulateFate(BASE, 'D000174', { scenario: s2, commitment: false, ir });
  const series = raw.series.map((N, j) => (j === 30 ? Float64Array.from(N, (x, k) => (k === 3 ? x + 5 : x)) : N));
  assert.ok(FA.judgeFate(BASE, { ...raw, series }, { scenario: s2, ir }).audit.some((a) => a.code === 'AUDIT_MASS' && a.fault === 'ENGINE_DEFECT'));
  const badIR = JSON.parse(JSON.stringify(ir)); badIR.jac.rate[0][1] *= 1.001; badIR.hash = IRB.irHash(badIR);
  assert.ok(FA.judgeFate(BASE, raw, { scenario: s2, ir: badIR }).audit.some((a) => a.fault === 'COMPILER_DEFECT' || (a.fault === 'ENGINE_DEFECT' && /IR/.test(a.msg))));
  for (const f of Object.keys(FT.FAULTS)) assert.ok(FT.FAULTS[f].route && FT.FAULTS[f].label);
  assert.match(FT.FAULTS.NUMERICAL.route, /생물 상수\(db\.json\)를 바꾸지 않는다/);
});
