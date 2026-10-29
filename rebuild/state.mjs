// 계획 상태 기록 (rebuild/PLAN.md 6c) — 계획은 기록이고 글은 생성물이다. 손으로 고치지 않는다.
//   원본 둘: rebuild/state/plans.jsonl (지금 — 계획 머리·결정·부·작업·글·종합·방향·열린 질문, 한 줄 = 기록 하나)
//            rebuild/state/plan-log.jsonl (걸어온 길 — 작업 사건, 덧붙이기만. 2026-10-29 까지는 git 역사에서 가져옴)
//   생성: docs/design/build-plan.md · rebuild/PLAN.md (rebuild/status.mjs --write 가 서기 writePlanDoc 로)
//   고치기: node rebuild/plan.mjs apply <ops.json> — 바꿀 때마다 왜(why)를 받아 사건으로 남긴다
// 왜 이렇게 (사용자 2026-10-29): 맥락을 잃은 채 계획을 따라가면 이상한 결론에 닿는다 — 처음 목적, 중간에 바뀐 이유,
//   도달 과정, 중간 결과, 종합 결과와 의의, 나아갈 방향이 모두 계획 안에 정확히 있어야 한다. 길어도 된다, 정확해야 한다.
// 계약: 순수 — load 는 읽기만, check·fold·render·apply 는 값만 돌려준다. 파일 쓰기는 서기만.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const PLANS_FILE = 'rebuild/state/plans.jsonl', LOG_FILE = 'rebuild/state/plan-log.jsonl';
// 작업 번호: 원래 순번에서 — build 12 → PLAN-012 · 12A → PLAN-012a · 50′ → PLAN-050p · (보류) → PLAN-H01 / rebuild 5a → STG-05a · 0′ → STG-00p · 5b″ → STG-05bpp
export const planId = (n, hold) => {
  if (hold != null) return 'PLAN-H' + String(hold).padStart(2, '0');
  const m = String(n).match(/^(\d+)(A|′)?$/);
  if (!m) throw new Error(`계획 순번 '${n}' 의 모양을 모름`);
  return 'PLAN-' + m[1].padStart(3, '0') + (m[2] === 'A' ? 'a' : m[2] === '′' ? 'p' : '');
};
export const stageId = (n) => {
  const m = String(n).match(/^(\d+)([a-z])?(′|″|‴)?$/);
  if (!m) throw new Error(`재건 단계 '${n}' 의 모양을 모름`);
  return 'STG-' + m[1].padStart(2, '0') + (m[2] || '') + 'p'.repeat(['', '′', '″', '‴'].indexOf(m[3] || ''));
};
export const PLANS = {
  build: { legacy: 'docs/design/build-plan.md', out: 'docs/design/build-plan.md', idOf: planId, re: /^PLAN-(?:\d{3}[ap]?|H\d{2})$/ },
  rebuild: { legacy: 'rebuild/PLAN.md', out: 'rebuild/PLAN.md', idOf: stageId, re: /^STG-\d{2}[a-z]?p{0,3}$/ },
};
// 상태 기호 ↔ 상태 (표의 기호는 그대로 보인다)
export const STATE_OF = { '☑': 'done', '◐': 'partial', '☐': 'open', '✗': 'dropped', '보류': 'hold', '논의': 'discussion' };
export const MARK = Object.fromEntries(Object.entries(STATE_OF).map(([k, v]) => [v, k]));
export const STATE_KO = { done: '완료', partial: '진행', open: '대기', dropped: '그만둠', hold: '보류', discussion: '논의' };
// 결정의 종류 · 누가 (원문에 적힌 대로 — 적힌 것이 없으면 unstated, 지어 넣지 않는다)
export const DECISION_TYPES = { purpose: '목적', diagnosis: '진단 (왜)', order: '순서', scope: '범위', design: '설계', method: '방법' };
export const BY = { user: '사용자', agreed: '사용자와 합의', delegated: '사용자가 AI 에게 맡김', ai: 'AI 초안 — 사용자 확인 전', unstated: '원문에 누가인지 없음' };
export const KINDS = ['plan', 'decision', 'part', 'note', 'item', 'synthesis', 'direction', 'open'];

