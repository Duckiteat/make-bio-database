# PLAN-104 — 배정 자동화 (Hybrid)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 104 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **배정 자동화 (Hybrid)** — PLAN-103 에서 깨진 곳에만 검사를 켠다(RULE-0462). Supervisor 가 클라우드 세션을 순차로 띄움(동시 하나). 자동 배정은 author · inspect · baseline 만 — develop · field 는 needs_user 로 멈춤(F11). 세션 첫 일 = push 권한 확인(F13, PLAN-077 교훈) · 마지막 일 = Supervisor 에게 끝 알림 + Supervisor 늦은 깨우기로 확인(F5). 정책: 정지 스위치 하나 · ORCH 당 세션 수 · 재시도 2 · 시간 제한 — 넘기면 blocked + 사람(F12). Supervisor 는 모드 세션을 대신 열지 않고 승인 · 병합 권한 없음
- **자리**: 조율 장부 명령(PLAN-100) · 정책 파일(rebuild/state 아래, 새) · 예약 작업 지시문
- **끝나는 조건**: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · D4(PLAN-116 G5 · DEC-0079): 자동 배정은 author · inspect · baseline 만 — develop · field(사용자 요청이 있어야 하는 모드)를 자동으로 띄우려 하면 거부하고 needs_user 로 멈추는 것을 시험으로 확인(정상 배정은 통과 · 검사를 끄면 시험이 실패) · **선행: PLAN-106 · 081 · 111 · 113 · 114 완료(DEC-0067 · 0070)**
- **상태**: ☐ 대기

## 결과 (날짜별)

- `2026-11-24` 커밋 전 기록: · 2026-11-24 DEC-0093: 자동 배정을 단계로 나눔 — 형식 · 순수 함수 · 루프(121–123) → MVP 실증(124) → 범위(125–127) → 병렬(128–131). 끝나는 조건은 PLAN-131 이 채운다

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0064 — 자리 칸의 아직 없는 파일을 경로 모양에서 이름으로 (탐침이 열린 작업의 경로를 지금 파일로 대조함 — 깨진 참조)

  <details><summary>이전 · 이후</summary>

이전: `rebuild/orch.mjs` · `workspace/orchestration/policies.json` · 예약 작업 지시문

이후: orch 모듈(PLAN-100) · 정책 파일 policies(workspace/orchestration 아래, 새) · 예약 작업 지시문

</details>
- `2026-11-20` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: **배정 자동화 (Hybrid)** — PLAN-103 에서 깨진 곳에만 검사를 켠다(RULE-0462). Supervisor 세션이 클라우드 세션을 순차로 띄워 하위 run 을 배정(동시 하나) · policies.json(작업 종류별 자동 가능 여부 · 재시도 한도 2 · 시간 제한) · 시간을 넘긴 run 은 blocked + 사람에게. Supervisor 는 모드 세션을 대신 열지 않고(한 세션 = 한 모드), 승인 · 병합 권한 없음

이후: **배정 자동화 (Hybrid)** — PLAN-103 에서 깨진 곳에만 검사를 켠다(RULE-0462). Supervisor 가 클라우드 세션을 순차로 띄움(동시 하나). 자동 배정은 author · inspect · baseline 만 — develop · field 는 needs_user 로 멈춤(F11). 세션 첫 일 = push 권한 확인(F13, PLAN-077 교훈) · 마지막 일 = Supervisor 에게 끝 알림 + Supervisor 늦은 깨우기로 확인(F5). 정책: 정지 스위치 하나 · ORCH 당 세션 수 · 재시도 2 · 시간 제한 — 넘기면 blocked + 사람(F12). Supervisor 는 모드 세션을 대신 열지 않고 승인 · 병합 권한 없음

</details>
- `2026-11-21` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

  <details><summary>이전 · 이후</summary>

이전: orch 모듈(PLAN-100) · 정책 파일 policies(workspace/orchestration 아래, 새) · 예약 작업 지시문

이후: 조율 장부 명령(PLAN-100) · 정책 파일(rebuild/state 아래, 새) · 예약 작업 지시문

</details>
- `2026-11-21` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

  <details><summary>이전 · 이후</summary>

