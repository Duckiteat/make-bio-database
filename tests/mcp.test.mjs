// MCP 서버 (설계 docs/design/outsourcing-and-mcp.md §4.3) — 서버 셋 중 query·fetch + 입출력기 clerk.
//   ① 프로토콜: initialize·tools/list·모르는 메서드·알림 ② query: dbtool 과 같은 글 · 메모리 사본을 다시 읽지 않음 · 파일이 바뀌면 다시 읽음
//   ③ 역할: 기본은 가장 좁은 collector · 목록에 없는 도구는 부르는 자리에서도 거부 ④ clerk 단일 작성자 ⑤ 핸드오프는 추가만·이름 검사
//   ⑥ 받기 기록 검사: 사슬 변조·받은 뒤 파일 바뀜 ⑦ 삼권: query·fetch 는 파일을 직접 쓰지 않는다 ⑧ fetch 인자 검사(네트워크 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, cpSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const CA = req('../judicial/collection_audit.js'), ATT = req('../judicial/attestation.js');
const sha = (x) => createHash('sha256').update(x).digest('hex');

// 서버에 요청 줄들을 보내고 답(id 순)을 받는다
function call(server, msgs, env = {}) {
  const input = msgs.map((m, i) => JSON.stringify({ jsonrpc: '2.0', ...(m.method.startsWith('notifications/') ? {} : { id: i + 1 }), ...m })).join('\n') + '\n';
  const r = spawnSync(process.execPath, [join(ROOT, 'mcp', server)], { input, encoding: 'utf8', env: { ...process.env, BIODB_ROLE: '', ...env }, cwd: ROOT, timeout: 60000 });
  return { status: r.status, stderr: r.stderr, out: r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) };
}
const tool = (name, args) => ({ method: 'tools/call', params: { name, arguments: args || {} } });
const text = (m) => m.result.content[0].text;

test('① 프로토콜: initialize 답 · 알림에는 답하지 않음 · 모르는 메서드는 -32601', () => {
  const { out } = call('query.mjs', [{ method: 'initialize', params: { protocolVersion: '2025-06-18' } }, { method: 'notifications/initialized' }, { method: 'nope' }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].result.protocolVersion, '2025-06-18');
  assert.ok(out[0].result.capabilities.tools);
  assert.equal(out[1].error.code, -32601);
});

test('② query: dbtool map 과 같은 글 · 같은 파일이면 다시 읽지 않음 · db 가 바뀌면 다시 읽음', () => {
  const { out } = call('query.mjs', [tool('map', { ref: 'D000210' }), tool('summary'), tool('summary')]);
  const cli = spawnSync(process.execPath, [join(ROOT, 'dbtool.mjs'), 'map', 'D000210'], { encoding: 'utf8', cwd: ROOT }).stdout.trim();
  assert.equal(text(out[0]).trim(), cli);
  assert.equal(out[1].result.structuredContent.loads, 1);
  assert.equal(out[2].result.structuredContent.loads, 1, '두 번째 호출은 메모리 사본');
  const dir = mkdtempSync(join(tmpdir(), 'mcpq-'));
  try {
    cpSync(join(ROOT, 'data'), dir, { recursive: true, filter: (s) => !s.includes('/fetched/') });
    const db = join(dir, 'db.json');
    // 같은 서버 안에서 db 를 바꾸면 다음 호출이 다시 읽는다 — 요청 사이에 파일을 바꾸려고 대화형으로 띄운다
    const p = spawn(process.execPath, [join(ROOT, 'mcp', 'query.mjs')], { env: { ...process.env, BIODB_DATA: dir }, cwd: ROOT });
    return new Promise((done, fail) => {
      let buf = '', step = 0;
      p.stdout.on('data', (d) => {
        buf += d; const lines = buf.split('\n'); buf = lines.pop();
        for (const l of lines) {
          const m = JSON.parse(l); step++;
          if (step === 1) { assert.equal(m.result.structuredContent.loads, 1); const t = JSON.parse(readFileSync(db, 'utf8')); t.meta.note_test = 'x'; writeFileSync(db, JSON.stringify(t)); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, ...tool('summary') }) + '\n'); }
          else { try { assert.equal(m.result.structuredContent.loads, 2, '파일이 바뀌어 다시 읽음'); done(); } catch (e) { fail(e); } finally { p.kill(); rmSync(dir, { recursive: true, force: true }); } }
        }
      });
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, ...tool('summary') }) + '\n');
    });
  } catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }
});