const jsonl = (root, p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
export function load(root) {
  const recs = jsonl(root, PLANS_FILE), log = jsonl(root, LOG_FILE), of = (k) => recs.filter((r) => r.kind === k);
  return { recs, log, plans: of('plan'), decisions: of('decision'), parts: of('part'), notes: of('note'), items: of('item'), syntheses: of('synthesis'), directions: of('direction'), opens: of('open') };
}

// 사건을 차례로 접어 작업의 지금 칸을 만든다 — 저장된 작업 기록과 같아야 한다(장부와 잔액)
export function fold(log, plan) {
  const m = new Map();
  for (const e of log.filter((x) => x.plan === plan)) {
    const k = e.item || e.label;
    if (e.change === 'added') { m.set(k, { id: e.item, n: e.label, part: e.part, fields: { ...e.fields }, state: e.state, mark: e.mark, at: e.state_at, result: e.result }); continue; }
    const x = m.get(k);
    if (!x) throw new Error(`사건 ${e.seq}: '${k}' 가 추가되기 전에 ${e.change}`);
    if (e.change === 'removed') m.delete(k);
    else if (e.change === 'moved') x.part = e.to;
    else if (e.change === 'scope') { if (e.to == null) delete x.fields[e.field]; else x.fields[e.field] = e.to; }
    else if (e.change === 'state') { x.state = e.to.state; x.mark = e.to.mark; x.at = e.to.at; }
    else if (e.change === 'result') x.result = e.set !== undefined ? e.set : (x.result || '') + e.append;
    else throw new Error(`사건 ${e.seq}: 모르는 변화 '${e.change}'`);
  }
  return m;
}

// ── 참조 — 결정·종합·방향이 가리키는 것. 글 안에 적힌 번호도 모두 풀려야 한다(지어낸 번호를 막는다)
export const REF_RE = /\b(?:PLAN-(?:\d{3}[ap]?|H\d{2})|STG-\d{2}[a-z]?p{0,3}|DEC-\d{4}|DIR-\d{4}|RULE-\d{4}|CHG-\d{4}|EQ-\d{4}|[TDSOLV]\d{6})\b/g;
const isPath = (r) => /^[\w.\-]+(\/[\w.\-*]+)+$|^[\w\-]+\.(md|mjs|js|json|jsonl)$/.test(r);
// ctx: { exists(path), rules:Set, db:{T,D,S,O,L,V:Set}, changes:n, formulas:Set, commit(h)→bool|null }
export function resolveRef(S, ctx, r) {
  const s = String(r);
  if (/^commit:/.test(s)) { const ok = ctx.commit ? ctx.commit(s.slice(7)) : null; return ok !== false; }
  if (/^PLAN-|^STG-/.test(s)) return S.items.some((x) => x.id === s);
  if (/^DEC-/.test(s)) return S.decisions.some((x) => x.id === s);
  if (/^DIR-/.test(s)) return S.directions.some((x) => x.id === s);
  if (/^RULE-/.test(s)) return ctx.rules.has(s);
  if (/^EQ-/.test(s)) return ctx.formulas.has(s);
  if (/^CHG-(\d{4})$/.test(s)) return Number(s.slice(4)) >= 1 && Number(s.slice(4)) <= ctx.changes;
  if (/^[TDSOLV]\d{6}$/.test(s)) return ctx.db[s[0]].has(s);
  if (isPath(s.replace(/#.*$/, '').replace(/ §.*$/, ''))) return ctx.exists(s.replace(/#.*$/, '').replace(/ §.*$/, ''));
  return false;
}
const idsIn = (t) => [...String(t || '').matchAll(REF_RE)].map((m) => m[0]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 정확성 검사 — 오류는 문장 목록. 없어야 생성한다
export function check(S, ctx) {
  const E = [], plans = new Set(S.plans.map((p) => p.plan)), seen = new Set();
  for (const r of S.recs) if (!KINDS.includes(r.kind)) E.push(`모르는 기록 종류 '${r.kind}'`);
  for (const p of S.plans) { if (!PLANS[p.plan]) E.push(`모르는 계획 '${p.plan}'`); if (!p.import || !p.import.until) E.push(`${p.plan}: import.until (가져온 역사의 끝 커밋) 없음`); }
  const uniq = (id, re, what) => { if (!re.test(id)) E.push(`${what} 번호 '${id}' 모양`); if (seen.has(id)) E.push(`번호 겹침 '${id}'`); seen.add(id); };
  // 작업
  for (const x of S.items) {
    if (!plans.has(x.plan)) { E.push(`${x.id}: 계획 '${x.plan}' 없음`); continue; }
    uniq(x.id, PLANS[x.plan].re, '작업');
    if (!Object.values(STATE_OF).includes(x.state) || MARK[x.state] !== x.mark) E.push(`${x.id}: 상태 '${x.state}'·기호 '${x.mark}'`);
    if (x.at != null && !DATE.test(x.at)) E.push(`${x.id}: 날짜 '${x.at}'`);
    if (['done', 'partial'].includes(x.state) && !x.at) E.push(`${x.id}: ${STATE_KO[x.state]} 인데 날짜 없음`);
    if (!S.parts.some((p) => p.plan === x.plan && p.title === x.part)) E.push(`${x.id}: 부 '${x.part}' 없음`);
  }
  // 걸어온 길 = 지금 (장부와 잔액)
  S.log.forEach((e, i) => { if (e.seq !== i + 1) E.push(`사건 순번 ${e.seq} ≠ ${i + 1} (덧붙이기만)`); if (!DATE.test(e.at || '') || !String(e.why || '').trim()) E.push(`사건 ${e.seq}: 날짜·왜(why) 필요`); if (e.source === 'git' && !e.commit) E.push(`사건 ${e.seq}: git 에서 온 사건에 커밋 없음`); });
  for (const plan of plans) {
    let f; try { f = fold(S.log, plan); } catch (e) { E.push(e.message); continue; }
    const want = S.items.filter((x) => x.plan === plan);
    const sig = (x) => JSON.stringify([x.id, x.n, x.part, x.fields, x.state, x.mark, x.at, x.result ?? null]);
    const have = new Map([...f.values()].map((x) => [x.id || x.n, sig(x)]));
    for (const x of want) if (have.get(x.id) !== sig(x)) E.push(`${x.id}: 지금 기록이 걸어온 길(사건)을 접은 것과 다름`);
    if (have.size !== want.length) E.push(`${plan}: 사건에서 나온 작업 ${have.size} ≠ 기록 ${want.length}`);
  }
  // 결정
  for (const d of S.decisions) {
    uniq(d.id, /^DEC-\d{4}$/, '결정');
    if (!(d.plans || []).length || d.plans.some((p) => !plans.has(p))) E.push(`${d.id}: plans`);
    if (!DECISION_TYPES[d.type]) E.push(`${d.id}: 종류 '${d.type}'`);
    if (!BY[d.by]) E.push(`${d.id}: 누가 '${d.by}'`);
    if (!DATE.test(d.at || '')) E.push(`${d.id}: 날짜`);
    if (!String(d.title || '').trim() || !String(d.text || '').trim()) E.push(`${d.id}: 제목·원문 필요`);
    for (const r of [...(d.affects || []), ...(d.updates || []).flatMap((u) => u.refs || [])]) if (!resolveRef(S, ctx, r)) E.push(`${d.id}: 참조 '${r}' 를 찾지 못함`);
    for (const u of d.updates || []) { if (!DATE.test(u.at || '') || !String(u.text || '').trim()) E.push(`${d.id}: 뒤에 일어난 일은 날짜·글 필요`); for (const r of idsIn(u.text)) if (!resolveRef(S, ctx, r)) E.push(`${d.id}: 글 속 번호 '${r}' 를 찾지 못함`); }
    if (d.src && d.src.item) { const x = S.items.find((y) => y.id === d.src.item); const all = x ? [...Object.values(x.fields), x.result || ''].join('\n') : ''; if (!all.includes(d.text)) E.push(`${d.id}: 원문이 ${d.src.item} 의 글에 그대로 없음`); }
    if (d.src && d.src.commit && !resolveRef(S, ctx, 'commit:' + d.src.commit)) E.push(`${d.id}: 커밋 ${d.src.commit} 없음`);
  }
  // 종합 · 방향 · 열린 질문 — 근거가 있어야 하고, 근거와 글 속 번호가 모두 풀려야 한다
  for (const s of S.syntheses) {
    if (!plans.has(s.plan) || !(s.scope === 'all' || S.parts.some((p) => p.plan === s.plan && p.title === s.scope))) E.push(`종합 ${s.plan}/${s.scope}: 계획·범위`);
    if (!BY[s.by] || !DATE.test(s.at || '')) E.push(`종합 ${s.scope}: 누가·날짜`);
    if (!String(s.result || '').trim() || !String(s.meaning || '').trim()) E.push(`종합 ${s.scope}: 결과·의의 둘 다 필요`);
    if (!(s.evidence || []).length) E.push(`종합 ${s.scope}: 근거 없음`);
    for (const r of [...(s.evidence || []), ...idsIn(s.result), ...idsIn(s.meaning)]) if (!resolveRef(S, ctx, r)) E.push(`종합 ${s.scope}: 참조 '${r}' 를 찾지 못함`);
  }
  for (const d of S.directions) {
    uniq(d.id, /^DIR-\d{4}$/, '방향');
    if (!plans.has(d.plan) || !BY[d.by] || !DATE.test(d.at || '')) E.push(`${d.id}: 계획·누가·날짜`);
    if (!['open', 'taken', 'dropped'].includes(d.state)) E.push(`${d.id}: 상태 '${d.state}'`);
    if (!String(d.text || '').trim() || !String(d.why || '').trim()) E.push(`${d.id}: 무엇·왜 둘 다 필요`);
    if (!(d.evidence || []).length) E.push(`${d.id}: 근거 없음`);
    for (const r of [...(d.first || []), ...(d.evidence || []), ...idsIn(d.text), ...idsIn(d.why)]) if (!resolveRef(S, ctx, r)) E.push(`${d.id}: 참조 '${r}' 를 찾지 못함`);
  }
  for (const o of S.opens) {
    if (!plans.has(o.plan) || !String(o.text || '').trim()) E.push(`열린 질문: 계획·글`);
    if (o.resolved) { if (!DATE.test(o.resolved.at || '') || !BY[o.resolved.by] || !String(o.resolved.how || '').trim()) E.push(`열린 질문 '${o.text.slice(0, 20)}…': 풀림은 날짜·누가·어떻게`); for (const r of o.resolved.refs || []) if (!resolveRef(S, ctx, r)) E.push(`열린 질문: 참조 '${r}'`); }
  }
  return E;
}

// ── 생성 (사람이 읽는 글). 같은 기록이면 같은 바이트
const one = (t) => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
const cell = (t) => one(t).replace(/(?<!\\)\|/g, '\\|');
const titleOf = (x) => { const w = x.fields[Object.keys(x.fields)[0]] || ''; const m = w.match(/^~*\*\*(.+?)\*\*/); return m ? m[1] : w.split(/[:—(]/)[0].trim() || w; };
const by = (k) => BY[k] || k;
const details = (summary, body) => `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`;
const eventsOf = (S, x) => S.log.filter((e) => e.plan === x.plan && (e.item ? e.item === x.id : e.label === x.n));
const srcOf = (e) => (e.commit ? `\`${e.commit.slice(0, 7)}\`` : '커밋 전 기록');

// 작업 하나의 결과를 날짜별 조각으로 — 덧붙은 조각은 그대로 잇고, 고쳐 쓴 곳은 이전 글을 접어 둔다
function resultPieces(S, x) {
  let pieces = [];
  for (const e of eventsOf(S, x)) {
    if (e.change === 'added' && e.result) pieces = [{ at: e.at, src: srcOf(e), text: e.result }];
    if (e.change === 'result') {
      if (e.set !== undefined) pieces = [{ at: e.at, src: srcOf(e), text: e.set || '', replaced: pieces.map((p) => p.text).join('') }];
      else pieces.push({ at: e.at, src: srcOf(e), text: e.append });
    }
  }
  return pieces.filter((p) => p.text || p.replaced);
}
function pathOf(S, x) {
  const out = []; let had = false; // 결과가 이미 있었나 — 없던 결과를 처음 쓰면 '고쳐 씀' 이 아니다
  for (const e of eventsOf(S, x)) {
    const first = e.change === 'result' && !had; if (e.change === 'added') had = !!e.result; if (e.change === 'result') had = e.set !== undefined ? !!e.set : true;
    const head = `- \`${e.at}\` ${srcOf(e)}`, why = ` — ${one(e.why)}`;
    if (e.change === 'added') out.push(`${head} 계획에 들어옴 (${e.mark || ''} ${STATE_KO[e.state] || '상태 없음'})${why}`);
    else if (e.change === 'state') out.push(`${head} 상태 ${e.from.mark || '?'}${e.from.at ? ' ' + e.from.at : ''} → ${e.to.mark || '?'}${e.to.at ? ' ' + e.to.at : ''}${why}`);
    else if (e.change === 'result') out.push(`${head} 결과 ${first ? '처음 적힘' : e.set !== undefined ? '고쳐 씀' : '덧붙음'}${why}`);
    else if (e.change === 'scope') out.push(`${head} '${e.field}' 칸이 바뀜${why}\n\n  ${details('이전 · 이후', `이전: ${one(e.from) || '(없음)'}\n\n이후: ${one(e.to) || '(없음)'}`)}`);
    else if (e.change === 'moved') out.push(`${head} '${e.from}' → '${e.to}' 로 옮김${why}`);
    else if (e.change === 'removed') out.push(`${head} 계획에서 빠짐${why}`);
  }
  return out;
}
const itemLine = (S, id) => { const x = S.items.find((y) => y.id === id); return x ? `${id} (${x.n} ${titleOf(x)} · ${x.mark})` : id; };

export function render(S, plan) {
  const P = S.plans.find((p) => p.plan === plan), items = S.items.filter((x) => x.plan === plan);
  const decs = S.decisions.filter((d) => d.plans.includes(plan)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const out = [`# ${P.title}`, '',
    `> 생성물 — \`node rebuild/status.mjs --write\` 가 원본 \`${PLANS_FILE}\` · \`${LOG_FILE}\` 에서 만든다. 손으로 고치지 않는다.`,
    `> 바꾸려면 \`node rebuild/plan.mjs apply <ops.json>\` (바꿀 때마다 왜를 적는다). 하나만 읽기: \`node rebuild/read.mjs <PLAN-…|STG-…|DEC-…|DIR-…>\`.`,
    `> 이 문서의 차례: 목적 → 왜 → 결정과 바뀐 이유(시간순) → 작업(결과·걸어온 길) → 종합 결과와 의의 → 나아갈 방향 → 열린 질문 → 근거 점검.`, '', ...(P.intro || []), ''];
  const decBlock = (d) => {
    const o = [`### ${d.id} — ${d.title}`, '', `\`${d.at}\` · ${by(d.by)}${d.by_src ? ` (${d.by_src})` : ''} · ${DECISION_TYPES[d.type]}${d.src && d.src.commit ? ` · 처음 적힌 커밋 \`${d.src.commit.slice(0, 7)}\`` : ''}${d.src && d.src.item ? ` · 원문 자리 ${d.src.item}` : ''}${d.was ? ` · 옛 문서의 ${d.was}` : ''}${d.src && d.src.file && d.src.file !== P.out ? ` · 원문 \`${d.src.file}\`` : ''}`, '', d.text, ''];
    if (d.first && d.first.text) o.push(details(`처음 적힌 글 (${d.first.at}, \`${d.first.commit.slice(0, 7)}\`) — 지금 글과 다름`, d.first.text), '');
    if ((d.updates || []).length) o.push('**뒤에 일어난 일**', '', ...d.updates.map((u) => `- \`${u.at}\` ${u.text}${(u.refs || []).length ? ` (${u.refs.join(' · ')})` : ''}`), '');
    if ((d.affects || []).length) o.push(`**닿는 작업**: ${d.affects.map((a) => itemLine(S, a)).join(' · ')}`, '');
    return o.join('\n');
  };
  // 1·2 목적과 진단
  const purp = decs.filter((d) => d.type === 'purpose'), diag = decs.filter((d) => d.type === 'diagnosis');
  out.push('## 1. 목적 — 처음 목적과 그 뒤에 바뀐 목적', '', purp.length ? purp.map(decBlock).join('\n') : '목적 기록 없음\n');
  out.push('## 2. 왜 — 진단', '', diag.length ? diag.map(decBlock).join('\n') : '진단 기록 없음\n');
  // 3 결정 (목적·진단 밖) — 한눈 표 + 하나씩
  const rest = decs.filter((d) => !['purpose', 'diagnosis'].includes(d.type));
  out.push('## 3. 결정과 바뀐 이유 (시간순)', '', '목적·진단을 포함한 모든 결정:', '', '| 결정 | 날짜 | 누가 | 종류 | 무엇 | 닿는 작업 |', '|---|---|---|---|---|---|',
    ...decs.map((d) => `| ${d.id} | ${d.at} | ${by(d.by)} | ${DECISION_TYPES[d.type]} | ${cell(d.title)} | ${(d.affects || []).length} |`), '', rest.map(decBlock).join('\n'));
  // 4 작업
  out.push('## 4. 작업 — 결과와 걸어온 길', '', ...S.notes.filter((n) => n.plan === plan && n.place === 'work').map((n) => n.text), '');
  for (const part of S.parts.filter((p) => p.plan === plan)) {
    const xs = items.filter((x) => x.part === part.title);
    out.push(`### ${part.title}`, '', ...(part.note || []), ...(part.note ? [''] : []), '| # | 번호 | 작업 | 상태 |', '|---|---|---|---|',
      ...xs.map((x) => `| ${x.n} | ${x.id} | ${cell(titleOf(x))} | ${x.mark}${x.at ? ' ' + x.at : ''} |`), '');
    for (const x of xs) {
      const pieces = resultPieces(S, x), decx = S.decisions.filter((d) => (d.affects || []).includes(x.id));
      out.push(`#### ${x.n} · ${x.id} — ${titleOf(x)}`, '', ...Object.entries(x.fields).map(([k, v]) => `- **${k}**: ${one(v)}`), `- **상태**: ${x.mark} ${STATE_KO[x.state]}${x.at ? ' ' + x.at : ''}`, '');
      out.push('**결과 (날짜별)**', '', ...(pieces.length ? pieces.map((p) => `- \`${p.at}\` ${p.src}: ${one(p.text) || '(비움)'}${p.replaced ? '\n\n  ' + details('고쳐 쓰기 전 글', one(p.replaced)) : ''}`) : ['- 결과 기록 없음']), '');
      out.push('**걸어온 길**', '', ...pathOf(S, x), '');
      if (decx.length) out.push(`**닿는 결정**: ${decx.map((d) => `${d.id} (${d.at} ${d.title})`).join(' · ')}`, '');
    }
  }
  // 5 종합
  out.push('## 5. 종합 결과와 의의', '');
  const scopes = [...S.parts.filter((p) => p.plan === plan).map((p) => p.title), 'all'];
  for (const sc of scopes) {
    const vs = S.syntheses.filter((s) => s.plan === plan && s.scope === sc), s = vs[vs.length - 1];
    out.push(`### ${sc === 'all' ? '전체' : sc}`, '');
    if (!s) { out.push('종합 기록 없음', ''); continue; }
    out.push(`\`${s.at}\` · ${by(s.by)}`, '', `**결과**: ${s.result}`, '', `**의의**: ${s.meaning}`, '', `근거: ${s.evidence.join(' · ')}`, '');
    if (vs.length > 1) out.push(details(`이전 종합 ${vs.length - 1}`, vs.slice(0, -1).map((v) => `\`${v.at}\` ${by(v.by)} — 결과: ${v.result} / 의의: ${v.meaning}`).join('\n\n')), '');
  }
  // 6 방향
  out.push('## 6. 나아갈 방향', '');
  const dirs = S.directions.filter((d) => d.plan === plan);
  if (!dirs.length) out.push('방향 기록 없음', '');
  for (const d of dirs) out.push(`### ${d.id} — ${d.text}`, '', `\`${d.at}\` · ${by(d.by)} · ${{ open: '갈 길', taken: '가는 중·감', dropped: '그만둠' }[d.state]}`, '', `**왜**: ${d.why}`, '', ...((d.first || []).length ? [`**먼저 할 것**: ${d.first.map((a) => itemLine(S, a)).join(' · ')}`, ''] : []), `근거: ${d.evidence.join(' · ')}`, '');
  // 7 열린 질문
  out.push('## 7. 열린 질문', '');
  const os = S.opens.filter((o) => o.plan === plan);
  out.push(...(os.length ? os.map((o) => `- ${o.text}${o.resolved ? ` — **풀림** \`${o.resolved.at}\` ${by(o.resolved.by)}: ${o.resolved.how}${(o.resolved.refs || []).length ? ` (${o.resolved.refs.join(' · ')})` : ''}` : ' — 열림'}`) : ['없음']), '');
  // 8 지표 등 글
  for (const n of S.notes.filter((n) => n.plan === plan && n.place !== 'work')) out.push(`## ${n.title}`, '', n.text, '');
  // 9 근거 점검 (계산)
  const count = (st) => items.filter((x) => x.state === st).length, ev = S.log.filter((e) => e.plan === plan);
  const noResult = items.filter((x) => x.state === 'done' && !x.result).map((x) => x.id);
  const openAffected = [...new Set(decs.flatMap((d) => d.affects || []))].filter((a) => { const x = S.items.find((y) => y.id === a); return x && x.state === 'open'; });
  out.push('## 근거 점검 (계산 — 원본에서 센 것)', '',
    `- 작업 ${items.length}: ${Object.keys(STATE_KO).map((k) => [k, count(k)]).filter(([, n]) => n).map(([k, n]) => `${MARK[k]} ${STATE_KO[k]} ${n}`).join(' · ')}`,
    `- 걸어온 길: 사건 ${ev.length} (git 역사 ${ev.filter((e) => e.source === 'git').length} — 커밋 ${P.import.commits} 개, \`${P.import.until.slice(0, 7)}\` ${P.import.at} 까지 · 그 뒤 ${ev.filter((e) => e.source !== 'git').length})`,
    `- 결정 ${decs.length} — 누가: ${Object.keys(BY).map((k) => [k, decs.filter((d) => d.by === k).length]).filter(([, n]) => n).map(([k, n]) => `${BY[k]} ${n}`).join(' · ')}`,
    `- 완료인데 결과 글이 없는 작업: ${noResult.length ? noResult.join(' · ') : '없음'}`,
    `- 결정이 닿는데 아직 대기인 작업: ${openAffected.length ? openAffected.join(' · ') : '없음'}`,
    `- 옛 문서에서 고친 깨진 곳: ${(P.import.repairs || []).length ? P.import.repairs.join(' / ') : '없음'}`, '');
  return out.join('\n');
}

// ── 고치기 — 변경 묶음 { at, why, ops[] } → 새 기록·새 사건. 작업이 바뀌면 사건이 붙고, 다른 기록은 at·updates 로 남는다
//   op: state {id, state, at?} · result {id, append | set} · scope {id, field, to} · add {item, after?} · remove {id}
//       decide {decision} · decision-update {id, update:{at?, text, refs}} · synthesis {synthesis} (덧붙임 — 이전 판은 남음)
//       direction {direction} (같은 번호면 바꿈) · open {open} · resolve {text, resolved}
export function apply(S, change) {
  const errs = [], at = change.at, why = String(change.why || '').trim();
  if (!DATE.test(at || '')) errs.push('변경 묶음 at 은 YYYY-MM-DD');
  if (!why) errs.push('변경 묶음 why 가 없음 — 왜 바꾸는지 한 줄');
  const recs = S.recs.map((r) => JSON.parse(JSON.stringify(r))), log = S.log.slice();
  const ev = (x, change2, rest) => log.push({ seq: log.length + 1, plan: x.plan, at, item: x.id, label: x.n, change: change2, ...rest, why: change.why_detail ? `${why} — ${change.why_detail}` : why, source: 'apply' });
  const item = (id) => { const x = recs.find((r) => r.kind === 'item' && r.id === id); if (!x) errs.push(`작업 '${id}' 없음`); return x; };
  for (const op of change.ops || []) {
    if (op.op === 'state') { const x = item(op.id); if (!x) continue; if (!MARK[op.state]) { errs.push(`상태 '${op.state}'`); continue; }
      const from = { state: x.state, mark: x.mark, at: x.at }; x.state = op.state; x.mark = MARK[op.state]; x.at = op.at === undefined ? at : op.at; ev(x, 'state', { from, to: { state: x.state, mark: x.mark, at: x.at } }); }
    else if (op.op === 'result') { const x = item(op.id); if (!x) continue;
      if (op.set !== undefined) { x.result = op.set; ev(x, 'result', { set: op.set }); } else { x.result = (x.result || '') + op.append; ev(x, 'result', { append: op.append }); } }
    else if (op.op === 'scope') { const x = item(op.id); if (!x) continue; const from = x.fields[op.field] ?? null; if (op.to == null) delete x.fields[op.field]; else x.fields[op.field] = op.to; ev(x, 'scope', { field: op.field, from, to: op.to ?? null }); }
    else if (op.op === 'add') { const x = { kind: 'item', ...op.item }; const i = op.after ? recs.findIndex((r) => r.kind === 'item' && r.id === op.after) : recs.map((r) => r.kind).lastIndexOf('item');
      if (i < 0) { errs.push(`'${op.after}' 뒤에 넣을 수 없음`); continue; } recs.splice(i + 1, 0, x); ev(x, 'added', { part: x.part, fields: x.fields, state: x.state, mark: x.mark, state_at: x.at, result: x.result ?? null }); }
    else if (op.op === 'remove') { const x = item(op.id); if (!x) continue; recs.splice(recs.indexOf(x), 1); ev(x, 'removed', {}); }
    else if (op.op === 'decide') recs.splice(recs.map((r) => r.kind).lastIndexOf('decision') + 1, 0, { kind: 'decision', ...op.decision });
    else if (op.op === 'decision-update') { const d = recs.find((r) => r.kind === 'decision' && r.id === op.id); if (!d) { errs.push(`결정 '${op.id}' 없음`); continue; } (d.updates = d.updates || []).push({ at, ...op.update }); }
    else if (op.op === 'synthesis') recs.push({ kind: 'synthesis', at, ...op.synthesis });
    else if (op.op === 'direction') { const i = recs.findIndex((r) => r.kind === 'direction' && r.id === op.direction.id); const d = { kind: 'direction', at, ...op.direction }; if (i >= 0) recs[i] = d; else recs.push(d); }
    else if (op.op === 'open') recs.push({ kind: 'open', ...op.open });
    else if (op.op === 'resolve') { const o = recs.find((r) => r.kind === 'open' && r.text === op.text); if (!o) { errs.push(`열린 질문 '${op.text}' 없음`); continue; } o.resolved = op.resolved; }
    else errs.push(`모르는 op '${op.op}'`);
  }
  const of = (k) => recs.filter((r) => r.kind === k);
  return { errs, S: { recs, log, plans: of('plan'), decisions: of('decision'), parts: of('part'), notes: of('note'), items: of('item'), syntheses: of('synthesis'), directions: of('direction'), opens: of('open') } };
}
export const serialize = (S) => ({ plans: S.recs.map((r) => JSON.stringify(r)).join('\n') + '\n', log: S.log.map((r) => JSON.stringify(r)).join('\n') + '\n' });

// ── 읽기 모드 (rebuild/read.mjs 가 부름) — 계획 번호 하나를 L0 한 줄 · L1 연결 · L2 전부로. 기록에서만
export function readOne(S, id, depth = 2) {
  const x = S.items.find((y) => y.id === id), d = S.decisions.find((y) => y.id === id), r = S.directions.find((y) => y.id === id), o = [];
  if (x) {
    o.push(`${x.id} (${x.plan} ${x.n}) ${titleOf(x)} — ${x.mark} ${STATE_KO[x.state]}${x.at ? ' ' + x.at : ''}`);
    if (depth < 1) return o.join('\n') + '\n';
    o.push(`  부: ${x.part}`, ...Object.entries(x.fields).map(([k, v]) => `  ${k}: ${one(v)}`));
    const decs = S.decisions.filter((y) => (y.affects || []).includes(x.id)), dirs = S.directions.filter((y) => (y.first || []).includes(x.id));
    o.push(`  닿는 결정: ${decs.map((y) => `${y.id} ${y.at} ${y.title}`).join(' · ') || '없음'}`, `  방향: ${dirs.map((y) => `${y.id} ${y.text}`).join(' · ') || '없음'}`);
    if (depth < 2) { o.push(`  결과: ${one(x.result) || '결과 기록 없음'}`); return o.join('\n') + '\n'; }
    o.push('  결과 (날짜별):', ...(resultPieces(S, x).map((p) => `    ${p.at} ${p.src}: ${one(p.text)}${p.replaced ? `\n      (고쳐 쓰기 전: ${one(p.replaced)})` : ''}`)), '  걸어온 길:', ...pathOf(S, x).map((l) => '    ' + l.replace(/^- /, '').replace(/\n[\s\S]*$/, '')));
    return o.join('\n') + '\n';
  }
  if (d) {
    o.push(`${d.id} ${d.at} — ${d.title}`);
    if (depth < 1) return o.join('\n') + '\n';
    o.push(`  ${by(d.by)}${d.by_src ? ` (${d.by_src})` : ''} · ${DECISION_TYPES[d.type]} · 계획 ${d.plans.join(' · ')}${d.was ? ` · 옛 문서의 ${d.was}` : ''}${d.src && d.src.commit ? ` · 처음 적힌 커밋 ${d.src.commit.slice(0, 7)}` : ''}`, `  닿는 작업: ${(d.affects || []).map((a) => itemLine(S, a)).join(' · ') || '없음'}`, ...(d.updates || []).map((u) => `  뒤에 일어난 일 ${u.at}: ${u.text}`));
    if (depth >= 2) o.push('  원문:', ...d.text.split('\n').map((l) => '    ' + l), ...(d.first && d.first.text ? ['  처음 적힌 글 (' + d.first.at + '):', ...d.first.text.split('\n').map((l) => '    ' + l)] : []));
    return o.join('\n') + '\n';
  }
  if (r) {
    o.push(`${r.id} — ${r.text}`);
    if (depth < 1) return o.join('\n') + '\n';
    o.push(`  ${r.at} · ${by(r.by)} · ${r.state}`, `  왜: ${r.why}`, `  먼저 할 것: ${(r.first || []).map((a) => itemLine(S, a)).join(' · ') || '없음'}`);
    if (depth >= 2) o.push(`  근거: ${r.evidence.join(' · ')}`);
    return o.join('\n') + '\n';
  }
  return null;
}
