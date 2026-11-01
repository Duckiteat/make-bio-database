# 순서 — 무엇을 언제 하나 (세 계획을 한 줄로)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 내용은 items/ · 계획 개요는 build.md · rebuild.md · assay.md. 순서를 바꾸면 내용 파일은 그대로다.

## 지금 순서

1. [PLAN-077](items/PLAN-077.md) 추세 재확인 자동화가 실제로 돌게 — ◐ 진행 · build — 구조 평가 뒤 순서의 첫째(DEC-0030) — 추세 재확인이 실제로 돌게 (저장소 연결은 사용자 일 — 보류 중)
2. [ASY-00](items/ASY-00.md) 틀 — ☐ 대기 · assay — 데이터를 모으기 전에 측정법 틀 — 나중이면 모은 기록을 모두 옮겨야 함 (DEC-0041)
3. [ASY-08](items/ASY-08.md) 계량 기초 — ☐ 대기 · assay — 가장 기초 — 단위 · 상수 · 자리수 · 추적성 · 불확도 예산. 모든 판독이 이 단을 가리킴 (DEC-0043)
4. [ASY-01](items/ASY-01.md) 기초 판독 — ☐ 대기 · assay — 조합 측정법이 가리킬 기초 판독 먼저
5. [ASY-02](items/ASY-02.md) 기초 분리 — ☐ 대기 · assay — 분리는 판독의 앞 단계 속성 — 조합(3) 전에
6. [ASY-03](items/ASY-03.md) 분리 + 판독 — ☐ 대기 · assay — 78 이 모을 속도 상수의 측정법(효소 활성 분광 등)
7. [ASY-09](items/ASY-09.md) 검증 축 — ☐ 대기 · assay — 정량 측정이 들어오는 3 과 함께 — 값마다 검증 근거 수준 (DEC-0043)
8. [PLAN-078](items/PLAN-078.md) 실측 상수 늘리기 — ☐ 대기 · build — 북극성 ①의 병목 — 측정법·검증 칸이 선 뒤 실측 상수를 모음
9. [ASY-04](items/ASY-04.md) 상호작용 — ☐ 대기 · assay — 경쟁 판정의 바탕인 Kd — 78 다음으로 필요해질 상수
10. [PLAN-071](items/PLAN-071.md) 검증 상태 = 기록의 축 묶음 (S, D, T, I) — ☐ 대기 · build — 검증 상태 축 — I 축(독립성)은 같은 측정 깃발(ASY-00) 위에
11. [ASY-05](items/ASY-05.md) 세포 수준 — ☐ 대기 · assay — 정성 검증 판독의 측정법
12. [PLAN-079](items/PLAN-079.md) 규칙 문서 한 곳 — ◐ 진행 · build — 규칙 문서 한 곳 — 구조 평가 뒤 순서의 끝(DEC-0030)
13. [ASY-10](items/ASY-10.md) GMP 자료 받기 — ☐ 대기 · assay — 실제 GMP 자료 출처가 생길 때 — 그때까지는 순서 끝 (DEC-0043)

## 순서 밖 — 대기·진행·논의·보류 (57)

- **build**: [PLAN-012](items/PLAN-012.md) ◐ · [PLAN-012a](items/PLAN-012a.md) ◐ · [PLAN-013](items/PLAN-013.md) ◐ · [PLAN-015](items/PLAN-015.md) ☐ · [PLAN-016](items/PLAN-016.md) ☐ · [PLAN-016a](items/PLAN-016a.md) ◐ · [PLAN-017](items/PLAN-017.md) ☐ · [PLAN-018](items/PLAN-018.md) ☐ · [PLAN-019](items/PLAN-019.md) ☐ · [PLAN-020](items/PLAN-020.md) ☐ · [PLAN-021](items/PLAN-021.md) ☐ · [PLAN-023](items/PLAN-023.md) ☐ · [PLAN-024](items/PLAN-024.md) ☐ · [PLAN-025](items/PLAN-025.md) ◐ · [PLAN-026](items/PLAN-026.md) ☐ · [PLAN-028](items/PLAN-028.md) ☐ · [PLAN-029](items/PLAN-029.md) ☐ · [PLAN-030](items/PLAN-030.md) ☐ · [PLAN-031](items/PLAN-031.md) ☐ · [PLAN-032](items/PLAN-032.md) ☐ · [PLAN-033](items/PLAN-033.md) ☐ · [PLAN-034](items/PLAN-034.md) ☐ · [PLAN-035](items/PLAN-035.md) ☐ · [PLAN-036](items/PLAN-036.md) ☐ · [PLAN-038](items/PLAN-038.md) ☐ · [PLAN-039](items/PLAN-039.md) ☐ · [PLAN-040](items/PLAN-040.md) ☐ · [PLAN-047](items/PLAN-047.md) ◐ · [PLAN-050](items/PLAN-050.md) ☐ · [PLAN-051](items/PLAN-051.md) ☐ · [PLAN-052](items/PLAN-052.md) ☐ · [PLAN-053](items/PLAN-053.md) ☐ · [PLAN-054](items/PLAN-054.md) ☐ · [PLAN-055](items/PLAN-055.md) ☐ · [PLAN-056](items/PLAN-056.md) ☐ · [PLAN-062](items/PLAN-062.md) ☐ · [PLAN-063](items/PLAN-063.md) ☐ · [PLAN-064](items/PLAN-064.md) ☐ · [PLAN-H01](items/PLAN-H01.md) 보류 · [PLAN-065](items/PLAN-065.md) ☐ · [PLAN-050p](items/PLAN-050p.md) ☐ · [PLAN-066](items/PLAN-066.md) ☐ · [PLAN-067](items/PLAN-067.md) ☐ · [PLAN-068](items/PLAN-068.md) ☐ · [PLAN-070](items/PLAN-070.md) ◐ · [PLAN-070p](items/PLAN-070p.md) ☐ · [PLAN-080](items/PLAN-080.md) ☐ · [PLAN-081](items/PLAN-081.md) ☐ · [PLAN-082](items/PLAN-082.md) ☐ · [PLAN-083](items/PLAN-083.md) ☐ · [PLAN-084](items/PLAN-084.md) ☐ · [PLAN-086](items/PLAN-086.md) ☐ · [PLAN-087](items/PLAN-087.md) ☐ · [PLAN-057](items/PLAN-057.md) ☐
- **rebuild**: [STG-06](items/STG-06.md) ◐
- **assay**: [ASY-06](items/ASY-06.md) 보류 · [ASY-07](items/ASY-07.md) ☐

## 끝난 것

- build: 34 / 92
- rebuild: 33 / 34
- assay: 0 / 11

## 순서가 바뀐 길

- `2026-11-01` (처음) ⇒ PLAN-077 → ASY-00 → ASY-01 → ASY-02 → ASY-03 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 — 측정법 계획을 따로 세우고(DEC-0041), 순서를 세 계획 한 줄의 순서 기록으로(DEC-0042)
- `2026-11-01` PLAN-077 → ASY-00 → ASY-01 → ASY-02 → ASY-03 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 ⇒ PLAN-077 → ASY-00 → ASY-08 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 → ASY-10 — 측정법 목표(GMP 자료 그릇 · 문헌값 정직 등급)와 양자역학 제외를 결정으로, 사다리에 계량 기초 · 검증 축 · GMP 자료 받기를 더하고 순서를 고침 (사용자 ㄱㄱ)
