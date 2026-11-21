# PLAN-106 — RP1 승인자 기본값

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 106 · 8부 — 학회 수준의 신뢰 (바닥 · 실행 · 확률 층 · 가설 고리)
- **작업**: **RP1 승인자 기본값** — `dbtool accept` 가 BIODB_ROLE 이 없으면 승인자를 human 으로 적는다(dbtool.mjs 647 행) · 등록부의 accept 도장 6 개 모두 human 인데 넣은 커밋 853cb42 의 작성자는 Claude. 고침(U1 a): 기본값을 ai-session(사람 승인 아님을 표시)으로, 사람 승인의 증거는 병합 커밋(PLAN-102)으로만. MCP 역할 이름표의 human 도 승인 증거에서 뺌. **이 고침 자체도 사용자 GitHub 병합으로만 반영**(취약 경로로 승인하지 않음 — DEC-0066 Q3)
- **자리**: `dbtool.mjs` · `judicial/acceptance.js` · `legislative/clerk.mjs` · `mcp/clerk.mjs`
- **끝나는 조건**: BIODB_ROLE 없이 accept → human 이 남지 않는 거부 시험 · CLI · MCP 어느 길로도 AI 세션이 사람 승인 칸을 못 만드는 시험 · 재관측: accept 경로 전수에서 위조 경로 0 · 다른 세션 재검토 · 사용자 병합
- **상태**: ◐ 진행 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 구현: 발급 검사(judicial/acceptance.js checkIssue — 서기 appendAttestations 가 부르므로 CLI · MCP · 직접 모든 길)에서 새 승인 도장의 승인자는 integrator 만, human 은 거부 · dbtool accept 기본값 human → integrator · MCP 이름표 human 은 서버가 뜨지 않음(PLAN-105). 시험 acceptance ⑥(발급 거부 · 등록부 안 씀 · integrator 통과 · 옛 human 도장 재검증 통과) · 바닥값 시험 518. dbtool attest: 승인 도장 6 무효 0. 남은 끝나는 조건: 다른 세션의 재검토(코어 변경, DEC-0066 U7) · 사용자 병합(PR #16). 옛 human 도장 6 의 처리는 열린 질문(U2).

## 걸어온 길

- `2026-11-21` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터
- `2026-11-21` 커밋 전 기록 상태 ☐ → ◐ 2026-11-21 — PLAN-106 RP1 — 새 승인 도장의 승인자 human 금지
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — PLAN-106 RP1 — 새 승인 도장의 승인자 human 금지

## 닿는 결정

- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0069](../decisions/DEC-0069.md) 2026-11-21 사람 승인의 증거 — 다: 지금은 AI 의 PR 병합을 설정으로 막아 병합 = 사람, 높은 위험 변경(권한 · 판정 기준)에는 나중에 사용자 기기 키 서명을 더함
- [DEC-0071](../decisions/DEC-0071.md) 2026-11-21 순서 고침 — RP1(106)을 첫 순환(103) 앞으로, 과학 한 걸음(112)을 103 바로 뒤로
