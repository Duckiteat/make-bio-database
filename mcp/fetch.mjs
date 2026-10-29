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
import { createRequire } from 'node:module';
import { serve, need, ROLES } from './protocol.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BIODB_DATA ? resolve(process.env.BIODB_DATA) : join(ROOT, 'data');
const EPMC = join(DATA, 'fetched', 'europepmc');
const API = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
// 원천별 예의 (동작 표): 요청 사이 최소 간격. 우리 쪽 개수를 늘려도 상대 제한이 상한이다 (§4.3 개수 규칙)
const POLITE_MS = { europepmc: 350, brenda: 1000 };
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
// ===== BRENDA (계정 원천 — 사용자 결정: 수집가도 이 도구로) =====
//   계정 정보는 환경 변수에서만 읽는다: BRENDA_EMAIL · BRENDA_PASSWORD_SHA256(비밀번호의 SHA256 16진수 — 원래 비밀번호는 받지 않음).
//   도구 출력·받기 기록·수신함 파일 어디에도 계정 정보를 남기지 않는다(본문은 curl 표준 입력으로, 응답은 저장 전에 지움 — 서기 postToInbox).
const BRENDA = 'https://www.brenda-enzymes.org/soap/brenda_server_zeep.php', BRENDA_DIR = join(DATA, 'fetched', 'brenda');
const INBOX = createRequire(import.meta.url)('../inbox.js');
function brendaCreds() {
  const email = String(process.env.BRENDA_EMAIL || '').trim(), hash = String(process.env.BRENDA_PASSWORD_SHA256 || '').trim().toLowerCase();
  if (!email || !hash) throw new Error('BRENDA 계정이 환경에 없음 — 사람이 환경 설정(Network secrets 또는 환경 변수)에 BRENDA_EMAIL · BRENDA_PASSWORD_SHA256 을 넣고 새 세션을 연다. 채팅·저장소에 넣지 않는다');
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('BRENDA_PASSWORD_SHA256 이 SHA256 16진수(64자)가 아님 — 원래 비밀번호가 아니라 그 해시를 넣는다');
  return { email, hash };
}
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function soapBody(method, creds, parts) {
  const args = [['email', creds.email], ['password', creds.hash], ...parts].map(([k, v]) => `<${k} xsi:type="xsd:string">${esc(v)}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns="ws.brenda"><soapenv:Body><ns:${method} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">${args}</ns:${method}></soapenv:Body></soapenv:Envelope>`;
}
async function brendaCall(method, parts, base, label, refetch) {
  const creds = brendaCreds(), file = base + '.xml', present = existsSync(file) ? file : null;
  if (!present || refetch) await polite('brenda');
  const [r] = CLERK.postToInbox([{ file: base, ext: '.xml', url: BRENDA, label: `${BRENDA}#${method} ${label}`, body: soapBody(method, creds, parts), headers: ['Content-Type: text/xml; charset=utf-8', `SOAPAction: "ws.brenda#${method}"`], redact: [creds.email, creds.hash], present: refetch ? null : present }], { refetch: !!refetch });
  const [ev] = CLERK.appendFetchLog(BRENDA_DIR, [r]);
  if (!r.ok) throw new Error(`BRENDA ${method} 받기 실패 (${r.error}) — 받기 기록 #${ev.seq}`);
  const xml = readFileSync(file, 'utf8'), fault = INBOX.brendaFault(xml);
  if (fault) throw new Error(`BRENDA ${method} 오류: ${fault} — 받기 기록 #${ev.seq}`);
  return { file, xml, log: ev };
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
  { name: 'resolve_doi', roles: W, description: 'DOI 로 Europe PMC 기록을 찾아 수신함(DOI-<정리한 DOI>.json)에 받고, PubMed 번호가 있으면 그 초록(MED-<pmid>.json)도 받는다 — 둘 다 받기 기록', inputSchema: { type: 'object', properties: { doi: { type: 'string' }, refetch: { type: 'boolean' } }, required: ['doi'] },
    run: async (a) => { const doi = need(a, 'doi', /^10\.\d{4,9}\/\S+$/), file = join(EPMC, `DOI-${doi.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
      const r = await get(file, `${API}/search?query=DOI:%22${encodeURIComponent(doi)}%22&resultType=core&format=json`, a.refetch);
      if (!r.ok) return { text: `DOI 검색 실패 (${r.error || '형식'}) — 받기 기록 #${r.log.seq}`, isError: true };
      const hits = (JSON.parse(readFileSync(file, 'utf8')).resultList || {}).result || [], med = hits.find((x) => x.source === 'MED' && x.pmid);
      if (!hits.length) return { text: `DOI ${doi}: Europe PMC 에 기록 없음 (받기 기록 #${r.log.seq}) — 확인하지 못함`, data: { doi, found: false } };
      if (!med) return { text: `DOI ${doi}: 기록 ${hits.length} 개, PubMed 학술지 기록 없음 (원천 ${[...new Set(hits.map((x) => x.source))].join(',')})`, data: { doi, found: true, pmid: null, sources: hits.map((x) => x.source) } };
      const ab = await abstract(med.pmid, false), acc = access(ab.rec);
      return { text: `DOI ${doi} → PMID ${med.pmid} — ${ACCESS_KO[acc]} · 초록 ${relp(ab.file)} (받기 기록 #${r.log.seq}·#${ab.log.seq})`, data: { doi, pmid: med.pmid, access: acc, inbox: relp(ab.file) } }; } },
  { name: 'brenda_kinetics', roles: W, description: 'BRENDA 에서 EC 번호·생물종의 Km(mM)·kcat(s⁻¹) 기록과 그 문헌의 PubMed 번호를 받는다 (계정은 환경 변수 — 이 도구는 계정 정보를 돌려주지 않는다). 받은 원본은 수신함 data/fetched/brenda/ 에, 받을 때마다 받기 기록. 값은 후보 — 사람(9606) 값만 사람 칸에', inputSchema: { type: 'object', properties: { ec: { type: 'string', description: '예: 1.1.1.37' }, organism: { type: 'string', description: '기본 Homo sapiens' }, kinds: { type: 'array', items: { type: 'string', enum: ['km', 'kcat'] } }, refetch: { type: 'boolean' } }, required: ['ec'] },
    run: async (a) => {
      const ec = need(a, 'ec', /^\d+\.\d+\.\d+\.\d+$/), org = a.organism == null ? 'Homo sapiens' : need(a, 'organism', /^[A-Za-z][A-Za-z .-]{1,60}$/);
      const kinds = Array.isArray(a.kinds) && a.kinds.length ? a.kinds.filter((k) => k === 'km' || k === 'kcat') : ['km', 'kcat'];
      const tag = `EC${ec}-${org.replace(/[^A-Za-z]+/g, '-')}`, rows = [], files = [];
      for (const kind of kinds) {
        const method = kind === 'km' ? 'getKmValue' : 'getTurnoverNumber', vn = kind === 'km' ? 'kmValue' : 'turnoverNumber';
        const parts = [['ecNumber', `ecNumber*${ec}`], ['organism', `organism*${org}`], [vn, `${vn}*`], [vn + 'Maximum', `${vn}Maximum*`], ['substrate', 'substrate*'], ['commentary', 'commentary*'], ['ligandStructureId', 'ligandStructureId*'], ['literature', 'literature*']];
        const r = await brendaCall(method, parts, join(BRENDA_DIR, `${tag}-${kind}`), `ecNumber=${ec} organism=${org}`, a.refetch);
        files.push({ kind, inbox: relp(r.file), sha256: r.log.sha256, log_seq: r.log.seq });
        rows.push(...INBOX.brendaRows(r.xml, kind));
      }
      // 문헌 번호 → PubMed 번호 (같은 번호는 한 번만, 받은 것은 다시 받지 않음)
      const pmid = {};
      for (const id of [...new Set(rows.flatMap((x) => x.literature))].slice(0, 40)) {
        if (!/^\d+$/.test(id)) continue;
        try { const r = await brendaCall('getReferenceById', [['id', id]], join(BRENDA_DIR, 'ref', `lit-${id}`), `id=${id}`, false); pmid[id] = INBOX.brendaReference(r.xml).pubmedId || null; } catch (e) { pmid[id] = null; }
      }
      for (const x of rows) x.pmids = x.literature.map((id) => pmid[id] || null);
      const human = rows.filter((x) => /^homo sapiens$/i.test(x.organism || ''));
      const line = (x) => `  ${x.kind === 'km' ? 'Km' : 'kcat'} ${x.value}${x.valueMax ? '–' + x.valueMax : ''} ${x.unit} · ${x.substrate || '?'} · ${x.organism || '?'} · PMID ${x.pmids.filter(Boolean).join(',') || '없음'} · ${(x.commentary || '').slice(0, 80)}`;
      return { text: [`BRENDA EC ${ec} · ${org}: 기록 ${rows.length} (사람 ${human.length})`, ...rows.slice(0, 60).map(line), `수신함: ${files.map((f) => `${f.inbox} (sha256 ${String(f.sha256 || '').slice(0, 12)}…, 받기 기록 #${f.log_seq})`).join(' · ')}`].join('\n'), data: { ec, organism: org, rows, files } };
    } },
];

serve({ name: 'biodb-fetch', version: '1', instructions: '바깥 원천 받기 — 공개 전문·초록만, 받을 때마다 받기 기록. db 를 읽거나 바꾸지 않는다.', tools: tools.map((t) => ({ ...t, roles: t.roles.filter((r) => ROLES.includes(r)) })) });
