#!/usr/bin/env node
// 병합 사전 점검 — 다른 브랜치(다른 세션이 일하는 곳)를 합치기 전에 어디서 충돌하고 어떤 번호가 겹치는지 미리 본다. 읽기만 한다.
//   node rebuild/merge-check.mjs <브랜치 또는 커밋>        (probe.mjs --merge-check <브랜치> 와 같다)
// 방법: git merge-tree 로 작업 트리를 건드리지 않고 시험 합치기 → 충돌 파일을 종류별로(다시 만들면 되는 것 · 합집합 · 손으로) 나누고,
//   번호(DEC · PLAN · STG · ASY · RULE · PERM)가 양쪽에서 새로 생겨 같은 번호가 다른 내용을 가리키는지(번호 충돌) 본다.
// 번호는 두 세션이 서로 모르는 채 "다음 번호"를 똑같이 집기 때문에 겹친다 — git 은 줄이 다르게 붙으면 충돌로도 안 보일 수 있어 따로 센다.
// 종료 코드: 0 = 번호 충돌 없고 손으로 풀 충돌 없음 · 1 = 번호 충돌이나 손으로 풀 충돌이 있음 · 2 = 점검 못 함 (사용법 · 얕은 복제 · 오래된 git)
import { execFileSync } from 'node:child_process';

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, root, ok = [0]) => {
  try { return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { if (ok.includes(e.status)) return String(e.stdout || ''); throw e; }
};

// 충돌 파일을 어떻게 푸는지 — 위에서부터 첫 규칙이 이긴다
export const KINDS = [
  [/^(rebuild\/status\/|docs\/plan\/|docs\/modes\/|\.claude\/skills\/|CLAUDE\.md$|docs\/textbook\/90-)/, '다시 만든다', 'node rebuild/status.mjs --write (+ rebuild/regen.mjs) — 생성물이라 어느 쪽을 골라도 된다'],
  [/^(CHANGES\.md|rebuild\/state\/plan-log\.jsonl)$/, '두 쪽 합집합', '두 쪽이 덧붙인 줄을 모두 남긴다 (기록은 seq 를 다시 매긴다)'],
  [/^(rebuild\/state\/plans\.jsonl|rebuild\/rules\/[a-z-]+\.jsonl|docs\/textbook\/storage-map\.json|docs\/textbook\/authority\.json)$/, '도구나 손으로', '양쪽이 새로 만든 것을 모두 남기고 번호가 겹치면 한쪽을 새 번호로 (아래 번호 충돌)'],
];
export const kindOf = (path) => { const k = KINDS.find(([re]) => re.test(path)); return k ? { kind: k[1], how: k[2] } : { kind: '손으로', how: '코드나 문서 — 양쪽 내용을 읽고 합친다' }; };

// 줄이 JSON 인 파일(.jsonl)에서 번호(id)별 줄 — 번호가 있는 줄만
export function idsOf(text) {
  const m = new Map();
  for (const l of String(text || '').split('\n')) { if (!l.trim()) continue; let o; try { o = JSON.parse(l); } catch { continue; } if (o && typeof o.id === 'string') m.set(o.id, l); }
  return m;
}

// 분기점(base) · 우리(a) · 그쪽(b) 의 번호 맵 → 번호 충돌과 양쪽이 고친 기존 항목
//   번호 충돌 = 분기점에 없던 번호를 양쪽이 새로 만들었고 내용이 다름 (같은 내용이면 같은 일을 두 번 한 것 — 충돌 아님)
//   양쪽이 고친 기존 항목 = 분기점에 있던 번호를 양쪽이 서로 다르게 고침
export function compareIds(base, a, b) {
  const out = { collisions: [], sameNew: [], bothModified: [], onlyA: [], onlyB: [] };
  for (const [id, la] of a) {
    const inBase = base.has(id), lb = b.get(id);
    if (!inBase && lb !== undefined) { (la === lb ? out.sameNew : out.collisions).push(id); }
    else if (inBase && lb !== undefined && la !== base.get(id) && lb !== base.get(id) && la !== lb) out.bothModified.push(id);
    else if (!inBase && lb === undefined) out.onlyA.push(id);
  }
  for (const [id] of b) if (!base.has(id) && !a.has(id)) out.onlyB.push(id);
  return out;
}

// 번호를 읽는 파일 — [경로, 이름]
export const ID_FILES = [['rebuild/state/plans.jsonl', '계획 (DEC · PLAN · STG · ASY …)'], ['rebuild/rules/rules.jsonl', '규칙 (RULE)'], ['rebuild/rules/permissions.jsonl', '상시 권한 (PERM)']];

// 새 파일이 우리 권한 칸(level · area · write_keys)을 갖췄는지 — 그쪽이 권한 모델 이전에 갈라졌다면 새 자리에 칸이 없다
//   새 자리 = 분기점의 저장 지도에 없던 자리 (옛 자리는 합칠 때 우리 칸이 남는다)
export function missingColumns(tipText, baseText) {
  const files = (t) => { try { return JSON.parse(t).files || []; } catch { return null; } };
  const tip = files(tipText), base = files(baseText) || [];
  if (!tip) return null;
  const had = new Set(base.map((f) => f.path));
  return tip.filter((f) => !had.has(f.path) && (!f.level || !f.area || !Array.isArray(f.write_keys))).map((f) => f.path);
}

export function mergeCheck(ref, root = ROOT) {
  const out = { ref, ok: true, lines: [], exit: 0 };
  const P = (...s) => out.lines.push(...(s.length ? s : ['']));
  let head, base;
  try {
    if (git(['rev-parse', '--is-shallow-repository'], root).trim() === 'true') { P('얕은 복제라 분기점을 못 찾을 수 있음 — git fetch --unshallow 뒤에 다시'); out.exit = 2; return out; }
    head = git(['rev-parse', 'HEAD'], root).trim();
    const tip = git(['rev-parse', '--verify', ref + '^{commit}'], root).trim();
    base = git(['merge-base', head, tip], root).trim();
    out.tip = tip;
  } catch (e) { P(`'${ref}' 를 읽을 수 없음 — 브랜치 이름(예: origin/브랜치)이나 커밋을 확인 (git fetch 필요할 수 있음)`); out.exit = 2; return out; }
  const short = (h) => h.slice(0, 8), count = (a, b) => git(['rev-list', '--count', `${a}..${b}`], root).trim();
  P(`병합 사전 점검 — 지금(${short(head)}) ← ${ref}(${short(out.tip)})`);
  P(`분기점 ${short(base)} · 우리 쪽 커밋 ${count(base, head)} · 그쪽 커밋 ${count(base, out.tip)}`);
  const files = (to) => new Set(git(['diff', '--name-only', base, to], root).split('\n').filter(Boolean));
  const fa = files(head), fb = files(out.tip), both = [...fa].filter((f) => fb.has(f));
  P(`바뀐 파일 — 우리 ${fa.size} · 그쪽 ${fb.size} · 둘 다 ${both.length}`);
  // 시험 합치기 (작업 트리 · 색인을 건드리지 않음)
  let conflicts = [];
  try {
    const mt = git(['merge-tree', '--write-tree', '--name-only', head, out.tip], root, [0, 1]);
    const [, ...rest] = mt.split('\n'); for (const l of rest) { if (!l.trim()) break; conflicts.push(l.trim()); }
  } catch { P('git merge-tree --write-tree 를 못 씀 (git 2.38 이상 필요)'); out.exit = 2; return out; }
  conflicts = [...new Set(conflicts)];
  P('', `## 시험 합치기 — 충돌 ${conflicts.length}`);
  const by = new Map();
  for (const f of conflicts) { const k = kindOf(f); (by.get(k.kind) || by.set(k.kind, { how: k.how, files: [] }).get(k.kind)).files.push(f); }
  for (const [kind, v] of by) P(`- ${kind} (${v.files.length}) — ${v.how}`, ...v.files.map((f) => `    ${f}`));
  const hand = by.get('손으로') ? by.get('손으로').files.length : 0;
  // 번호 충돌
  P('', '## 번호 충돌');
  let coll = 0;
  for (const [file, name] of ID_FILES) {
    const rd = (rev) => { try { return git(['show', `${rev}:${file}`], root); } catch { return ''; } };
    const c = compareIds(idsOf(rd(base)), idsOf(rd(head)), idsOf(rd(out.tip)));
    coll += c.collisions.length;
    P(`- ${name}: 새로 — 우리 ${c.onlyA.length} · 그쪽 ${c.onlyB.length}${c.sameNew.length ? ` · 같은 내용으로 양쪽에 ${c.sameNew.length}` : ''}`);
    if (c.collisions.length) P(`    ★ 번호 충돌 ${c.collisions.length}: ${c.collisions.join(' · ')} — 같은 번호가 다른 내용을 가리킴. 한쪽(보통 나중에 합치는 쪽)을 새 번호로 바꾸고 참조도 함께`);
    if (c.bothModified.length) P(`    양쪽이 다르게 고친 기존 항목 ${c.bothModified.length}: ${c.bothModified.slice(0, 12).join(' · ')}${c.bothModified.length > 12 ? ' …' : ''} — 결과 글을 합쳐야 함`);
  }
  if (!coll) P('  (번호 충돌 없음)');
  // 기록 번호(seq) · 권한 칸 · L6
  const logs = (rev) => { try { return git(['diff', '--name-only', base, rev, '--', 'rebuild/state/plan-log.jsonl'], root).trim(); } catch { return ''; } };
  if (logs(head) && logs(out.tip)) P('', '- 계획 기록(plan-log)을 양쪽이 덧붙임 — 합칠 때 seq 를 다시 매겨야 함');
  try {
    let baseMap = ''; try { baseMap = git(['show', `${base}:docs/textbook/storage-map.json`], root); } catch { /* 분기점에 없음 */ }
    const miss = missingColumns(git(['show', `${out.tip}:docs/textbook/storage-map.json`], root), baseMap) || [];
    if (miss.length) P('', `- 그쪽이 새로 만든 저장 지도 자리 중 권한 칸(level · area · write_keys)이 없는 것 ${miss.length} — 합치고 칸을 채워야 \`textbook --check\` 가 통과 (예: ${miss.slice(0, 4).join(' · ')})`);
  } catch { /* 그쪽에 저장 지도가 없음 */ }
  try {
    const A = JSON.parse(git(['show', `${head}:docs/textbook/storage-map.json`], root));
    const L6 = new Set(A.files.filter((f) => f.level === 'L6').map((f) => f.path)), hit = [...fb].filter((f) => L6.has(f));
    P(hit.length ? `- ★ 그쪽이 L6(사람의 커밋으로만 바뀌는 파일)를 바꿈 ${hit.length}: ${hit.join(' · ')}` : '- 그쪽은 L6 파일을 건드리지 않음');
  } catch { /* 지금 쪽에 저장 지도 칸이 없음 */ }
  out.ok = !coll && !hand; out.exit = out.ok ? 0 : 1;
  P('', out.ok ? '결론: 손으로 풀 충돌과 번호 충돌이 없음 — 생성물은 다시 만들면 됨' : `결론: ${coll ? `번호 충돌 ${coll}` : ''}${coll && hand ? ' · ' : ''}${hand ? `손으로 풀 충돌 ${hand}` : ''} — 먼저 푼 뒤 합친다`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ref = process.argv[2];
  if (!ref) { console.error('사용: node rebuild/merge-check.mjs <브랜치 또는 커밋>'); process.exit(2); }
  const r = mergeCheck(ref); console.log(r.lines.join('\n')); process.exit(r.exit);
}
