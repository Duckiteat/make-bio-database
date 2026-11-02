// 내부 일관성 시험 (ASY-14) — 알려진 불가능 조합을 잡고, 가능한 조합은 통과시킨다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grimPossible, sdSem, consistencyNotes } from '../judicial/consistency.js';

test('GRIM: 정수 자료의 평균 — 알려진 불가능 조합을 잡고 가능한 조합은 통과', () => {
  assert.equal(grimPossible(5.19, 28), false, 'Brown & Heathers 의 고전 예 — 28 개 정수의 평균이 5.19 일 수 없다');
  assert.equal(grimPossible(5.18, 28), true, '145/28 = 5.1786 → 5.18');
  assert.equal(grimPossible(2.5, 2), true); assert.equal(grimPossible(2.5, 3), false);
  assert.equal(grimPossible(3.0, 1), true); assert.equal(grimPossible(3.5, 1), false, 'n=1 의 평균은 정수');
  assert.equal(grimPossible(0.33, 3), true, '1/3 → 0.33'); assert.equal(grimPossible(0.34, 3), false);
  assert.equal(grimPossible(1.5, 0), null, 'n 이 없으면 판정할 수 없음');
});

test('GRIM: 반올림 경계는 정수로 센다 — 부동소수 오차로 가능한 평균을 불가능이라 하지 않는다', () => {
  for (let n = 1; n <= 40; n++) for (let S = 0; S <= 60; S++) {
    const M = Math.floor((2 * S * 100 + n) / (2 * n)); // S/n 을 소수 둘째 자리로 반올림(반올림 위쪽)한 정수 — 정수로만 계산
    assert.equal(grimPossible(String(M / 100), n, 2), true, `${S}/${n} → ${M / 100}`);
  }
});

test('SD ↔ SEM: SEM = SD/√n 이 맞으면 통과, 틀리면 사유, 바꿔 적은 것은 따로', () => {
  assert.equal(sdSem({ sd: '2.0', sem: '0.5', n: 16 }).kind, 'ok');
  assert.equal(sdSem({ sd: '1.8', sem: '0.4', n: 20 }).kind, 'ok', '1.8/√20 = 0.4025 → 0.4');
  assert.equal(sdSem({ sd: '2.0', sem: '1.0', n: 16 }).kind, 'mismatch');
  assert.equal(sdSem({ sd: '0.5', sem: '2.0', n: 16 }).kind, 'swapped', 'SEM > SD 는 뒤바뀜');
  assert.equal(sdSem({ sd: '2.0', sem: '2.0', n: 1 }).kind, 'unchecked', 'n=1 은 판정하지 않음');
  assert.equal(sdSem({ sd: 2, sem: 1, n: 16 }).kind, 'ok', '숫자 2 는 자리수를 잃어(0 자리) 허용 오차가 넓다 — 적힌 글 그대로 넘겨야 함');
});

test('한 기록의 사유: 걸리는 것만 사유를 내고 재료가 부족하면 조용하다 · 사유 앞에 규칙 번호', () => {
  assert.deepEqual(consistencyNotes({ sd: '2.0', sem: '0.5', n: 16, mean: '3.5', integer: false }), []);
  assert.deepEqual(consistencyNotes({ sd: 2 }), [], '재료 없음');
  assert.deepEqual(consistencyNotes(null), []);
  const sw = consistencyNotes({ sd: '0.5', sem: '2.0', n: 16 });
  assert.equal(sw.length, 1); assert.match(sw[0], /^RULE-0530 SEM\(2\.0\) 이 SD\(0\.5\) 보다 큼.*바꿔 적은 흔적/);
  assert.match(consistencyNotes({ sd: '2.0', sem: '1.0', n: 16 })[0], /^RULE-0530 SEM 1\.0 ≠ SD\/√n/);
  assert.match(consistencyNotes({ mean: '5.19', n: 28, integer: true })[0], /^RULE-0530 정수 자료 28 개의 평균이 5\.19 일 수 없음 \(GRIM\)/);
  assert.deepEqual(consistencyNotes({ mean: '5.19', n: 28, integer: false }), [], '정수 자료가 아니면 GRIM 을 쓰지 않음');
});
