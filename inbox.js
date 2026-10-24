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

module.exports = { textsFor, literatureStatus };
