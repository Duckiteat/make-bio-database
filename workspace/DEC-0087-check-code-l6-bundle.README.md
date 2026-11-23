# DEC-0087 승인 묶음 — 도장 등록부 · CI 구역 점검의 판정 코드를 보호 파일(L6)로 (D3 · 공격 경로 N3)

> **적용 끝 — 다시 적용하지 않는다.** 2026-11-23 사용자가 Codespaces 에서 단계마다 확인하며 적용 · 커밋 `5036bfe`(Duckiteat) · push. 시험: 보호 기준 · 권한 구조 9/9 · 전체 555 중 통과 553 · 실패 0 · 건너뜀 2(Codespace 환경). develop 세션 대조: 세 파일이 묶음과 바이트 동일 · 실제 문지기 정책으로 develop 이 8 파일을 못 씀(다른 판정 코드는 씀) · 전체 555 통과 · data · attestations 변경 0. 2 단계에서 파일 이름의 `l6`(엘 6)를 `16` 으로 치는 일이 있어 `DEC-0087-*.patch` 로 바꿔 안내함(이름을 헷갈리게 지은 통합가의 실수). PERM-0017 설명 글은 적용 뒤 장부 도구로 고침.

> 사용자 커밋 대상. develop 세션은 모드표 · 저장 지도의 L6 자리를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다. develop 세션에서는 바뀐 파일을 메모리에서만 확인했다(권한 구조 검사 오류 0 · 어느 모드도 8 파일을 못 씀 · develop 은 나머지 판정 코드 · 시험을 그대로 씀). **4 단계의 시험이 첫 실행** 이다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `rebuild/rules/modes.json` — develop except 에 `.github/**` · `rebuild/ci-zone.mjs` · `judicial/attestation.js` · `judicial/acceptance.js` · `judicial/transition_audit.js` · `tests/registry_policy.test.mjs` · `tests/acceptance.test.mjs` · `tests/guard-matrix.test.mjs`, field except 에 그 시험 3 · `docs/textbook/storage-map.json` — 그 8 파일을 L6 · guard:gate · 사람만 · `tests/guard-matrix.test.mjs` — 기준 파일(CORE)에 8 파일 | 공격 경로 N3 — develop 세션이 판정 코드 · 워크플로를 약하게 고칠 수 있었다(D2 는 같은 push 안에서 막지만 워크플로 파일 자체를 고치면 빠질 수 있음) | AI 세션은 이 8 파일을 못 고친다(문지기 · CI 구역 점검이 막음) — 고치려면 이런 승인 묶음 · 앞으로 이 파일들을 고칠 때마다 Codespaces | `git apply --check` 통과 · 승인 화면 `DEC-0087-check-code-l6-bundle.screen.txt` (지문 ca113fa3903b…) |

## 적용 순서 (사람 — Codespaces, 한 단계씩)

1. `git pull`
2. `node rebuild/bundle.mjs verify workspace/DEC-0087-check-code-l6-bundle.patch ca113fa3903b9c594ebba697315cf8a60be6155f178a5eb0a11adf27ff8abd56` — `통과`
3. `git apply workspace/DEC-0087-check-code-l6-bundle.patch && git status --short` — 세 줄: `docs/textbook/storage-map.json` · `rebuild/rules/modes.json` · `tests/guard-matrix.test.mjs`
4. `node --test tests/guard-matrix.test.mjs tests/authority.test.mjs 2>&1 | tail -8` — `# fail 0` (실패하면 멈추고 화면을 develop 세션에)
5. `node rebuild/status.mjs --write`
6. `node --test tests/*.test.mjs 2>&1 | tail -8` — `# fail 0`
7. `git add -A && git commit -m "L6: check code to L6 (DEC-0087, bundle ca113fa3903b)" && git push origin ccr-2a8c4e06-0zo0i6`
8. develop 세션이 원격에서 받아 대조

권한 장부(permissions.jsonl)의 쓰기 목록은 바뀌지 않는다(except 만 늘어남) — PERM-0017 의 설명 글은 적용 뒤 develop 이 장부 도구로 고친다.
