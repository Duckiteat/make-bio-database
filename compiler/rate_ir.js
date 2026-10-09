// 컴파일러 — 경로 속도 시뮬레이션 IR (Rate IR). docs/design/engine-port-roadmap.md 3단계
//
// 행정부 simulateRate(core.js)가 조립한 계(단계·공급·분해·조절·저장소)를 정수 번호 표로 낮춘다. 순수 함수: 쓰기·판정·엔진 호출 없음.
//   · 묶음 → 0…nB−1 (앞 nInit 개는 시작 시 상태에 있던 묶음, 그 순서 그대로 — 원자료의 키 순서를 지키려고)
//   · 단계: 행위자·입력·출력·법칙 입력·법칙 출력·자기 입력(저장소 아님)을 [번호, 화학량] 으로, 법칙 상수, 반응 부피, 조절자 목록
//   · 공급: 소비(포화 표시)·생성, 법칙 상수, 부피, 조절자 · 분해: 묶음, k_deg, 재활용 산물, 조절자
//   · 조절자: [묶음 번호, 효과, 힐 상수(없으면 null — 배율 1, 공백으로 보고), 부피 L]
//   · 해시: 정준 JSON 의 sha256 (원자료 irHash)
// 루프는 이 표만 읽고, 이름(묶음·실체·부분 구조)은 기록·원장을 만들 때만 쓴다. 산술 순서는 조립 전 코드와 같게 둔다(결과 비트 일치).
// core.js 와 같이 브라우저에서도 읽히므로 UMD — 해시는 Node(crypto)에서만 (브라우저에서는 null).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('crypto'));
  else root.DefDBRateIR = factory(null);
})(typeof self !== 'undefined' ? self : this, function (crypto) {
'use strict';
const FORMAT = 'definition-db-rate-ir', VERSION = 1;
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));

function lowerRate(sys) {
  const keys = sys.keys.slice(), at = new Map(keys.map((b, i) => [b, i]));
  const I = (b) => { if (!at.has(b)) { at.set(b, keys.length); keys.push(b); } return at.get(b); };
  const pairs = (m) => [...m].map(([b, n]) => [I(b), n]);
  const mods = (list) => list.map((m) => ({ i: I(m.b), effect: m.effect, kin: m.kin || null, V: m.V, ref: m.ref }));
  const steps = sys.steps.map((s) => ({
    sid: s.sid, agents: s.agents.map(I), ins: pairs(s.ins), outs: pairs(s.outs), lawIns: pairs(s.lawIns), lawOuts: pairs(s.lawOuts), own: pairs(s.own),
    law: s.law, k: s.k, V: s.V, mods: mods(s.mods),
  }));
  const sups = sys.sups.map((s) => ({ ref: s.ref, active: s.active, law: s.law, k: s.k, V: s.V, source: s.source, cons: s.cons.map((q) => [I(q.b), q.n, !!q.sat]), prods: s.prods.map((q) => [I(q.b), q.n]), mods: mods(s.mods) }));
  const degrs = sys.degrs.map((g) => ({ ref: g.ref, b: I(g.b), k: g.k, lost: g.lost, rec: g.rec.map((q) => [I(q.b), q.n]), mods: mods(g.mods) }));
  const isRes = Uint8Array.from(keys, (b) => (sys.res.has(b) ? 1 : 0));
  const ir = { format: FORMAT, version: VERSION, keys, nInit: sys.nInit, isRes: Array.from(isRes), steps, sups, degrs };
  ir.hash = crypto ? crypto.createHash('sha256').update(canon(ir)).digest('hex') : null;
  // 해시를 낸 뒤 실행용 평평한 형식 배열을 붙인다 ([번호, 화학량] 쌍 → B: Int32Array, N: Float64Array)
  const flat = (o, name, list) => { o[name + 'B'] = Int32Array.from(list, (q) => q[0]); o[name + 'N'] = Float64Array.from(list, (q) => q[1]); };
  for (const S of steps) { S.agentsB = Int32Array.from(S.agents); for (const f of ['ins', 'outs', 'lawIns', 'lawOuts', 'own']) flat(S, f, S[f]); }
  for (const s of sups) { flat(s, 'cons', s.cons); s.consSat = Uint8Array.from(s.cons, (q) => (q[2] ? 1 : 0)); flat(s, 'prods', s.prods); }
  for (const g of degrs) flat(g, 'rec', g.rec);
  ir.isRes = isRes;
  return ir;
}

return Object.freeze({ FORMAT, VERSION, lowerRate });
});
