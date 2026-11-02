// 승인 묶음 판정 (STG-12 · 승인 묶음 설계 보고서) — L6 변경을 분류하고, 승인 화면과 지문을 만든다.
// 계약: 순수 — 값만 받고 값만 돌려준다 (읽기·쓰기·실행 없음, 사법부). 쓰기는 서기, 버튼(적용기)은 L6 라 사람이 승인한 묶음으로 따로.
//   classify({ path, before, after, role }) → { kind, reasons[] }   role: 'settings'(설정 권한 목록) · 'modes'(문지기 모드 표) · 'guard'(문지기 코드) — 호출자가 저장 지도에서 넘긴다 (이 모듈은 자리 이름을 모른다)
//     kind: 'added_only'(줄만 더함) · 'changed'(승인 필요) · 'widened'(권한을 넓힘 — 거부) · 'loosened'(검사를 느슨하게 — 거부) · 'unreviewable'(검토할 수 없음 — 거부)
//   decide(changes) → { auto[], approve[], refused[] }   자동 통과 · 사람 승인 필요 · 눌러도 거부
//   digest(changes) → sha256 (파일 목록 + 바뀐 뒤 바이트의 지문)   screen(changes, areaOf) → 승인 화면 글
import { createHash } from 'node:crypto';

const RULE = 'RULE-0461'; // 권한을 넓히는 길은 설정에 적힌 standing 권한뿐 — 이 판정이 막는 이유
const R = 'RULE-0528'; // 승인 묶음: 눌러도 거부되는 것 — 거부 문장 앞에 붙는 규칙 번호
const tag = (xs) => xs.map((x) => `${R} ${x}`);
export const LIMITS = { maxChangedLines: 400, maxLineLength: 2000 };
// 자동 통과 — 끔. 줄만 더하는 변경도 패턴으로는 속일 수 있고(assert 덮어쓰기 · 빈 순환이 통과) 이득은 7% 뿐이었다 (사후 점검). 켜려면 판정이 속지 않는다는 근거가 먼저.
export const AUTO_PASS = false;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const GUARD_ROLES = new Set(['settings', 'modes', 'guard']); // 문지기 · 설정 · 모드 표: 추가도 권한을 넓힐 수 있음 — 항상 사람
const isSelfTest = (p) => /^tests\/(?:[\w.-]+\.test\.mjs|affected\.mjs|trace\.mjs|snapshot\.mjs|mutation\/run\.mjs)$/.test(p);
const lines = (s) => (s === '' ? [] : s.split('\n'));

