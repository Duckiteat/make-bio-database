#!/usr/bin/env node
// 파일 탐침 (STG-11d · DEC-0047) — 한 자리에 닿는 곳을 한 번에, 그리고 깨진 참조 따라가기.
//   node rebuild/probe.mjs <파일 | RULE-… | PLAN-…·ASY-…·STG-… | 이름>   닿는 자리 (규칙 · 집행 · 시험 · 같이 고친 파일 · 분류 · 처방)
//   node rebuild/probe.mjs --check                                      깨진 참조 — 있으면 종료 코드 1 (rebuild/precheck.mjs 가 부름)
//   node rebuild/probe.mjs --fix [--dry]                                첫 등급 자동 수정(파일 이동 — 장부 · 계획) · 저장 지도는 고칠 줄만 보임 · 둘째 등급은 후보만
// 새 지도를 손으로 만들지 않는다 — 이미 있는 기계 자료를 엮는다: 규칙 장부 where · 집행 장부 · links code: · 계획(자리) ·
//   저장 지도(storage-map.json) · 시험 추적 지도(tests/affected.mjs mapFile) · git 함께 바뀜 · 단위 장부 분류.
// 참조 세 등급 (작업 자동화 보고서 §8 — docs/reports):
//   1 자동 — 현재 상태를 가리키는 경로(규칙 where · 집행 file·tests · links code: · 열린 계획 항목의 자리 · 저장 지도 path): git 이 이동으로 본 것만
//     장부·계획 도구로 고친다(이유를 단 사건). 2 제안 — 변이 자리(find)가 코드와 어긋남: 지워진 검사를 다시 가리키면 거짓 안심이므로 후보만(RULE-0461).
//   3 안 고침 — 과거 기록(CHANGES · 결정·계획 이력 · 영수증 · 도장 · 봉인 · 데이터)은 읽지도 고치지도 않는다.
// 계약: 질의 · --check 는 읽기만. --fix 는 rebuild/rules.mjs apply · rebuild/plan.mjs apply 를 부를 뿐(변경 묶음 초안은 저장소 밖 — 서기 writeDraft).
//   저장 지도(docs/textbook/storage-map.json)는 서기 구역이 아니므로 쓰지 않고 고칠 줄을 보인다.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import * as CLERK from '../legislative/clerk.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const git = (args, root) => { try { return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 }); } catch { return ''; } };

// 글 속 저장소 경로 — 'a/b.js' 꼴(한글 이름 포함). 맨 이름(vocab.js)은 저장소 최상위 파일과 맞을 때만
const PATH_RE = /(?:[\w가-힣.-]+\/)+[\w가-힣.*-]+\.(?:mjs|cjs|js|jsonl|json|md|rs|html|sh|toml)\b/g;
const BARE_RE = /(?<![\w/.-])[\w-]+\.(?:mjs|cjs|js|md)\b/g;
export function pathsIn(text, rootFiles) {
  const t = String(text || ''), out = new Set(t.match(PATH_RE) || []);
  for (const b of t.match(BARE_RE) || []) if (rootFiles.has(b)) out.add(b);
  return [...out].filter((p) => !p.includes('*') && !p.startsWith('.') && !/^https?:/.test(p));
}

// 맥락 — 모든 원천을 한 번 읽는다 (순수 함수들이 이것만 본다 — 시험은 합성 맥락으로)
export function context(root = ROOT) {
  const files = git(['ls-files'], root).split('\n').filter(Boolean);
  const exists = new Set(files.filter((f) => existsSync(join(root, f))));
  for (const l of git(['ls-files', '--others', '--exclude-standard'], root).split('\n').filter(Boolean)) exists.add(l);
  const R = (n) => jsonl(join(root, 'rebuild', 'rules', n + '.jsonl'));
  let map = null; try { const A = join(root, 'docs', 'textbook', 'storage-map.json'); map = JSON.parse(readFileSync(A, 'utf8')); } catch { /* 없음 */ }
  const plan = jsonl(join(root, 'rebuild', 'state', 'plans.jsonl')).filter((x) => x.kind === 'item');
  return { root, exists, rootFiles: new Set([...exists].filter((f) => !f.includes('/'))), rules: R('rules'), enforcement: R('enforcement'), links: R('links'), plan, map, read: (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return null; } }, everTracked: (p) => !!git(['log', '-n', '1', '--format=%h', '--', p], root).trim() };
}
const mapEntries = (ctx) => (ctx.map ? Object.values(ctx.map).flatMap((v) => (Array.isArray(v) ? v : v && Array.isArray(v.entries) ? v.entries : [])).filter((e) => e && e.path) : []);
const OPEN = (x) => !['☑', '✗'].includes(x.mark);

