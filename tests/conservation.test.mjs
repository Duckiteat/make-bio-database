// 보존 분류 — 오차 3채널 doctrine 의 기저 (설계 docs/design/conservation-classes.md · build-plan 20–25)
//   ⓐ 모든 observable 이 conservation.{class,reason} 를 가지며 통제 어휘를 가리킨다 (조각화돼도 참조 가능)
//   ⓑ 분류가 doctrine 과 맞는다: 카운트(amount)=보존, 유도·창발·측정 파라미터=비보존
//   ⓒ class·reason 이 사전 register 로 노출된다 (16A — 나중 적분장이 참조)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const V = req('../vocab.js');
const D = req('../dictionary.js');

test('ⓐ 모든 observable 이 유효한 conservation.{class,reason} 를 가진다', () => {
  for (const [k, ob] of Object.entries(V.observables)) {
    assert.ok(ob.conservation, `${k} conservation 누락`);
    const { class: cls, reason } = ob.conservation;
    assert.ok(V.conservationClasses[cls], `${k} class '${cls}' 어휘 밖`);
    assert.ok(V.conservationReasons[reason], `${k} reason '${reason}' 어휘 밖`);
  }
});

test('ⓑ 분류가 doctrine 과 맞는다 — 카운트=보존, 나머지=비보존', () => {
  assert.equal(V.observables.amount.conservation.class, 'conserved');
  assert.equal(V.observables.amount.conservation.reason, 'substance_count');
  for (const k of ['concentration', 'fraction', 'event_time', 'volume', 'kinetic_constant']) {
    assert.equal(V.observables[k].conservation.class, 'non_conserved', `${k} 는 비보존이어야`);
  }
});

test('ⓒ class·reason 이 사전 register 로 노출된다 (나중 적분장이 참조)', () => {
  for (const r of ['conservationClasses', 'conservationReasons']) assert.ok(D.registers.includes(r), `register ${r} 누락`);
  for (const k of Object.keys(V.conservationClasses)) assert.ok(!D.entry(k).error, `${k} 사전 미등록`);
  for (const k of Object.keys(V.conservationReasons)) assert.ok(!D.entry(k).error, `${k} 사전 미등록`);
  // 왕복 확인(한 쌍)
  assert.equal(D.parseToken(D.renderToken('non_conserved', { audience: 'both' })), 'conservationClasses/non_conserved');
});
