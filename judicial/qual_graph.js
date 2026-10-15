// 사법부 — 정성 그래프 0 층 판정 (build-plan 7 · docs/design/integral-field-engine.md §13.9)
//
// 정성 관찰(형식 v12 §4)은 새 저장 구조가 아니라 번호 그래프 위의 주장 간선이다. 여기서 두 가지를 한다:
//   ① 양방향 색인 — 간선은 관찰 기록에 한 번만 있고, 교란 대상·읽을 거리·맥락 열쇠 쪽에서 모두 찾을 수 있게 색인만 만든다.
//   ② 0 층 판정 — 기전 그래프(정의 층)에서 교란 대상 → … → 읽을 거리 경로를 찾고, 경로 부호 곱으로 예측한 변화 방향을 주장과 비교한다.
//      엔진을 돌리기 전의 싼 걸러내기: 지지 · 경로 없음(Structural_Gap 후보) · 모순 후보 · 부호 섞임(정량 판정 필요).
//      판정은 구조만 본다 — 속도·양이 정하는 결과(경로 둘의 우열, 포화)는 모의 판정(build-plan 8)의 몫이다.
// 기전 그래프의 간선 (부호: +1 늘림 · −1 줄임 · 0 부호 모름):
//   정의항 D → 그 정의항의 묶음 (+)                          knockout 은 모든 묶음을 없앤다 (compiler/perturb.js 와 같은 뜻)
//   단계: 입력·작용자 묶음 → 규칙 (+) · 규칙 → 산물 (+) · 규칙 → 소비된 입력 (−) · 조절자 → 규칙 (규칙 regulators 의 effect)
//   공급 규칙: 원료 → 규칙 (+) · 규칙 → 산물 (+) · 규칙 → 원료 (−) (위치 = where[0])
//   분해 규칙: 소유 정의항 묶음 → 규칙 (+) · 규칙 → 소유 정의항 묶음 (−)
//   조절 규칙: 소유 정의항 → 대상 규칙 (activates +, inhibits −)
//   세포 상태: 전이 신호 → 도착 상태 (+) · 표지 서명 묶음 → 상태 (high +, low −)
// 쓰기·엔진 실행 없음. 입력은 정규화된 db.
'use strict';
const M = require('../model.js');
const V = require('../vocab.js');

const RELATIVE = new Set(Object.keys(V.qualitativeExpectations).filter((k) => V.qualitativeExpectations[k].relative));
const EXPECT_SIGN = { increase: 1, decrease: -1 };
const PERTURB_SIGN = { knockout: -1, block: -1, inhibit: -1 }; // clamp 은 대조군 대비 방향이 정해지지 않는다
const baseOf = (b) => String(b).split('|')[0];
const signOfEffect = (e) => (e === 'activates' ? 1 : e === 'inhibits' ? -1 : 0);

function buildGraph(db) {
  const adj = new Map(), bundles = new Set();
  const edge = (from, to, sign, why) => { if (!adj.has(from)) adj.set(from, []); adj.get(from).push({ to, sign, why }); };
  const bun = (b) => { bundles.add(b); return b; };
  const ruleOf = (ref) => { const i = String(ref).indexOf('/rule/'), d = i > 0 && db.senses[ref.slice(0, i)]; return d && d.rule.find((r) => r.id === ref.slice(i + 6)); };
  for (const [sid, st] of Object.entries(db.steps || {})) {
    const R = st.rule, r = ruleOf(R) || {}, outs = new Set(st.outputs.map((p) => p.b));
    for (const p of [...st.inputs, ...st.agents]) edge(bun(p.b), R, 1, `${sid} 참여`);
    for (const p of st.outputs) edge(R, bun(p.b), 1, `${sid} 산물`);
    for (const p of st.inputs) if (!outs.has(p.b)) edge(R, p.b, -1, `${sid} 소비`);
    for (const p of st.regulators) {
      const g = (r.regulators || []).find((x) => x.ref === baseOf(p.b));
      edge(bun(p.b), R, signOfEffect(g && g.effect), `${sid} 조절${g ? ' ' + g.effect : ' (효과 모름)'}`);
    }
  }
  for (const [sid, d] of Object.entries(db.senses)) {
    for (const r of d.rule) {
      const R = `${sid}/rule/${r.id}`;
      if (r.type === 'supply') {
        const loc = (r.where || [])[0], key = (q) => (loc ? `${q.ref}|${loc}` : q.ref);
        for (const q of r.consumes || []) { edge(bun(key(q)), R, 1, '공급 원료'); edge(R, key(q), -1, '공급 원료 소비'); }
        for (const q of r.produces || []) edge(R, bun(key(q)), 1, '공급 산물');
      } else if (r.type === 'degradation') {
        edge(sid, R, 1, '분해 대상'); edge(R, `${sid}#pool`, -1, '분해');
      } else if (r.type === 'modulation' && r.target) edge(sid, r.target, signOfEffect(r.effect), `조절 ${r.effect}`);
    }
    if (d.kind === 'cell_state') {
      for (const t of d.transitions || []) for (const s of t.signals || []) edge(s, t.to, 1, `${sid} → ${t.to} 전이 신호`);
      for (const m of d.signature || []) edge(bun(`${m.ref}|${m.location}`), sid, m.level === 'high' ? 1 : m.level === 'low' ? -1 : 0, `표지 서명 ${m.level}`);
    }
  }
  // 정의항 → 묶음 (+), 분해의 '정의항 전체' 묶음 → 각 묶음 (+): 정의항 단위 교란·분해가 그 정의항의 모든 형태에 닿게
  for (const b of bundles) { edge(baseOf(b), b, 1, '정의항의 묶음'); edge(`${baseOf(b)}#pool`, b, 1, '정의항의 묶음'); }
  for (const list of adj.values()) list.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : b.sign - a.sign));
  return { adj, bundles };
}