// 깨진 참조 — 등급 1(auto: 경로가 없음) · 등급 2(propose: 변이 자리가 정확히 한 번이 아님). 과거 기록은 보지 않는다
export function brokenRefs(ctx) {
  const out = [], miss = (p) => (p.endsWith('/') ? ![...ctx.exists].some((f) => f.startsWith(p)) : !ctx.exists.has(p)); // 끝이 / 면 폴더
  for (const r of ctx.rules) if (!r.retired && r.where) for (const p of pathsIn(r.where, ctx.rootFiles)) if (miss(p)) out.push({ tier: 1, kind: 'rules.where', key: r.id, path: p });
  for (const e of ctx.enforcement) {
    if (e.file && miss(e.file)) out.push({ tier: 1, kind: 'enforcement.file', key: e.rule, path: e.file });
    for (const t of e.tests || []) if (miss(t)) out.push({ tier: 1, kind: 'enforcement.tests', key: e.rule, path: t });
    if (e.find && e.file && !miss(e.file) && ['replace', 'disable'].includes(e.op)) {
      const src = ctx.read(e.file) || '', n = src.split(e.find).length - 1;
      if (n !== 1) out.push({ tier: 2, kind: 'enforcement.find', key: e.rule, path: e.file, count: n });
    }
  }
  for (const l of ctx.links) if (/^code:/.test(l.to || '')) { const p = l.to.slice(5).split('#')[0]; if (miss(p)) out.push({ tier: 1, kind: 'links.to', key: `${l.from}|${l.rel}|${l.to}`, path: p }); }
  for (const x of ctx.plan) if (OPEN(x) && x.fields && x.fields['자리']) for (const p of pathsIn(x.fields['자리'], ctx.rootFiles)) if (miss(p)) out.push({ tier: 1, kind: 'plan.자리', key: x.id, path: p });
  // 저장 지도: 아직 만들어지지 않은 자리(첫 쓰기 전 장부)는 깨짐이 아님 — git 에 있었다가 사라진 경로만
  for (const m of mapEntries(ctx)) if (!/[*{]/.test(m.path) && miss(m.path) && (ctx.everTracked || (() => true))(m.path)) out.push({ tier: 1, kind: 'storage-map.path', key: m.path, path: m.path });
  return out;
}
// 둘째 등급 후보 — 그 규칙 번호를 글자 그대로 내는 줄 (같은 검사인지는 사람·AI 가 확인)
export function findCandidates(ctx, rule, file) {
  const src = ctx.read(file) || '', lines = src.split('\n').map((l, i) => [i + 1, l]);
  const e = ctx.enforcement.find((x) => x.rule === rule), toks = e && e.find ? e.find.split(/\s+/).filter((t) => t.length > 2) : [];
  const score = (l) => (toks.length ? toks.filter((t) => l.includes(t)).length / toks.length : 0);
  const lit = lines.filter(([, l]) => l.includes(`'${rule}'`)), near = lines.filter(([, l]) => score(l) >= 0.6).sort((a, b) => score(b[1]) - score(a[1]));
  return [...new Map([...near, ...lit].map((x) => [x[0], x])).values()].map(([n, l]) => `${file}:${n}  ${l.trim().slice(0, 140)}`); // 옛 find 와 닮은 줄 먼저, 그 규칙 번호를 내는 줄
}

// git 이 이동으로 본 것 — 옛 경로 → 지금 경로 (이어진 이동은 끝까지 따라감, 지금 없는 경로는 버림)
export function renames(root = ROOT) {
  const m = new Map();
  const add = (txt) => { for (const l of txt.split('\n')) { const p = l.split('\t'); if (/^R\d*$/.test(p[0]) && p[1] && p[2] && !m.has(p[1])) m.set(p[1], p[2]); } };
  add(git(['diff', '-M', '--cached', '--name-status'], root));
  add(git(['log', '-M', '--diff-filter=R', '--name-status', '--pretty=format:', '-n', '2000'], root));
  const end = (p, seen = new Set()) => (m.has(p) && !seen.has(p) ? (seen.add(p), end(m.get(p), seen)) : p);
  return new Map([...m.keys()].map((k) => [k, end(k)]));
}
// 첫 등급 고치기 계획 — 장부 ops · 계획 ops · 저장 지도 글 바꿈. 이동이 없는 깨짐과 둘째 등급은 고치지 않고 남긴다
export function planFixes(ctx, broken, mv) {
  const rules = [], plan = [], mapSub = [], left = [];
  const cur = (rows, k, key) => rows.find((r) => String(k(r)) === String(key));
  for (const b of broken) {
    const to = b.tier === 1 && mv.get(b.path);
    if (!to || !ctx.exists.has(to)) { left.push(b); continue; }
    const sub = (s) => String(s).split(b.path).join(to);
    if (b.kind === 'rules.where') { const r = cur(ctx.rules, (x) => x.id, b.key); rules.push({ op: 'set', file: 'rules', key: b.key, fields: { where: sub(r.where) } }); r.where = sub(r.where); }
    else if (b.kind === 'enforcement.file') { rules.push({ op: 'set', file: 'enforcement', key: b.key, fields: { file: to } }); }
    else if (b.kind === 'enforcement.tests') { const e = cur(ctx.enforcement, (x) => x.rule, b.key); e.tests = e.tests.map((t) => (t === b.path ? to : t)); rules.push({ op: 'set', file: 'enforcement', key: b.key, fields: { tests: e.tests } }); }
    else if (b.kind === 'links.to') { rules.push({ op: 'set', file: 'links', key: b.key, fields: { to: sub(b.key.split('|')[2]) } }); }
    else if (b.kind === 'plan.자리') { const x = cur(ctx.plan, (y) => y.id, b.key); x.fields['자리'] = sub(x.fields['자리']); plan.push({ op: 'scope', id: b.key, field: '자리', to: x.fields['자리'] }); }
    else if (b.kind === 'storage-map.path') mapSub.push([b.path, to]);
    else left.push(b);
  }
  const merged = []; // 같은 열쇠의 set 은 마지막 것으로 (where 를 여러 번 고친 경우)
  for (const o of rules) { const i = merged.findIndex((y) => y.file === o.file && y.key === o.key && Object.keys(y.fields).join() === Object.keys(o.fields).join()); if (i >= 0) merged[i] = o; else merged.push(o); }
  return { rules: merged, plan, mapSub, left };
}

// 질의 — 한 자리에 닿는 곳
const RECIPES = [
  [/^judicial\//, '판정 규칙을 더하면: node rebuild/rules.mjs rule <명세> (규칙 · 연결 · 집행 · 변이 · red 한 번에) · 판정 코드의 오류 첫 인자는 \'RULE-…\' 글자 그대로(rebuild ⑫) · SCHEMA 변경 기록(형식이 바뀔 때) · CHANGES 맨 위 한 행'],
  [/^(model|core|vocab)\.js$/, '형식·어휘가 바뀌면: schemas/ 계약 · SCHEMA §와 변경 기록 · 교과서(분류된 줄은 이어 쓰기) · node rebuild/regen.mjs · CHANGES'],
  [/^rebuild\/rules\//, '장부는 도구로만: node rebuild/rules.mjs apply|rule — 손으로 고치면 봉인이 거부(RULE-0519)'],
  [/^rebuild\/state\/|^docs\/plan\//, '계획은 node rebuild/plan.mjs apply <ops.json> 로만 — docs/plan 은 생성물(node rebuild/regen.mjs)'],
  [/^(rebuild|tests|legislative|compiler|engine)\/.+\.(m?js|rs)$/, '새 파일이면 docs/textbook/storage-map.json 에 분류 · CHANGES 맨 위 한 행'],
  [/^docs\/textbook\/|^SCHEMA\.md$/, '분류된 줄(rebuild/ledger/units.jsonl)은 새 줄 대신 이어 쓰기 — 단위 장부 범위(rebuild ④)'],
];
export function coChange(root, file, n = 300) {
  const commits = git(['log', '-n', String(n), '--name-only', '--pretty=format:@@'], root).split('@@').map((c) => c.split('\n').filter(Boolean)).filter((c) => c.length);
  const hit = commits.filter((c) => c.includes(file)), cnt = new Map();
  for (const c of hit) for (const f of c) if (f !== file && !f.startsWith('workspace/receipts/')) cnt.set(f, (cnt.get(f) || 0) + 1);
  return { commits: hit.length, top: [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, k]) => [f, Math.round((100 * k) / hit.length)]) };
}
async function testsReading(root, file) {
  try {
    const A = await import('../tests/affected.mjs'), f = A.mapFile(root);
    if (!existsSync(f)) return null;
    const m = JSON.parse(readFileSync(f, 'utf8'));
    return Object.entries(m.tests || {}).filter(([, e]) => A.covers(e, file)).map(([t]) => t);
  } catch { return null; }
}
// 영수증 감사 (STG-12 점검 ⑩ · RULE-0529) — GitHub 의 파일 쓰기 도구는 사용자 계정으로 커밋되어 사람의 커밋과 구별되지 않는다.
//   그래서 쓰지 않는다 (L6 는 사람의 커밋으로만). 문지기 영수증(workspace/receipts)에 그 도구 사용이 있으면 사전 검사가 막는다 — 사후 감시.
//   명령 장부로 막으면 장부 ↔ 실제 도구 일치 시험(L6)과 부딪혀서, 사람 손이 필요 없는 감사로 둔다.
const AUDIT_RULE = 'RULE-0529'; // 영수증 감사의 규칙 번호
export const GH_WRITE = /^mcp__[a-z0-9_]+__(?:push_files|create_or_update_file|delete_file)$/;
export function auditReceipts(root = ROOT) {
  const dir = join(root, 'workspace', 'receipts'), out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort()) {
    for (const [i, l] of readFileSync(join(dir, f), 'utf8').split('\n').entries()) {
      if (!l.trim()) continue;
      let e; try { e = JSON.parse(l); } catch { out.push(`${AUDIT_RULE} 영수증 ${f}:${i + 1} 읽을 수 없음`); continue; }
      if (e.t === 'tool' && GH_WRITE.test(String(e.tool || ''))) out.push(`${AUDIT_RULE} 영수증 ${f}:${i + 1} ${e.at || ''} — GitHub 파일 쓰기 도구 ${e.tool} (사용자 계정과 구별되지 않음 — L6 는 사람의 커밋으로만)`);
    }
  }
  return out;
}
// 세션 끊기 (STG-11f) — 새 세션이 넘김 기록과 탐침만으로 첫 작업 자리에 닿게 한다.
//   넘김 기록 형식: workspace/NEXT-<날짜>.md — "다음에" 가 든 제목 아래 표가 다음에 할 수 있는 일(범위 · 이유 · 영향 · 확인).
//   --next 는 가장 나중 넘김 기록의 그 표 · 열린 작업 앞 셋(계획 순서) · 바뀐 파일 수를 보인다. 읽기만 한다.
export function nextFrom(root = ROOT) {
  const dir = join(root, 'workspace'), out = [];
  const docs = existsSync(dir) ? readdirSync(dir).filter((f) => /^NEXT-.*\.md$/.test(f)).sort() : [];
  if (!docs.length) { out.push('넘김 기록 없음 — workspace/NEXT-<날짜>.md (끝내는 세션이 쓴다)'); }
  else {
    const f = docs[docs.length - 1], L = readFileSync(join(dir, f), 'utf8').split('\n');
    out.push(`넘김 기록 — workspace/${f}${docs.length > 1 ? ` (이전 ${docs.length - 1} 개는 낡음)` : ''}`);
    out.push(`  ${(L.find((l) => /^# /.test(l)) || '').slice(0, 120)}`);
    const i = L.findIndex((l) => /^##\s.*다음에/.test(l));
    if (i < 0) out.push('  "다음에" 제목이 없음 — 넘김 기록 형식 위반');
    else { const t = []; for (let j = i + 1; j < L.length; j++) { if (/^##\s/.test(L[j])) break; if (/^\|/.test(L[j])) t.push(L[j]); } out.push(`  ${L[i].replace(/^##\s*/, '')}`, ...t.slice(2).map((r) => '  ' + r.slice(0, 200))); }
  }
  const recs = jsonl(join(root, 'rebuild', 'state', 'plans.jsonl')), items = new Map(recs.filter((r) => r.kind === 'item').map((r) => [r.id, r]));
  const seq = (recs.find((r) => r.kind === 'order') || { seq: [] }).seq.map((o) => items.get(o.id)).filter((x) => x && OPEN(x) && x.state !== 'hold').slice(0, 3);
  out.push('계획 순서의 열린 작업 앞 셋:', ...seq.map((x) => `  ${x.id} ${x.mark} ${String(Object.values(x.fields)[0] || '').slice(0, 60)}`));
  const ch = git(['status', '--porcelain', '-uall'], root).split('\n').filter(Boolean).length;
  out.push(`작업 트리: 바뀐 파일 ${ch}${ch ? ' — 이어받은 작업이 있다면 먼저 git status' : ''}`);
  return out;
}

// 새 파일 (STG-12 · 연결 항목 제안) — 이번 작업에서 새로 생긴 파일(추적 안 됨 + 스테이지에 더해짐 + HEAD 에 없음)
export function newFiles(root = ROOT) {
  const out = git(['status', '--porcelain', '--untracked-files=all'], root).split('\n').filter(Boolean).filter((l) => /^(\?\?| A|A )/.test(l)).map((l) => l.slice(3).replace(/^"|"$/g, ''));
  return out.filter((f) => !f.startsWith('workspace/') && !f.startsWith('.git/'));
}
// 자기 검사 시험(L6) 파일에 새 시험 블록을 더하려는가 — 일상 시험은 새 L2 파일에 쓴다 (STG-12 · 분리 보고서 B안). 제안만 — 막지 않는다
//   불변식(권한 · 서기 구역 · 규칙 번호 · 봉인)을 지키는 시험이면 L6 에 더해도 된다 — 그때는 승인 묶음으로
export function l6TestAdds(ctx) {
  const out = [];
  for (const f of (ctx.map && ctx.map.files) || []) {
    if (f.area !== 'guard:self-tests' || f.path.includes('*')) continue;
    const d = git(['diff', '-U0', 'HEAD', '--', f.path], ctx.root);
    const n = d.split('\n').filter((l) => /^\+test\(/.test(l)).length;
    if (n) out.push(`${f.path}: 새 시험 블록 ${n} 개 — 일상 시험이면 새 L2 파일(tests/<주제>.test.mjs)에 쓴다. 스스로를 지키는 불변식이면 여기에 더해도 되지만 사람 승인이 필요하다`);
  }
  return out;
}
// 새 파일마다 연결 후보: 분류 · 규칙 · 읽는 시험 · 열린 계획 (probe 가 이미 아는 것을 엮음) — 연결이 하나도 없으면 알린다. 막지는 않는다 (제안)
export async function linkHints(ctx, files) {
  const lines = [];
  for (const f of files) {
    if (!ctx.exists.has(f)) continue;
    const ls = await probe(ctx, f), pick = (re) => ls.filter((l) => re.test(l)).map((l) => '  ' + l.slice(0, 200));
    lines.push(`새 파일 ${f}`, ...pick(/^(분류|규칙|집행|읽는 시험|열린 계획|처방)/));
    if (!ls.some((l) => /^(규칙|열린 계획)/.test(l))) lines.push('  연결 없음 — 닿는 규칙의 where 나 계획 항목의 결과에 이 경로를 적으면 탐침이 이어 준다 (node rebuild/rules.mjs apply · plan.mjs apply)');
  }
  return lines;
}
export async function probe(ctx, q) {
  const out = [], P = (s) => out.push(s);
  const rid = /^RULE-\d{4}$/.test(q) && q, item = /^(PLAN|ASY|STG)-[\w]+$/.test(q) && q;
  if (rid) {
    const r = ctx.rules.find((x) => x.id === rid), e = ctx.enforcement.find((x) => x.rule === rid);
    if (!r) return [`${rid} — 규칙 장부에 없음`];
    P(`${rid} [${r.enforce}${r.retired ? ' · 은퇴' : ''}] ${r.text.slice(0, 160)}`);
    if (r.where) P(`자리 — ${r.where}`);
    const fs = pathsIn(r.where, ctx.rootFiles); if (fs.length) P(`파일 — ${fs.map((p) => `${p}${ctx.exists.has(p) ? '' : ' (없음!)'}`).join(' · ')}`);
    if (e) { const n = e.find && e.file ? (ctx.read(e.file) || '').split(e.find).length - 1 : null; P(`집행 — ${e.op} ${e.file || ''}${n != null ? ` · find ${n} 곳${n === 1 ? '' : ' (어긋남!)'}` : ''} · 결과 ${e.result} · 시험 ${(e.tests || []).join(' · ')}${e.red ? ` · red: ${e.red.slice(0, 80)}` : ''}`); }
    for (const l of ctx.links.filter((x) => x.from === rid)) P(`연결 — ${l.rel} → ${l.to || ''}`);
    P(`이유·맥락 — node rebuild/read.mjs ${rid} --depth 1`);
    return out;
  }
  if (item) {
    const x = ctx.plan.find((y) => y.id === item); if (!x) return [`${item} — 계획에 없음`];
    P(`${item} ${x.mark} ${Object.values(x.fields)[0] || ''}`);
    const fs = pathsIn(Object.values(x.fields).join(' '), ctx.rootFiles); if (fs.length) P(`닿는 파일 — ${fs.map((p) => `${p}${ctx.exists.has(p) ? '' : ' (없음)'}`).join(' · ')}`);
    P(`전부 — node rebuild/read.mjs ${item} --depth 1`);
    return out;
  }
  const file = ctx.exists.has(q) ? q : null;
  if (file) {
    const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$');
    const m = mapEntries(ctx).find((e) => e.path === file) || mapEntries(ctx).find((e) => /\*/.test(e.path) && glob(e.path).test(file)); P(m ? `분류 — ${m.class} · 쓰는 이: ${m.writer || '-'} · ${String(m.interpret || '').slice(0, 140)}` : '분류 — 저장 지도에 없음 (새 파일이면 docs/textbook/storage-map.json)');
    const rs = ctx.rules.filter((r) => !r.retired && pathsIn(r.where, ctx.rootFiles).includes(file)); if (rs.length) P(`규칙 ${rs.length} — ${rs.slice(-8).map((r) => r.id).join(' · ')}${rs.length > 8 ? ' …' : ''}`);
    const es = ctx.enforcement.filter((x) => x.file === file); if (es.length) P(`집행 변이 ${es.length} — ${es.slice(-8).map((x) => x.rule).join(' · ')}${es.length > 8 ? ' …' : ''}`);
    const ts = await testsReading(ctx.root, file); P(ts ? `읽는 시험 ${ts.length} — ${ts.slice(0, 10).join(' · ')}${ts.length > 10 ? ' …' : ''}` : '읽는 시험 — 추적 지도 없음 (node rebuild/gate.mjs finish <모드> --full 뒤 생김)');
    const cc = coChange(ctx.root, file); if (cc.commits) P(`같이 고침 (최근 커밋 ${cc.commits}) — ${cc.top.map(([f, k]) => `${f} ${k} %`).join(' · ')}`);
    const units = jsonl(join(ctx.root, 'rebuild', 'ledger', 'units.jsonl')).filter((u) => String(u.src || '').startsWith(file + ':')).length; if (units) P(`분류된 줄 ${units} — 이 문서는 새 줄 대신 이어 쓰기 (rebuild ④)`);
    for (const [re, s] of RECIPES) if (re.test(file)) P(`처방 — ${s}`);
    const ps = ctx.plan.filter((x) => OPEN(x) && pathsIn(Object.values(x.fields).join(' '), ctx.rootFiles).includes(file)); if (ps.length) P(`열린 계획 — ${ps.map((x) => x.id).join(' · ')}`);
    return out;
  }
  // 이름 (함수 · 칸) — 코드에서 찾고, 그 이름을 자리로 적은 규칙
  const hits = git(['grep', '-n', '-w', '-I', '--', q, '*.js', '*.mjs', '*.rs'], ctx.root).split('\n').filter(Boolean);
  const files = [...new Set(hits.map((h) => h.split(':')[0]))];
  P(files.length ? `코드 ${hits.length} 곳 · 파일 ${files.length} — ${files.slice(0, 10).join(' · ')}${files.length > 10 ? ' …' : ''}` : `'${q}' — 코드에서 찾지 못함`);
  const def = hits.find((h) => new RegExp(`(function\\s+${q}\\b|const\\s+${q}\\s*=|${q}\\s*:\\s*\\{)`).test(h)); if (def) P(`정의 — ${def.split(':').slice(0, 2).join(':')}`);
  const rs = ctx.rules.filter((r) => !r.retired && new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(r.where || '')); if (rs.length) P(`이 이름을 자리로 적은 규칙 — ${rs.map((r) => r.id).join(' · ')}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2), ctx = context(ROOT);
  if (args[0] === '--check' || args[0] === '--fix') {
    const broken = brokenRefs(ctx), t1 = broken.filter((b) => b.tier === 1), t2 = broken.filter((b) => b.tier === 2);
    if (args[0] === '--check') {
      for (const b of t1) console.log(`깨진 참조 [자동 대상] ${b.kind} ${b.key}: '${b.path}' 이 없음`);
      for (const b of t2) { console.log(`깨진 참조 [제안] ${b.kind} ${b.key}: find 가 ${b.path} 에 ${b.count} 곳 (정확히 1 이어야) — 후보:`); for (const c of findCandidates(ctx, b.key, b.path).slice(0, 5)) console.log('    ' + c); }
      console.log(broken.length ? `깨진 참조 ${broken.length} (자동 대상 ${t1.length} · 제안 ${t2.length}) — 이동이면 node rebuild/probe.mjs --fix` : '깨진 참조 0');
      process.exit(broken.length ? 1 : 0);
    }
    const fx = planFixes(ctx, broken, renames(ROOT)), dry = args.includes('--dry'), at = new Date().toISOString().slice(0, 10);
    const why = `경로 이동을 따라 고침 — git 이 이동으로 본 것만 (node rebuild/probe.mjs --fix · 첫 등급)`;
    const runOps = (tool, ops) => { const f = join(tmpdir(), `biodb-probe-${tool}-${process.pid}.json`); CLERK.writeDraft(f, { at, why, ops }); const r = spawnSync('node', [`rebuild/${tool}.mjs`, 'apply', f, ...(dry ? ['--dry'] : [])], { cwd: ROOT, encoding: 'utf8' }); console.log(`${tool}: ${(r.stdout || '') + (r.stderr || '')}`.trim()); return r.status === 0; };
    let ok = true;
    if (fx.rules.length) ok = runOps('rules', fx.rules) && ok;
    if (fx.plan.length) ok = runOps('plan', fx.plan) && ok;
    for (const [a, b] of fx.mapSub) console.log(`저장 지도 고칠 줄 (손으로 — 서기 구역 아님): docs/textbook/storage-map.json "path": "${a}" → "${b}"`);
    console.log(`고침 — 장부 ${fx.rules.length} · 계획 ${fx.plan.length}${dry ? ' (--dry: 쓰지 않음)' : ''} · 저장 지도 ${fx.mapSub.length} 은 위 줄대로`);
    for (const b of fx.left) console.log(`남김 [${b.tier === 2 ? '제안 — 같은 검사인지 확인 뒤 rules.mjs apply 로 find 갱신 + 변이 재실행' : '이동 기록 없음 — 사람이 판단'}] ${b.kind} ${b.key}: ${b.path}`);
    process.exit(ok ? 0 : 1);
  }
  if (args[0] === '--next') { console.log(nextFrom(ROOT).join('\n')); process.exit(0); }
  if (args[0] === '--merge-check') { // 병합 사전 점검 (rebuild/merge-check.mjs) — 다른 브랜치와 합치기 전에 충돌 · 번호 충돌을 미리 본다
    if (!args[1]) { console.error('사용: node rebuild/probe.mjs --merge-check <브랜치 또는 커밋>'); process.exit(2); }
    const { mergeCheck } = await import('./merge-check.mjs'), r = mergeCheck(args[1]); console.log(r.lines.join('\n')); process.exit(r.exit);
  }
  if (args[0] === '--audit') { const p = auditReceipts(ROOT); console.log(p.length ? p.join('\n') : '영수증 감사 — GitHub 파일 쓰기 도구 사용 0'); process.exit(p.length ? 1 : 0); }
  if (args[0] === '--new') { // 새 파일의 연결 후보 (제안 — 종료 코드 0)
    const fs = newFiles(ROOT), ls = await linkHints(ctx, fs);
    const ta = l6TestAdds(ctx);
    console.log([fs.length ? ls.join('\n') : '새 파일 0 — 연결 후보 없음', ...ta].join('\n')); process.exit(0);
  }
  if (!args[0]) { console.error('사용: node rebuild/probe.mjs <파일 | RULE-… | PLAN-…·ASY-…·STG-… | 이름> · --check · --fix [--dry] · --new · --audit · --next · --merge-check <브랜치>'); process.exit(2); }
  for (const l of await probe(ctx, args[0])) console.log(l);
}
