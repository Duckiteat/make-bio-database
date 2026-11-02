# 순서 — 무엇을 언제 하나 (세 계획을 한 줄로)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 내용은 items/ · 계획 개요는 build.md · rebuild.md · assay.md. 순서를 바꾸면 내용 파일은 그대로다.

## 지금 순서

1. [PLAN-077](items/PLAN-077.md) 추세 재확인 자동화가 실제로 돌게 — ◐ 진행 · build — 구조 평가 뒤 순서의 첫째(DEC-0030) — 추세 재확인이 실제로 돌게 (저장소 연결은 사용자 일 — 보류 중)
2. [ASY-00](items/ASY-00.md) 틀 — ◐ 진행 · assay — 데이터를 모으기 전에 측정법 틀 — 나중이면 모은 기록을 모두 옮겨야 함 (DEC-0041)
3. [STG-12](items/STG-12.md) 자리별 담당과 권한 재검토 — ☐ 대기 · rebuild — 엔진 일보다 먼저 — 오늘 만든 도구 바로 밑의 구조라 미루면 도구가 지금 방식에 굳음 (DEC-0048)
4. [STG-11c](items/STG-11c.md) 빠른 사전 검사 — ☑ 완료 · rebuild — 가장 싸고 바로 실패를 줄임 — 다음 작업들이 규칙을 더하는 일이라 먼저 (DEC-0047)
5. [STG-11b](items/STG-11b.md) 재생성 한 번에 — ☑ 완료 · rebuild — 11a 가 부름 (DEC-0047)
6. [STG-11a](items/STG-11a.md) 규칙 한 번에 — ☑ 완료 · rebuild — ASY-08 · 11 · 12 가 규칙을 더함 — 그대로 효과 (DEC-0047)
7. [STG-11f](items/STG-11f.md) 세션 끊기 — ☐ 대기 · rebuild — 도구가 필요 없는 습관 — 규칙 한 번에(11a) 뒤 ASY-08 부터 항목마다 적용 (DEC-0047)
8. [ASY-08](items/ASY-08.md) 계량 기초 — ◐ 진행 · assay — 가장 기초 — 단위 · 상수 · 자리수 · 추적성 · 불확도 예산. 모든 판독이 이 단을 가리킴 (DEC-0043)
9. [ASY-11](items/ASY-11.md) 사슬 꼬리 — ☐ 대기 · assay — 가장 싸고 모든 장부에 닿음 — 자료가 쌓이기 전에 (DEC-0046)
10. [STG-11d](items/STG-11d.md) 파일 탐침 — ☑ 완료 · rebuild — 효과는 가장 크지만 설계가 큼 — 앞의 셋이 만든 자리 정보를 씀 (DEC-0047)
11. [STG-11e](items/STG-11e.md) CHANGES 초안 — ☐ 대기 · rebuild — 탐침의 바뀐 자리 정보를 씀 (DEC-0047)
12. [ASY-12](items/ASY-12.md) 출처 고정 — ☐ 대기 · assay — 옛 관찰 22 의 원문 숫자 채우기가 이 위에서 해야 한 번에 끝남 (DEC-0046)
13. [ASY-14](items/ASY-14.md) 내부 일관성 — ☐ 대기 · assay — 들이는 값마다 걸러야 하니 모으기 전에 — 계산만이라 쌈 (DEC-0046)
14. [ASY-13](items/ASY-13.md) 이중 독립 입력 — ☐ 대기 · assay — 실측 상수 모으기(78) 전에 절차로 서야 함 (DEC-0046)
15. [ASY-01](items/ASY-01.md) 기초 판독 — ☐ 대기 · assay — 조합 측정법이 가리킬 기초 판독 먼저
16. [ASY-02](items/ASY-02.md) 기초 분리 — ☐ 대기 · assay — 분리는 판독의 앞 단계 속성 — 조합(3) 전에
17. [ASY-03](items/ASY-03.md) 분리 + 판독 — ☐ 대기 · assay — 78 이 모을 속도 상수의 측정법(효소 활성 분광 등)
18. [ASY-09](items/ASY-09.md) 검증 축 — ☐ 대기 · assay — 정량 측정이 들어오는 3 과 함께 — 값마다 검증 근거 수준 (DEC-0043)
19. [PLAN-088](items/PLAN-088.md) 엔진 정답 시험 + 변형 관계 시험 — ☐ 대기 · build — 실측 상수로 비교를 시작하기 전에 엔진 쪽 근거 — 관문 D 의 바탕 (DEC-0046)
20. [PLAN-078](items/PLAN-078.md) 실측 상수 늘리기 — ☐ 대기 · build — 북극성 ①의 병목 — 측정법·검증 칸이 선 뒤 실측 상수를 모음
21. [ASY-15](items/ASY-15.md) 화학량 보존 — ☐ 대기 · assay — 78 이 저분자 반응 상수를 들이며 화학식이 생김 (DEC-0046)
22. [ASY-04](items/ASY-04.md) 상호작용 — ☐ 대기 · assay — 경쟁 판정의 바탕인 Kd — 78 다음으로 필요해질 상수
23. [PLAN-071](items/PLAN-071.md) 검증 상태 = 기록의 축 묶음 (S, D, T, I) — ☐ 대기 · build — 검증 상태 축 — I 축(독립성)은 같은 측정 깃발(ASY-00) 위에
24. [ASY-16](items/ASY-16.md) 여러 출처 합의 — ☐ 대기 · assay — 독립성 축(71) 위에, 독립 출처가 쌓인 뒤 (DEC-0046)
25. [ASY-05](items/ASY-05.md) 세포 수준 — ☐ 대기 · assay — 정성 검증 판독의 측정법
26. [PLAN-079](items/PLAN-079.md) 규칙 문서 한 곳 — ◐ 진행 · build — 규칙 문서 한 곳 — 구조 평가 뒤 순서의 끝(DEC-0030)
27. [ASY-10](items/ASY-10.md) GMP 자료 받기 — ☐ 대기 · assay — 실제 GMP 자료 출처가 생길 때 — 그때까지는 순서 끝 (DEC-0043)

