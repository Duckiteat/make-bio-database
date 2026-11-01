# STG-09 — 코드 재배치

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 9 · 7. 단계
- **단계**: 코드 재배치
- **무엇**: 모드·규칙 번호에 맞춰 판정 코드·명령 처리 재배치(필요한 만큼)
- **끝나는 조건**: 판정 불변(말뭉치·시험 같은 결과)
- **상태**: ☑ 완료 2026-10-29

## 결과 (날짜별)

- `2026-10-29` 커밋 전 기록: 필요한 만큼 = 명령 처리 (DEC-0033): 문지기의 명령 허용·금지가 modes.json 의 따로 적은 금지 목록과 명령 장부 두 곳에 있었고 쓰는 명령 24 곳에서 어긋났다(예: 승인 도장 accept 는 장부에선 점검 전용인데 모든 모드에서 허용) — 금지 목록을 없애고 장부(rebuild/rules/commands.jsonl)의 modes · writes · 새 writes_on(어느 인자에서 쓰나 — dbtool.mjs 의 case 본문에서 읽음, 12) · 새 collector 에서 계산(gate.mjs commandBlock · dbtoolCalls). 장부를 고침: attest 는 재검증만이라 쓰지 않음(cli · mcp) · textbook 에 author(부록이 db 로도 만들어져 정보 작성 뒤 낡음) · dictionary 는 develop 만(경로 규칙에 also: data/dictionary.jsonl). MCP 도구도 문지기가 미리 봄 — 서버 이름과 상관없이 mcp__*__<도구> 가 장부에 있으면(훅 matcher 에 mcp__.*). 판정 코드(judicial · legislative)는 바꾸지 않음 — 거부 말뭉치·시험 같은 결과(끝나는 조건). 이어 붙인 명령의 둘째 dbtool 호출도 봄. 시험 ② 에 16 가지

## 걸어온 길

- `2026-10-25` `82fc060` 계획에 들어옴 (☐ 대기) — 재건 시작: 계획 문서와 자동 갱신 관리 파일 (rebuilding-project)
- `2026-10-29` 커밋 전 기록 상태 ☐ → ☑ 2026-10-29 — 재건 9 단계 — 명령의 허용·금지를 명령 장부 하나로 (사용자 결정 DEC-0033)
- `2026-10-29` 커밋 전 기록 결과 처음 적힘 — 재건 9 단계 — 명령의 허용·금지를 명령 장부 하나로 (사용자 결정 DEC-0033)

## 닿는 결정

- [DEC-0033](../decisions/DEC-0033.md) 2026-10-29 9 단계 — 명령 장부 하나로, 어긋나면 장부가 기준 · 교과서 부록은 정보 작성도 · 사전은 디벨롭
