#!/usr/bin/env node
// MCP 서버 clerk — 입출력기, 저장소를 바꾸는 유일한 문 (설계 docs/design/outsourcing-and-mcp.md §4.3).
//   · 역할 확인: 수집가(collector)는 핸드오프 붙이기만. 권위 쓰기(병합·등록·가정·사전·도장·파생 문서)는 통합가·사람만.
//   · 사법부 재판정: 권위 쓰기는 dbtool 명령을 그대로 부른다 — 그 명령이 관문·봉인·원장 감사를 스스로 다시 돌린 뒤
//     입법 서기로 쓴다. 다른 서버가 낸 판정을 믿지 않고, 같은 로직을 두 번 쓰지 않는다.
//   · 단일 작성자: 한 저장소에 한 개만 뜬다(잠금 파일). 요청은 하나씩 처리한다(protocol.mjs).
//   · --allow-warnings 는 사람 역할만 (CLAUDE.md: 사용자 허락 시만).
//   실행: BIODB_ROLE=integrator node mcp/clerk.mjs
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CLERK from '../legislative/clerk.mjs';
import { serve, need, roleOf } from './protocol.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DBTOOL = join(ROOT, 'dbtool.mjs');

// 단일 작성자 잠금 — 저장소마다 하나 (잠금 파일은 입법 서기가 저장소 밖에)
let release;
try { release = CLERK.writerLock(ROOT); } catch (e) { process.stderr.write(e.message + '\n'); process.exit(1); }
process.on('exit', () => release()); for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => process.exit(0));

// dbtool 명령 하나 — 종료 코드와 출력을 그대로 돌려준다
function dbtool(args) {
  try { return { text: execFileSync(process.execPath, [DBTOOL, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim(), isError: false }; }
  catch (e) { return { text: [String(e.stdout || '').trim(), String(e.stderr || '').trim()].filter(Boolean).join('\n') || e.message, isError: true }; }
}
// 패치·기록 파일은 저장소 밖에서 온다 (CLAUDE.md: 패치는 저장소 밖에)
const outside = (p) => { const abs = resolve(p); if (!abs.startsWith('/')) throw new Error('절대 경로가 필요함'); if (!abs.startsWith(ROOT + '/') && abs !== ROOT) return abs; if (abs.startsWith(join(ROOT, 'examples') + '/')) return abs; throw new Error(`저장소 안의 파일은 받지 않음 (패치·기록은 저장소 밖에): ${p}`); };
const INT = ['integrator', 'human'];
const role = roleOf();

const tools = [
  { name: 'put_handoff', roles: ['collector', 'integrator', 'human'], description: '핸드오프에 후보 줄을 붙인다 (workspace/handoff/<name>.jsonl, 추가만). 수집가가 쓸 수 있는 유일한 자리', inputSchema: { type: 'object', properties: { name: { type: 'string', description: '소문자·숫자·하이픈' }, lines: { type: 'array', items: { type: 'object' } } }, required: ['name', 'lines'] },
    run: (a) => { const f = CLERK.appendHandoff(need(a, 'name'), a.lines); return { text: `핸드오프에 ${a.lines.length}줄 붙임: ${f.slice(ROOT.length + 1)} — 후보일 뿐, 통합가가 1차 출처로 재확인해야 패치가 된다`, data: { file: f.slice(ROOT.length + 1), lines: a.lines.length } }; } },
  { name: 'validate_patch', roles: INT, description: '패치 관문 미리 보기 (쓰지 않음) — dbtool validate <patch>', inputSchema: { type: 'object', properties: { path: { type: 'string', description: '저장소 밖 패치 파일 절대 경로' } }, required: ['path'] },
    run: (a) => dbtool(['validate', outside(need(a, 'path'))]) },
  { name: 'merge', roles: INT, description: '패치 병합 — 관문 통과 + 봉인 뒤 서기가 db.json·patches 를 쓴다. allow_warnings 는 사람 역할만', inputSchema: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } }, dry: { type: 'boolean' }, allow_warnings: { type: 'boolean' } }, required: ['paths'] },
    run: (a) => { if (a.allow_warnings && role !== 'human') return { text: '--allow-warnings 는 사람 역할만 (사용자 허락 시만)', isError: true };
      if (!Array.isArray(a.paths) || !a.paths.length) throw new Error('paths 가 필요함');
      return dbtool(['merge', ...a.paths.map(outside), ...(a.dry ? ['--dry'] : []), ...(a.allow_warnings ? ['--allow-warnings'] : [])]); } },
  { name: 'augment_apply', roles: INT, description: '원본 대조 고리의 적용 — dbtool augment apply <patch>', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (a) => dbtool(['augment', 'apply', outside(need(a, 'path'))]) },
  { name: 'register', roles: INT, description: '사전 등록 — 규약 구조 판정 통과 + 가정은 번호로만인 시나리오를 실행 전에 남긴다', inputSchema: { type: 'object', properties: { scenario: { type: 'string', description: '시나리오 파일 절대 경로' } }, required: ['scenario'] },
    run: (a) => dbtool(['register', outside(need(a, 'scenario'))]) },
  { name: 'assume_add', roles: INT, description: '가정 원장에 기록 추가 — 사법부 검사 → 봉인 → 서기', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (a) => dbtool(['assume', 'add', outside(need(a, 'path'))]) },
  { name: 'dictionary_add', roles: INT, description: '사전에 항목 추가 — 사법부 검사 → 봉인 → 서기', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (a) => dbtool(['dictionary', 'add', outside(need(a, 'path'))]) },
  { name: 'accept', roles: INT, description: '높은 용도(검증 근거·기준) 승인·철회 도장 — 이유 필수, 축·관계 조건을 넘는 승인은 서기가 거부. 역할(BIODB_ROLE)이 승인자로 기록된다', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, use: { type: 'string', enum: ['evidence', 'standard'] }, reason: { type: 'string' }, revoke: { type: 'boolean' } }, required: ['ids', 'use', 'reason'] },
    run: (a) => { const ids = a.ids; if (!Array.isArray(ids) || !ids.length || !ids.every((x) => /^O\d{6}$/.test(x))) throw new Error('ids 는 관찰 번호(O…) 목록'); return dbtool(['accept', ...ids, '--use', need(a, 'use'), '--reason', need(a, 'reason'), ...(a.revoke ? ['--revoke'] : [])]); } },
  { name: 'attest', roles: INT, description: '증명 등록부 재검증', inputSchema: { type: 'object', properties: {} }, run: () => dbtool(['attest']) },
  { name: 'write_derived', roles: INT, description: '파생 문서 다시 쓰기 — limitations.md 또는 교과서 부록', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['limitations', 'textbook'] } }, required: ['kind'] },
    run: (a) => dbtool(a.kind === 'textbook' ? ['textbook', '--write'] : ['limitations', '--write']) },
];

serve({ name: 'biodb-clerk', version: '1', instructions: '입출력기 — 저장소를 바꾸는 유일한 문. 권위 쓰기는 사법부 재판정 뒤에만, 수집가는 핸드오프만.', tools, role });
