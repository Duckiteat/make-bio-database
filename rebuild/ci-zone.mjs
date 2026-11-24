#!/usr/bin/env node
// Governor 의 CI 겹 (PLAN-114 · DEC-0070 V2 · DIR-0010) — 커밋마다 "선언한 모드의 쓰기 구역 밖 변경" 을 서버 쪽에서 본다. 읽기만 한다.
//   node rebuild/ci-zone.mjs <base> [head]      base..head 의 커밋마다 판정 (head 기본 HEAD)
// 정한 것 (사용자 결정 — PLAN-114 결과 글):
//   · 모드 선언 = 그 커밋이 바꾼 영수증(workspace/receipts/*.jsonl)의 마지막 'open' 사건(mode · role). 문지기가 쓰는 파일이라 새로 적을 것이 없다.
//   · 선언 없는 커밋(사람의 커밋 · 훅 없이 만든 커밋)은 알리기만 — 통과시키고 바뀐 파일을 남긴다. 단 도장 등록부의 승인 도장 정책만은 본다(DEC-0084 · RULE-0548).
//   · 판정은 문지기의 함수 그대로(gate.mjs violations) — 새 판정 코드 없음. 정책(modes.json)은 그 커밋의 부모에서 읽는다: 커밋이 자기 정책을 넓혀 통과하지 못하게.
//   · 병합 커밋은 건너뛴다 — 합쳐 온 커밋은 그 자체로 판정된다.
//   · 영수증 파일 자체는 판정에서 뺀다 — 선언이고, 문지기가 쓴다.
// 한계: 영수증도 커밋 안의 파일이라 훅 없이 만든 커밋은 영수증을 꾸밀 수 있다. 그래도 꾸민 모드의 구역은 넘지 못한다(권한의 뿌리는 모든 모드의 except).
// 종료 코드: 0 = 구역 밖 변경 없음 (선언 없음은 알리기만) · 1 = 구역 밖 변경 · 2 = 점검 못 함
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { violations } from './gate.mjs';
import { createRequire } from 'node:module';
const ATT = createRequire(import.meta.url)('../judicial/attestation.js');
const REGISTRY = 'attestations/registry.json';
// 덧붙이기만 하는 기록 (DEC-0079 ③ · RULE-0544) — 판정은 judicial/transition_audit.js (문지기와 같은 함수)
const TA = createRequire(import.meta.url)('../judicial/transition_audit.js');
export const APPEND_ONLY = ['rebuild/state/supervise.jsonl', 'workspace/transitions.jsonl']; // 문지기(rebuild/gate.mjs)도 이 목록을 가져다 쓴다
export const appendOnly = TA.appendOnly;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT_RE = /^workspace\/receipts\/[^/]+\.jsonl$/;
const isReceipt = (p) => /^workspace\/receipts\//.test(p);
const git = (args, root) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const show = (rev, file, root) => { try { return git(['show', `${rev}:${file}`], root); } catch { return null; } };

// 영수증 글들 → 선언 [{ mode, role, file }] (파일마다 마지막 open)
export function declaredOf(receipts) {
  const out = [];
  for (const { file, text } of receipts) {
    let last = null;
    for (const l of String(text || '').split('\n')) { if (!l.trim()) continue; let o; try { o = JSON.parse(l); } catch { continue; } if (o && o.t === 'open' && typeof o.mode === 'string') last = o; }
    if (last) out.push({ mode: last.mode, role: last.role || null, file });
  }
  return out;
}