test('③ 역할: 기본 collector 는 clerk 의 권위 쓰기를 못 보고, 불러도 거부 · 모르는 역할은 시작 거부', () => {
  const c = call('clerk.mjs', [{ method: 'tools/list' }, tool('merge', { paths: ['/tmp/none.json'] })]);
  assert.deepEqual(c.out[0].result.tools.map((t) => t.name), ['put_handoff']);
  assert.equal(c.out[1].result.isError, true);
  assert.match(text(c.out[1]), /역할 collector 에게 없음/);
  const i = call('clerk.mjs', [{ method: 'tools/list' }], { BIODB_ROLE: 'integrator' });
  assert.ok(i.out[0].result.tools.some((t) => t.name === 'merge'));
  const m = call('clerk.mjs', [tool('merge', { paths: ['/tmp/none.json'], allow_warnings: true })], { BIODB_ROLE: 'integrator' });
  assert.match(text(m.out[0]), /사람 역할만/);
  const bad = call('query.mjs', [{ method: 'tools/list' }], { BIODB_ROLE: 'admin' });
  assert.notEqual(bad.status, 0);
});

test('④ 단일 작성자: clerk 가 떠 있으면 둘째 clerk 도, dbtool 쓰기도 막힌다', async () => {
  const first = spawn(process.execPath, [join(ROOT, 'mcp', 'clerk.mjs')], { env: { ...process.env, BIODB_ROLE: 'integrator' }, cwd: ROOT });
  await new Promise((r) => setTimeout(r, 400));
  try {
    const second = spawnSync(process.execPath, [join(ROOT, 'mcp', 'clerk.mjs')], { input: '', encoding: 'utf8', env: { ...process.env, BIODB_ROLE: 'integrator' }, cwd: ROOT, timeout: 10000 });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /이미 떠 있음/);
    // dbtool 도 같은 잠금을 잡는다 (RULE-0018, 재건 7 단계) — 권위 구역 쓰기는 거부되고, 읽기는 그대로
    const w = spawnSync(process.execPath, [join(ROOT, 'dbtool.mjs'), 'limitations', '--write'], { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
    assert.notEqual(w.status, 0, 'clerk 가 떠 있는 동안 dbtool 쓰기');
    assert.match(w.stderr, /작성자가 이미 떠 있음/);
    const r = spawnSync(process.execPath, [join(ROOT, 'dbtool.mjs'), 'limitations', '--check'], { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
    assert.doesNotMatch(r.stderr, /작성자가 이미/, '읽기는 잠금을 잡지 않음');
  } finally { first.kill(); await new Promise((r) => first.on('exit', r)); }
});

test('⑤ 핸드오프: 이름 검사 · 붙이기만 (앞 줄 그대로)', () => {
  const name = `mcp-test-${process.pid}`, f = join(ROOT, 'workspace', 'handoff', `${name}.jsonl`);
  try {
    const bad = call('clerk.mjs', [tool('put_handoff', { name: '../x', lines: [{ a: 1 }] })]);
    assert.match(text(bad.out[0]), /소문자·숫자·하이픈/);
    call('clerk.mjs', [tool('put_handoff', { name, lines: [{ n: 1 }] })]);
    call('clerk.mjs', [tool('put_handoff', { name, lines: [{ n: 2 }, { n: 3 }] })]);
    assert.deepEqual(readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l).n), [1, 2, 3]);
  } finally { if (existsSync(f)) unlinkSync(f); }
});

test('⑥ 받기 기록 검사: 통과 · 사슬 변조 · 받은 뒤 파일이 바뀜 · 파일이 사라짐', () => {
  let prev = CA.FETCH_GENESIS; const ev = [];
  for (const [i, f] of ['a.xml', 'b.json'].entries()) { const body = { seq: i + 1, at: '2026-10-23T00:00:00.000Z', url: `https://x/${f}`, file: `data/fetched/t/${f}`, ok: true, bytes: 3, sha256: sha(f), prev }; const e = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) }; ev.push(e); prev = e.root; }
  const cur = { 'data/fetched/t/a.xml': sha('a.xml'), 'data/fetched/t/b.json': sha('b.json') };
  assert.ok(CA.verifyFetchLog(ev, cur).ok);
  const t = JSON.parse(JSON.stringify(ev)); t[0].url = 'https://evil/';
  assert.match(CA.verifyFetchLog(t, cur).errors.join(), /root 재계산 불일치/);
  assert.match(CA.verifyFetchLog(ev, { ...cur, 'data/fetched/t/a.xml': sha('other') }).errors.join(), /받은 뒤 내용이 바뀜/);
  assert.match(CA.verifyFetchLog(ev, { ...cur, 'data/fetched/t/b.json': null }).errors.join(), /파일이 없음/);
});

