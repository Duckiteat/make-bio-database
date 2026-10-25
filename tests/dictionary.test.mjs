// 사전·번역기 뼈대 — build-plan 16A · 설계 docs/design/dictionary-and-translation.md
//   ① R1 왕복: 기계 키 → 사람 글(렌더) → 기계 키(회수) 가 모든 키·청중에서 동일 (결정론·무손실)
//   ② R2 통과: 자유 서술은 번역기를 지나도 바이트 동일 (생성이 아님 — lookup not infer)
//   ③ 미등록 토큰 거부: 사전에 없는 토큰은 조회·렌더·번역에서 오류 (추론으로 메우지 않음)
//   ④ 병합 형태: 통제 토큰이 ko(vocab 권위) + en(overlay) 를 한 항목으로, 사실 복제 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const D = req('../dictionary.js');

const AUDIENCES = ['both', 'en', 'ko'];

test('① R1 왕복 — 렌더 → 회수가 모든 키·청중에서 동일', () => {
  const keys = D.keys();
  assert.ok(keys.length >= 8, '통제 토큰이 최소 8(gap 타입)');
  for (const k of keys) {
    for (const audience of AUDIENCES) {
      const rendered = D.renderToken(k, { audience });
      assert.equal(typeof rendered, 'string');
      assert.ok(rendered.length > 0, `${k}/${audience} 빈 렌더`);
      assert.equal(D.parseToken(rendered), k, `${k}/${audience} 왕복 깨짐`);
    }
    // 결정론: 같은 입력 → 같은 출력
    assert.equal(D.renderToken(k, { audience: 'both' }), D.renderToken(k, { audience: 'both' }));
  }
});

test('② R2 통과 — 자유 서술은 바이트 동일로 통과(생성 아님)', () => {
  const narrative = 'telomerase 차단 → 텔로미어 반복 길이 감소 (Bodnar 1998, PMID 9454332).\n인용 그대로: "limited replicative capacity".';
  // 토큰 없이: 출력 = 서술 그 자체
  assert.equal(D.translate({ tokens: [], narrative }), narrative);
  // 토큰과 함께: 서술이 바이트 그대로 포함 (변형·요약 없음)
  const out = D.translate({ tokens: ['Structural_Gap'], narrative });
  assert.ok(out.includes(narrative), '서술이 원문 그대로 들어있지 않음 — 번역기가 생성했을 가능성');
  assert.ok(out.endsWith(narrative), '서술이 끝에 원문 통과로 붙어야 함');
});

test('③ 미등록 토큰 거부 — 조회·렌더·번역 모두 오류(추론으로 메우지 않음)', () => {
  const e = D.entry('Nonexistent_Gap');
  assert.ok(e.error, '미등록 토큰이 오류를 내지 않음');
  assert.throws(() => D.renderToken('Nonexistent_Gap'), /미등록/, '렌더가 거부하지 않음');
  assert.throws(() => D.translate({ tokens: ['Nonexistent_Gap'] }), /미등록/, '번역이 거부하지 않음');
  assert.throws(() => D.parseToken('존재하지 않는 렌더 문자열'), /사전에 없는/, 'parse 가 거부하지 않음');
  assert.throws(() => D.renderToken('Kinetic_Gap', { audience: 'de' }), /audience/, 'audience 어휘 밖 거부');
});

test('④ 병합 형태 — ko(vocab 권위) + en(overlay) 한 항목, 사실 복제 없음', () => {
  const e = D.entry('Kinetic_Gap');
  assert.ok(!e.error);
  // ko 는 vocab, en 은 overlay — 둘 다 있고 서로 다른 소스
  assert.equal(typeof e.label_ko, 'string');
  assert.equal(typeof e.label_en, 'string');
  assert.equal(typeof e.meaning_ko, 'string');
  assert.equal(typeof e.meaning_en, 'string');
  assert.ok('xref' in e, 'xref 칸 존재(검증 앵커, 고유 개념은 null)');
  assert.equal(e.xref, null, '우리가 제정한 개념이라 외부 xref 없음(null)');
  assert.equal(e.register, 'gapTypes');
  // ko 가 vocab 권위와 같은지 (복제가 아니라 참조)
  const V = req('../vocab.js');
  assert.equal(e.label_ko, V.gapTypes.Kinetic_Gap.label, 'ko 라벨은 vocab 권위를 가리켜야 함');
  assert.equal(e.meaning_ko, V.gapTypes.Kinetic_Gap.note, 'ko 의미는 vocab 권위를 가리켜야 함');
});

