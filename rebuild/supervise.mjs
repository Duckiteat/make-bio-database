#!/usr/bin/env node
// 감독 장부 (PLAN-100 · 설계 docs/design/supervisor.md · DEC-0064–0070) — 상위 작업(SUP-…)과 실행 기록(run, SUP-…/r…)의 덧붙이기 장부.
//   node rebuild/supervise.mjs status [SUP-…]                          지금 상태 (장부를 접은 것 — 읽기만)
//   node rebuild/supervise.mjs check                                   장부 검사만
//   node rebuild/supervise.mjs <propose|start|handoff|block|cancel> <사건.json> [--dry] [--human <이름>]
// 계약: load 는 읽기만, check · fold · admit 는 값만 돌려준다(순수). 파일 쓰기는 입법 서기(appendSupervise)만.
// 정한 것 (설계 §3 · §4 · §5):
//   · 승인 사건은 없다 — 승인 · 반영 · 완료는 증거에서 계산한다(PLAN-102). 모르는 사건 이름은 거부한다(approve 포함).
//   · 계약에 쓸 수 있는 범위 · 승인자 칸을 두지 않는다 — 범위는 모드에서 계산(RULE-0461: 적는 쪽이 넓히지 못하게).
//   · 누가 · 어느 모드 · 문지기가 걸렸나(by · mode · enforcement)는 입력으로 받지 않고 이 세션의 영수증에서 읽는다.
//     영수증이 없으면(훅 없는 실행) --human <이름> 으로만 적을 수 있고 enforcement 가 "없음" 으로 남는다.
//   · 사건 번호는 순번이 아니라 <세션 꼬리>-<차례> — 두 브랜치가 장부를 합쳐도 겹치지 않는다(가상 실행 F8). 상위 작업 번호(SUP-)가
//     양쪽에서 겹치면 검사가 잡는다.
//   · Supervisor 세션은 아무것도 쓰지 않는다(DEC-0065 ①) — 실행 세션이 자기 run 의 사건만, 사용자가 시작한 세션이 propose · cancel 을.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as CLERK from '../legislative/clerk.mjs';
import { MODES, liveRoot, readReceipt } from './gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LEDGER = CLERK.SUPERVISE;
export const EVENTS = ['propose', 'start', 'handoff', 'block', 'cancel'];
export const EXECUTORS = ['claude-code', 'human'];
export const CAUSES = ['FINDING', 'DATA_GAP', 'DOMAIN_CONFLICT', 'NUMERICAL', 'ENGINE_DEFECT', 'COMPILER_DEFECT', 'EXEC_FAILURE'];
export const MAX_ATTEMPTS = 3; // 같은 모드의 run — 처음 1 + 재시도 2 (DEC-0065 ⑤)
const COMMON = ['id', 'at', 'ev', 'sup', 'by', 'why'];
// 사건마다 받는 칸 — 그 밖의 칸은 거부 (범위 · 승인 칸을 끼워 넣지 못하게)
export const FIELDS = {
  propose: ['plan_item', 'purpose', 'inputs', 'steps', 'done_when', 'decision'],
  start: ['run', 'mode', 'enforcement', 'branch', 'base', 'decision'],
  handoff: ['run', 'transition_seq', 'verify', 'outputs'],
  block: ['run', 'cause'],
  cancel: ['decision'],
};
// 입력으로 받는 칸 (나머지는 이 도구가 계산해 채운다)
const INPUT = {
  propose: ['plan_item', 'purpose', 'inputs', 'steps', 'done_when', 'decision', 'why'],
  start: ['sup', 'mode', 'branch', 'base', 'decision', 'why'],
  handoff: ['sup', 'transition_seq', 'verify', 'outputs', 'why'],
  block: ['sup', 'cause', 'why'],
  cancel: ['sup', 'decision', 'why'],
};
const SUP_RE = /^SUP-\d{4}$/, RUN_RE = /^SUP-\d{4}\/r\d+$/, ID_RE = /^([a-z0-9][a-z0-9-]{1,40})-(\d+)$/, DEC_RE = /^DEC-\d{4}$/;
const ITEM_RE = /^(?:PLAN-(?:\d{3}[ap]?|H\d{2})|STG-\d{2}[a-z]*p*|ASY-\d{2})$/, ID_ANY = /^(?:[TDSOLV]\d{6}|A\d{6}|RULE-\d{4})$/;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const str = (x) => typeof x === 'string' && x.trim().length > 0;
const fmtSup = (n) => `SUP-${String(n).padStart(4, '0')}`;