// 부호 붙은 도달: (노드, 부호) 상태마다 처음 도달한 경로 하나만 펼치는 너비 우선 — 다항 시간.
//   순환은 막는다: 자기 경로 위의 노드로 돌아가는 간선은 따르지 않는다(음성 되먹임 A → 소비 → A 는 직접 효과의 부호를 뒤집지 않는다).
//   avoid: 한 번 나간 뒤 다시 들어가지 않을 노드 — knockout 은 그 정의항의 모든 형태를 없애므로 형태 사이 변환을 지나는 경로는 뜻이 없다.
//   근사: 한 상태에 먼저 닿은 경로만 이어 가므로, 그 경로 때문에 막힌 다른 경로의 부호를 놓칠 수 있다 — 놓치는 쪽은 '경로 없음·지지' 가
//   아니라 반대 부호이므로, 판결 문구는 '찾은 경로' 기준이라고 밝힌다.
function signedPaths(G, start, goal, avoid) {
  const st = [{ node: start, sign: 1, parent: -1, via: null, esign: null }], seen = new Set([`1:${start}`]), found = {};
  const onChain = (i, n) => { for (let j = i; j >= 0; j = st[j].parent) if (st[j].node === n) return true; return false; };
  for (let i = 0; i < st.length; i++) {
    const cur = st[i];
    if (cur.node === goal && i > 0) { if (!(cur.sign in found)) found[cur.sign] = i; continue; }
    for (const e of G.adj.get(cur.node) || []) {
      const s2 = cur.sign * e.sign, k = `${s2}:${e.to}`;
      if (seen.has(k) || (avoid && avoid(e.to) && !avoid(cur.node) && e.to !== goal) || onChain(i, e.to)) continue; // 대상의 형태들에서 나간 뒤에는 다시 들어가지 않음
      seen.add(k); st.push({ node: e.to, sign: s2, parent: i, via: e.why, esign: e.sign });
    }
  }
  const trace = (i) => { const out = []; for (let j = i; j >= 0; j = st[j].parent) out.unshift({ node: st[j].node, via: st[j].via, sign: st[j].esign }); return out; };
  return { paths: Object.fromEntries(Object.entries(found).map(([s, i]) => [s, trace(i)])), expanded: st.length };
}

// 주장 하나 → 0 층 판결
function judgeClaim(db, G, o) {
  const p = o.perturbation, ex = o.expect, row = { expect: ex, readout: o.readout, perturbation: p || null };
  if (!RELATIVE.has(ex)) return Object.assign(row, { verdict: 'not_applicable', why: '대조군 비교가 아닌 기대(유무·순서·단조)는 구조로 판정하지 않음 — 모의 판정(build-plan 8)' });
  if (!p || !(p.type in PERTURB_SIGN)) return Object.assign(row, { verdict: 'not_applicable', why: `교란 ${p ? p.type : '없음'} — 대조군 대비 방향이 구조로 정해지지 않음 (모의 판정)` });
  const goal = o.readout.target;
  // knockout 대상 자신의 형태를 읽으면 정의상 없어진다 — 경로를 찾을 일이 아니다
  if (p.type === 'knockout' && baseOf(goal) === p.target) {
    const ok = ex === 'decrease';
    return Object.assign(row, { predicted: [-1], verdict: ok ? 'supported' : 'contradiction_candidate', why: ok ? '정의상 — 교란이 읽을 거리의 정의항 자체를 없앰' : '교란이 읽을 거리의 정의항 자체를 없애는데 주장은 그렇지 않음' });
  }
  const avoid = p.type === 'knockout' ? (n) => baseOf(n) === p.target || n === `${p.target}#pool` : null;
  const sp = signedPaths(G, p.target, goal, avoid), paths = sp.paths, signs = Object.keys(paths).map(Number);
  // 예측 변화 = 교란 부호(줄임 −1) × 경로 부호
  const predicted = signs.map((s) => PERTURB_SIGN[p.type] * s);
  Object.assign(row, { paths, predicted: [...new Set(predicted)].sort() });
  if (!signs.length) return Object.assign(row, { verdict: ex === 'no_change' ? 'supported' : 'no_path', why: ex === 'no_change' ? '경로 없음 — 효과 없다는 주장과 맞음' : '기전 그래프에 교란 대상 → 읽을 거리 경로가 없음 — Structural_Gap 후보 (빠진 단계·조절)' });
  if (ex === 'no_change') return Object.assign(row, { verdict: 'tension', why: '경로가 있는데 효과 없음을 주장 — 상쇄·포화 여부는 모의 판정으로' });
  const want = EXPECT_SIGN[ex], hasWant = predicted.includes(want), hasOpp = predicted.includes(-want), unsigned = predicted.includes(0);
  if (hasWant && !hasOpp && !unsigned) return Object.assign(row, { verdict: 'supported', why: '찾은 경로의 부호가 모두 주장 방향과 같음' });
  if (hasOpp && !hasWant && !unsigned) return Object.assign(row, { verdict: 'contradiction_candidate', why: '찾은 경로의 부호가 모두 주장과 반대 — 빠진 경로 또는 잘못된 부호 후보' });
  return Object.assign(row, { verdict: 'mixed', why: unsigned ? '효과를 모르는 조절 간선을 지나는 경로가 있음' : '부호가 다른 경로가 함께 있음 — 우열은 속도·양이 정함 (모의 판정)' });
}

