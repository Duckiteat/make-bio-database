// 작업 파일 스냅숏 — 지금 작업 트리(커밋 안 한 변경 · 추적 안 하는 새 파일, .gitignore 밖)를 git 개체로 뜬다.
//   쓰는 곳: 변이 시험의 사본(tests/mutation/run.mjs) · 바뀐 것만 시험의 지도(tests/affected.mjs).
// 방법: 저장소 밖에 둔 이 저장소 전용 색인(GIT_INDEX_FILE)에 작업 트리 전부를 더하고(add -A — 바뀐 파일만 다시 읽음) write-tree.
// 계약: 브랜치 · 작업 트리 · 실제 색인 · stash 는 그대로. 쓰는 것은 .git 의 개체 저장소와 저장소 밖 임시 색인뿐.
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const indexOf = (root) => join(tmpdir(), `biodb-snapindex-${createHash('sha256').update(resolve(root)).digest('hex').slice(0, 12)}`);
const git = (root, env, ...a) => execFileSync('git', a, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// 스냅숏 커밋의 이름은 고정 — 어느 환경에서나 같은 방식(사용자 git 설정이 없어도 됨)
const WHO = { GIT_AUTHOR_NAME: 'snapshot', GIT_AUTHOR_EMAIL: 'snapshot@localhost', GIT_COMMITTER_NAME: 'snapshot', GIT_COMMITTER_EMAIL: 'snapshot@localhost' };

export function snapshotTree(root) {
  const env = { GIT_INDEX_FILE: indexOf(root) };
  git(root, env, 'add', '-A');
  return git(root, env, 'write-tree');
}
// 부모 HEAD 인 스냅숏 커밋 — same: 작업 파일이 HEAD 와 같은가
export function snapshotCommit(root, message = 'snapshot (작업 파일)') {
  const tree = snapshotTree(root);
  return { commit: git(root, WHO, 'commit-tree', tree, '-p', 'HEAD', '-m', message), same: tree === git(root, {}, 'rev-parse', 'HEAD^{tree}') };
}
// 두 트리 사이 바뀐 경로 (더함 · 고침 · 지움 — 이름 바꿈은 지움 + 더함으로)
export const treeDiff = (root, a, b) => (a === b ? [] : git(root, {}, 'diff', '--name-only', '--no-renames', '-z', a, b).split('\0').filter(Boolean));
export const headOf = (root) => { try { return git(root, {}, 'rev-parse', 'HEAD'); } catch { return null; } };
