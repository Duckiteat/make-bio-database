// 형식 v12 2차 — docs/design/format-v12.md §4–6
//   ① 정성 관찰: 교란 → 읽을 거리 → 기대, 1차 문헌(DOI·PMID) + 원문 구절 필수, 용도 validation, 수치 근거로 못 씀
//   ② 관찰 입력 계약(schemas/obs): kind 로 정량·정성 모양을 고른다
//   ③ 맥락 열쇠: 여섯 칸만(빈 칸 null, 조건 정렬) · 조건은 정의항 번호 목록(문장 거부)
//   ④ 새 관찰의 기록 시각 · 실험 묶음 · 근거 시각 형식
//   ⑤ 번호 이동: 병합이 옛 번호를 지우고 기록 · 조회는 따라감 · 이동된 번호를 가리키는 패치·정의는 거부
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), K = req('../judicial/contract.js');
const BASE = M.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const AT = '2026-10-15T00:00:00.000Z';
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 12, why: '정성 관찰 시험', recorded_at: AT }, o);
// 대상은 데이터에서 고른다 (이름을 박지 않음): 첫 단계의 규칙·참여 묶음·산물 묶음
const ST = Object.values(BASE.steps).find((s) => s.inputs.length && s.outputs.length);
const RULE = ST.rule, KO = ST.inputs[0].b.split('|')[0], READ = ST.outputs[0].b;
const Q = (o) => Object.assign({
  id: 'O+q', kind: 'qualitative', perturbation: { type: 'knockout', target: KO },
  readout: { kind: 'amount', target: READ }, expect: 'decrease',
  condition: { species: '9606' }, quote: 'Knockout abolished formation of the product.',
  provenance: { source: { db: 'DOI', id: '10.1000/test.1' } }, use: 'validation', experiment: '시험 실험 1', evidence_at: '2019',
  evidence: { level: 'curated', sources: [{ db: 'DOI', id: '10.1000/test.1', citation: '시험' }] },
}, o);
const gate = (patch) => { const res = LEG.merge(BASE, patch); return { res, g: J.gate(BASE, res) }; };
const errs = (g) => g.errors.map((e) => `${e.where}: ${e.msg}`).join('\n');

test('① 정성 관찰: 맞는 모양은 관문 통과 · 기록 시각이 찍힘', () => {
  const { res, g } = gate(P({ observations: [Q()] }));
  assert.ok(g.ok, errs(g));
  const id = res.report.idmap['O+q'], o = res.db.observations[id];
  assert.equal(o.kind, 'qualitative'); assert.equal(o.recorded_at, AT); assert.equal(o.experiment, '시험 실험 1'); assert.equal(o.evidence_at, '2019');
  assert.deepEqual(o.provenance.source, { db: 'DOI', id: '10.1000/test.1' });
  assert.ok(!('value' in o) && !('uncertainty' in o), '정성 관찰은 값·불확도가 없음');
  // 순서 기대: 대상 둘 이상, readout.target 없음
  const ord = gate(P({ observations: [Q({ perturbation: undefined, readout: { kind: 'amount' }, expect: { order: [ST.inputs[0].b, READ] } })] }));
  assert.ok(ord.g.ok, errs(ord.g));
});

test('① 정성 관찰: 구절·1차 문헌·교란·읽을 거리·용도 위반은 거부', () => {
  const bad = [
    [{ quote: '' }, '원문 구절(quote)이 없음'],
    [{ provenance: { source: { db: 'textbook', id: 'Alberts 6e' } } }, '교과서·추론은 정성 관찰이 될 수 없음'],
    [{ provenance: { source: { db: 'DOI', id: 'not-a-doi' } } }, "식별자 'not-a-doi' 형식 틀림"],
    [{ perturbation: undefined }, '교란(perturbation)이 필요함'],
    [{ readout: { kind: 'volume', target: 'cytosol' } }, '부피·속도 상수는 정성으로 말하지 않음'],
    [{ expect: 'goes_up' }, "기대(expect) 'goes_up'"],
    [{ expect: { order: [READ, READ] }, readout: { kind: 'amount' } }, '서로 다른 대상 둘 이상'],
    [{ use: 'estimation' }, '정성 관찰의 용도는 validation'],
    [{ perturbation: { type: 'inhibit', target: RULE } }, 'inhibit 에는 Ki_M > 0'],
    [{ perturbation: { type: 'block', target: 'D000001/rule/없는규칙' } }, '없음 — D…/rule/키'],
    [{ evidence: { level: 'abstracted', basis: '추론' } }, '정성 관찰 근거는 curated'],
    [{ evidence_at: '2019년' }, "근거 시각(evidence_at) '2019년'"],
  ];
  for (const [o, why] of bad) {
    const { g } = gate(P({ observations: [Q(o)] }));
    assert.ok(!g.ok && g.errors.some((e) => e.msg.includes(why)), `거부되어야 함 (${why}):\n${errs(g)}`);
  }
});

