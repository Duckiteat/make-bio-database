// 실제 기록 번호를 쓰는 시험 (10e · RULE-0520) — 시험은 실제 데이터 기록을 예로 들지 않고 합성 기록(9xxxxx 번호)을 쓴다.
//   데이터가 좋아지면(철회 · 값 추가 · 한계 닫힘) 실제 기록의 지금 상태에 기댄 단언이 깨지기 때문이다.
//   남는 것은 tests/real-records.json 에 시험 파일마다 번호와 이유 — 예시 시나리오가 가리키는 계 · 불변인 사전 등록 기록 등.
// ① 목록 밖의 실제 번호는 거부 · 쓰지 않는 목록 번호도 거부(목록이 낡지 않게) · 이유 없는 줄 거부  ② 거부 사례 (합성)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const RULE = 'RULE-0520';
// 실제 기록 번호 = db 에 따옴표로 적힌 T·D·S·O·V·L + 숫자 여섯
export const realIds = (dbText) => new Set((dbText.match(/"(?:T|D|S|O|V|L)\d{6}"/g) || []).map((x) => x.slice(1, -1)));
// 시험 글에 따옴표·백틱으로 적힌 번호 중 실제 번호
export const refsIn = (src, real) => [...new Set([...src.matchAll(/['"`]((?:T|D|S|O|V|L)\d{6})\b/g)].map((m) => m[1]).filter((x) => real.has(x)))].sort();
// 검사 (순수) — files: { 경로: 글 } · list: real-records.json 의 entries
export function check(files, list, real) {
  const errs = [], E = (m) => errs.push(`${RULE} ${m}`), by = new Map();
  for (const e of list) {
    if (!e.why || !String(e.why).trim()) E(`${e.file}: 이유(why)가 없음`);
    if (by.has(e.file)) E(`${e.file}: 목록에 두 번`);
    by.set(e.file, new Set(e.ids || []));
  }
  for (const [f, src] of Object.entries(files)) {
    const got = refsIn(src, real), allowed = by.get(f) || new Set();
    const extra = got.filter((x) => !allowed.has(x));
    if (extra.length) E(`${f}: 실제 기록 번호 ${extra.join(' · ')} — 합성 기록(9xxxxx)을 쓰거나, 꼭 실제여야 하면 tests/real-records.json 에 이유와 함께`);
    const stale = [...allowed].filter((x) => !got.includes(x));
    if (stale.length) E(`${f}: 목록의 ${stale.join(' · ')} 를 더는 쓰지 않음 — tests/real-records.json 에서 지울 것`);
  }
  for (const f of by.keys()) if (!(f in files)) E(`${f}: 목록에 있지만 시험 파일이 없음`);
  return errs;
}

test('① 실제 기록 번호는 목록에 이유와 함께 있는 것만 (RULE-0520)', () => {
  const real = realIds(readFileSync(join(ROOT, 'data/db.json'), 'utf8'));
  const files = Object.fromEntries(readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => [`tests/${f}`, readFileSync(join(ROOT, 'tests', f), 'utf8')]));
  const list = JSON.parse(readFileSync(join(ROOT, 'tests/real-records.json'), 'utf8')).entries;
  assert.deepEqual(check(files, list, real), []);
});

test('② 거부 사례 (합성): 목록 밖 번호 · 낡은 목록 번호 · 이유 없음 · 없는 파일 — 합성 번호는 통과', () => {
  const real = realIds('{"a": "D800001", "b": ["O800002"]}');
  assert.deepEqual([...real].sort(), ['D800001', 'O800002']);
  const ok = { 't/a.test.mjs': "const x = 'D900001'; const y = `O900002`;" };
  assert.deepEqual(check(ok, [], real), [], '합성 번호(실제에 없음)는 통과');
  const used = { 't/a.test.mjs': "f('D800001'); g(\"O800002\");" };
  assert.match(check(used, [], real).join('\n'), /^RULE-0520 t\/a\.test\.mjs: 실제 기록 번호 D800001 · O800002/);
  assert.deepEqual(check(used, [{ file: 't/a.test.mjs', ids: ['D800001', 'O800002'], why: '예시 시나리오' }], real), [], '목록에 이유와 함께면 통과');
  assert.match(check(used, [{ file: 't/a.test.mjs', ids: ['D800001', 'O800002'], why: ' ' }], real).join('\n'), /이유\(why\)가 없음/);
  assert.match(check(ok, [{ file: 't/a.test.mjs', ids: ['D800001'], why: 'x' }], real).join('\n'), /D800001 를 더는 쓰지 않음/);
  assert.match(check(ok, [{ file: 't/gone.test.mjs', ids: [], why: 'x' }], real).join('\n'), /시험 파일이 없음/);
});
