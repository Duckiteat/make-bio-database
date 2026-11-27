# 데이터베이스 변천사와 관련 서류 (2026-11-27, inspect)

> 읽기만 한 정리. 출처: `migrations/` · `data/patches/` · `data/log/events.jsonl`(사건 32, 사슬 정상 — `node dbtool.mjs log`) · `data/log/genesis-db.json` · `CHANGES.md`(354 행) · `docs/design/` · `docs/reports/`. 숫자는 파일에서 센 값.

## 0. 처음과 지금

| 시점 | 형식 | 개념·정의항·기전 단계 | 한계·관찰 기록·값 |
|---|---|---|---|
| 사건 사슬의 시작(genesis, 2026-10-15 v10 상태) | v10 | 209 · 211 · 56 | 106 · 18 · 0 |
| 지금(2026-11-27) | v12 | 210 · 212 · 57 | 127 · 28 · 68 |
| 차이 | v10→v12(값 층 분리) | +1 · +1 · +1 | +21 · +10 · +68 |
| 해석 | 10-15 이후 성장은 거의 한계·관찰·값 | 구조는 10-08~10-10 에 대부분 섬 | 그 뒤는 "근거 달기·공백 등록" 단계 |

## 1. 형식 변천 (migrations/)

| 날짜 | 변환 | 바뀐 점 | 관련 서류 |
|---|---|---|---|
| 2026-10-08 | 001 v1→v2 | 첫 형식 정리 | `migrations/001-v1-to-v2.mjs` |
| 2026-10-08 | 002 v2→v3 | 이름=ID → 의미 없는 고정 번호(T…) · `002-id-map.json` | README "고정 번호" |
| 2026-10-08 | 003 v3→v4 | 두 해상도: 정의항(D, 부위·규칙·설명·관찰) + 단계(S) | `DESIGN-v4.md` · `SCHEMA.md` |
| 2026-10-08 | 004 v4→v5 | 한계 등록부(L…) | `limitations.md` |
| 2026-10-08 | 005 v5→v6 | 반응 속도(kinetics) · 부위 구조 참조 | `docs/design/hybrid-multiscale-engine.md` |
| 2026-10-08 | 006 v6→v7 | 생애 주기: supply·degradation · moieties · half_life | 같음 |
| 2026-10-08 | 007 v7→v8 | 3층 다중 규모(tier) · 확산·pH 등 | `hybrid-multiscale-engine.md` |
| 2026-10-08 | 008 v8→v9 | 세포 운명 층(cell_state · modulation · hill) | `docs/design/cell-fate-engine.md` |
| 2026-10-09 | 009 v9→v10 | 관찰 기록(O…, SI 값·불확도·출처) | `docs/design/observation-port.md` · `engine-port-roadmap.md` |
| 2026-10-15 | 010 v10→v12 | 값 층 분리(V…) — 수치를 obs·kinetics 밖으로 | `docs/design/format-v12.md` · 사건 #1 |
| 2026-10-23 | 011 | 사전을 추가만 하는 해시 사슬로 | `docs/design/dictionary-and-translation.md` |
| 2026-10-23 | 012 | 가정 원장(A…) — 시나리오의 가상 숫자를 번호로 | `docs/design/structure-realignment.md` §3.5 |

## 2. 데이터 패치 시기 (data/patches/, 71 개)