이전: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐

이후: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · **선행: PLAN-106 · 081 · 111 완료(DEC-0067)**

</details>
- `2026-11-21` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0070 — 독립형 오케스트레이터 검토의 권장 결정 전부

  <details><summary>이전 · 이후</summary>

이전: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · **선행: PLAN-106 · 081 · 111 완료(DEC-0067)**

이후: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · **선행: PLAN-106 · 081 · 111 · 113 · 114 완료(DEC-0067 · 0070)**

</details>
- `2026-11-23` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — 사용자 승인(세션 답 2026-11-23 '가자' — 제안: D4 를 PLAN-104 의 끝나는 조건으로, 계획 기록만)

  <details><summary>이전 · 이후</summary>

이전: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · **선행: PLAN-106 · 081 · 111 · 113 · 114 완료(DEC-0067 · 0070)**

이후: 두 번째 순환을 Supervisor 가 사람 손 없이 awaiting_approval 까지 끌고 감 · 재시도 한도 넘김 → blocked 시험 · 승인은 여전히 사용자 병합뿐 · D4(PLAN-116 G5 · DEC-0079): 자동 배정은 author · inspect · baseline 만 — develop · field(사용자 요청이 있어야 하는 모드)를 자동으로 띄우려 하면 거부하고 needs_user 로 멈추는 것을 시험으로 확인(정상 배정은 통과 · 검사를 끄면 시험이 실패) · **선행: PLAN-106 · 081 · 111 · 113 · 114 완료(DEC-0067 · 0070)**

</details>
- `2026-11-24` 커밋 전 기록 결과 처음 적힘 — 사용자 결정 DEC-0093 — 오케스트레이터를 MVP(최종 형식) → 범위 → 병렬 → 자율 순서로 계획

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0068](../decisions/DEC-0068.md) 2026-11-21 작업 조율의 정체 — Supervisor(감독)이다, Claude 내장 조율(하위 에이전트 · fork · 작업 목록)과 다르다
- [DEC-0070](../decisions/DEC-0070.md) 2026-11-21 독립형 오케스트레이터 — 방향으로 기록 · 계약은 감독 장부 · Governor CI 겹 · 둘째 실행 모듈은 사람 작업 흐름
- [DEC-0074](../decisions/DEC-0074.md) 2026-11-23 사람 손을 덜 타는 구조 먼저 — 주장 층(115) → 승인 보조(116 G2–G4) → 자동 배정(104) → D000051 주장 층 시범(112, 자동 순환) · author P1 손 고침은 시범으로 흡수
- [DEC-0081](../decisions/DEC-0081.md) 2026-11-23 전환 기록에 선택 칸 sup(상위 작업 번호) — DEC-0065 ② '전환 형식 불변' 을 이 한 칸만큼 고침 · 감독 장부 넘김이 다른 상위 작업의 전환 기록을 가리키면 거부
- [DEC-0082](../decisions/DEC-0082.md) 2026-11-23 main 병합 방법은 (가) 시범 뒤 한꺼번에 — 병합 자체의 사전 승인은 아님 · 승인 묶음 2 적용 · 검증 뒤 PLAN-104 · PLAN-112 에서 P1 원문 보존과 데이터 판정 승인을 가름
- [DEC-0088](../decisions/DEC-0088.md) 2026-11-23 상호 권한 · 독립 신뢰 경계 제안서를 PLAN-116 2 차 입력(최종 정의 후보)으로 — AI 전용 GitHub 신원 · 보안 핵심 먼저 · Hard Veto 와 중재자 정의를 지킬 수 있게
- [DEC-0089](../decisions/DEC-0089.md) 2026-11-23 git push 확인 창을 지금 없앰(가) · 사람 클릭에 기대지 않는 안전 구조(보안 핵심)를 먼저 빠르게
- [DEC-0090](../decisions/DEC-0090.md) 2026-11-23 AI 전용 GitHub 신원 = 봇 계정 1 개(협업자 Write) — 모든 Claude 세션이 씀, 승인 · 병합 · 설정 · 규칙 우회는 사람 계정만
- [DEC-0093](../decisions/DEC-0093.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
