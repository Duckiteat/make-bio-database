#!/usr/bin/env node
// MCP 서버 fetch — 바깥 원천과 말하는 창구 (설계 docs/design/outsourcing-and-mcp.md §4.3·§5).
//   받기는 입법 서기(fetchToInbox — 증거 구역만)가 하고, 받을 때마다 받기 기록(FETCH_LOG, 추가 전용 사슬)을 남긴다.
//   db 를 읽지 않는다. 판단(무엇을 받을지)은 부르는 에이전트가, 받기와 기록은 이 도구가 — 기록이 곧 증거다(§4.4).
//   공개 전문(OA)만 원본을 받는다. PMC 무료 열람(OA 아님)·유료는 받지 않고 상태만 알린다(저작권 · 로그인 금지).
//   실행: BIODB_ROLE=collector node mcp/fetch.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as CLERK from '../legislative/clerk.mjs';
import { serve, need, ROLES } from './protocol.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BIODB_DATA ? resolve(process.env.BIODB_DATA) : join(ROOT, 'data');
const EPMC = join(DATA, 'fetched', 'europepmc');
const API = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
// 원천별 예의 (동작 표): 요청 사이 최소 간격. 우리 쪽 개수를 늘려도 상대 제한이 상한이다 (§4.3 개수 규칙)
const POLITE_MS = { europepmc: 350 };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const last = {};
async function polite(src) { const wait = (last[src] || 0) + POLITE_MS[src] - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last[src] = Date.now(); }

// 받기 한 건 → 서기 받기 + 받기 기록. 이미 있으면 다시 받지 않는다(기록에는 cached 로)
async function get(file, url, refetch) {
  const base = file.replace(/\.(json|xml)$/, ''), ext = file.endsWith('.xml') ? '.xml' : '.json', present = existsSync(file) ? file : null;
  if (!present || refetch) await polite('europepmc');
  const [r] = CLERK.fetchToInbox([{ file: base, urls: [url], present: refetch ? null : present }], { refetch: !!refetch });
  if (r.file && !r.file.endsWith(ext)) r.ok = false;
  const [ev] = CLERK.appendFetchLog(EPMC, [{ ...r, url: r.url || url }]);
  return { ...r, log: ev };
}
const access = (rec) => (rec.isOpenAccess === 'Y' ? 'open' : rec.inPMC === 'Y' ? 'free_read' : 'paywalled');
const ACCESS_KO = { open: '공개 전문 — 원본 XML 을 받을 수 있음', free_read: 'PMC 무료 열람 — 본문을 저장하지 않는다(저작권). 사람이 읽고 인용·sha256 만', paywalled: '유료 — 받지 않는다. 사람이 받아 올리는 길(RETRIEVAL_TASKS)로만. 로그인 금지' };
const relp = (f) => relative(ROOT, f);

async function abstract(pmid, refetch) {
  const file = join(EPMC, `MED-${pmid}.json`);
  const r = await get(file, `${API}/search?query=EXT_ID:${pmid}%20AND%20SRC:MED&resultType=core&format=json`, refetch);
  if (!r.ok) throw new Error(`초록 받기 실패 (${r.error || '형식'}) — 받기 기록 #${r.log.seq}`);
  const rec = (JSON.parse(readFileSync(file, 'utf8')).resultList.result || [])[0];
  if (!rec) throw new Error(`PMID ${pmid} 결과 없음 — 받기 기록 #${r.log.seq}`);
  return { file, rec, log: r.log };
}

const W = ['collector', 'integrator', 'human'];
const tools = [
  { name: 'resolve_access', roles: W, description: 'PMID 의 접근 상태 — open(공개 전문) · free_read(PMC 무료 열람) · paywalled(유료). 초록을 수신함에 받고 기록을 남긴다', inputSchema: { type: 'object', properties: { pmid: { type: 'string' }, refetch: { type: 'boolean' } }, required: ['pmid'] },
    run: async (a) => { const { file, rec, log } = await abstract(need(a, 'pmid', /^\d{1,9}$/), a.refetch), acc = access(rec);
      const data = { pmid: rec.pmid, pmcid: rec.pmcid || null, doi: rec.doi || null, title: rec.title, access: acc, inbox: relp(file), sha256: log.sha256 || sha(readFileSync(file)), log_seq: log.seq };
      return { text: `PMID ${data.pmid}${data.pmcid ? ` · ${data.pmcid}` : ''} — ${ACCESS_KO[acc]}\n  ${data.title}\n  초록 ${data.inbox} (sha256 ${data.sha256.slice(0, 12)}…, 받기 기록 #${log.seq}${log.cached ? ' · 이미 있음' : ''})`, data }; } },
  { name: 'fetch_abstract', roles: W, description: 'PMID 초록을 수신함(MED-<pmid>.json)에 받는다 — 정성 관찰 인용 대조용', inputSchema: { type: 'object', properties: { pmid: { type: 'string' }, refetch: { type: 'boolean' } }, required: ['pmid'] },
    run: async (a) => { const { file, log } = await abstract(need(a, 'pmid', /^\d{1,9}$/), a.refetch); return { text: `초록 ${relp(file)} · sha256 ${(log.sha256 || '').slice(0, 12)}… · 받기 기록 #${log.seq}${log.cached ? ' (이미 있음)' : ''}`, data: { inbox: relp(file), sha256: log.sha256, log_seq: log.seq } }; } },
  { name: 'fetch_fulltext', roles: W, description: '공개 전문(OA)만 원본 XML 을 수신함(PMC-<번호>.xml)에 받는다. 공개 여부는 같은 PMID 초록의 isOpenAccess 로 판정 — OA 가 아니면 받지 않는다', inputSchema: { type: 'object', properties: { pmid: { type: 'string' }, refetch: { type: 'boolean' } }, required: ['pmid'] },
    run: async (a) => { const { rec, log: alog } = await abstract(need(a, 'pmid', /^\d{1,9}$/), false), acc = access(rec);
      if (acc !== 'open') return { text: `받지 않음 — ${ACCESS_KO[acc]} (판정 근거: 초록 받기 기록 #${alog.seq})`, data: { access: acc }, isError: true };
      if (!/^PMC\d+$/.test(rec.pmcid || '')) return { text: '공개라는데 PMCID 가 없음 — 받지 않음', isError: true };
      const file = join(EPMC, `PMC-${rec.pmcid.slice(3)}.xml`), r = await get(file, `${API}/${rec.pmcid}/fullTextXML`, a.refetch);
      if (!r.ok) return { text: `전문 받기 실패 (${r.error || '형식'}) — 받기 기록 #${r.log.seq}`, isError: true };
      return { text: `전문 ${relp(file)} · ${r.log.bytes} B · sha256 ${(r.log.sha256 || '').slice(0, 12)}… · 받기 기록 #${r.log.seq}${r.log.cached ? ' (이미 있음)' : ''}`, data: { pmcid: rec.pmcid, inbox: relp(file), bytes: r.log.bytes, sha256: r.log.sha256, log_seq: r.log.seq } }; } },
];

serve({ name: 'biodb-fetch', version: '1', instructions: '바깥 원천 받기 — 공개 전문·초록만, 받을 때마다 받기 기록. db 를 읽거나 바꾸지 않는다.', tools: tools.map((t) => ({ ...t, roles: t.roles.filter((r) => ROLES.includes(r)) })) });
