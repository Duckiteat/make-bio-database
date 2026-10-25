// 수신함 읽기 (읽기 전용 — 쓰기·판정·네트워크 없음). 핸드오프 후보의 출처마다 수신함 원문을 모아 사법부 대조(collection_audit.quoteCheck)에 넘긴다.
//   초록 = europepmc/MED-<PMID>.json 의 제목 + abstractText · 전문 = europepmc/PMC-<번호>.xml (후보의 pmcid, 없으면 초록 기록의 pmcid).
//   받기는 여기서 하지 않는다 — mcp/fetch.mjs(입법 서기 받기)만.
'use strict';
const fs = require('fs');
const path = require('path');

function textsFor(entries, dataDir) {
  const dir = path.join(dataDir, 'fetched', 'europepmc'), out = {};
  for (const e of entries || []) {
    const s = e && e.source;
    if (!s || s.db !== 'PMID' || !/^\d+$/.test(String(s.id))) continue;
    const key = `PMID:${s.id}`, t = out[key] || {};
    const med = path.join(dir, `MED-${s.id}.json`);
    let pmcid = /^PMC\d+$/.test(String(e.pmcid || '')) ? e.pmcid : null;
    if (fs.existsSync(med)) {
      const r = (JSON.parse(fs.readFileSync(med, 'utf8')).resultList.result || [])[0] || {};
      t.abstract = [r.title, r.abstractText].filter(Boolean).join(' ');
      if (!pmcid && /^PMC\d+$/.test(String(r.pmcid || ''))) pmcid = r.pmcid;
    }
    const xml = pmcid ? path.join(dir, `PMC-${pmcid.slice(3)}.xml`) : null;
    if (xml && fs.existsSync(xml)) t.fulltext = fs.readFileSync(xml, 'utf8');
    out[key] = t;
  }
  return out;
}

// 출처 논문의 상태 (신뢰 지표 S 축, judicial/reliability.js litS) — 수신함 초록 기록에서: 학술지(MED)·원고(PPR)·철회 표시.
//   { 'PMID:123': { kind, retracted }, 'DOI:10.x/y': … } — MED-<pmid>.json(초록)·DOI-<doi>.json(DOI 검색) 에서. 기록이 없는 식별자는 넣지 않는다(확인 못 함 = 없음, 지어내지 않음)
const RETRACTED = /retracted publication/i;
function literatureStatus(dataDir) {
  const dir = path.join(dataDir, 'fetched', 'europepmc'), out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((n) => /^(MED-\d+|DOI-[A-Za-z0-9._-]+)\.json$/.test(n))) {
    const rs = (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).resultList || {}).result || [];
    const r = rs.find((x) => x.source === 'MED') || rs[0]; // DOI 검색은 여러 원천이 올 수 있다 — 학술지 기록이 있으면 그것
    if (!r) continue;
    const types = (((r.pubTypeList || {}).pubType) || []).map(String);
    const st = { kind: r.source === 'PPR' ? 'preprint' : 'journal', retracted: types.some((t) => RETRACTED.test(t)) };
    if (r.pmid) out[`PMID:${r.pmid}`] = st;
    if (r.doi) out[`DOI:${String(r.doi).toLowerCase()}`] = st; // DOI 는 대소문자를 가리지 않는 식별자
  }
  return out;
}

// BRENDA SOAP 응답 해석 (수신함 data/fetched/brenda/*.xml — 받기는 mcp/fetch.mjs 의 brenda_kinetics 가 서기로).
//   응답은 SOAP 인코딩 배열: <return …><item …><kmValue>…</kmValue><substrate>…</substrate><literature><item>756131</item></literature>…</item>…</return>
//   kind 'km' → kmValue(BRENDA 관례 단위 mM), 'kcat' → turnoverNumber(s⁻¹). 해석만 — 단위 환산·종 판정은 하지 않는다(통합가·관문 몫).
const xmlText = (x) => String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const field = (block, name) => { const m = block.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${name}>)`)); return m ? (m[1] == null ? '' : m[1]) : null; };
function brendaFault(xml) { const m = String(xml).match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/); return m ? xmlText(m[1]) : null; }
function topItems(xml) {
  const ret = (String(xml).match(/<(?:\w+:)?return\b[^>]*>([\s\S]*)<\/(?:\w+:)?return>/) || [])[1];
  if (ret == null) return [];
  const out = []; let depth = 0, start = -1; const re = /<(\/)?item\b[^>]*?(\/)?>/g; let m;
  while ((m = re.exec(ret))) {
    if (m[2]) continue; // <item/>
    if (!m[1]) { if (depth === 0) start = m.index; depth++; } else { depth--; if (depth === 0 && start >= 0) { out.push(ret.slice(start, re.lastIndex)); start = -1; } }
  }
  return out;
}
function brendaRows(xml, kind) {
  const valueName = kind === 'kcat' ? 'turnoverNumber' : 'kmValue';
  return topItems(xml).map((b) => {
    const lit = field(b, 'literature');
    const literature = lit == null ? [] : (lit.match(/<item\b[^>]*>([\s\S]*?)<\/item>/g) || []).map(xmlText).filter(Boolean).concat(/<item\b/.test(lit) ? [] : [xmlText(lit)].filter(Boolean));
    const g = (n) => { const v = field(b, n); return v == null || xmlText(v) === '' ? null : xmlText(v); };
    return { kind, value: g(valueName), valueMax: g(valueName + 'Maximum'), unit: kind === 'kcat' ? 's^-1' : 'mM', substrate: g('substrate'), organism: g('organism'), commentary: g('commentary'), ecNumber: g('ecNumber'), ligandStructureId: g('ligandStructureId'), literature };
  }).filter((r) => r.value != null);
}
function brendaReference(xml) {
  const b = (String(xml).match(/<(?:\w+:)?reference\b[^>]*>([\s\S]*)<\/(?:\w+:)?reference>/) || [])[1] || String(xml);
  const g = (n) => { const v = field(b, n); return v == null ? null : xmlText(v); };
  return { pubmedId: g('pubmedId') || null, title: g('title'), year: g('year'), authors: g('authors'), journal: g('journal') };
}

module.exports = { textsFor, literatureStatus, brendaRows, brendaReference, brendaFault };