test('① 정성 관찰은 수치(속도 상수·정의항 obs)의 근거가 될 수 없다', () => {
  const law = Object.entries(BASE.senses).flatMap(([sid, d]) => d.rule.filter((r) => r.kinetics && r.kinetics.from).map((r) => [sid, r]))[0];
  const [sid, r] = law, k = JSON.parse(JSON.stringify(r.kinetics));
  k.from = k.from.map((f, i) => (i ? f : { ...f, obs: 'O+q' }));
  const rule = BASE.senses[sid].rule.map((x) => { const y = JSON.parse(JSON.stringify(x)); delete y.kinetic_law; if (x.kinetics) y.kinetics = x.id === r.id ? k : JSON.parse(JSON.stringify(x.kinetics)); return y; });
  const { g } = gate(P({ observations: [Q()], senses: [{ id: sid, rule }] }));
  assert.ok(g.errors.some((e) => e.msg.includes('정성 관찰은 수치의 근거가 될 수 없음')), errs(g));
});

test('② 관찰 입력 계약: kind 로 모양을 고른다', () => {
  const q = Q(); delete q.id;
  assert.ok(K.checkObservation(q).ok, JSON.stringify(K.checkObservation(q).violations));
  const { quote, ...noQuote } = q, v = K.checkObservation({ ...noQuote, value: 3 });
  assert.ok(!v.ok && v.violations.some((x) => /'quote'/.test(x.msg)) && v.violations.some((x) => x.path === '$.value'), JSON.stringify(v.violations));
  assert.ok(!K.checkObservation({ ...q, use: 'estimation' }).ok, '정성 관찰은 validation 만');
  const ex = JSON.parse(readFileSync(new URL('../examples/observations/eomes-amount-hypothetical.json', import.meta.url), 'utf8'));
  assert.ok(K.checkObservation(ex).ok, '정량 예제는 그대로 통과');
});

test('③ 맥락 열쇠: 여섯 칸 · 빈 칸 null · 조건 정렬 · 자유 문장은 열쇠 밖', () => {
  const a = M.contextKey({ species: '9606', location: 'cytosol', condition: ['D000002', 'D000001'], scope: '설명 A' });
  const b = M.contextKey({ location: 'cytosol', species: '9606', condition: ['D000001', 'D000002'], scope: '설명 B', cell: null });
  assert.equal(a, b, '같은 맥락은 같은 열쇠 (순서·설명 무관)');
  assert.deepEqual(Object.keys(JSON.parse(a)), ['cell', 'condition', 'location', 'pH', 'species', 'temperature_K']);
  assert.notEqual(a, M.contextKey({ species: '9606', location: 'cytosol', condition: ['D000001', 'D000002'], pH: 7.4 }));
  // 조건은 정의항 번호 목록: 문장은 거부, 번호는 통과(있는 번호만)
  const sid = Object.keys(BASE.senses).find((s) => BASE.senses[s].obs.some((o) => o.property === 'sequence_length' && !o.from));
  const withCond = (c) => P({ senses: [{ id: sid, obs: BASE.senses[sid].obs.map((o) => (o.property === 'sequence_length' ? { ...o, context: { ...o.context, condition: c } } : o)) }] });
  let { g } = gate(withCond('LPS 100 ng/mL 자극'));
  assert.ok(g.errors.some((e) => e.msg.includes('조건(condition)은 정의항 번호 목록')), errs(g));
  ({ g } = gate(withCond(['D999999'])));
  assert.ok(g.errors.some((e) => e.msg.includes("조건 'D999999' 은(는) 있는 정의항 번호가 아님")), errs(g));
  ({ g } = gate(withCond([KO])));
  assert.ok(g.ok, errs(g));
});

