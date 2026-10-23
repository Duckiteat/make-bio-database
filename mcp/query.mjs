#!/usr/bin/env node
// MCP 서버 query — 메모리에 띄운 저장소를 읽는 창구 (설계 docs/design/outsourcing-and-mcp.md §4.3).
//   db·색인·원장을 메모리에 두고 조회만 한다. 쓰기 없음 — 쓰기는 clerk 서버(입출력기)만.
//   무효화 열쇠: db.json·가정·사전·사전 등록 원장의 (크기, 수정 시각) — 바뀌면 다음 호출에서 다시 읽는다.
//   실행: BIODB_ROLE=collector node mcp/query.mjs   (BIODB_DATA = 다른 data 폴더, 시험용)
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, need, ROLES } from './protocol.mjs';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BIODB_DATA ? resolve(process.env.BIODB_DATA) : join(ROOT, 'data');
const C = require('../core.js'), J = require('../judicial/judicial.js'), QG = require('../judicial/qual_graph.js');
const SO = require('../judicial/scene_origin.js'), AA = require('../judicial/assumption_audit.js'), CA = require('../judicial/collection_audit.js');
const SCN = require('../scenarios.js');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const FILES = ['db.json', 'assumptions.jsonl', 'dictionary.jsonl', 'preregistrations.jsonl'];
const SCENARIO_DIR = join(ROOT, 'examples', 'scenarios');
const jsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