// 양방향 색인: 교란 대상 · 읽을 거리(묶음과 그 정의항) · 맥락 열쇠 → 관찰 번호
function claimIndex(db) {
  const idx = { byPerturbation: {}, byReadout: {}, byContext: {} }, push = (m, k, id) => { (m[k] = m[k] || []).push(id); };
  for (const [id, o] of Object.entries(db.observations || {})) {
    if (o.kind !== 'qualitative' || o.retracted) continue;
    if (o.perturbation && o.perturbation.target) { push(idx.byPerturbation, o.perturbation.target, id); if (o.perturbation.target.includes('/rule/')) push(idx.byPerturbation, baseOf(o.perturbation.target.split('/')[0]), id); }
    for (const t of o.readout.target ? [o.readout.target] : (o.expect && o.expect.order) || []) { push(idx.byReadout, t, id); if (t.includes('|')) push(idx.byReadout, baseOf(t), id); }
    push(idx.byContext, M.contextKey(o.condition), id);
  }
  return idx;
}

function qualGraphVerdict(db, opt) {
  opt = opt || {};
  const G = buildGraph(db), rows = [], counts = {};
  for (const [id, o] of Object.entries(db.observations || {})) {
    if (o.kind !== 'qualitative' || o.retracted || (opt.ids && !opt.ids.includes(id))) continue;
    const r = Object.assign({ id, experiment: o.experiment || null, context: M.contextKey(o.condition) }, judgeClaim(db, G, o));
    rows.push(r); counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  }
  return { rows, counts, index: claimIndex(db), graph: { nodes: G.adj.size, edges: [...G.adj.values()].reduce((t, l) => t + l.length, 0) } };
}

const LABEL = { supported: '구조 지지', no_path: '경로 없음 (Structural_Gap 후보)', contradiction_candidate: '모순 후보', mixed: '부호 섞임 (모의 판정 필요)', tension: '긴장 (경로 있음 · 효과 없음 주장)', not_applicable: '0 층 판정 대상 아님' };
function qualGraphText(v) {
  const out = [`정성 그래프 0 층 판정 — 기전 그래프 노드 ${v.graph.nodes} · 간선 ${v.graph.edges} · 정성 관찰 ${v.rows.length}`];
  if (!v.rows.length) out.push('  (정성 관찰 없음)');
  for (const r of v.rows) {
    out.push(`  ${r.id}${r.experiment ? ` [${r.experiment}]` : ''}: ${r.perturbation ? `${r.perturbation.type} ${r.perturbation.target}` : '교란 없음'} → ${r.readout.kind} ${r.readout.target || JSON.stringify(r.expect)} · 기대 ${typeof r.expect === 'string' ? r.expect : 'order'} — ${LABEL[r.verdict]}: ${r.why}`);
    for (const [s, path] of Object.entries(r.paths || {})) out.push(`      경로 부호 ${s > 0 ? '+' : s < 0 ? '−' : '?'}: ${path.map((x) => x.node).join(' → ')}`);
  }
  out.push('판정은 구조만 본다 — "구조 지지" 는 일치가 아니다 (일치는 사전 등록된 규약 아래의 모의 판정으로만).');
  return out.join('\n');
}

module.exports = { buildGraph, signedPaths, judgeClaim, claimIndex, qualGraphVerdict, qualGraphText, LABEL };