test('③ 같은 열쇠의 현재 값이 둘이면 거부 (새 값은 supersedes 로)', () => {
  const sid = Object.keys(BASE.senses).find((s) => BASE.senses[s].obs.some((o) => o.property === 'sequence_length' && !o.from));
  const seq = BASE.senses[sid].obs.find((o) => o.property === 'sequence_length');
  const { g } = gate(P({ senses: [{ id: sid, obs: [...BASE.senses[sid].obs, { ...seq, value: seq.value + 1, note: '두 번째' }] }] }));
  assert.ok(g.errors.some((e) => e.msg.includes('같은 열쇠(대상·속성·맥락)의 현재 값이 둘')), errs(g));
});

test('④ 새 관찰은 기록 시각을 가진다', () => {
  const p = P({ observations: [Q()] }); delete p.recorded_at;
  const { g } = gate(p);
  assert.ok(g.errors.some((e) => e.msg.includes('새 관찰에 기록 시각(recorded_at)이 없음')), errs(g));
});

test('⑤ 번호 이동: 병합이 옛 번호를 지우고 기록 · 조회는 따라감 · 이동된 번호를 가리키면 거부', () => {
  // 아무도 가리키지 않는 같은 종류의 정의항 둘 (데이터에서 고름)
  const text = (id) => JSON.stringify([BASE.terms, BASE.steps, BASE.limitations, ...Object.entries(BASE.senses).filter(([k]) => k !== id).map(([, v]) => v)]);
  const free = Object.keys(BASE.senses).filter((id) => !text(id).includes(id)), byKind = {};
  for (const id of free) (byKind[BASE.senses[id].kind] = byKind[BASE.senses[id].kind] || []).push(id);
  const [from, to] = Object.values(byKind).find((l) => l.length >= 2);
  const { res, g } = gate(P({ moved: { [from]: { to: [to], kind: 'merge', why: '같은 실체 — 시험' } } }));
  assert.ok(g.ok, errs(g));
  assert.ok(!res.db.senses[from], '옛 번호는 표에서 빠짐');
  assert.deepEqual(res.db.moved[from], { to: [to], kind: 'merge', at: AT, why: '같은 실체 — 시험' });
  assert.equal(M.resolveRef(M.index(res.db), from).id, to, '조회는 이동을 따라감');
  assert.deepEqual(M.followMoved(res.db, from), [to]);
  // 정규화 멱등 · 이동이 없으면 moved 키도 없음 (기존 db 직렬화 불변)
  assert.equal(JSON.stringify(M.normalize(JSON.parse(JSON.stringify(res.db)))), JSON.stringify(res.db));
  assert.ok(!('moved' in BASE));
  // 이동된 번호를 가리키는 새 패치: 병합 단계에서 대상을 알려 주며 거부
  const after = res.db, r2 = LEG.merge(after, P({ senses: [{ id: to, desc: after.senses[to].desc.map((d, i) => (i ? d : { ...d, links: [...d.links, { to: from, rel: 'related' }] })) }] }));
  assert.ok(r2.report.errors.some((e) => e.where === from && e.msg.includes(`${to} 를 쓸 것`)), JSON.stringify(r2.report.errors));
  // 정의 층에 남은 참조는 사법부가 거부
  const broken = JSON.parse(JSON.stringify(after)); broken.senses[to].desc[0].links.push({ to: from, rel: 'related' });
  assert.ok(J.validate(M.normalize(broken)).errors.some((e) => e.where === from && e.msg.includes('이동된 번호를 가리킴')));
  // 이동 기록 모양: 대상 수·종류·대상 존재
  const bad = JSON.parse(JSON.stringify(after)); bad.moved[from] = { to: [to, from], kind: 'merge', at: AT, why: 'x' };
  const es = J.validate(M.normalize(bad)).errors.filter((e) => e.where === `이동 ${from}`).map((e) => e.msg).join(' | ');
  assert.ok(es.includes('merge 대상 수 2') && es.includes(`이동 대상 '${from}'`), es);
});
