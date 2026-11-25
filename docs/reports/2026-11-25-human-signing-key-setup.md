# 사람 서명 키 — Codespaces 에서 내 키로 서명하기 (DEC-0100 · DEC-0094 · PLAN-135 선행)

> 2026-11-25 · develop 세션 · 사용자 결정 "가자"(B — 사용자 자신의 서명 키). 이 문서는 **사람이 GitHub · Codespace 에서 할 일** 을 적는다 — develop 세션은 키를 만들거나 보지 않는다.
> **개인 키(`signing_key`, `.pub` 아닌 것)는 채팅 · 저장소 · 전환 기록 어디에도 붙여 넣지 않는다**(RULE-0518). 공개 키(`.pub`)만 GitHub 설정 화면에 붙인다.

## 왜 필요한가

| 범위 | 사실 | 영향 | 확인 |
|---|---|---|---|
| Codespaces 의 **GPG verification** | GitHub 의 키로 서명하고 커미터를 `GitHub <noreply@github.com>`(web-flow)로 남긴다 | DEC-0094 의 사람 서명 판정(검증된 서명 + **커미터가 사람 계정**)을 통과하지 못한다 — web-flow 는 웹 편집 · API 커밋과 구별되지 않아 일부러 뺐다 | PR #27 의 커밋 `c298b23` |
| **내 키로 서명** | 커미터가 Duckiteat 로 남고, 서명은 내 계정에 등록한 키로 검증된다 | 봇은 내 키를 가질 수 없다 — 사람 서명 = 사람만 만들 수 있는 증거 | 아래 5 |

## 절차 (Codespace 터미널 · GitHub 웹 — 처음 한 번)

1. **Codespaces 의 GPG verification 끄기** — 프로필 사진 → Settings → Codespaces → GPG verification → **Disabled**. (켜 둔 채면 Codespace 가 GitHub 키로 서명하는 설정을 덮어쓸 수 있다)
2. **새 Codespace 열기**(이 저장소) — 1 을 바꾼 뒤 새로 만든 것이 안전하다
3. **서명 키 만들기** — Codespace 터미널에서:
   ```bash
   ssh-keygen -t ed25519 -C "signing" -f ~/.ssh/signing_key -N ""
   cat ~/.ssh/signing_key.pub
   ```
   화면에 나온 **`.pub` 한 줄(ssh-ed25519 로 시작)만** 복사한다
4. **GitHub 에 서명 키로 등록** — 프로필 사진 → Settings → **SSH and GPG keys** → New SSH key → Title 아무거나 · **Key type: Signing Key** · Key 칸에 3 의 한 줄 → Add
5. **이 저장소의 git 이 그 키로 서명하게** — Codespace 터미널에서(저장소 폴더 안):
   ```bash
   git config gpg.format ssh
   git config user.signingkey ~/.ssh/signing_key.pub
   git config commit.gpgsign true
   git config user.name Duckiteat
   git config user.email "$(git log -1 --author=Duckiteat --format=%ae)"
   git config --get user.email
   ```
   마지막 줄이 `…+Duckiteat@users.noreply.github.com` 꼴이면 된다(GitHub 계정의 noreply 주소 — 커밋이 내 계정으로 이어지는 주소)
6. **확인** — 다음에 승인 묶음을 적용해 커밋하면 GitHub 의 그 커밋에 **Verified** 가 붙고, 커밋 화면의 커미터가 **Duckiteat** 이어야 한다. develop 세션이 `git log --format='%cn <%ce>'` 와 CI 의 "서명 사실" 줄(검증된 서명 · 커미터)로 대조한다

## 주의

| 범위 | 내용 |
|---|---|
| 키는 그 Codespace 안에만 있다 | Codespace 를 지우면 키도 사라진다 — 그때는 3 – 5 를 다시(새 키를 또 등록, 옛 키는 Settings 에서 지워도 된다) |
| 키를 다른 곳으로 옮기지 않는다 | 비밀 값 · 채팅 · 저장소에 개인 키를 넣지 않는다 — 옮기는 자리가 늘수록 새는 자리도 는다 |
| 웹 편집은 하지 않는다 | GitHub 웹에서 파일을 고친 커밋은 web-flow 서명이라 사람 서명으로 세지 않는다(DEC-0095 운영 규칙 그대로) |
| 병합은 Merge commit | Squash · Rebase 는 GitHub 이 새 커밋(web-flow)을 만든다 — 병합 커밋은 판정에서 빠지지만 PR 안의 내 커밋이 그대로 남는 방식이 Merge commit 이다 |
