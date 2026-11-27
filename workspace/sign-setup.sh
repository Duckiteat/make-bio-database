#!/usr/bin/env bash
# 사람 서명 키 설정 · 시험 (DEC-0100) — Codespace 터미널에서: bash workspace/sign-setup.sh
# 태블릿 키보드는 -- 를 긴 줄표로, 따옴표를 다른 글자로 바꿔서 손으로 친 명령이 자꾸 틀린다 — 그래서 대본 하나로.
# 하는 일 (읽어 보고 실행):
#   1) 서명 키가 없으면 만든다 (~/.ssh/signing_key — 개인 키는 이 Codespace 안에만, 어디에도 붙여 넣지 않는다)
#   2) 이 저장소의 git 설정: SSH 방식 · 키 자리 · 커밋마다 서명 · 이름 · 이메일 (손으로 칠 때 생긴 오타 설정은 지운다)
#   2b) Codespaces 가 넣는 커미터 변수(GIT_COMMITTER_* — 커미터를 GitHub 으로 바꿈)를 지우고, 새 터미널에서도 지우게 ~/.bashrc 에 한 줄
#   3) 빈 시험 커밋으로 도장이 찍히는지 보고, 시험 커밋은 바로 되돌린다 (push 하지 않는다)
#   4) GitHub 에 등록할 견본(.pub 한 줄)을 보여 준다
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
KEY="$HOME/.ssh/signing_key"
say() { echo; echo "== $*"; }

say "1) 서명 키"
if [ -f "$KEY.pub" ]; then echo "있음 — $KEY.pub (새로 만들지 않는다)"
else mkdir -p "$HOME/.ssh" && ssh-keygen -q -t ed25519 -C signing -f "$KEY" -N "" && echo "새로 만듦 — 아래 4) 의 한 줄을 GitHub 에 Signing Key 로 등록해야 한다"; fi

say "2) git 설정"
git config gpg.format ssh
git config user.signingkey "$KEY.pub"
git config commit.gpgsign true
git config user.name Duckiteat
git config user.email 127865597+Duckiteat@users.noreply.github.com
for bad in connit.gpgsign user.eamil; do git config --unset "$bad" 2>/dev/null && echo "오타 설정 지움: $bad"; done
git config --show-origin --get-regexp '^(gpg|user|commit)\.' | cat

say "2b) 커미터를 바꾸는 숨은 변수 (Codespaces 가 넣음 — git 설정보다 우선한다)"
found=0
for v in GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL; do if [ -n "${!v:-}" ]; then echo "$v=${!v} — 지운다"; found=1; fi; done
[ "$found" = 0 ] && echo "없음"
unset GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
if grep -q 'sign-setup DEC-0100' "$HOME/.bashrc" 2>/dev/null; then echo "새 터미널에서도 지우는 줄이 이미 ~/.bashrc 에 있음"
else echo 'unset GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL # sign-setup DEC-0100' >> "$HOME/.bashrc"; echo "새 터미널에서도 지우도록 ~/.bashrc 에 한 줄 더함"; fi

say "3) 시험 도장"
if git commit --allow-empty -q -m "sign test (곧 되돌림)"; then
  C=$(git cat-file -p HEAD | grep '^committer'); S=$(git cat-file -p HEAD | grep -m1 BEGIN)
  git reset -q --soft HEAD~1
  echo "$C"; echo "$S"
  case "$S" in
    *"SSH SIGNATURE"*) case "$C" in *Duckiteat*) echo "성공 — 내 도장(SSH)으로 서명 · 커미터 Duckiteat. 시험 커밋은 되돌렸다";; *) echo "실패 — 커미터가 Duckiteat 가 아님";; esac;;
    *) echo "실패 — SSH 서명이 아님 (develop 세션에 이 화면을)";;
  esac
else echo "실패 — 위의 오류 문구를 develop 세션에"; fi

say "4) GitHub 에 등록할 견본 (이미 등록했으면 무시) — Settings → SSH and GPG keys → New SSH key → Key type: Signing Key"
cat "$KEY.pub"

say "끝 — 지금 이 터미널에도 적용하려면: exec bash (새 터미널을 열어도 됨)"
echo
say "남은 변경 (아무것도 없어야 정상)"
git status --short
