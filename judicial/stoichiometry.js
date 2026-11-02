// 화학량 보존 (ASY-15 · 자료 무결성 보고서의 제안) — 참여자 모두에 원소 조성이 있는 반응만 원자 · 전하 균형을 검사한다.
// 계약: 순수 — 값만 받고 값만 돌려준다 (읽기·쓰기·실행 없음, 사법부). 조성은 호출자가 compOf(id) 로 준다 — 이 모듈은 자료 모양을 모른다.
//   조성이 없는 참여자(단백질 복합체 · 묶음 · 부분 구조만 아는 분자)가 하나라도 있으면 "검사 불가" — 통과로 치지 않고 수로 드러낸다.
//   반응 { inputs: [{ id, coef? }], outputs: [{ id, coef? }] } — coef 기본 1. minor 가 붙은 참여자(미량)가 있으면 균형을 주장할 수 없어 검사 불가.
const R = 'RULE-0531'; // 이 검사가 사유 앞에 붙이는 규칙 번호
const add = (acc, comp, sign, coef) => { for (const [e, n] of Object.entries(comp.elements || {})) acc[e] = (acc[e] || 0) + sign * coef * n; acc['+'] = (acc['+'] || 0) + sign * coef * (comp.charge || 0); };

// 반응 한 개 → { kind: 'balanced' | 'unbalanced' | 'uncheckable', diff?, why? }
export function balanceOf(rx, compOf) {
  const sides = [...(rx.inputs || []).map((p) => [p, -1]), ...(rx.outputs || []).map((p) => [p, 1])];
  if (!sides.length) return { kind: 'uncheckable', why: '참여자가 없음' };
  const acc = {};
  for (const [p, sign] of sides) {
    if (p.minor) return { kind: 'uncheckable', why: `미량 참여자 ${p.id} — 균형을 주장할 수 없음` };
    const comp = compOf(p.id);
    if (!comp || typeof comp.elements !== 'object') return { kind: 'uncheckable', why: `${p.id} 의 원소 조성을 모름` };
    const coef = p.coef == null ? 1 : p.coef;
    if (!(coef > 0) || !Number.isInteger(coef)) return { kind: 'uncheckable', why: `${p.id} 의 계수 ${coef} 가 양의 정수가 아님` };
    add(acc, comp, sign, coef);
  }
  const diff = Object.fromEntries(Object.entries(acc).filter(([, n]) => n !== 0));
  return Object.keys(diff).length ? { kind: 'unbalanced', diff } : { kind: 'balanced' };
}

// 여러 반응 → 수와 사유. unbalanced 는 거부 대상, uncheckable 은 검사 불가로 수를 보인다 (통과로 치지 않음)
export function stoichiometryReport(reactions, compOf) {
  const out = { total: 0, balanced: 0, uncheckable: 0, unbalanced: [], notes: [] };
  for (const [id, rx] of Object.entries(reactions)) {
    out.total++;
    const r = balanceOf(rx, compOf);
    if (r.kind === 'balanced') out.balanced++;
    else if (r.kind === 'uncheckable') out.uncheckable++;
    else { out.unbalanced.push(id); out.notes.push(`${R} ${id} 원자 · 전하가 맞지 않음: ${Object.entries(r.diff).map(([e, n]) => `${e === '+' ? '전하' : e} ${n > 0 ? '+' : ''}${n}`).join(' · ')} (오른쪽 − 왼쪽)`); }
  }
  return out;
}