test('⑤ register 확장 — gapTypes·observables·qualitativeExpectations 일반화(모든 키 overlay·왕복)', () => {
  const V = req('../vocab.js');
  const regs = D.registers;
  for (const r of ['gapTypes', 'observables', 'qualitativeExpectations', 'conservationClasses', 'conservationReasons', 'closureMethods', 'judgmentLevels', 'faultChannels', 'qualOutcomes', 'trendVerdicts', 'reliabilityGrades']) assert.ok(regs.includes(r), `register ${r} 누락`);
  for (const r of regs) assert.ok(D.registers.includes(r), `register ${r} 누락`);
  // 모든 register 의 모든 키가 사전에 등록(overlay 있음) 돼 있어야 — 조각화가 통제 토큰 전체로 퍼짐
  const want = regs.flatMap((r) => Object.keys(V[r]).map((k) => `${r}/${k}`));
  assert.equal(D.keys().length, want.length, `키 수 불일치 — overlay 누락 의심`);
  for (const k of want) assert.ok(!D.entry(k).error, `${k} overlay 미등록`);
  // 다른 register 의 토큰도 왕복 (①이 전수하지만 확장을 못박아 둔다)
  assert.equal(D.parseToken(D.renderToken('event_time', { audience: 'both' })), 'observables/event_time');
  assert.equal(D.parseToken(D.renderToken('monotone_increase', { audience: 'en' })), 'qualitativeExpectations/monotone_increase');
});

test('⑥ 이름공간 — 같은 키가 두 register 에 있으면 맨 키는 모호(오류), register/key 로만 (고르지 않는다)', () => {
  assert.match(D.entry('match').error || '', /모호한 통제 토큰/, '맨 키 match 가 하나를 골랐다');
  assert.equal(D.entry('qualOutcomes/match').label_ko, '맞음');
  assert.equal(D.entry('trendVerdicts/match').label_ko, '합의와 같음');
  assert.equal(D.entry('match', { register: 'trendVerdicts' }).id, 'trendVerdicts/match');
  assert.throws(() => D.renderToken('mismatch'), /모호/);
  assert.ok(D.entry('nope/match').error, '없는 register');
  assert.deepEqual(D.ambiguousRenders(), [], '두 토큰이 같은 렌더 문자열을 쓰면 회수가 깨진다 — 라벨을 가른다');
});

test('⑦ 판결 모듈의 라벨 = vocab 표 (코드에 문구 복사본 없음)', () => {
  const V = req('../vocab.js'), REL = req('../judicial/reliability.js'), M = req('../model.js');
  for (const [k, g] of Object.entries(REL.GRADES)) { assert.equal(g.label, V.reliabilityGrades[k].label); assert.equal(g.use, V.reliabilityGrades[k].note); assert.ok(g.rule, `${k}: 규칙 설명은 로직 곁에`); }
  assert.equal(REL.S_LABEL[3], V.sourceScale[3].label);
  assert.equal(M.ROLE.agent, V.bundleRoles.agent.label);
  assert.equal(M.AXIS_UP.part, V.hierarchyUp.part.label);
});

test('⑧ core.js 번역 함수 + 주입 라벨러 — ko 는 기본과 바이트 동일, en 은 지어내지 않음, 행정부는 사전을 부르지 않음', () => {
  const C = req('../core.js'), fs = req('fs'), path = req('path');
  const db = JSON.parse(fs.readFileSync(path.join(path.dirname(req.resolve('../core.js')), 'data/db.json'), 'utf8'));
  const ko = { label: D.labeler({ audience: 'ko' }) }, en = { label: D.labeler({ audience: 'en' }) };
  for (const id of ['D000189', 'D000210', 'D000148']) {
    assert.equal(C.contextText(db, id, ko), C.contextText(db, id), `${id}: ko 라벨러가 기본 출력과 다름`);
    assert.equal(C.mapText(db, id, ko), C.mapText(db, id));
  }
  const out = C.contextText(db, 'D000189', en);
  assert.match(out, /Catalyst \/ actor/, '등록된 토큰(bundleRoles/agent)은 영어로');
  assert.match(out, /\[en 미등록\]/, 'overlay 없는 토큰은 표시만 — 영어를 지어내지 않음');
  assert.throws(() => D.labeler({ audience: 'de' }), /audience/);
  const src = fs.readFileSync(req.resolve('../core.js'), 'utf8');
  assert.ok(!/require\(['"][./]*dictionary/.test(src) && !/require\(['"]fs['"]\)/.test(src), 'core.js 가 사전·파일 읽기를 부름 — 주입받기만 한다');
});