let state = null;
const keyNow = () => FILES.map((f) => { const p = join(DATA, f); if (!existsSync(p)) return `${f}:-`; const s = statSync(p); return `${f}:${s.size}:${s.mtimeMs}`; }).join('|');
function S() {
  const key = keyNow();
  if (state && state.key === key) return state;
  const t0 = performance.now(), text = readFileSync(join(DATA, 'db.json'), 'utf8'), db = C.normalize(JSON.parse(text));
  state = { key, db, ix: C.index(db), dbSha: sha(text), assumptions: jsonl(join(DATA, 'assumptions.jsonl')), loads: (state ? state.loads : 0) + 1, loadMs: performance.now() - t0 };
  return state;
}
const scenarios = () => Object.fromEntries(readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.json') && f !== 'subjects.json').sort().map((f) => [f, JSON.parse(readFileSync(join(SCENARIO_DIR, f), 'utf8'))]));
const inRepo = (p) => { const abs = resolve(ROOT, p), r = relative(ROOT, abs); if (r.startsWith('..')) throw new Error(`저장소 밖 경로: ${p}`); return abs; };
const subjectOf = (file) => { const f = join(SCENARIO_DIR, 'subjects.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).subjects[basename(file)] || null : null; };
const ALL = ROLES;
const str = (d) => ({ type: 'string', description: d });

const tools = [
  { name: 'summary', roles: ALL, description: '저장소 요약 — 개수·db sha256·무효화 열쇠·다시 읽은 횟수', inputSchema: { type: 'object', properties: {} },
    run: () => { const s = S(), d = s.db; const data = { terms: Object.keys(d.terms).length, senses: Object.keys(d.senses).length, steps: Object.keys(d.steps).length, observations: Object.keys(d.observations).length, values: Object.keys(d.values || {}).length, limitations: Object.keys(d.limitations).length, assumptions: s.assumptions.length, db_sha256: s.dbSha, loads: s.loads, load_ms: Math.round(s.loadMs) };
      return { text: Object.entries(data).map(([k, v]) => `${k} ${v}`).join(' · '), data }; } },
  { name: 'map', roles: ALL, description: '참조(번호·이름·외부 ID·지문)가 어느 정의항(D…)으로 매핑되는지', inputSchema: { type: 'object', properties: { ref: str('번호·이름·외부 ID') }, required: ['ref'] },
    run: (a) => C.mapText(S().db, need(a, 'ref')) },
  { name: 'context', roles: ALL, description: '이름의 뜻이 여럿일 때 맥락별 정의항', inputSchema: { type: 'object', properties: { name: str('이름'), up: { type: 'integer' }, down: { type: 'integer' } }, required: ['name'] },
    run: (a) => C.contextText(S().db, need(a, 'name'), { up: a.up || 4, down: a.down || 1 }) },
  { name: 'mechanism', roles: ALL, description: '정의항·경로의 기전(위·아래 단계)', inputSchema: { type: 'object', properties: { ref: str('D… 또는 이름'), up: { type: 'integer' }, down: { type: 'integer' } }, required: ['ref'] },
    run: (a) => C.mechanismText(S().db, need(a, 'ref'), { up: a.up || 3, down: a.down || 3 }) },
  { name: 'pattern', roles: ALL, description: '경로의 사고 패턴(지문)', inputSchema: { type: 'object', properties: { ref: str('경로 D…') }, required: ['ref'] },
    run: (a) => C.patternText(S().db, need(a, 'ref')) },
  { name: 'limitations', roles: ALL, description: '한계 — mode: open(열린 것) · all · coverage(측정 사각 지도) · detect(미등록 후보 + 재검토 후보)', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['open', 'all', 'coverage', 'detect'] } } },
    run: (a) => { const db = S().db, m = a.mode || 'open';
      if (m === 'coverage') return J.coverageMapText(db);
      if (m === 'detect') { const c = J.detectGaps(db), rv = J.reviewCandidates(db); return [c.length ? '등록되지 않은 한계 후보:\n' + c.map((x) => `  [${x.target} | ${x.type}] ${x.why}`).join('\n') : '등록되지 않은 한계 후보 없음', ...(rv.length ? ['다시 볼 한계 (해결 판정 아님):\n' + rv.map((x) => `  ${x.limitation} [${x.target} | ${x.type}] ${x.trigger}: ${x.hits.join(', ')}`).join('\n')] : [])].join('\n'); }
      return J.limitationsText(db, { open: m === 'open' }); } },
  { name: 'origin', roles: ALL, description: '첫 장면 기원 — 시나리오 시작 숫자마다 실측·추상·가정·기원 없음 (가정 번호 포함)', inputSchema: { type: 'object', properties: { scenario: str('시나리오 경로 (저장소 안)'), target: str('대상 상태·경로 (없으면 subjects.json)') }, required: ['scenario'] },
    run: (a) => { const s = S(), f = inRepo(need(a, 'scenario')), target = a.target || subjectOf(f); if (!target) throw new Error('대상 없음 — target 을 주거나 subjects.json 에 등록');
      const tg = C.resolveRef(s.ix, target); if (tg.error) throw new Error(tg.error);
      const L = SCN.load(f, { ledger: s.assumptions }), v = SO.sceneOrigin(s.db, L.scenario, { target: tg.id, used: L.used }); if (v.error) throw new Error(v.error);
      return { text: SO.sceneOriginText(v, basename(f)), data: { count: v.count } }; } },
  { name: 'assume_uses', roles: ALL, description: '가정 번호(A…)를 쓰는 시나리오 — 번호로 가리킨 것 + 등록 시나리오의 내용 일치', inputSchema: { type: 'object', properties: { id: str('A…') }, required: ['id'] },
    run: (a) => { const u = AA.uses(S().assumptions, scenarios(), need(a, 'id', /^A\d{6}$/)); if (u.error) throw new Error(u.error);
      return { text: `${u.record.id} = ${u.record.value}${u.record.unit ? ' ' + u.record.unit : ''} [${u.record.slot.kind} ${u.record.slot.key} · ${u.record.slot.param}] · 기원 ${u.record.origin}\n  번호로 가리킴: ${u.ref.join(', ') || '없음'}\n  내용 일치(등록 시나리오): ${u.content.join(', ') || '없음'}`, data: { ref: u.ref, content: u.content, revisedBy: u.revisedBy } }; } },
  { name: 'qualgraph', roles: ALL, description: '정성 그래프 0 층 — 기전 경로 부호 대 정성 관찰 주장 (ids 없으면 전부)', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } },
    run: (a) => QG.qualGraphText(QG.qualGraphVerdict(S().db, a.ids && a.ids.length ? { ids: a.ids } : {})) },
  { name: 'retraction', roles: ALL, description: '철회 전파 — 철회된(또는 ids 로 철회를 가정한) 관찰에 기댄 값·규칙·단계·경로·결론', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } },
    run: (a) => J.retractionText(S().db, { ...(a.ids && a.ids.length ? { assume: a.ids } : {}), scenarios: scenarios() }) },
  { name: 'inbox', roles: ALL, description: '수신함에 무엇이 있나 — PMID(초록)·PMCID(전문)의 파일·크기·sha256', inputSchema: { type: 'object', properties: { pmid: str('PMID'), pmcid: str('PMC…') } },
    run: (a) => { const dir = join(DATA, 'fetched', 'europepmc'), files = [];
      if (a.pmid) files.push(join(dir, `MED-${need(a, 'pmid', /^\d+$/)}.json`));
      if (a.pmcid) files.push(join(dir, `PMC-${need(a, 'pmcid', /^PMC\d+$/).slice(3)}.xml`));
      if (!files.length) throw new Error('pmid 또는 pmcid 가 필요함');
      const rows = files.map((f) => existsSync(f) ? { file: relative(ROOT, f), bytes: statSync(f).size, sha256: sha(readFileSync(f)) } : { file: relative(ROOT, f), missing: true });
      return { text: rows.map((r) => r.missing ? `없음 ${r.file}` : `있음 ${r.file} · ${r.bytes} B · sha256 ${r.sha256.slice(0, 12)}…`).join('\n'), data: rows }; } },
  { name: 'verify_collection', roles: ALL, description: '후보 판정 (verify-collection) — 핸드오프 .jsonl 글을 받아 PASS·REVIEW_REQUIRED·INCOMPLETE·BLOCKED·REJECTED', inputSchema: { type: 'object', properties: { jsonl: str('핸드오프 후보, 한 줄 한 JSON') }, required: ['jsonl'] },
    run: (a) => { const db = S().db, lines = need(a, 'jsonl').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('//'));
      const entries = lines.map((x, i) => { try { return JSON.parse(x); } catch (e) { throw new Error(`${i + 1}행이 JSON 이 아님`); } }).filter((o) => o && typeof o === 'object' && !('_task' in o) && !('_meta' in o));
      const epDir = join(DATA, 'fetched', 'europepmc'), sourceChecks = {};
      for (const s of CA.sourcesOf(entries)) if (sourceChecks[s.key] == null) sourceChecks[s.key] = s.db === 'PMID' && existsSync(join(epDir, `MED-${s.id}.json`)) ? 'resolves' : 'error';
      const res = CA.auditCollection(db, entries, { sourceChecks });
      return { text: CA.auditText(res), data: { verdict: res.verdict }, isError: false }; } },
];

serve({ name: 'biodb-query', version: '1', instructions: '읽기 전용 조회 — 저장소를 바꾸지 않는다. 쓰기는 biodb-clerk 서버만.', tools });