## 순서 밖 — 대기·진행·논의·보류 (57)

- **build**: [PLAN-012](items/PLAN-012.md) ◐ · [PLAN-012a](items/PLAN-012a.md) ◐ · [PLAN-013](items/PLAN-013.md) ◐ · [PLAN-015](items/PLAN-015.md) ☐ · [PLAN-016](items/PLAN-016.md) ☐ · [PLAN-016a](items/PLAN-016a.md) ◐ · [PLAN-017](items/PLAN-017.md) ☐ · [PLAN-018](items/PLAN-018.md) ☐ · [PLAN-019](items/PLAN-019.md) ☐ · [PLAN-020](items/PLAN-020.md) ☐ · [PLAN-021](items/PLAN-021.md) ☐ · [PLAN-023](items/PLAN-023.md) ☐ · [PLAN-024](items/PLAN-024.md) ☐ · [PLAN-025](items/PLAN-025.md) ◐ · [PLAN-026](items/PLAN-026.md) ☐ · [PLAN-028](items/PLAN-028.md) ☐ · [PLAN-029](items/PLAN-029.md) ☐ · [PLAN-030](items/PLAN-030.md) ☐ · [PLAN-031](items/PLAN-031.md) ☐ · [PLAN-032](items/PLAN-032.md) ☐ · [PLAN-033](items/PLAN-033.md) ☐ · [PLAN-034](items/PLAN-034.md) ☐ · [PLAN-035](items/PLAN-035.md) ☐ · [PLAN-036](items/PLAN-036.md) ☐ · [PLAN-038](items/PLAN-038.md) ☐ · [PLAN-039](items/PLAN-039.md) ☐ · [PLAN-040](items/PLAN-040.md) ☐ · [PLAN-047](items/PLAN-047.md) ◐ · [PLAN-050](items/PLAN-050.md) ☐ · [PLAN-051](items/PLAN-051.md) ☐ · [PLAN-052](items/PLAN-052.md) ☐ · [PLAN-053](items/PLAN-053.md) ☐ · [PLAN-054](items/PLAN-054.md) ☐ · [PLAN-055](items/PLAN-055.md) ☐ · [PLAN-056](items/PLAN-056.md) ☐ · [PLAN-062](items/PLAN-062.md) ☐ · [PLAN-063](items/PLAN-063.md) ☐ · [PLAN-064](items/PLAN-064.md) ☐ · [PLAN-H01](items/PLAN-H01.md) 보류 · [PLAN-065](items/PLAN-065.md) ☐ · [PLAN-050p](items/PLAN-050p.md) ☐ · [PLAN-066](items/PLAN-066.md) ☐ · [PLAN-067](items/PLAN-067.md) ☐ · [PLAN-068](items/PLAN-068.md) ☐ · [PLAN-070](items/PLAN-070.md) ◐ · [PLAN-070p](items/PLAN-070p.md) ☐ · [PLAN-080](items/PLAN-080.md) ☐ · [PLAN-081](items/PLAN-081.md) ☐ · [PLAN-082](items/PLAN-082.md) ☐ · [PLAN-083](items/PLAN-083.md) ☐ · [PLAN-084](items/PLAN-084.md) ☐ · [PLAN-086](items/PLAN-086.md) ☐ · [PLAN-087](items/PLAN-087.md) ☐ · [PLAN-057](items/PLAN-057.md) ☐
- **rebuild**: [STG-06](items/STG-06.md) ◐
- **assay**: [ASY-06](items/ASY-06.md) 보류 · [ASY-07](items/ASY-07.md) ☐

