// 세션에 꽂는 MCP 서버 설정 (.mcp.json · PLAN-105) — 지금은 읽기 서버만 (query · run)
//   쓰기 서버(clerk · fetch)는 저장소당 작성자 하나 잠금을 세션 내내 잡아 CLI 쓰기(dbtool transition · merge …)를 막는다 → 잠금 방식을 정한 뒤에
//   사람 역할은 이름표로 주지 않는다 (RP1) — 설정의 env 에도 human 금지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const READ_ONLY = new Set(['mcp/query.mjs', 'mcp/run.mjs']);

test('① .mcp.json: 읽기 서버만 · 스크립트가 있음 · 사람 역할 이름표 없음', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8'));
  const servers = Object.entries(cfg.mcpServers || {});
  assert.ok(servers.length > 0, '서버가 하나는 있다');
  for (const [name, s] of servers) {
    assert.equal(s.command, 'node', name);
    assert.equal(s.args.length, 1, `${name}: 인자는 스크립트 하나`);
    assert.ok(READ_ONLY.has(s.args[0]), `${name}: ${s.args[0]} — 쓰기 서버(clerk · fetch)는 잠금 방식을 정하기 전까지 꽂지 않는다`);
    assert.ok(existsSync(join(ROOT, s.args[0])), `${name}: 스크립트 없음`);
    const role = (s.env || {}).BIODB_ROLE;
    assert.ok(role === undefined || ['collector', 'integrator'].includes(role), `${name}: BIODB_ROLE '${role}'`);
  }
});

test('② 읽기 서버는 파일을 쓰지 않고 서기를 부르지 않는다 (잠금을 잡지 않는다)', () => {
  for (const f of READ_ONLY) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.ok(!/\b(writeFileSync|appendFileSync|renameSync|unlinkSync|createWriteStream)\b/.test(src), `${f}: 파일 쓰기`);
    assert.ok(!/legislative\/clerk\.mjs/.test(src), `${f}: 서기`);
  }
});
