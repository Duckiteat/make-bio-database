#!/usr/bin/env node
// Governor 의 CI 겹 (PLAN-114 · DEC-0070 V2 · DIR-0010) — 커밋마다 "선언한 모드의 쓰기 구역 밖 변경" 을 서버 쪽에서 본다. 읽기만 한다.
//   node rebuild/ci-zone.mjs <base> [head]      base..head 의 커밋마다 판정 (head 기본 HEAD)
// 정한 것 (사용자 결정 — PLAN-114 결과 글):
//   · 모드 선언 = 그 커밋이 바꾼 영수증(workspace/receipts/*.jsonl)의 마지막 'open' 사건(mode · role). 문지기가 쓰는 파일이라 새로 적을 것이 없다.
//   · 선언 없는 커밋(사람의 커밋 · 훅 없이 만든 커밋)은 알리기만 — 통과시키고 바뀐 파일을 남긴다.
//   · 판정은 문지기의 함수 그대로(gate.mjs violations) — 새 판정 코드 없음. 정책(modes.json)은 그 커밋의 부모에서 읽는다: 커밋이 자기 정책을 넓혀 통과하지 못하게.
//   · 병합 커밋은 건너뛴다 — 합쳐 온 커밋은 그 자체로 판정된다.
//   · 영수증 파일 자체는 판정에서 뺀다 — 선언이고, 문지기가 쓴다.
// 한계: 영수증도 커밋 안의 파일이라 훅 없이 만든 커밋은 영수증을 꾸밀 수 있다. 그래도 꾸민 모드의 구역은 넘지 못한다(권한의 뿌리는 모든 모드의 except).
// 종료 코드: 0 = 구역 밖 변경 없음 (선언 없음은 알리기만) · 1 = 구역 밖 변경 · 2 = 점검 못 함
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { violations } from './gate.mjs';

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
export function judgeCommit(P, changed, decl) {
  const files = changed.filter((p) => !isReceipt(p));
  if (!decl.length) return { status: 'undeclared', files, bad: [] };
  const bad = files.filter((f) => decl.every((d) => violations(P, d.mode, d.role, [f]).length));
  return { status: bad.length ? 'violation' : 'ok', files, bad, modes: [...new Set(decl.map((d) => d.role ? `${d.mode}/${d.role}` : d.mode))] };
}

export function zoneCheck(base, head = 'HEAD', root = ROOT) {
  const out = { base, head, commits: [], exit: 0, lines: [] };
  let list;
  try { list = git(['rev-list', '--reverse', '--no-merges', `${base}..${head}`], root).split('\n').filter(Boolean); }
  catch { out.exit = 2; out.lines.push(`범위 '${base}..${head}' 를 읽을 수 없음 — 전체 역사가 필요 (fetch-depth: 0)`); return out; }
  for (const c of list) {
    let parent; try { parent = git(['rev-parse', '--verify', '-q', `${c}^`], root).trim(); } catch { parent = null; }
    if (!parent) { out.commits.push({ c, status: 'no_parent', files: [], bad: [] }); continue; } // 첫 커밋 · 얕은 복제의 경계
    const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', c], root).split('\n').filter(Boolean);
    const modes = show(parent, 'rebuild/rules/modes.json', root);
    if (!modes) { out.commits.push({ c, status: 'no_policy', files: changed, bad: [] }); continue; }
    const P = JSON.parse(modes).gate;
    const decl = declaredOf(changed.filter((p) => RECEIPT_RE.test(p)).map((file) => ({ file, text: show(c, file, root) })));
    out.commits.push({ c, subject: git(['log', '-1', '--format=%s', c], root).trim(), ...judgeCommit(P, changed, decl) });
  }
  const n = (s) => out.commits.filter((x) => x.status === s).length;
  out.lines.push(`구역 점검 (CI 겹) — ${base.slice(0, 8)}..${head.slice(0, 8)} · 커밋 ${out.commits.length} (병합 커밋 제외) · 통과 ${n('ok')} · 선언 없음 ${n('undeclared')} · 정책 없음 ${n('no_policy')}${n('no_parent') ? ` · 부모 없음 ${n('no_parent')}` : ''} · 구역 밖 ${n('violation')}`);
  for (const x of out.commits) {
    const h = `${x.c.slice(0, 8)} ${String(x.subject || '').slice(0, 60)}`;
    if (x.status === 'violation') out.lines.push(`✗ ${h} — 선언 ${x.modes.join(' · ')} 의 쓰기 구역 밖 ${x.bad.length}: ${x.bad.slice(0, 12).join(' · ')}${x.bad.length > 12 ? ' …' : ''}`);
    else if (x.status === 'undeclared') out.lines.push(`· ${h} — 모드 선언(영수증) 없음 → 사람의 커밋으로 봄 (알리기만) · 바뀐 파일 ${x.files.length}: ${x.files.slice(0, 8).join(' · ')}${x.files.length > 8 ? ' …' : ''}`);
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
