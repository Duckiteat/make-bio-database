// 권한 구조 검사 (STG-12 · DEC-0048) — 저장 지도(docs/textbook/storage-map.json)의 authority·files 를 대조한다.
// 계약: 순수 — 값만 받고 오류 문장 목록만 돌려준다 (읽기·쓰기 없음). 사법부 — 쓰기·실행 없음. dbtool textbook --check 와 tests/authority.test.mjs 가 부른다.
//   열쇠 표(authority.keys) · 구역 표(authority.areas) · 자리(files: level · area · write_keys ⊆ 구역) · 서기 호출 표(authority.callers)
//   상속은 열쇠의 max_level 까지(사람 전부 · 세션 L2 · 도구·생성기 자기 구역). L5 는 서기+사법부 두 열쇠, L6 을 세션이 쓰려면 사람 판정.
//   위로 넓히는 길은 구역 표에 적은 예외뿐 (RULE-0461).
const RULE = 'RULE-0527'; // 오류 문장 앞에 붙는 규칙 번호
const LV = (l) => Number(String(l).slice(1));
export const DEBT_MAX = 2; // 담당 열쇠 없는 구역(unassigned) 상한 — 늘리지 않는다

export function checkAuthority(map) {
  const err = [], AU = map.authority || {}, KEYS = AU.keys || {}, AREAS = AU.areas || {};
  const need = (a, k) => { if (!KEYS[k]) { err.push(`${RULE} storage-map: 구역 '${a}' 의 열쇠 '${k}' 가 authority.keys 에 없음`); return { kind: '?', max_level: 'L0' }; } return KEYS[k]; };
  let debt = 0;
  for (const [a, z] of Object.entries(AREAS)) {
    if (!/^L[0-6]$/.test(z.level || '')) { err.push(`${RULE} storage-map: 구역 '${a}' 의 level 이 L0–L6 이 아님`); continue; }
    const wk = (z.write_keys || []).map((k) => need(a, k)), jk = (z.judge_keys || []).map((k) => need(a, k));
    if (!wk.length || !jk.length) err.push(`${RULE} storage-map: 구역 '${a}' 에 쓰는/판정 열쇠가 비어 있음 (판정 없음은 'none')`);
    if ((z.write_keys || []).includes('unassigned')) debt++;
    const strong = jk.some((k) => k.kind === 'human' || k.kind === 'judge');
    for (const k of wk) if (LV(k.max_level) < LV(z.level) && !strong && !z.예외) err.push(`${RULE} storage-map: 구역 '${a}'(${z.level}) 의 열쇠가 max_level ${k.max_level} 를 넘음 — 예외나 사람·사법부 판정이 필요`);
    if (z.level === 'L5') {
      if (wk.some((k) => k.kind !== 'clerk')) err.push(`${RULE} storage-map: L5 구역 '${a}' 의 쓰는 열쇠는 서기(clerk)만`);
      if (!jk.every((k) => k.kind === 'judge') && !z.예외) err.push(`${RULE} storage-map: L5 구역 '${a}' 는 판정 열쇠(judicial)가 있어야 함 — 없으면 예외를 적는다`);
    }
    if (z.level === 'L6' && wk.some((k) => k.kind === 'session') && !jk.some((k) => k.kind === 'human')) err.push(`${RULE} storage-map: L6 구역 '${a}' 를 세션이 쓰려면 사람 확인(human 판정)이 있어야 함`);
  }
  if (debt > DEBT_MAX) err.push(`${RULE} storage-map: 담당 열쇠 없는 구역(unassigned)이 ${debt} — 상한 ${DEBT_MAX} (늘리지 않는다)`);
  for (const f of map.files || []) {
    const z = AREAS[f.area];
    if (!z) { err.push(`${RULE} storage-map: '${f.path}' 의 구역 '${f.area}' 가 authority.areas 에 없음`); continue; }
    if (f.level !== z.level) err.push(`${RULE} storage-map: '${f.path}' 의 등급 ${f.level} 이 구역 '${f.area}'(${z.level}) 와 다름`);
    if (!Array.isArray(f.write_keys) || !f.write_keys.length || f.write_keys.some((k) => !(z.write_keys || []).includes(k))) err.push(`${RULE} storage-map: '${f.path}' 의 write_keys 가 구역 '${f.area}' 표의 부분집합이 아님`);
  }
  for (const [fn, c] of Object.entries(AU.callers || {})) if (!KEYS[c.key]) err.push(`${RULE} storage-map: 서기 함수 ${fn} 의 열쇠 '${c.key}' 가 authority.keys 에 없음`);
  return err;
}

// 서기 쓰기 함수를 부르는 모듈이 표 안인가 — sources: { 경로: 원문 } (clerk 자신 · 시험 · 작업 기록은 뺀 코드 전체)
export function checkCallers(map, sources) {
  const err = [], callers = (map.authority || {}).callers || {};
  for (const [fn, c] of Object.entries(callers)) {
    const re = new RegExp('\\b' + fn + '\\s*\\(');
    for (const [path, src] of Object.entries(sources)) if (re.test(src) && !c.modules.includes(path)) err.push(`${RULE} ${path} 가 ${fn}() 을 부름 — 표(authority.callers)에 없는 모듈 (열쇠 ${c.key})`);
    for (const m of c.modules) if (sources[m] !== undefined && !re.test(sources[m])) err.push(`${RULE} authority.callers.${fn} 의 모듈 ${m} 은 더 이상 부르지 않음 — 표에서 거둔다`);
  }
  return err;
}
