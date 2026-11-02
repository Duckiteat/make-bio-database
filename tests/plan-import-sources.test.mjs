// 결정 원문 대조 시험 — 대화로 만든 결정(커밋 없음)이 전체 이력 검사를 깨뜨리지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as IMPORT from '../rebuild/plan-import.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = (decisions) => ({ plans: [{ import: { until: 'HEAD' } }], decisions });

test('대화로 만든 결정(파일은 있고 커밋은 없음)은 대조 대상이 아니라 오류도 예외도 없다', () => {
  const d = { id: 'DEC-9999', text: '대화에서 정함', src: { conversation: '2026-11-02', file: 'docs/reports/none.md' } };
  assert.deepEqual(IMPORT.checkDecisionSources(ROOT, S([d])), []);
});

test('커밋이 있는 결정은 여전히 대조한다 — 그 판에 원문이 없으면 오류로 알린다', () => {
  const d = { id: 'DEC-9998', text: '존재하지 않는 원문 qzx', src: { commit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', file: 'docs/없는파일.md' } };
  const errs = IMPORT.checkDecisionSources(ROOT, S([d]));
  assert.equal(errs.length, 2); assert.match(errs[0], /DEC-9998: 원문이 docs\/없는파일\.md/); assert.match(errs[1], /처음 적힌 판 deadbee/);
});
