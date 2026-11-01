# PLAN-006 — 형식 v12

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 6 · 1부 — 검증 기반과 저장의 출발점
- **작업**: **형식 v12**: 정성 관찰(kind direction·presence·order·monotone, 교란, 읽기 값, 기대, 맥락, DOI + 원문 구절) · 매개변수 분포(평균·sd·형태·구간) · 두 시간(기록·근거) · 맥락 열쇠 표준
- **자리**: `model.js` · `vocab.js` · `schemas/obs/` · `migrations/010-v10-to-v12`
- **끝나는 조건**: 이전 스크립트 왕복 · 정성 관찰 거부 말뭉치
- **상태**: ☑ 완료 2026-10-15

## 결과 (날짜별)

- `2026-10-15` `ed0615f`: 1차 값 층(분포·두 시간·대체·철회)·변환, 2차 정성 관찰·실험 묶음·맥락 열쇠·번호 이동. 기존 기록의 evidence_at 채우기는 데이터 작업으로 남김

  <details><summary>고쳐 쓰기 전 글</summary>

값 층(분포·두 시간·대체·철회)·변환 완료. 정성 관찰·실험 묶음·맥락 열쇠·번호 이동 남음 (format-v12.md)

</details>

## 걸어온 길

- `2026-10-15` `ca92cdd` 계획에 들어옴 (☐ 대기) — 구현 계획: 검증·저장·적분 엔진 작업 40개 (docs/design/build-plan.md)
- `2026-10-15` `fa0e0cd` 상태 ☐ → ◐ 2026-10-15 — 형식 v12 ①: 값 층 분리 — 수치는 values(V…)에만, obs·kinetics 는 정규화가 붙이는 보기
- `2026-10-15` `fa0e0cd` 결과 처음 적힘 — 형식 v12 ①: 값 층 분리 — 수치는 values(V…)에만, obs·kinetics 는 정규화가 붙이는 보기
- `2026-10-15` `ed0615f` 상태 ◐ 2026-10-15 → ☑ 2026-10-15 — 형식 v12 ②: 정성 관찰·실험 묶음·근거 시각·맥락 열쇠·번호 이동
- `2026-10-15` `ed0615f` 결과 고쳐 씀 — 형식 v12 ②: 정성 관찰·실험 묶음·근거 시각·맥락 열쇠·번호 이동

## 닿는 결정

- [DEC-0005](../decisions/DEC-0005.md) 2026-10-16 측정·기록 인프라 점검 + 계측기 시기(TIER A·B·C)
