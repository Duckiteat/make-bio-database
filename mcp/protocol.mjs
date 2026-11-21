// MCP 공통 틀 (설계 docs/design/outsourcing-and-mcp.md §4) — 표준 입출력 위 JSON-RPC 2.0, 한 줄 한 메시지. 외부 패키지 없음.
//   initialize · notifications/initialized · ping · tools/list · tools/call 만 다룬다.
//   역할(BIODB_ROLE: collector | integrator | human, 기본 collector — 가장 좁은 권한)에 따라 보이는 도구가 다르다.
//   목록에 없는 도구를 부르면 거부 — 숨기기만 하지 않고 부르는 자리에서도 막는다. 로그는 stderr 로만(stdout 은 프로토콜).
import { createInterface } from 'node:readline';

export const ROLES = ['collector', 'integrator', 'human'];
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

// 이름표(환경 변수)로 줄 수 있는 역할 — 사람 역할은 이름표로 주지 않는다: 서버를 켜는 쪽이 스스로 적는 값이라 AI 도 human 을 적을 수 있다
//   (RP1 · DEC-0066 · PLAN-105). 사람의 일(--allow-warnings 같은 것)은 사람이 직접 도는 CLI(설정 ask)로, 사람 승인의 증거는 병합(DEC-0069).
export const ENV_ROLES = ['collector', 'integrator'];
export function roleOf(env = process.env) {
  const r = env.BIODB_ROLE || 'collector';
  if (r === 'human') throw new Error("BIODB_ROLE 'human' — 사람 역할은 이름표로 주지 않는다 (켜는 쪽이 스스로 적는 값이라 승인 증거가 못 됨, PLAN-105). collector | integrator");
  if (!ENV_ROLES.includes(r)) throw new Error(`BIODB_ROLE '${r}' — ${ENV_ROLES.join(' | ')}`);
  return r;
}

// tools: [{ name, description, inputSchema, roles: [...], run(args) → string | { text, data?, isError? } }]
export function serve({ name, version, instructions, tools, role = roleOf() }) {
  const visible = tools.filter((t) => t.roles.includes(role));
  const byName = new Map(visible.map((t) => [t.name, t]));
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  const handle = async (msg) => {
    const { id, method, params } = msg;
    if (id === undefined || id === null) return; // 알림 — 답하지 않는다
    if (method === 'initialize') {
      const asked = params && params.protocolVersion;
      return reply(id, { protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name, version }, instructions: `${instructions} (역할 ${role})` });
    }
    if (method === 'ping') return reply(id, {});
    if (method === 'tools/list') return reply(id, { tools: visible.map(({ name: n, description, inputSchema }) => ({ name: n, description, inputSchema })) });
    if (method === 'tools/call') {
      const t = byName.get(params && params.name);
      if (!t) return reply(id, { content: [{ type: 'text', text: `도구 '${params && params.name}' 은 역할 ${role} 에게 없음` }], isError: true });
      try {
        const out = await t.run((params && params.arguments) || {});
        const o = typeof out === 'string' ? { text: out } : out;
        return reply(id, { content: [{ type: 'text', text: o.text }], ...(o.data !== undefined ? { structuredContent: o.data } : {}), isError: !!o.isError });
      } catch (e) { return reply(id, { content: [{ type: 'text', text: e.message }], isError: true }); }
    }
    return fail(id, -32601, `모르는 메서드 '${method}'`);
  };
  const rl = createInterface({ input: process.stdin });
  let chain = Promise.resolve(); // 한 번에 하나씩 — 답 순서가 요청 순서와 같다
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch (e) { return fail(null, -32700, 'JSON 이 아님'); }
    chain = chain.then(() => handle(msg)).catch((e) => process.stderr.write(String(e && e.stack || e) + '\n'));
  });
  return { role, visible: visible.map((t) => t.name) };
}

// 인자 검사 — 문자열 형식만 (도구가 더 본다)
export function need(args, key, re) {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`인자 '${key}' 가 필요함`);
  if (re && !re.test(v)) throw new Error(`인자 '${key}' 형식이 아님: ${v}`);
  return v.trim();
}