test('⑦ 삼권: query·fetch 는 파일을 직접 쓰지 않는다 — 쓰기는 입법 서기(clerk.mjs)를 지난다', () => {
  const W = /\b(writeFileSync|appendFileSync|renameSync|unlinkSync|mkdirSync|writeSync|createWriteStream|rmSync)\b/;
  for (const f of ['mcp/query.mjs', 'mcp/fetch.mjs', 'mcp/protocol.mjs']) assert.ok(!W.test(readFileSync(join(ROOT, f), 'utf8')), `${f}: 파일 쓰기 함수`);
  assert.ok(!/legislative\/clerk/.test(readFileSync(join(ROOT, 'mcp/query.mjs'), 'utf8')), 'query 는 서기를 부르지 않는다(읽기 전용)');
  assert.ok(!/child_process/.test(readFileSync(join(ROOT, 'mcp/query.mjs'), 'utf8')) && !/child_process/.test(readFileSync(join(ROOT, 'mcp/fetch.mjs'), 'utf8')));
});

test('⑧ fetch 인자 검사 (네트워크 없음): PMID 형식이 아니면 받기 전에 거부', () => {
  const { out } = call('fetch.mjs', [tool('fetch_fulltext', { pmid: 'PMC123; rm -rf' }), { method: 'tools/list' }]);
  assert.equal(out[0].result.isError, true);
  assert.match(text(out[0]), /형식이 아님/);
  assert.deepEqual(out[1].result.tools.map((t) => t.name), ['resolve_access', 'fetch_abstract', 'fetch_fulltext', 'resolve_doi', 'brenda_kinetics']);
});

test('⑨ fetch resolve_doi 인자 검사 (네트워크 없음) · 수신함의 DOI 검색 기록도 출처 상태로 읽힌다', () => {
  const { out } = call('fetch.mjs', [tool('resolve_doi', { doi: 'not-a-doi' })]);
  assert.equal(out[0].result.isError, true);
  assert.match(text(out[0]), /형식이 아님/);
  const lit = req('../inbox.js').literatureStatus(join(ROOT, 'data'));
  assert.deepEqual(lit['DOI:10.1038/nature07830'], { kind: 'journal', retracted: false }, 'DOI 검색으로 확인된 학술지 기록 (소문자 열쇠)');
});

