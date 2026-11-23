# DEC-0084 · DEC-0085 승인 묶음 — 문지기: 도구 밖 등록부 · 장부 변경도 판정 · 등록부 · 장부는 내용 지문으로 대조 · git 전역 옵션 뒤 commit · 꼬리표 RULE-0546

> 사용자 커밋 대상. develop 세션은 문지기(L6)를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다. develop 세션에서는 시험을 돌리지 못했다(보호 파일을 복사본으로 만드는 일이 거부됨) — **4 단계의 시험이 첫 실행** 이다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `DEC-0084-gate-bundle.patch` — `rebuild/gate.mjs` · `tests/gate.test.mjs` ⑳ 한 줄 · ㉒ | 두 번째 독립 재검토의 R2(도구 호출 밖에서 바뀐 등록부는 정책을 안 봄) · R1 의 문지기 쪽(`git -c … commit` 을 커밋으로 못 봄) · R5(꼬리표 RULE-0542) · 공격 경로 매트릭스 N1(크기 · 시각을 보존한 셸 쓰기가 도구 뒤 대조를 지남 — DEC-0085 D4) | 도구 밖에서 바뀐 등록부 · 감독 장부 · 전환 기록을 다음 도구 호출 앞에서 같은 판정(ledgerViolations — 도구 뒤와 같은 함수)으로 보고, 어기면 그 호출을 막고 영수증에 남김 · git 전역 옵션 뒤의 commit · push 도 끝내기 전 시험을 요구 · 새 승인 도장의 승인자 위반은 [RULE-0546] 으로 · 등록부 · 감독 장부 · 전환 기록은 크기 · 시각에 더해 내용 지문(sha256)으로 대조 | `git apply --check` 통과 · 승인 화면 `DEC-0084-gate-bundle.screen.txt` (지문 4cb5b8ed3b50…) |

## 적용 순서 (사람 — Codespaces, G5 때와 같은 방식, 한 단계씩)

1. `git pull` — 이 묶음을 만든 커밋까지 받기
2. `node rebuild/bundle.mjs verify workspace/DEC-0084-gate-bundle.patch 4cb5b8ed3b50e847b22b3f374a7d8e0bf710cec3366ea2af9f182c19e7f86b55` — `통과` 확인
3. `git apply workspace/DEC-0084-gate-bundle.patch && git status --short` — `rebuild/gate.mjs` · `tests/gate.test.mjs` 둘만
4. `node --test tests/gate.test.mjs 2>&1 | tail -8` — `# fail 0` (실패하면 멈추고 화면을 develop 세션에 보낸다 — 되돌리기는 `git checkout -- rebuild/gate.mjs tests/gate.test.mjs`)
5. `node rebuild/status.mjs --write` — 문지기 시험이 6 → 7 개라(㉒) 생성 문서가 바뀐다(G5 때 빠뜨린 단계)
6. `npm test 2>&1 | tail -5` — `# fail 0`
7. `git add -A && git commit -m "L6: gate outside-change ledger check, git global opts, RULE-0546 label (DEC-0084, bundle 4cb5b8ed3b50)"` 그리고 `git push origin ccr-2a8c4e06-0zo0i6`
8. develop 세션이 원격에서 받아 대조(묶음과 바이트 동일 · 전체 시험)

권한 장부 · 모드표는 바뀌지 않는다(검사만 더함).