## 끝난 것

- build: 34 / 93
- rebuild: 37 / 41
- assay: 0 / 17

## 순서가 바뀐 길

- `2026-11-01` (처음) ⇒ PLAN-077 → ASY-00 → ASY-01 → ASY-02 → ASY-03 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 — 측정법 계획을 따로 세우고(DEC-0041), 순서를 세 계획 한 줄의 순서 기록으로(DEC-0042)
- `2026-11-01` PLAN-077 → ASY-00 → ASY-01 → ASY-02 → ASY-03 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 ⇒ PLAN-077 → ASY-00 → ASY-08 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 → ASY-10 — 측정법 목표(GMP 자료 그릇 · 문헌값 정직 등급)와 양자역학 제외를 결정으로, 사다리에 계량 기초 · 검증 축 · GMP 자료 받기를 더하고 순서를 고침 (사용자 ㄱㄱ)
- `2026-11-01` PLAN-077 → ASY-00 → ASY-08 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-078 → ASY-04 → PLAN-071 → ASY-05 → PLAN-079 → ASY-10 ⇒ PLAN-077 → ASY-00 → ASY-08 → ASY-11 → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 — 자료 무결성 종합 — 제안 사양서와 다른 방법을 뺄 것은 빼고 묶어 계획에 넣고 순서를 정함 (사용자 요청 2026-11-01, docs/reports/2026-11-01-data-integrity.md)
- `2026-11-01` PLAN-077 → ASY-00 → ASY-08 → ASY-11 → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 ⇒ PLAN-077 → ASY-00 → STG-11c → STG-11b → STG-11a → ASY-08 → ASY-11 → STG-11d → STG-11e → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 — 반복 기록 일 자동화와 파일 탐침을 계획에 — 영수증으로 잰 효율 차이와 순서 (사용자 요청 2026-11-01, docs/reports/2026-11-01-work-automation.md)
- `2026-11-01` PLAN-077 → ASY-00 → STG-11c → STG-11b → STG-11a → ASY-08 → ASY-11 → STG-11d → STG-11e → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 ⇒ PLAN-077 → ASY-00 → STG-11c → STG-11b → STG-11a → STG-11f → ASY-08 → ASY-11 → STG-11d → STG-11e → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 — 세션 끊기를 순서에, 기록 묶기는 열린 질문으로 (사용자 결정 2026-11-01)
- `2026-11-02` PLAN-077 → ASY-00 → STG-11c → STG-11b → STG-11a → STG-11f → ASY-08 → ASY-11 → STG-11d → STG-11e → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 ⇒ PLAN-077 → ASY-00 → STG-12 → STG-11c → STG-11b → STG-11a → STG-11f → ASY-08 → ASY-11 → STG-11d → STG-11e → ASY-12 → ASY-14 → ASY-13 → ASY-01 → ASY-02 → ASY-03 → ASY-09 → PLAN-088 → PLAN-078 → ASY-15 → ASY-04 → PLAN-071 → ASY-16 → ASY-05 → PLAN-079 → ASY-10 — 자리별 담당과 권한 재검토를 계획에 — 엔진보다 먼저 (사용자 결정 2026-11-02)
