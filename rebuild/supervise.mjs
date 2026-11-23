#!/usr/bin/env node
// 감독 장부 (PLAN-100 · 설계 docs/design/supervisor.md · DEC-0064–0070) — 상위 작업(SUP-…)과 실행 기록(run, SUP-…/r…)의 덧붙이기 장부.
//   node rebuild/supervise.mjs status [SUP-…]                          지금 상태 (장부를 접은 것 — 읽기만)
//   node rebuild/supervise.mjs check                                   장부 검사만
//   node rebuild/supervise.mjs report <SUP-…>                          승인 보고서 12 칸 · 검수 독립성 · 최종 권고 (계산 — 읽기만, PLAN-116 G2–G4)
//   node rebuild/supervise.mjs evidence <SUP-…>                        승인 판정 · 계산된 상태 (git 읽기만 — 판정은 judicial/supervise_approval.js, PLAN-102)
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
import { execFileSync } from 'node:child_process';
import * as CLERK from '../legislative/clerk.mjs';
import * as AP from '../judicial/supervise_approval.js';
import { MODES, liveRoot, readReceipt } from './gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LEDGER = CLERK.SUPERVISE;
export const EVENTS = ['propose', 'start', 'handoff', 'block', 'cancel'];
export const EXECUTORS = ['claude-code', 'human'];
export const CAUSES = ['FINDING', 'DATA_GAP', 'DOMAIN_CONFLICT', 'NUMERICAL', 'ENGINE_DEFECT', 'COMPILER_DEFECT', 'EXEC_FAILURE'];
// 막힘의 두 종류 (PLAN-116 G2 · DEC-0077): deny = 필수 검증 실패 · 결함 — 고친 뒤 다시 · hold = 근거 부족 · 해석 불확실 · 검증 불일치 · 원인 모름 — 사람 판단
export const CAUSE_KIND = {
  FINDING: 'hold', DATA_GAP: 'hold', DOMAIN_CONFLICT: 'hold', NUMERICAL: 'hold',
  ENGINE_DEFECT: 'deny', COMPILER_DEFECT: 'deny', EXEC_FAILURE: 'deny',
};
export const KIND_LABEL = { deny: '거부', hold: '보류' };
export const MAX_ATTEMPTS = 3;
// 넘김 · 입력이 가리킨 전환 기록이 다른 상위 작업의 것인가 (DEC-0081 · RULE-0545): 전환 기록에 sup 가 있을 때만 판정 — 없는 옛 기록은 판정하지 않는다
const LINK_RULE = 'RULE-0545';
function linkErr(R, seq, sup, where, E) {
  const own = R && R.transitionSup && R.transitionSup.get(seq);
  if (own && sup && own !== sup) E.push(`${where} — 전환 기록 #${seq} 은 ${own} 의 것, 이 사건은 ${sup} (${LINK_RULE}: 다른 상위 작업의 기록을 잇지 않는다)`);
} // 같은 모드의 run — 처음 1 + 재시도 2 (DEC-0065 ⑤)
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
    transitionSup: new Map(jsonl(join(root, 'workspace/transitions.jsonl')).filter((t) => t.sup).map((t) => [t.seq, t.sup])), // 선택 칸 sup 가 있는 전환 기록만 (DEC-0081)
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
      for (const s of e.inputs.transitions || []) linkErr(R, s, e.sup, `inputs.transitions ${s}`, E);
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
    else linkErr(R, e.transition_seq, e.sup, `transition_seq ${e.transition_seq}`, E);
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
      if (e.ev === 'handoff') { r.transition_seq = e.transition_seq; r.outputs = e.outputs; r.verify = e.verify || null; r.result = 'handed_off'; s.active = null; }
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