// 커밋 하나 판정 (순수): P = 부모의 문지기 정책, changed = 바뀐 경로, decl = 선언
//   선언이 여럿이면 바뀐 파일마다 어느 선언으로든 쓸 수 있어야 한다
//   reg = { before, after } — 그 커밋이 도장 등록부를 바꿨으면 부모 · 커밋의 등록부(JSON). 등록부 정책(DEC-0078): 선언된 모드가 낼 수 있는 도장 종류(모드표 stamps)만 —
//   선언 중 하나라도 그 변경을 허락하면 통과. 정책이 없는 모드(stamps 칸 없음)는 승인 도장 지우기 · 바꾸기만 본다(judicial/attestation.js registryPolicy)
const UNDECLARED_RULE = 'RULE-0548'; // 선언 없는 커밋의 등록부 정책 (DEC-0084 (c))
const AGENT_RULE = 'RULE-0551'; // AI 계정이 민 커밋은 모드 선언이 있어야 한다 (PLAN-117 · DEC-0090)
// 사람 계정 = 부모 커밋의 .github/CODEOWNERS 에 적힌 @계정 (L6 · 사람 커밋으로만 바뀜 — 커밋이 자기를 사람으로 올리지 못하게 부모에서 읽는다). 팀(@조직/팀)은 세지 않는다
export const OWNERS = '.github/CODEOWNERS';
export function humansOf(text) {
  const out = new Set();
  for (const l of String(text || '').split('\n')) { const s = l.replace(/#.*/, ''); for (const m of s.matchAll(/(?:^|\s)@([A-Za-z0-9-]+)(?=\s|$)/g)) out.add(m[1].toLowerCase()); }
  return [...out];
}
// who = { actor, human: true | false | null } — null 이면 모름(행위자 · 사람 목록이 없음: 옛 판정 그대로 알리기만)
export const whoOf = (actor, humans) => ({ actor: actor || null, human: actor && humans && humans.length ? humans.includes(String(actor).toLowerCase()) : null });
export function judgeCommit(P, changed, decl, reg, ledgers, who = { actor: null, human: null }) {
  const files = changed.filter((p) => !isReceipt(p));
  if (!decl.length) {
    // 선언 없음 — 도장 등록부의 승인 도장 정책(지우기 · 바꾸기 · 새 도장의 승인자)은 늘 본다(DEC-0084 (c) · RULE-0546): 사람의 커밋도 by: human 도장을 새로 넣을 일은 없다
    const stamps = reg ? ATT.registryPolicy(reg.before, reg.after, null).map((v) => ({ ...v, via: UNDECLARED_RULE })) : [];
    // AI 계정(봇)이 민 커밋인데 선언이 없음 — 문지기를 거치지 않은 AI 커밋(따옴표 속 커밋 N8 · 훅 없는 실행 B1)이라 거부. 사람 계정이면 전처럼 알리기만 (RULE-0551)
    const agent = who && who.human === false;
    return { status: stamps.length || agent ? 'violation' : 'undeclared', files, bad: [], stamps, rewrites: [], agent, who, modes: ['선언 없음'] };
  }
  const bad = files.filter((f) => decl.every((d) => violations(P, d.mode, d.role, [f]).length));
  let stamps = [];
  if (reg) {
    const per = decl.map((d) => ATT.registryPolicy(reg.before, reg.after, Array.isArray((P.modes[d.mode] || {}).stamps) ? P.modes[d.mode].stamps : null));
    if (per.every((v) => v.length)) stamps = per[0];
  }
  const rewrites = (ledgers || []).flatMap((x) => appendOnly(x.before, x.after).map((v) => ({ ...v, file: x.file })));
  return { status: bad.length || stamps.length || rewrites.length ? 'violation' : 'ok', files, bad, stamps, rewrites, modes: [...new Set(decl.map((d) => d.role ? `${d.mode}/${d.role}` : d.mode))] };
}

// actor: 이 push · PR 을 일으킨 GitHub 계정 — CI 에서는 GitHub 이 정하는 GITHUB_ACTOR(실행 환경이 꾸밀 수 없음). 없으면 모름(옛 판정)
// main 에 이미 들어간 커밋은 다시 판정하지 않는다 — 사람이 병합해 받아들인 것이고, 봇이 main 을 자기 브랜치로 합쳐 오면 그 커밋들이 범위에 들어온다.
//   단 head 자체가 main 에 들어 있으면(main 으로의 push) 빼지 않는다 — 빼면 아무것도 판정하지 않게 된다.
export function zoneCheck(base, head = 'HEAD', root = ROOT, opt = {}) {
  const out = { base, head, commits: [], exit: 0, lines: [] };
  const actor = opt.actor === undefined ? (process.env.GITHUB_ACTOR || null) : opt.actor;
  const mainRef = opt.main === undefined ? ['origin/main', 'main'].find((r) => { try { git(['rev-parse', '--verify', '-q', r + '^{commit}'], root); return true; } catch { return false; } }) : opt.main;
  let exclude = [];
  if (mainRef) { try { git(['merge-base', '--is-ancestor', head, mainRef], root); } catch { exclude = ['--not', mainRef]; } }
  let list;
  try { list = git(['rev-list', '--reverse', '--no-merges', `${base}..${head}`, ...exclude], root).split('\n').filter(Boolean); }
  catch { out.exit = 2; out.lines.push(`범위 '${base}..${head}' 를 읽을 수 없음 — 전체 역사가 필요 (fetch-depth: 0)`); return out; }
  for (const c of list) {
    let parent; try { parent = git(['rev-parse', '--verify', '-q', `${c}^`], root).trim(); } catch { parent = null; }
    if (!parent) { out.commits.push({ c, status: 'no_parent', files: [], bad: [] }); continue; } // 첫 커밋 · 얕은 복제의 경계
    const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', c], root).split('\n').filter(Boolean);
    const modes = show(parent, 'rebuild/rules/modes.json', root);
    if (!modes) { out.commits.push({ c, status: 'no_policy', files: changed, bad: [] }); continue; }
    const P = JSON.parse(modes).gate;
    const decl = declaredOf(changed.filter((p) => RECEIPT_RE.test(p)).map((file) => ({ file, text: show(c, file, root) })));
    const reg = changed.includes(REGISTRY) ? { before: JSON.parse(show(parent, REGISTRY, root) || '{"stamps":[]}'), after: JSON.parse(show(c, REGISTRY, root) || '{"stamps":[]}') } : null;
    const ledgers = APPEND_ONLY.filter((f) => changed.includes(f)).map((file) => ({ file, before: show(parent, file, root) || '', after: show(c, file, root) || '' }));
    const who = whoOf(actor, show(parent, OWNERS, root) === null ? null : humansOf(show(parent, OWNERS, root)));
    out.commits.push({ c, subject: git(['log', '-1', '--format=%s', c], root).trim(), ...judgeCommit(P, changed, decl, reg, ledgers, who) });
  }
  const n = (s) => out.commits.filter((x) => x.status === s).length;
  out.lines.push(`구역 점검 (CI 겹) — ${base.slice(0, 8)}..${head.slice(0, 8)} · 행위자 ${actor || '모름'} · 커밋 ${out.commits.length} (병합 커밋 · main 에 이미 든 커밋 제외) · 통과 ${n('ok')} · 선언 없음 ${n('undeclared')} · 정책 없음 ${n('no_policy')}${n('no_parent') ? ` · 부모 없음 ${n('no_parent')}` : ''} · 구역 밖 ${n('violation')}`);
  for (const x of out.commits) {
    const h = `${x.c.slice(0, 8)} ${String(x.subject || '').slice(0, 60)}`;
    if (x.status === 'violation' && x.bad.length) out.lines.push(`✗ ${h} — 선언 ${x.modes.join(' · ')} 의 쓰기 구역 밖 ${x.bad.length}: ${x.bad.slice(0, 12).join(' · ')}${x.bad.length > 12 ? ' …' : ''}`);
    for (const v of x.status === 'violation' ? x.rewrites || [] : []) out.lines.push(`✗ ${h} — ${v.file}: ${v.msg}`);
    if (x.status === 'violation' && (x.stamps || []).length) out.lines.push(`✗ ${h} — 선언 ${x.modes.join(' · ')}${x.stamps[0].via ? ` (${x.stamps[0].via})` : ''} 의 도장 등록부 정책 밖 ${x.stamps.length}: ${x.stamps.slice(0, 4).map((v) => v.msg).join(' · ')}${x.stamps.length > 4 ? ' …' : ''}`);
    if (x.status === 'violation' && x.agent) out.lines.push(`✗ ${h} — AI 계정(${x.who.actor})이 민 커밋인데 모드 선언(영수증)이 없음 (${AGENT_RULE}) — 문지기를 거치지 않은 커밋 · 바뀐 파일 ${x.files.length}: ${x.files.slice(0, 8).join(' · ')}${x.files.length > 8 ? ' …' : ''}`);
    else if (x.status === 'undeclared') out.lines.push(`· ${h} — 모드 선언(영수증) 없음 → ${x.who && x.who.human ? `사람 계정(${x.who.actor})의 커밋 (알리기만)` : '사람의 커밋으로 봄 (알리기만) · 행위자 또는 사람 계정 목록(CODEOWNERS)을 모름'} · 바뀐 파일 ${x.files.length}: ${x.files.slice(0, 8).join(' · ')}${x.files.length > 8 ? ' …' : ''}`);
    else if (x.status === 'no_policy') out.lines.push(`· ${h} — 부모에 문지기 정책이 없음 (문지기 이전 커밋) — 건너뜀`);
  }
  out.exit = n('violation') ? 1 : 0;
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [base, head] = process.argv.slice(2);
  if (!base) { console.error('사용: node rebuild/ci-zone.mjs <base> [head]'); process.exit(2); }
  const r = zoneCheck(base, head || 'HEAD'); console.log(r.lines.join('\n')); process.exit(r.exit);
}