// 사용자 결정: 수집가도 BRENDA 를 — 단 계정 정보는 도구 안(환경 변수)에만, 출력·기록·수신함에 남지 않는다
test('⑩ BRENDA 도구: 수집가에게 보임 · 계정 없으면 사람이 할 일을 알림 · 해시가 아니면 거부 · EC 형식 검사', () => {
  const env = { BRENDA_EMAIL: '', BRENDA_PASSWORD_SHA256: '' };
  const { out } = call('fetch.mjs', [{ method: 'tools/list' }, tool('brenda_kinetics', { ec: '1.1.1.37' }), tool('brenda_kinetics', { ec: 'x' })], env);
  assert.ok(out[0].result.tools.some((t) => t.name === 'brenda_kinetics'), '기본 역할 collector 에게 보임');
  assert.match(text(out[1]), /BRENDA_EMAIL · BRENDA_PASSWORD_SHA256/); assert.match(text(out[1]), /채팅·저장소에 넣지 않는다/);
  assert.match(text(out[2]), /형식이 아님/);
  const raw = call('fetch.mjs', [tool('brenda_kinetics', { ec: '1.1.1.37' })], { BRENDA_EMAIL: 'a@b.cd', BRENDA_PASSWORD_SHA256: 'myRawPassword' });
  assert.match(text(raw.out[0]), /SHA256 16진수/); assert.doesNotMatch(JSON.stringify(raw.out), /myRawPassword/);
});

test('⑪ 서기 POST 받기: 본문은 표준 입력으로만 · 응답에 되돌아온 계정 정보는 지움 · 오류 본문도 지움', async () => {
  // 메아리 서버는 다른 프로세스에 — 서기의 curl 이 이 프로세스를 막는다(동기 호출)
  const echo = `const h=require('http');const s=h.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{const bad=/fail/.test(q.url);r.writeHead(bad?500:200,{'Content-Type':'text/xml'});r.end(bad?'<faultstring>echo '+b+'</faultstring>':'<return>'+b+'</return>')})});s.listen(0,'127.0.0.1',()=>console.log(s.address().port))`;
  const child = spawn(process.execPath, ['-e', echo]);
  const port = await new Promise((r) => child.stdout.once('data', (d) => r(+String(d).trim())));
  const dir = mkdtempSync(join(tmpdir(), 'post-')), prev = process.env.NO_PROXY, prevl = process.env.no_proxy;
  process.env.NO_PROXY = process.env.no_proxy = '127.0.0.1,localhost';
  try {
    const CLERK = await import('../legislative/clerk.mjs');
    const secret = 'secret-user@example.org', hash = sha('pw'), body = `<email>${secret}</email><password>${hash}</password>`;
    const post = (path) => CLERK.postToInbox([{ file: join(dir, 'x' + path.length), url: `http://127.0.0.1:${port}${path}`, label: 'test', body, redact: [secret, hash] }], { timeout: 10 })[0];
    const ok = post('/ok'), bad = post('/fail');
    assert.ok(ok.ok, ok.error); const saved = readFileSync(ok.file, 'utf8');
    assert.match(saved, /\[REDACTED\]/); assert.ok(!saved.includes(secret) && !saved.includes(hash), '응답에 되돌아온 계정 정보가 지워짐');
    assert.equal(bad.ok, false); assert.match(bad.error, /HTTP 500/); assert.ok(!bad.error.includes(secret) && !bad.error.includes(hash));
  } finally {
    child.kill(); rmSync(dir, { recursive: true, force: true });
    if (prev == null) delete process.env.NO_PROXY; else process.env.NO_PROXY = prev;
    if (prevl == null) delete process.env.no_proxy; else process.env.no_proxy = prevl;
  }
});

test('⑫ BRENDA 응답 해석: 기록마다 값·기질·종·문헌 · 빈 칸은 null · 오류 문구', () => {
  const I = req('../inbox.js');
  const x = readFileSync(join(ROOT, 'tests/fixtures/brenda/km-sample.xml'), 'utf8');
  const rows = I.brendaRows(x, 'km');
  assert.deepEqual(rows.map((r) => [r.value, r.substrate, r.organism, r.literature.join('+'), r.valueMax]), [['0.0077', 'acetyl-CoA', 'Homo sapiens', '756131', null], ['0.0036', 'oxaloacetate', 'Homo sapiens', '1+2', null]]);
  assert.equal(rows[0].unit, 'mM');
  assert.equal(I.brendaFault('<faultstring>Username or password is wrong</faultstring>'), 'Username or password is wrong');
  assert.equal(I.brendaReference('<reference><pubmedId>31141475</pubmedId><title>t</title></reference>').pubmedId, '31141475');
});