// ── 승인 증거의 사실 모으기 (PLAN-102 — git 읽기만, 판정은 사법부 judicial/supervise_approval.js) ──────────
const git = (root, ...a) => execFileSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
const tryGit = (root, ...a) => { try { return git(root, ...a); } catch { return null; } };
export function mainRefOf(root = ROOT) { for (const r of ['origin/main', 'main']) if (tryGit(root, 'rev-parse', '--verify', '--quiet', r + '^{commit}')) return r; return null; }
// 경로들의 blob (없는 경로는 null) — 커밋 하나에서
function blobsAt(root, rev, paths) {
  const out = Object.fromEntries(paths.map((p) => [p, null]));
  const txt = tryGit(root, 'ls-tree', '-r', rev, '--', ...paths) || '';
  for (const l of txt.split('\n').filter(Boolean)) { const m = l.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/); if (m && m[2] in out) out[m[2]] = m[1]; }
  return out;
}
const denyAt = (root, rev) => { const t = tryGit(root, 'show', `${rev}:.claude/settings.json`); try { return t ? (JSON.parse(t).permissions?.deny || []).includes(AP.MERGE_TOOL) : false; } catch { return false; } };
// 영수증에 남은 PR 병합 호출 — main 의 영수증 파일에서 (영수증이 없는 실행 환경의 병합은 여기 잡히지 않는다 — 그래서 ③ 설정 막음이 따로 필요)
function aiMergesAt(root, rev) {
  const names = (tryGit(root, 'ls-tree', '--name-only', rev, 'workspace/receipts/') || '').split('\n').filter((f) => f.endsWith('.jsonl'));
  const out = [];
  for (const f of names) for (const l of (tryGit(root, 'show', `${rev}:${f}`) || '').split('\n')) { if (!l.includes(AP.MERGE_TOOL)) continue; try { const e = JSON.parse(l); if (e.tool === AP.MERGE_TOOL) out.push({ at: e.at, receipt: f.replace(/^.*\//, '').replace(/\.jsonl$/, '') }); } catch { /* 줄 아님 */ } }
  return out;
}
// 상위 작업 하나의 승인 판정 + 계산된 상태. 사실을 못 모으면(얕은 복제 · 커밋 없음) 그 까닭을 돌려준다.
export function evidence(sup, root = ROOT) {
  const pre = sup.runs.filter((r) => r.mode !== 'baseline' && r.result === 'handed_off');
  const last = pre[pre.length - 1];
  if (!last) return { verdict: null, derived: AP.derive(sup, null), note: '넘긴 실행 없음' };
  const tip = last.outputs.commits[last.outputs.commits.length - 1], main = mainRefOf(root);
  if (!main) return { verdict: null, derived: AP.derive(sup, null), note: 'main 을 찾지 못함' };
  if (tryGit(root, 'cat-file', '-e', tip + '^{commit}') === null) return { verdict: null, derived: AP.derive(sup, null), note: `넘긴 커밋 ${tip} 이 이 저장소에 없음 (가져오기 필요)` };
  const first = sup.runs.find((r) => r.base);
  const base = (first && tryGit(root, 'cat-file', '-e', first.base + '^{commit}') !== null ? first.base : (tryGit(root, 'merge-base', tip, main) || '').trim());
  if (!base) return { verdict: null, derived: AP.derive(sup, null), note: '분기점을 찾지 못함' };
  const paths = (tryGit(root, 'diff', '--name-only', base, tip) || '').split('\n').filter(Boolean);
  const target = blobsAt(root, tip, paths);
  // main 의 본줄기(첫 부모 사슬)만 — 진짜 머지면 작업 브랜치의 커밋도 main 역사에 들어오지만, 병합된 지점은 본줄기 위의 머지 커밋이다
  const commits = (tryGit(root, 'rev-list', '--first-parent', '--reverse', `${base}..${main}`) || '').split('\n').filter(Boolean)
    .map((sha) => ({ sha, time: (tryGit(root, 'show', '-s', '--format=%cI', sha) || '').trim(), blobs: blobsAt(root, sha, paths), denyMerge: denyAt(root, sha) }));
  const baseTime = Date.parse((tryGit(root, 'show', '-s', '--format=%cI', base) || '').trim());
  const aiMerges = aiMergesAt(root, main).filter((m) => !Number.isFinite(baseTime) || Date.parse(m.at) >= baseTime);
  const verdict = AP.judge({ target, commits, aiMerges });
  const onApproved = {};
  if (verdict.commit) for (const r of sup.runs.filter((x) => x.mode === 'baseline')) onApproved[r.run] = !!(r.base && tryGit(root, 'merge-base', '--is-ancestor', verdict.commit, r.base) !== null);
  return { verdict, derived: AP.derive(sup, verdict, onApproved), tip, base, main, files: paths.length };
}

// ── 검수 독립성 · 승인 보고서의 사실 모으기 (PLAN-116 G3 · G4 — 읽기만, 판정은 judicial/supervise_approval.js) ──
const RAW_RE = /data\/fetched\/|europepmc|ebi\.ac\.uk|mcp__biodb-fetch__/;
// 세션 꼬리 → 그 세션의 영수증 사건 (작업 트리에 없으면 main 에서)
function receiptOf(root, tag) {
  const d = join(root, 'workspace/receipts');
  const f = existsSync(d) && readdirSync(d).find((x) => x.endsWith(`-${tag}.jsonl`));
  let txt = f ? readFileSync(join(d, f), 'utf8') : null;
  if (!txt) { const m = mainRefOf(root), n = m && (tryGit(root, 'ls-tree', '--name-only', m, 'workspace/receipts/') || '').split('\n').find((x) => x.endsWith(`-${tag}.jsonl`)); txt = n ? tryGit(root, 'show', `${m}:${n}`) : null; }
  if (!txt) return null;
  return { name: f ? f.slice(0, -6) : tag, events: txt.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) };
}
// 영수증에서 원문 자리를 가리킨 도구 호출 — 그 글에 나온 문헌 번호(MED-… · 5–8 자리 수)를 모음 (추정)
export function rawTouches(events) {
  const hits = events.filter((e) => e.t === 'tool' && RAW_RE.test(String(e.target || '') + ' ' + String(e.tool || '')));
  const pmids = new Set();
  for (const e of hits) for (const m of String(e.target || '').matchAll(/(?:MED-)?\b(\d{5,8})\b/g)) pmids.add(m[1]);
  return { touches: hits.length, pmids: [...pmids] };
}
// 작성 실행이 넘긴 커밋의 패치 파일이 단 문헌 출처 (PMID)
function citedBy(root, commits) {
  const out = new Set();
  for (const c of commits || []) for (const f of (tryGit(root, 'show', '--name-only', '--format=', c) || '').split('\n').filter((x) => /^data\/patches\/.+\.json$/.test(x))) {
    for (const m of (tryGit(root, 'show', `${c}:${f}`) || '').matchAll(/"db"\s*:\s*"PMID"\s*,\s*"id"\s*:\s*"(\d+)"/g)) out.add(m[1]);
  }
  return [...out];
}
const modeOf = (mode, root) => { try { return JSON.parse(readFileSync(join(root, 'rebuild/rules/modes.json'), 'utf8')).gate.modes[mode] || {}; } catch { return {}; } };
const zoneOf = (mode, root) => modeOf(mode, root).write || [];
// 모드가 낼 수 있는 도장 종류 (모드표 stamps — DEC-0078). 칸이 없으면 null(정책 없음) — 여러 모드면 하나라도 없으면 null
const stampsOf = (modes, root) => { const l = modes.map((m) => modeOf(m, root).stamps); return l.every(Array.isArray) ? [...new Set(l.flat())] : null; };
// 검수 실행마다 독립성 사실 → 판정
export function independenceOf(sup, root = ROOT) {
  return sup.runs.filter((r) => r.mode === 'inspect').map((ir) => {
    const before = sup.runs.slice(0, sup.runs.indexOf(ir)).filter((r) => !['inspect', 'baseline'].includes(r.mode));
    const rc = receiptOf(root, ir.session);
    const facts = {
      author: { modes: [...new Set(before.map((r) => r.mode))], sessions: before.map((r) => r.session), zones: [...new Set(before.flatMap((r) => zoneOf(r.mode, root)))], stamps: stampsOf([...new Set(before.map((r) => r.mode))], root) },
      inspect: { mode: ir.mode, session: ir.session, zone: zoneOf('inspect', root), stamps: stampsOf(['inspect'], root) },
      receipt: rc ? rawTouches(rc.events) : null,
      cited: citedBy(root, before.flatMap((r) => (r.outputs && r.outputs.commits) || [])),
    };
    return { run: ir.run, receipt: rc && rc.name, ...AP.independence(facts), cited: facts.cited };
  });
}
// 승인 보고서 (제안서 §8 의 12 칸) — 장부 · 영수증 · git · 전환 기록에서. 쓰지 않는다. Supervisor 가 쓰는 글이 아님 (DEC-0065 ① · DEC-0077)
export function report(sup, root = ROOT) {
  const ev = evidence(sup, root), ind = independenceOf(sup, root), last = ind[ind.length - 1] || null;
  const rec = AP.recommend({ sup, verdict: ev.verdict, kindOf: (c) => CAUSE_KIND[c], indep: last });
  const trs = jsonl(join(root, 'workspace/transitions.jsonl')), trOf = (n) => trs.find((t) => t.seq === n);
  const paths = ev.base && ev.tip ? (tryGit(root, 'diff', '--name-only', ev.base, ev.tip) || '').split('\n').filter(Boolean) : [];
  const area = {}; for (const p of paths) { const k = p.startsWith('data/') ? p.split('/').slice(0, 2).join('/') : p.includes('/') ? p.split('/')[0] + '/' : p; area[k] = (area[k] || 0) + 1; }
  const touchesCore = paths.filter((p) => /^(judicial|engine|compiler|legislative)\/|^(model|core|vocab)\.js$|^data\/db\.json$/.test(p));
  const cell = (x) => String(x ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const attempts = {}; for (const r of sup.runs) attempts[r.mode] = (attempts[r.mode] || 0) + 1;
  const rows = [
    ['작업 목적', `${sup.purpose} (계획 ${sup.plan_item} · 결정 ${sup.decision})`],
    ['실행 내역', sup.runs.map((r) => `${r.run} ${r.mode} · 세션 ${r.session} · ${r.result}${r.transition_seq ? ` · 전환 #${r.transition_seq}` : ''}`).join(' / ') || '없음'],
    ['변경 내역', ev.base ? `${String(ev.base).slice(0, 7)} → ${String(ev.tip).slice(0, 7)} · 파일 ${paths.length}: ${paths.slice(0, 12).join(' · ')}${paths.length > 12 ? ` … (+${paths.length - 12})` : ''}` : `계산 못 함 — ${ev.note || ''}`],
    ['근거', last && last.cited.length ? `작성 패치의 문헌 출처 ${last.cited.length}: PMID ${last.cited.join(' · ')}` : '작성 패치의 문헌 출처 없음 (또는 검수 전)'],
    ['검증', sup.runs.map((r) => `${r.run} finish ${(r.verify && r.verify.finish) || '—'}`).join(' / ')],
    ['독립 검수', ind.length ? ind.map((x) => `${x.run} ${x.level} — ${Object.entries(x.factors).map(([k, v]) => `${k} ${v.ok === true ? '○' : v.ok === false ? '✗' : '?'}${v.estimated ? '(추정)' : ''}`).join(' · ')}`).join(' / ') : '검수 실행 없음'],
    ['절차 감사', sup.runs.map((r) => { const t = r.transition_seq && trOf(r.transition_seq); return `${r.run} 문지기 ${r.enforcement && r.enforcement.hooks ? '있음' : '없음'} · 영수증 ${receiptOf(root, r.session) ? '있음' : '없음'}${t ? ` · 전환 #${t.seq} ${t.sup ? (t.sup === sup.id ? '같은 작업(sup)' : `다른 작업 ${t.sup}`) : '연결 확인 못 함(sup 없음)'}` : ''}`; }).join(' / ')],
    ['실패 이력', [...Object.entries(attempts).filter(([, n]) => n > 1).map(([m, n]) => `${m} 시도 ${n}`), ...sup.runs.filter((r) => r.result === 'blocked').map((r) => `${r.run} 막힘`), ...(sup.blocked ? [`지금 막힘(${KIND_LABEL[CAUSE_KIND[sup.blocked.cause]]}) ${sup.blocked.cause}: ${sup.blocked.why}`] : [])].join(' / ') || '없음'],
    ['미해결', sup.runs.map((r) => r.transition_seq && trOf(r.transition_seq)).filter(Boolean).slice(-1).flatMap((t) => (t.open || []).map((o) => `#${t.seq}: ${o}`)).join(' / ') || '없음'],
    ['영향 분석', paths.length ? `${Object.entries(area).map(([k, n]) => `${k} ${n}`).join(' · ')}${touchesCore.length ? ` — ⚠ 판정 · 엔진 · 권위 데이터에 닿음 ${touchesCore.length}` : ''}` : '—'],
    ['승인 대상', ev.verdict ? `넘긴 커밋 ${String(ev.tip).slice(0, 7)} 의 파일 ${ev.files} 바이트 · 판정 ${ev.verdict.status} — ${ev.verdict.text}` : `계산 못 함 — ${ev.note || ''}`],
    ['최종 권고', `${rec.code} — ${rec.text}${rec.reasons.length ? ` (${rec.reasons.join(' · ')})` : ''}`],
  ];
  return { rows, recommendation: rec, independence: ind, evidence: ev, text: [`# 승인 보고서 — ${sup.id} (계산된 상태 ${ev.derived.state})`, '', '> 생성물 — 감독 장부 · 영수증 · git · 전환 기록에서 계산 (node rebuild/supervise.mjs report). 승인이 아니다 — 병합 = 사람 (DEC-0069). (추정) 칸은 영수증의 명령 글에서 셈.', '', '| 항목 | 내용 |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`)].join('\n') };
}

// ── 보기 ──────────────────────────────────────────────────────────────────
const NEXT = { planned: '첫 실행을 기다림', running: '진행 중', blocked: '막힘 — 사람이 봐야 함', cancelled: '취소됨' };
export function render(sups, ev = {}) {
  if (!sups.length) return '감독 장부 — 상위 작업 없음';
  const cell = (x) => String(x ?? '').replace(/\|/g, '\\|');
  const L = ['| 상위 작업 | 계획 작업 | 상태 | 실행 | 지금 |', '|---|---|---|---|---|'];
  for (const s of sups) {
    const runs = s.runs.map((r) => `${r.run.split('/')[1]} ${r.mode}·${r.executor}${r.enforcement && !r.enforcement.hooks ? '(문지기 없음)' : ''}·${r.result}`).join(' → ') || '—';
    const d = ev[s.id] && ev[s.id].derived, state = d ? d.state : s.state;
    const now = d && d.why ? d.why : s.state === 'running' && !s.active ? `다음 실행을 기다림 (steps ${s.steps.join(' → ')})` : s.state === 'blocked' ? `막힘(${KIND_LABEL[CAUSE_KIND[s.blocked.cause]] || '?'}) ${s.blocked.cause}: ${s.blocked.why}` : NEXT[s.state];
    L.push(`| ${s.id} | ${s.plan_item} | ${state} | ${cell(runs)} | ${cell(now)} |`);
  }
  L.push('', '승인 대기 · 반영 · 완료는 장부에 적지 않고 증거에서 계산한다 (judicial/supervise_approval.js — 자세히: node rebuild/supervise.mjs evidence <SUP-…>).');
  return L.join('\n');
}

// ── 명령 ──────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const events = load(), R = refs();
  if (cmd === 'check') { const e = check(events, R); console.log(e.length ? e.join('\n') : `감독 장부 정확 — 사건 ${events.length} · 오류 0`); process.exit(e.length ? 1 : 0); }
  if (cmd === 'status') { const f = fold(events, R); const sel = file ? f.sups.filter((s) => s.id === file) : f.sups; const ev = Object.fromEntries(sel.filter((s) => !['planned', 'blocked', 'cancelled'].includes(s.state) && !s.active).map((s) => [s.id, evidence(s)])); console.log(render(sel, ev)); if (f.errors.length) console.log(`\n장부 오류 ${f.errors.length}:\n- ${f.errors.join('\n- ')}`); process.exit(f.errors.length ? 1 : 0); }
  if (cmd === 'report') {
    const f = fold(events, R), s = f.sups.find((x) => x.id === file);
    if (!s) { console.error(`상위 작업 '${file || ''}' 없음`); process.exit(2); }
    console.log(report(s).text);
    process.exit(0);
  }
  if (cmd === 'evidence') {
    const f = fold(events, R), s = f.sups.find((x) => x.id === file);
    if (!s) { console.error(`상위 작업 '${file || ''}' 없음`); process.exit(2); }
    const e = evidence(s);
    console.log(`${s.id} — 계산된 상태 ${e.derived.state}${e.derived.why ? ' · ' + e.derived.why : ''}`);
    if (e.note) console.log(`사실을 다 모으지 못함: ${e.note}`);
    if (e.verdict) { console.log(`승인 판정 ${e.verdict.status} — ${e.verdict.text}`); console.log(`  대상: 분기점 ${String(e.base).slice(0, 7)} → 넘긴 커밋 ${String(e.tip).slice(0, 7)} · 파일 ${e.files} · main ${e.main}`); for (const r of e.verdict.reasons) console.log(`  - ${r}`); }
    process.exit(0);
  }
  if (!EVENTS.includes(cmd) || !file) { console.error(`사용: node rebuild/supervise.mjs status [SUP-…] · check · evidence <SUP-…> · report <SUP-…> · <${EVENTS.join('|')}> <사건.json> [--dry] [--human <이름>]`); process.exit(2); }
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
