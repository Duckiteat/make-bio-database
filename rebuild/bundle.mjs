#!/usr/bin/env node
// 승인 묶음 보기·확인 (STG-12 · 승인 묶음 보고서) — L6 변경 패치를 읽어 승인 화면 · 지문 · 판정을 낸다. 파일을 쓰지 않는다.
//   node rebuild/bundle.mjs show <패치>            승인 화면(지문 · 거부 · 사람 승인 필요 · 자동 통과, 바뀐 줄 전부)
//   node rebuild/bundle.mjs verify <패치> <지문>    지문이 같고 거부가 없을 때만 종료 코드 0 — 적용기가 쓸 확인
// 방법: 패치가 건드리는 파일의 지금(HEAD) 내용을 임시 폴더에 놓고 패치를 적용해 바뀐 뒤 내용을 얻는다 (저장소는 건드리지 않음).
// 판정은 judicial/approval.js (순수). 파일의 성격(role)은 여기서 정해 넘긴다 — 판정 모듈은 자리 이름을 모른다.
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import * as CLERK from '../legislative/clerk.mjs'; // 쓰기는 서기만 — 임시 폴더(저장소 밖)의 초안 쓰기
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, digest, screen } from '../judicial/approval.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROLE_OF = { 'rebuild/gate.mjs': 'guard', '.claude/settings.json': 'settings', 'rebuild/rules/modes.json': 'modes' };
const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$');

// 패치가 건드리는 경로 (diff --git a/x b/x 머리)
export const pathsOf = (patch) => [...new Set([...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((m) => m[2]))];

// 바뀐 뒤 내용 — before(path) 로 지금 내용(없으면 null = 새 파일)을 받아 임시 폴더에서 적용
export function applyPatch(patch, before) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-')), paths = pathsOf(patch), olds = {}; // 임시 폴더는 운영체제가 치운다 (저장소 밖)
  for (const p of paths) { const b = before(p); olds[p] = b; if (b != null) CLERK.writeDraftText(join(dir, p), b); }
  const pf = join(dir, '.patch'); CLERK.writeDraftText(pf, patch);
  execFileSync('git', ['apply', '--unsafe-paths', '--directory=.', pf], { cwd: dir, stdio: 'pipe' });
  return paths.map((p) => ({ path: p, before: olds[p] ?? '', after: existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : '' }));
}

export function changesOf(patch, root = ROOT, before = null) {
  const b = before || ((p) => { try { return execFileSync('git', ['show', `HEAD:${p}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return null; } });
  return applyPatch(patch, b).map((c) => ({ ...c, role: ROLE_OF[c.path] || null }));
}

export function areaLookup(root = ROOT) {
  let map = null; try { map = JSON.parse(readFileSync(join(root, 'docs/textbook/storage-map.json'), 'utf8')); } catch { /* 없음 */ }
  const files = (map && map.files) || [];
  return (p) => { const f = files.find((x) => x.path === p) || files.find((x) => x.path.includes('*') && glob(x.path).test(p)); return f ? { level: f.level, area: f.area, write_keys: f.write_keys } : null; };
}

export const show = (patch, root = ROOT, before = null) => screen(changesOf(patch, root, before), areaLookup(root));
export function verify(patch, want, root = ROOT, before = null) {
  const ch = changesOf(patch, root, before), got = digest(ch), d = decide(ch);
  if (got !== want) return { ok: false, why: `지문이 다름 — 승인한 ${want} · 지금 ${got}` };
  if (d.refused.length) return { ok: false, why: `거부 ${d.refused.length}: ${d.refused.map((r) => r.path + ' ' + r.kind).join(' · ')}` };
  return { ok: true, why: `지문 일치 · 자동 ${d.auto.length} · 사람 승인 ${d.approve.length}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, file, want] = process.argv.slice(2);
  if (!['show', 'verify'].includes(cmd) || !file || (cmd === 'verify' && !want)) { console.error('사용: node rebuild/bundle.mjs show <패치> · verify <패치> <지문>'); process.exit(2); }
  const patch = readFileSync(file, 'utf8');
  if (cmd === 'show') { process.stdout.write(show(patch)); process.exit(0); }
  const r = verify(patch, want); console.log((r.ok ? '통과 — ' : '거부 — ') + r.why); process.exit(r.ok ? 0 : 1);
}