// ── 읽기 ──────────────────────────────────────────────────────────────────
const jsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l, i) => { try { return JSON.parse(l); } catch { return { __bad: i + 1 }; } }) : []);
export const load = (root = ROOT) => jsonl(join(root, LEDGER));
// 참조 (계획 작업 · 결정 · 전환 순번) — 검사가 번호를 대조할 때 쓴다
export function refs(root = ROOT) {
  const plans = jsonl(join(root, 'rebuild/state/plans.jsonl'));
  return {
    items: new Set(plans.filter((r) => r.kind === 'item').map((r) => r.id)),
    decisions: new Set(plans.filter((r) => r.kind === 'decision').map((r) => r.id)),
    transitions: new Set(jsonl(join(root, 'workspace/transitions.jsonl')).map((t) => t.seq)),
    files: (p) => existsSync(join(root, p)),
  };
}
// 이 세션 — 문지기 영수증에서 (가장 최근에 움직인 영수증 · 그 영수증의 열린 모드). 입력으로 받지 않는다.
export function sessionFromReceipts(root = ROOT) {
  const d = join(liveRoot(root), 'workspace/receipts');
  if (!existsSync(d)) return null;
  const names = readdirSync(d).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f, t: statSync(join(d, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { f } of names) {
    const name = f.slice(0, -'.jsonl'.length), evs = readReceipt(liveRoot(root), name), open = evs.find((e) => e.t === 'open');
    if (open) return { tag: name.replace(/^\d{4}-\d{2}-\d{2}-/, '').toLowerCase(), mode: open.mode, executor: 'claude-code', enforcement: { hooks: true, receipts: true }, receipt: name };
  }
  return null;
}

// ── 판단 (순수) ───────────────────────────────────────────────────────────
// 사건 하나의 모양 — 칸 · 값의 형식만 (번호 대조와 순서 규칙은 fold)
function shape(e, R) {
  const E = [];
  if (!isObj(e)) return ['사건이 JSON 객체가 아님'];
  if (!EVENTS.includes(e.ev)) return [`모르는 사건 '${e.ev}' — ${EVENTS.join(' · ')} 만 (승인 사건은 없다 — 승인은 증거에서 계산)`];
  const allowed = new Set([...COMMON, ...FIELDS[e.ev]]);
  const extra = Object.keys(e).filter((k) => !allowed.has(k));
  if (extra.length) E.push(`받지 않는 칸 ${extra.join(', ')} (범위 · 승인은 계약에 적지 않는다)`);
  if (!ID_RE.test(e.id || '')) E.push(`사건 번호 '${e.id}' — <세션 꼬리>-<차례>`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(e.at || '')) E.push('at 은 ISO 시각 (UTC)');
  if (!SUP_RE.test(e.sup || '')) E.push(`상위 작업 번호 '${e.sup}' — SUP-0000`);
  if (!str(e.why)) E.push('why 가 없음 — 왜 한 줄');
  if (!isObj(e.by) || !EXECUTORS.includes(e.by.executor) || !str(e.by.session)) E.push(`by — { executor: ${EXECUTORS.join('|')}, session }`);
  const dec = (need) => { if (e.decision === undefined) { if (need) E.push('사용자 결정 번호(decision)가 없음'); return; } if (!DEC_RE.test(e.decision) || (R && !R.decisions.has(e.decision))) E.push(`결정 '${e.decision}' 이 계획 장부에 없음`); };
  if (e.ev === 'propose') {
    if (!ITEM_RE.test(e.plan_item || '') || (R && !R.items.has(e.plan_item))) E.push(`계획 작업 '${e.plan_item}' 이 계획 장부에 없음`);
    if (!str(e.purpose)) E.push('purpose 가 없음');
    if (!str(e.done_when)) E.push('done_when 이 없음');
    if (!Array.isArray(e.steps) || !e.steps.length || e.steps.some((m) => !MODES.includes(m))) E.push(`steps — 모드 목록 (${MODES.join(' · ')})`);
    if (!isObj(e.inputs)) E.push('inputs — { transitions, files, ids }');
    else {
      for (const k of Object.keys(e.inputs)) if (!['transitions', 'files', 'ids'].includes(k)) E.push(`inputs.${k} — transitions · files · ids 만`);
      for (const s of e.inputs.transitions || []) if (R && !R.transitions.has(s)) E.push(`inputs.transitions ${s} — 전환 기록에 없음`);
      for (const p of e.inputs.files || []) if (!str(p) || p.startsWith('/') || p.split('/').includes('..') || (R && !R.files(p))) E.push(`inputs.files '${p}' — 없거나 저장소 상대 경로가 아님`);
      for (const i of e.inputs.ids || []) if (!ID_ANY.test(String(i))) E.push(`inputs.ids '${i}' — T · D · S · O · L · V · A · RULE 번호만`);
    }
    dec(true);
  }
  if (e.ev === 'start') {
    if (!RUN_RE.test(e.run || '') || !String(e.run).startsWith(e.sup + '/')) E.push(`run '${e.run}' — ${e.sup}/r<차례>`);
    if (!MODES.includes(e.mode)) E.push(`mode '${e.mode}'`);
    if (!isObj(e.enforcement) || typeof e.enforcement.hooks !== 'boolean' || typeof e.enforcement.receipts !== 'boolean') E.push('enforcement — { hooks, receipts } (도구가 영수증에서 채움)');
    if (!str(e.branch)) E.push('branch 가 없음');
    if (e.base !== undefined && !/^[0-9a-f]{7,40}$/.test(e.base)) E.push(`base '${e.base}' — 커밋 해시`);
    dec(false);
  }
  if (e.ev === 'handoff') {
    if (!RUN_RE.test(e.run || '')) E.push(`run '${e.run}'`);
    if (!Number.isInteger(e.transition_seq) || (R && !R.transitions.has(e.transition_seq))) E.push(`transition_seq ${e.transition_seq} — 전환 기록에 없음 (넘기기 전에 dbtool transition)`);
    if (!isObj(e.verify) || e.verify.finish !== 'pass') E.push("verify.finish 가 'pass' 가 아님 — 끝내기 검사(gate finish <모드> --full)를 통과한 뒤에 넘긴다");
    if (!isObj(e.outputs) || !Array.isArray(e.outputs.commits) || !e.outputs.commits.length || e.outputs.commits.some((c) => !/^[0-9a-f]{7,40}$/.test(c))) E.push('outputs.commits — 커밋 해시 목록');
  }
  if (e.ev === 'block') {
    if (e.run !== undefined && !RUN_RE.test(e.run)) E.push(`run '${e.run}'`);
    if (!CAUSES.includes(e.cause)) E.push(`cause — ${CAUSES.join(' · ')}`);
  }
  if (e.ev === 'cancel') dec(true);
  return E;
}

// 사건을 차례로 접어 상위 작업마다 지금 상태를 만든다 — 순서 규칙 위반은 오류로 모은다.
//   순서: 시각(at) → 사건 번호. 파일 줄 순서와 무관하다(두 브랜치를 합쳐 줄이 섞여도 같은 결과).
export function fold(events, R) {
  const errors = [], sups = new Map(), byTag = new Map(), seen = new Set();
  const sorted = events.map((e, i) => ({ e, i })).sort((a, b) => (a.e.at < b.e.at ? -1 : a.e.at > b.e.at ? 1 : String(a.e.id) < String(b.e.id) ? -1 : 1));
  for (const { e, i } of sorted) {
    const where = `사건 ${e && e.id ? e.id : '#' + (i + 1)}`;
    if (e && e.__bad) { errors.push(`줄 ${e.__bad}: JSON 아님`); continue; }
    const bad = shape(e, R);
    if (bad.length) { errors.push(...bad.map((m) => `${where}: ${m}`)); continue; }
    if (seen.has(e.id)) { errors.push(`${where}: 사건 번호 겹침`); continue; }
    seen.add(e.id);
    const [, tag, n] = e.id.match(ID_RE);
    (byTag.get(tag) || byTag.set(tag, []).get(tag)).push(Number(n));
    if (tag !== e.by.session) errors.push(`${where}: 사건 번호의 세션 꼬리 '${tag}' ≠ by.session '${e.by.session}'`);
    const s = sups.get(e.sup);
    if (e.ev === 'propose') {
      if (s) { errors.push(`${where}: 상위 작업 ${e.sup} 가 이미 있음 — 번호 겹침 (두 브랜치가 같은 번호를 만들었을 수 있음, PLAN-111)`); continue; }
      sups.set(e.sup, { id: e.sup, plan_item: e.plan_item, purpose: e.purpose, steps: e.steps, done_when: e.done_when, decision: e.decision, proposed_by: e.by, state: 'planned', runs: [], active: null, last: e.at, blocked: null, events: [e.id] });
      continue;
    }
    if (!s) { errors.push(`${where}: 상위 작업 ${e.sup} 가 없음 (propose 먼저)`); continue; }
    s.events.push(e.id); s.last = e.at;
    if (s.state === 'cancelled') { errors.push(`${where}: ${e.sup} 는 취소됨`); continue; }
    if (e.ev === 'start') {
      if (s.active) { errors.push(`${where}: ${e.sup} 에 진행 중인 실행 ${s.active} 가 있음 — 중복 실행`); continue; }
      if (s.state === 'blocked' && !e.decision) { errors.push(`${where}: 막힌 ${e.sup} 를 다시 시작하려면 사용자 결정 번호(decision)`); continue; }
      const k = s.runs.length + 1;
      if (e.run !== `${e.sup}/r${k}`) { errors.push(`${where}: run 은 ${e.sup}/r${k} 이어야 함`); continue; }
      if (!s.steps.includes(e.mode)) errors.push(`${where}: 모드 ${e.mode} 는 이 상위 작업의 steps(${s.steps.join(' → ')})에 없음`);
      const same = s.runs.filter((r) => r.mode === e.mode).length;
      if (same >= MAX_ATTEMPTS) { errors.push(`${where}: ${e.mode} 실행이 이미 ${same} 번 — 재시도 한도(처음 1 + 2) 넘김, 막힘으로`); continue; }
      if (e.mode === 'inspect') { const own = s.runs.filter((r) => r.mode !== 'inspect' && r.session === e.by.session); if (own.length) { errors.push(`${where}: inspect 세션이 ${own.map((r) => r.run).join(' · ')} 를 만든 세션과 같음 — 독립 검토가 아님 (하위 에이전트도 같은 세션)`); continue; } }
      s.runs.push({ run: e.run, mode: e.mode, executor: e.by.executor, session: e.by.session, enforcement: e.enforcement, branch: e.branch, base: e.base || null, started: e.at, ended: null, transition_seq: null, outputs: null, result: 'running' });
      s.active = e.run; s.state = 'running'; s.blocked = null;
      continue;
    }
    if (e.ev === 'handoff' || (e.ev === 'block' && e.run)) {
      const r = s.runs.find((x) => x.run === e.run);
      if (!r) { errors.push(`${where}: 실행 ${e.run} 가 없음`); continue; }
      if (s.active !== e.run) { errors.push(`${where}: 실행 ${e.run} 는 진행 중이 아님`); continue; }
      if (r.session !== e.by.session) { errors.push(`${where}: 실행 ${e.run} 를 시작한 세션(${r.session})만 그 실행의 사건을 적는다`); continue; }
      r.ended = e.at;
      if (e.ev === 'handoff') { r.transition_seq = e.transition_seq; r.outputs = e.outputs; r.result = 'handed_off'; s.active = null; }
      else { r.result = 'blocked'; s.active = null; s.state = 'blocked'; s.blocked = { cause: e.cause, why: e.why, at: e.at }; }
      continue;
    }
    if (e.ev === 'block') { if (s.active) { errors.push(`${where}: 진행 중인 실행 ${s.active} 가 있으면 그 실행으로 막는다 (run 칸)`); continue; } s.state = 'blocked'; s.blocked = { cause: e.cause, why: e.why, at: e.at }; continue; }
    if (e.ev === 'cancel') { if (s.active) { errors.push(`${where}: 진행 중인 실행 ${s.active} 가 있음 — 먼저 막거나 넘긴다`); continue; } s.state = 'cancelled'; continue; }
  }
  // 세션마다 차례가 1 부터 빠짐없이 (사건을 지우거나 끼워 넣지 않았나)
  for (const [tag, ns] of byTag) { const want = ns.slice().sort((a, b) => a - b); if (want.some((v, i) => v !== i + 1)) errors.push(`세션 ${tag} 의 사건 차례가 1…${want.length} 가 아님 (${want.join(',')})`); }
  return { errors, sups: [...sups.values()] };
}
export const check = (events, R) => fold(events, R).errors;

// 입력 하나 → 사건 하나 (번호 · 시각 · 누가 · 문지기 칸을 채움). 장부에 붙였을 때 검사가 통과해야 돌려준다.
//   who = { tag, mode, executor, enforcement } — 영수증에서 (sessionFromReceipts) 또는 --human
export function admit(events, ev, input, who, R, now = new Date().toISOString()) {
  if (!EVENTS.includes(ev)) return { errors: [`모르는 사건 '${ev}' — ${EVENTS.join(' · ')} 만 (승인 사건은 없다)`] };
  if (!isObj(input)) return { errors: ['입력이 JSON 객체가 아님'] };
  const extra = Object.keys(input).filter((k) => !INPUT[ev].includes(k));
  if (extra.length) return { errors: [`입력에 받지 않는 칸 ${extra.join(', ')} — 받는 칸: ${INPUT[ev].join(' · ')} (누가 · 모드 · 문지기 칸은 이 도구가 영수증에서 채운다)`] };
  if (!who || !str(who.tag)) return { errors: ['이 세션을 알 수 없음 — 모드를 연 세션(영수증)에서 부르거나, 훅 없는 실행이면 --human <이름>'] };
  const { sups } = fold(events, R);
  const mine = events.filter((e) => { const m = e && typeof e.id === 'string' && e.id.match(ID_RE); return m && m[1] === who.tag; }).length;
  const e = { id: `${who.tag}-${mine + 1}`, at: now, ev, by: { executor: who.executor, session: who.tag }, ...input };
  if (ev === 'propose') {
    const max = sups.reduce((m, s) => Math.max(m, Number(s.id.slice(4))), 0);
    e.sup = fmtSup(max + 1);
  }
  if (ev === 'start') {
    if (input.mode !== undefined && input.mode !== who.mode) return { errors: [`입력 mode '${input.mode}' 가 이 세션의 열린 모드 '${who.mode}' 와 다름 — 실행은 연 모드로만`] };
    e.mode = who.mode;
    if (!MODES.includes(e.mode)) return { errors: ['이 세션에 열린 모드가 없음 — node rebuild/gate.mjs open <모드> 먼저 (훅 없는 실행은 입력 mode 를 적는다)'] };
    e.enforcement = who.enforcement;
    const s = sups.find((x) => x.id === input.sup);
    e.run = `${input.sup}/r${s ? s.runs.length + 1 : 1}`;
  }
  if (ev === 'handoff' || ev === 'block') {
    const s = sups.find((x) => x.id === input.sup);
    if (s && s.active) e.run = s.active;
  }
  const order = ['id', 'at', 'ev', 'sup', 'run', 'by', 'mode', 'enforcement', ...FIELDS[ev].filter((k) => !['run', 'mode', 'enforcement'].includes(k)), 'why'];
  const out = Object.fromEntries(order.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
  const errors = check([...events, out], R);
  return errors.length ? { errors } : { event: out };
}

// ── 보기 ──────────────────────────────────────────────────────────────────
const NEXT = { planned: '첫 실행을 기다림', running: '진행 중', blocked: '막힘 — 사람이 봐야 함', cancelled: '취소됨' };
export function render(sups) {
  if (!sups.length) return '감독 장부 — 상위 작업 없음';
  const cell = (x) => String(x ?? '').replace(/\|/g, '\\|');
  const L = ['| 상위 작업 | 계획 작업 | 상태 | 실행 | 지금 |', '|---|---|---|---|---|'];
  for (const s of sups) {
    const runs = s.runs.map((r) => `${r.run.split('/')[1]} ${r.mode}·${r.executor}${r.enforcement && !r.enforcement.hooks ? '(문지기 없음)' : ''}·${r.result}`).join(' → ') || '—';
    const now = s.state === 'running' && !s.active ? `다음 실행을 기다림 (steps ${s.steps.join(' → ')})` : s.state === 'blocked' ? `막힘 ${s.blocked.cause}: ${s.blocked.why}` : NEXT[s.state];
    L.push(`| ${s.id} | ${s.plan_item} | ${s.state} | ${cell(runs)} | ${cell(now)} |`);
  }
  L.push('', '승인 대기 · 반영 · 완료는 증거에서 계산한다 (PLAN-102 — 아직 계산하지 않음).');
  return L.join('\n');
}

// ── 명령 ──────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const events = load(), R = refs();
  if (cmd === 'check') { const e = check(events, R); console.log(e.length ? e.join('\n') : `감독 장부 정확 — 사건 ${events.length} · 오류 0`); process.exit(e.length ? 1 : 0); }
  if (cmd === 'status') { const f = fold(events, R); const sel = file ? f.sups.filter((s) => s.id === file) : f.sups; console.log(render(sel)); if (f.errors.length) console.log(`\n장부 오류 ${f.errors.length}:\n- ${f.errors.join('\n- ')}`); process.exit(f.errors.length ? 1 : 0); }
  if (!EVENTS.includes(cmd) || !file) { console.error(`사용: node rebuild/supervise.mjs status [SUP-…] · check · <${EVENTS.join('|')}> <사건.json> [--dry] [--human <이름>]`); process.exit(2); }
  let input; try { input = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`입력 JSON 을 읽지 못함: ${e.message}`); process.exit(2); }
  const hi = rest.indexOf('--human');
  let who = sessionFromReceipts();
  if (hi >= 0) {
    const name = String(rest[hi + 1] || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(name)) { console.error('--human <이름> — 소문자 · 숫자 · 하이픈'); process.exit(2); }
    if (who) { console.error('이 세션에는 문지기 영수증이 있다 — --human 은 훅 없는 실행에서만 (영수증의 세션으로 적힌다)'); process.exit(2); }
    who = { tag: 'human-' + name, mode: input.mode, executor: 'human', enforcement: { hooks: false, receipts: false } };
  }
  const r = admit(events, cmd, input, who, R);
  if (r.errors) { console.error(`거부 — ${r.errors.length}:\n- ${r.errors.join('\n- ')}`); process.exit(1); }
  console.log(JSON.stringify(r.event));
  if (rest.includes('--dry')) { console.log('(--dry — 쓰지 않음)'); process.exit(0); }
  CLERK.appendSupervise([JSON.stringify(r.event)]);
  console.log(`씀 (입법 서기): ${LEDGER}`);
}