| 시기 | 패치 수 | 무엇을 넣었나 | 관련 서류 |
|---|---|---|---|
| 10-08 | 17 | 첫 기전: cAMP→글리코겐 분해, PP1 탈인산화, LPS→TLR4→NF-κB, TCA 회로 소진 시험, CD8 T 세포 운명 · Identity_Gap 6 | `README.md` · `FEATURES.md` · `cell-fate-engine.md` |
| 10-09 | 8 | 엔진 이식(Rodas3 결합 적분 · 사건 시각) 한계 · MHC I·II 기전 | `engine-port-roadmap.md` |
| 10-10 | 15 | 자동 보강(UniProt·ChEBI 대조, 5회) · Crossref 문헌 확인 · 텔로미어 · TCA 속도 상수 · 농도·부피를 관찰로 · TNF mRNA 길이 | `docs/design/scaling-limits.md` · `judicial/trend.js` |
| 10-15 | 9 | v12 맥락 열쇠 · TAP·타파신 정성 관찰(관문 A′) · 적재 복합체 조립 S000057(L000108 닫음) | `docs/reports/2026-10-15-*` 2 편 |
| 10-16 | 13 | BRENDA 실측 kcat·Km(CS · ACO2) · HLA-DM · β2m 첫 현실 검증 · 대식세포 상태 · 텔로미어(Bodnar 1998) | `docs/reports/2026-10-16-*` 10 편 |
| 10-23 ~ 10-25 | 7 | 한계 구조 칸 · 순환 근거 위험 · 정지 세포 관찰(Allsopp 1995) · 출처를 sources 칸으로 · 합의 창 · TCA 실험 한계 | `2026-10-22-phase0-reality-validation-audit.md` · `2026-10-23-*` · `2026-10-25-tca-resolution.md` |
| 11-20 | 2 | cAMP 신호 전달에 1차 출처 · 잘못 더한 S000058 되돌림 | 전환 기록 #8 · `2026-11-19-baseline-sweep.md` |
| 11-20 이후 | 0 | 데이터 변경 없음 — 관문·권한·감독(거버넌스) 코드 작업 | `CHANGES.md` 11-21~11-25 행 |

## 3. 관련 서류 순서 (읽는 순서 추천)

| 순서 | 서류 | 무엇 | 언제 쓰나 |
|---|---|---|---|
| 1 | `README.md` → `DESIGN-v4.md` → `SCHEMA.md` | 두 해상도 · 고정 번호 · 형식 규격 | DB 구조를 처음 볼 때 |
| 2 | `docs/design/format-v12.md` · `observation-port.md` · `uncertainty-budget.md` | 지금 형식(v12)의 값·관찰·불확도 | 수치가 어떻게 저장되나 |
| 3 | `limitations.md` (생성물) | 한계 127 | 무엇이 비어 있나 |
| 4 | `CHANGES.md` (최신이 위) | 코드·형식 변경 354 행 | 언제 무엇이 바뀌었나 |
| 5 | `node dbtool.mjs report <패치>` | 데이터 패치마다의 보고서 | 데이터 하나의 이유 |
| 6 | `docs/reports/` 10-15 → 11-03 | 검증·감사 보고(현실 검증 · 무결성 · 구조 평가) | 데이터 신뢰도 |
| 7 | `docs/reports/` 11-18 → 11-25 | baseline 훑기 · 두 엔진 차이 · 거버넌스·보안 | 지금 진행 상황 |
| 8 | `docs/plan/ORDER.md` | 앞으로의 순서 | 다음에 무엇을 하나 |

## 4. 알아 둘 점

| 점 | 사실 | 뜻 | 할 일 |
|---|---|---|---|
| git 역사 시작 | 첫 커밋 cf886b8(10-08, 일괄 가져오기) 다음이 10-23 | 10-08~10-22 변경은 git 이 아니라 패치·CHANGES 로만 추적 | 그 시기는 `data/patches/` 를 원본으로 |
| 사건 사슬 범위 | `events.jsonl` 은 v12 변환(10-15)부터 | 그 앞은 genesis-db 한 장면으로 접힘 | 재생 검증은 10-15 이후만 |
| 정정 패치 | 10-15 L108 정정 · 11-20 S000058 되돌림 | 지우지 않고 덧붙여 고침(추적 보존) | 되돌린 단계는 번호 재사용 안 함 |
| 최근 한 달 | 11-20 이후 데이터 패치 0 | 작업이 데이터에서 거버넌스로 옮겨 감 | 데이터 성장은 author 세션이 필요 |