// 줄 단위 차이 (순서 보존 최장 공통 부분열 대신 집합 차이로 충분 — 추가만 / 삭제 있음을 가르는 데 쓴다)
function delta(before, after) {
  const b = lines(before), a = lines(after), count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const cb = count(b), ca = count(a), removed = [], added = [];
  for (const [l, n] of cb) for (let i = 0; i < n - (ca.get(l) || 0); i++) removed.push(l);
  for (const [l, n] of ca) for (let i = 0; i < n - (cb.get(l) || 0); i++) added.push(l);
  return { removed, added };
}
const SKIP = /\b(?:test|it|describe)\.(?:skip|todo|only)\b|\{\s*skip\s*:|\bskip\s*:\s*true/;
const ASSERT = /\bassert(?:\.\w+)?\(/;
const numbers = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

// settings.json · modes.json 의 권한이 넓어졌나 — 목록 값이 늘거나(allow · write · also) 막는 목록이 줄면(deny · except · protect)
const asSet = (x) => new Set(Array.isArray(x) ? x : []);
function widened(role, before, after) {
  const why = [];
  const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const b = J(before), a = J(after);
  if (role === 'settings' && b && a) {
    const P = (o) => (o && o.permissions) || {};
    const grow = (k) => [...asSet(P(a)[k])].filter((x) => !asSet(P(b)[k]).has(x));
    const shrink = (k) => [...asSet(P(b)[k])].filter((x) => !asSet(P(a)[k]).has(x));
    for (const x of grow('allow')) why.push(`allow 에 추가: ${x}`);
    for (const x of shrink('deny')) why.push(`deny 에서 제거: ${x}`);
    for (const x of shrink('ask')) if (asSet(P(a).allow).has(x) || !asSet(P(a).deny).has(x)) why.push(`ask 에서 제거(더 묻지 않게 됨): ${x}`);
    for (const x of grow('ask')) if (/^\*$|^Bash$|^Bash\(\*\)$|dangerously|bypass/i.test(x)) why.push(`마스터 권한 모양: ${x}`);
    // 문지기 훅 — 지우거나 바꾸면 문지기가 꺼진다 (추가는 좁히는 쪽). 항목 = 사건 | 매처 | 명령
    const hooks = (o) => new Set(Object.entries((o && o.hooks) || {}).flatMap(([ev, gs]) => (Array.isArray(gs) ? gs : []).flatMap((g) => ((g && g.hooks) || []).map((h) => `${ev} | ${g.matcher || '*'} | ${h.command || h.type}`))));
    const ha = hooks(a);
    for (const x of hooks(b)) if (!ha.has(x)) why.push(`훅이 사라지거나 바뀜: ${x}`);
    // 기본 모드를 묻지 않는 쪽으로 · 작업 폴더를 늘림 · 프로젝트 MCP 서버를 전부 허용
    const dm = (o) => String(P(o).defaultMode || 'default');
    if (dm(a) !== dm(b) && /bypass|acceptEdits|dontAsk|auto/i.test(dm(a))) why.push(`기본 권한 모드가 ${dm(b)} → ${dm(a)} (덜 묻는 쪽)`);
    for (const x of asSet(P(a).additionalDirectories)) if (!asSet(P(b).additionalDirectories).has(x)) why.push(`작업 폴더 추가: ${x}`);
    if (a.enableAllProjectMcpServers === true && b.enableAllProjectMcpServers !== true) why.push('프로젝트 MCP 서버를 전부 허용');
  }
  if (role === 'modes' && b && a && b.gate && a.gate) {
    const lists = (g) => [['common', g.common || {}], ...Object.entries(g.modes || {}), ...Object.entries(g.roles || {})];
    const mb = new Map(lists(b.gate)), ma = new Map(lists(a.gate));
    for (const [k, x] of ma) {
      const y = mb.get(k) || {};
      for (const f of ['write', 'also']) for (const g of asSet(x[f])) if (!asSet(y[f]).has(g)) why.push(`${k}.${f} 에 추가: ${g}`);
      for (const f of ['except', 'protect']) for (const g of asSet(y[f])) if (!asSet(x[f]).has(g)) why.push(`${k}.${f} 에서 제거: ${g}`);
      for (const f of ['finish', 'finish_first']) for (const g of asSet(y[f])) if (!asSet(x[f]).has(g)) why.push(`${k}.${f} 에서 끝내기 전 시험을 줄임: ${g}`);
    }
  }
  return why;
}

// 자동 통과할 수 있는 추가인가 — 새 시험 블록을 통째로(최상위에서 시작해 최상위에서 닫힘, 괄호 균형, 검사 문장 1 개 이상) 더한 것뿐이고
// 위험한 모양(종료 · 건너뛰기 · 에러 삼키기 · 항상 참 · 예외 · 목록 · 바닥값)이 없을 때. 기존 블록 안이나 목록에 줄을 끼우는 것은 사람 승인 (측정: 순수 추가 27 건 중 새 블록 19, 끼움 8, 위험 모양 7)
const RISK = /process\.exit|\.(?:skip|todo|only)\b|catch\s*(?:\([^)]*\))?\s*\{\s*\}|assert\.ok\(\s*(?:true|1)\s*\)|예외|exception|allow|FLOOR|floor|ratchet|new Set\(\[|^\s*['"`][^'"`]*['"`],?\s*$/;
export function unsafeAdditions(before, after) {
  const b = lines(before), a = lines(after), hunks = [];
  let i = 0, j = 0;
  while (j < a.length) { if (i < b.length && a[j] === b[i]) { i++; j++; continue; } const st = j; while (j < a.length && !(i < b.length && a[j] === b[i])) j++; hunks.push([st, j]); }
  const why = [];
  for (const [st, en] of hunks) {
    const h = a.slice(st, en), body = h.join('\n'), nz = h.filter((l) => l.trim());
    const prev = [...a.slice(0, st)].reverse().find((l) => l.trim()) ?? '';
    const bal = (re) => (body.match(re) || []).length;
    if (!nz.length) continue;
    if (!/^(?:test|describe)\(/.test(nz[0]) || !/^\}\);?\s*$/.test(nz[nz.length - 1])) why.push(`${st + 1} 째 줄 근처: 새 시험 블록을 통째로 더한 것이 아님`);
    else if (prev && (/^\s/.test(prev) || /[{(,\[]\s*$/.test(prev))) why.push(`${st + 1} 째 줄 근처: 기존 블록 안에 끼움`);
    else if (bal(/\(/g) !== bal(/\)/g) || bal(/\{/g) !== bal(/\}/g)) why.push(`${st + 1} 째 줄 근처: 괄호가 맞지 않음`);
    else if (!ASSERT.test(body)) why.push(`${st + 1} 째 줄 근처: 검사 문장이 없는 시험`);
    else { const r = h.find((l) => RISK.test(l)); if (r) why.push(`${st + 1} 째 줄 근처: 위험한 모양 — ${r.trim().slice(0, 60)}`); }
  }
  return why;
}

export function classify({ path, before = '', after = '', role = null }) {
  const reasons = [];
  const all = lines(after).concat(lines(before));
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/.test(after)) reasons.push('보이지 않는 제어 문자가 있음');
  if (all.some((l) => l.length > LIMITS.maxLineLength)) reasons.push(`한 줄이 ${LIMITS.maxLineLength} 자를 넘음`);
  const { removed, added } = delta(before, after);
  if (removed.length + added.length > LIMITS.maxChangedLines) reasons.push(`바뀐 줄이 ${LIMITS.maxChangedLines} 을 넘음 — 쪼갠다`);
  if (reasons.length) return { kind: 'unreviewable', reasons: tag(reasons) };
  const w = widened(role, before, after);
  if (w.length) return { kind: 'widened', reasons: tag(w.map((x) => `${RULE}: ${x}`)) };
  if (isSelfTest(path)) {
    const loose = [];
    for (const l of added) if (SKIP.test(l)) loose.push(`시험을 건너뛰게 함: ${l.trim().slice(0, 80)}`);
    const ra = removed.filter((l) => ASSERT.test(l)).length, aa = added.filter((l) => ASSERT.test(l)).length;
    if (ra > aa) loose.push(`검사 문장이 줄어듦 (${ra} 줄 삭제 · ${aa} 줄 추가)`);
    // 바닥값(FLOOR · 상한) 숫자가 내려가거나 상한이 올라간 줄 — 지워진 줄과 더해진 줄의 첫 숫자 비교
    if (/FLOOR|floor|<=\s*\d|>=\s*\d/.test(removed.join('\n') + added.join('\n'))) {
      const rn = removed.filter((l) => /FLOOR|floor/.test(l)).flatMap(numbers), an = added.filter((l) => /FLOOR|floor/.test(l)).flatMap(numbers);
      if (rn.length && an.length && Math.min(...an) < Math.min(...rn)) loose.push('바닥값(FLOOR)이 내려감');
    }
    if (loose.length) return { kind: 'loosened', reasons: tag(loose) };
  }
  if (removed.length === 0 && !GUARD_ROLES.has(role)) {
    if (!isSelfTest(path)) return { kind: 'added_only', reasons: [] };
    const u = unsafeAdditions(before, after);
    return u.length ? { kind: 'changed', reasons: u } : { kind: 'added_only', reasons: [] };
  }
  return { kind: 'changed', reasons: GUARD_ROLES.has(role) ? ['문지기 · 설정 · 모드 표는 추가도 항상 사람 승인'] : [`${removed.length} 줄 삭제`] };
}

export function decide(changes) {
  const out = { auto: [], approve: [], refused: [] };
  for (const c of changes) {
    const r = { path: c.path, ...classify(c) }; // c.role 은 classify 가 읽는다
    if (AUTO_PASS && r.kind === 'added_only' && isSelfTest(c.path)) out.auto.push(r);
    else if (r.kind === 'widened' || r.kind === 'loosened' || r.kind === 'unreviewable') out.refused.push(r);
    else out.approve.push(r);
  }
  return out;
}

// 지문 — 파일 목록(정렬)과 바뀐 뒤 바이트의 지문. 같은 묶음이면 같다
export const digest = (changes) => sha(JSON.stringify([...changes].map((c) => [c.path, sha(c.after ?? '')]).sort((x, y) => (x[0] < y[0] ? -1 : 1))));

// 승인 화면 — 도구가 만든다 (AI 의 요약이 아님). areaOf(path) → { level, area, write_keys } 또는 null
export function screen(changes, areaOf = () => null) {
  const d = decide(changes), id = digest(changes), L = [`지문 ${id}`, `묶음 ${changes.length} 파일 — 자동 ${d.auto.length} · 사람 승인 ${d.approve.length} · 거부 ${d.refused.length}`];
  const sec = (title, rs) => {
    if (!rs.length) return;
    L.push('', `## ${title}`);
    for (const r of rs) {
      const a = areaOf(r.path), c = changes.find((x) => x.path === r.path), { removed, added } = delta(c.before ?? '', c.after ?? '');
      L.push(`- ${r.path}${a ? ` [${a.level} ${a.area} · ${(a.write_keys || []).join(', ')}]` : ''} — ${r.kind}${r.reasons.length ? ': ' + r.reasons.join(' / ') : ''}`);
      for (const l of removed) L.push(`    - ${l}`);
      for (const l of added) L.push(`    + ${l}`);
    }
  };
  sec('거부 — 눌러도 적용되지 않음', d.refused);
  sec('사람 승인 필요', d.approve);
  sec('자동 통과 (검사를 강화하는 추가만)', d.auto);
  return L.join('\n') + '\n';
}
