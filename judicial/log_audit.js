// 사법부 — 델타 기록 감사 (Log Audit). docs/design/integral-field-engine.md §17 (S1)
//
// 원본은 기원 체크포인트 + 추가만 하는 사건 사슬이고 data/db.json 은 그 재생 결과다. 이 파일은 두 가지를 판정한다:
//   ① 사슬 무결성 — 기원 루트 = sha256('genesis\n' + 기원 db sha256), 사건마다 prev = 직전 루트, root = sha256(prev + '\n' + 정준 JSON), seq 연속.
//      중간 사건을 고치거나 빼거나 끼우면 그 뒤 루트가 모두 어긋난다.
//   ② 재생 일치 — 기원 스냅숏의 sha256 = 기원이 적은 값, 사건마다 재생한 db 의 sha256 = 사건이 적은 봉인 값, 마지막 = 지금 db.json.
// 재생(병합)은 하지 않는다 — 조정자(orchestrator.replayLog)가 입법부 순수 함수로 재생해 sha256 목록을 넘긴다. 쓰기·엔진 실행 없음.
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

function verifyChain(genesis, events) {
  const errors = [];
  if (!genesis || genesis.format !== 'definition-db-log') return { ok: false, errors: ['기원 체크포인트가 없거나 형식이 다름'] };
  if (genesis.root !== sha('genesis\n' + genesis.db_sha256)) errors.push('기원 루트가 기원 db sha256 과 맞지 않음');
  let prev = genesis.root;
  events.forEach((ev, i) => {
    const { root, ...body } = ev;
    if (ev.seq !== i + 1) errors.push(`사건 ${i + 1}: seq ${ev.seq} — 빠지거나 끼운 사건`);
    if (ev.prev !== prev) errors.push(`사건 ${i + 1}: prev 가 직전 루트와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) errors.push(`사건 ${i + 1}: root 재계산 불일치 — 내용이 바뀜`);
    if (!Array.isArray(ev.patches) || !ev.patches.length) errors.push(`사건 ${i + 1}: 패치가 없음`);
    prev = root;
  });
  return { ok: !errors.length, errors, head: prev, n: events.length };
}

// replay = { snapshot_sha256, shas: [사건마다 재생한 db sha256], error? } · current_sha256 = 지금 db.json 의 sha256
function replayVerdict(genesis, events, replay, currentSha) {
  const chain = verifyChain(genesis, events), errors = chain.errors.slice();
  if (replay.error) errors.push('재생 실패: ' + replay.error);
  if (replay.snapshot_sha256 !== genesis.db_sha256) errors.push('기원 스냅숏 파일이 기원이 적은 sha256 과 다름 — 스냅숏이 바뀜');
  events.forEach((ev, i) => { if (replay.shas[i] !== undefined && replay.shas[i] !== ev.db_sha256) errors.push(`사건 ${i + 1}: 재생한 db 가 봉인된 db 와 다름 — 병합이 결정론적이지 않거나 기록이 바뀜`); });
  const expect = events.length ? events[events.length - 1].db_sha256 : genesis.db_sha256;
  if (currentSha !== expect) errors.push('지금 db.json 이 기록의 마지막 상태와 다름 — 기록을 거치지 않은 쓰기(직접 편집 등)');
  return { ok: !errors.length, errors, events: events.length, head: chain.head };
}

function logText(v) {
  return v.ok ? `델타 기록: 정상 — 사건 ${v.events}, 사슬 머리 ${String(v.head).slice(0, 12)}…, 재생 = 지금 db`
    : `델타 기록: 이상 ${v.errors.length}\n` + v.errors.map((e) => '  ✗ ' + e).join('\n');
}

module.exports = { verifyChain, replayVerdict, logText };
