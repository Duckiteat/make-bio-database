// 시나리오 읽기 (읽기 전용 — 쓰기·판정·엔진 없음). 파일 + 가정 원장(data/assumptions.jsonl)을 읽어 번호를 숫자로 푼다.
//   풀기 자체는 컴파일러(compiler/assumptions.js)의 순수 함수다. 이 모듈은 파일을 읽어 넘기기만 한다 — dbtool·조정자 밖 시험이 같은 길을 쓴다.
//   번호가 없는 시나리오(등록된 인라인 시나리오)는 파일 그대로 — 글자(text)까지 같아서 입력 해시가 바뀌지 않는다.
'use strict';
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const AS = require('./compiler/assumptions.js');

const LEDGER = path.join(__dirname, 'data', 'assumptions.jsonl');
const asPath = (p) => (p instanceof URL ? fileURLToPath(p) : String(p));
function ledger(file) {
  const f = file || LEDGER;
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
}
// { scenario, used, text } — 풀리지 않으면 예외 (조용히 숫자를 지어내지 않는다)
function load(p, opt = {}) {
  const file = asPath(p), raw = fs.readFileSync(file, 'utf8'), sc = JSON.parse(raw);
  const r = AS.resolve(sc, opt.ledger || ledger(opt.ledgerFile));
  if (r.error) throw new Error(`시나리오 ${path.basename(file)}: ${r.error}`);
  return { scenario: r.scenario, used: r.used, text: r.used.length ? JSON.stringify(r.scenario, null, 2) + '\n' : raw };
}
const read = (p, opt) => load(p, opt).scenario;
const text = (p, opt) => load(p, opt).text;

module.exports = { load, read, text, ledger, LEDGER };
