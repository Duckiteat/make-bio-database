// 결정론 수학 시험 (PLAN-021) — compiler/detmath.js (JS) · engine/rust/src/detmath.rs (Rust → WASM)
//   ① 정밀도: 고정밀 기준값(BigInt 고정소수점 300 비트)과 대조해 오차를 ulp 로 잼 — 로그 ≤ 0.6 · 지수 ≤ 1.1 · 정수 지수 ≤ 0.6 · 분수 지수 ≤ 1.2
//   ② JS = Rust: 같은 입력에서 비트까지 같음 (WASM 출구 fe_dm_pow · fe_dm_log · fe_dm_exp) — 범위 전체와 경계 값
//   ③ 경계 값과 정확한 값
//   ④ 엔진 런타임에 외부 pow · log · exp 호출이 없음 (sqrt · floor · ceil · fabs 는 정확한 연산이라 허용)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const DM = require('../compiler/detmath.js');
const ROOT = new URL('..', import.meta.url);
const wasm = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(new URL('engine/rust/pkg/fate_core.wasm', ROOT))), {}).exports;

// ----- 고정밀 기준값 -----
const P = 300n, ONE = 1n << P;
const dv = new DataView(new ArrayBuffer(8));
function toFix(x) {
  dv.setFloat64(0, x); const b = dv.getBigUint64(0), s = (b >> 63n) ? -1n : 1n, ex = Number((b >> 52n) & 0x7ffn);
  let m = b & ((1n << 52n) - 1n), e;
  if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
  const sh = BigInt(e) + P; return s * (sh >= 0n ? m << sh : m >> (-sh));
}
const mul = (a, b) => (a * b) >> P, div = (a, b) => (a << P) / b;
function expFix(x) { const S = 30n, r = x >> S; let term = ONE, sum = ONE; for (let n = 1n; n < 40n; n++) { term = mul(term, r) / n; sum += term; if (term === 0n) break; } for (let i = 0n; i < S; i++) sum = mul(sum, sum); return sum; }
function logFix(xd) { let y = toFix(Math.log(xd)); const x = toFix(xd); for (let i = 0; i < 4; i++) { const ey = expFix(y); y = y + 2n * div(x - ey, x + ey); } return y; }
function ulpErr(got, ref) { // 기준값 대비 오차 (ulp 단위)
  if (got === 0 || !isFinite(got)) return Infinity;
  const e = Math.floor(Math.log2(Math.abs(got))), ulp = 1n << (P + BigInt(e) - 52n), g = toFix(got), d = g > ref ? g - ref : ref - g;
  return Number(d * 1000000n / ulp) / 1e6;
}
// 재현되는 입력 (xorshift64)
let st = 0x9e3779b97f4a7c15n; const M = (1n << 64n) - 1n;
const rnd = () => { st ^= (st << 13n) & M; st ^= st >> 7n; st ^= (st << 17n) & M; return Number(st >> 11n) * 2 ** -53; };
const lin = (a, b) => a + (b - a) * rnd(), lg = (a, b) => 10 ** lin(a, b);

test('① 정밀도: 고정밀 기준값과 대조 — 로그 ≤ 0.6 ulp · 지수 ≤ 1.1 · 정수 지수 ≤ 0.6 · 분수 지수 ≤ 1.2', () => {
  const worst = {}, note = (k, e) => { worst[k] = Math.max(worst[k] || 0, e); };
  for (let i = 0; i < 1200; i++) {
    const x = lg(-9, 12); note('log', ulpErr(DM.log(x), logFix(x)));
    const u = 1 - rnd(); if (u > 0 && u < 1) note('log', ulpErr(DM.log(u), logFix(u)));
    const a = lin(-40, 40); note('exp', ulpErr(DM.exp(a), expFix(toFix(a))));
    const c = lg(-9, 0), k = 1 + (i % 4); note('pow_int', ulpErr(DM.pow(c, k), expFix(mul(toFix(k), logFix(c))))); note('pow_int', ulpErr(DM.pow(c, -k), expFix(mul(toFix(-k), logFix(c)))));
    const s = lg(-6, 6), n = [0.5, 1.5, 2.5, 3.5, 6, 8][i % 6]; note(Number.isInteger(n) ? 'pow_int' : 'pow_frac', ulpErr(DM.pow(s, n), expFix(mul(toFix(n), logFix(s)))));
    const er = lg(-10, 3); note('pow_frac', ulpErr(DM.pow(er, -1 / 3), expFix(mul(toFix(-1 / 3), logFix(er)))));
  }
  assert.ok(worst.log <= 0.6, `log ${worst.log}`); assert.ok(worst.exp <= 1.1, `exp ${worst.exp}`);
  assert.ok(worst.pow_int <= 0.6, `pow 정수 지수 ${worst.pow_int}`); assert.ok(worst.pow_frac <= 1.2, `pow 분수 지수 ${worst.pow_frac}`);
});

const same = (a, b) => Object.is(a, b);
const probe = (name, fnJs, fnWasm, gen, n) => {
  let bad = 0, first = null;
  for (let i = 0; i < n; i++) { const args = gen(i), a = fnJs(...args), b = fnWasm(...args); if (!same(a, b)) { bad++; if (!first) first = `${args} → JS ${a} / Rust ${b}`; } }
  assert.equal(bad, 0, `${name}: JS ≠ Rust ${bad} 건 (첫 건 ${first})`);
};

test('② JS = Rust: 같은 입력에서 비트까지 같음 (범위 전체 + 경계 값)', () => {
  const N = 120000;
  probe('log 넓은 범위', DM.log, wasm.fe_dm_log, () => [lg(-300, 300)], N);
  probe('log 1 근처', DM.log, wasm.fe_dm_log, () => [1 + lin(-0.3, 0.3)], N);
  probe('log 부정규', DM.log, wasm.fe_dm_log, () => [lg(-323, -308)], 20000);
  probe('exp', DM.exp, wasm.fe_dm_exp, () => [lin(-745, 709)], N);
  probe('exp 작은 인수', DM.exp, wasm.fe_dm_exp, () => [lin(-1, 1)], N);
  probe('pow 힐', DM.pow, wasm.fe_dm_pow, (i) => [lg(-6, 6), [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 12.5][i % 10]], N);
  probe('pow 정수(질량 작용)', DM.pow, wasm.fe_dm_pow, (i) => [lg(-9, 3), 1 + (i % 6)], N);
  probe('pow 음의 정수', DM.pow, wasm.fe_dm_pow, (i) => [lg(-9, 3), -(1 + (i % 6))], 40000);
  probe('pow 걸음 크기', DM.pow, wasm.fe_dm_pow, () => [lg(-10, 3), -1 / 3], N);
  probe('pow 넓은 범위', DM.pow, wasm.fe_dm_pow, () => [lg(-30, 30), lin(-20, 20)], N);
  const specials = [0, -0, 1, -1, 2, -2, 0.5, 10, 1e-300, 1e300, 5e-324, 1.7976931348623157e308, Infinity, -Infinity, NaN, 3, -3, 100, -100, 0.1, 64, 65, -64, -65];
  for (const x of specials) for (const y of specials) assert.ok(same(DM.pow(x, y), wasm.fe_dm_pow(x, y)), `pow(${x}, ${y}): JS ${DM.pow(x, y)} / Rust ${wasm.fe_dm_pow(x, y)}`);
  for (const x of specials) { assert.ok(same(DM.log(x), wasm.fe_dm_log(x)), `log(${x})`); assert.ok(same(DM.exp(x), wasm.fe_dm_exp(x)), `exp(${x})`); }
  for (const x of [709.78, 709.7827128933841, 709.783, -745.13, -745.1332191019412, -745.14, -708, -740, 700, 1e-20, -1e-20]) assert.ok(same(DM.exp(x), wasm.fe_dm_exp(x)), `exp(${x})`);
});

test('③ 경계 값과 정확한 값', () => {
  assert.equal(DM.pow(2, 10), 1024); assert.equal(DM.pow(2, -1), 0.5); assert.equal(DM.pow(3, 2), 9); assert.equal(DM.pow(10, 3), 1000); assert.equal(DM.pow(7, 1), 7); assert.equal(DM.pow(5, 0), 1);
  assert.equal(DM.pow(0, 2), 0); assert.equal(DM.pow(0, -1), Infinity); assert.equal(DM.pow(-8, 3), -512); assert.equal(DM.pow(-8, 2), 64); assert.ok(Number.isNaN(DM.pow(-8, 0.5))); assert.equal(DM.pow(Infinity, -2), 0);
  assert.equal(DM.log(1), 0); assert.equal(DM.log(0), -Infinity); assert.ok(Number.isNaN(DM.log(-1))); assert.equal(DM.log(Infinity), Infinity);
  assert.equal(DM.exp(0), 1); assert.equal(DM.exp(710), Infinity); assert.equal(DM.exp(-746), 0); assert.ok(Number.isNaN(DM.exp(NaN)));
  assert.ok(Math.abs(DM.exp(1) - Math.E) <= 2 * Number.EPSILON * Math.E); assert.ok(Math.abs(DM.log(Math.E) - 1) <= 2 * Number.EPSILON);
  assert.ok(Math.abs(DM.exp(-740) / Math.exp(-740) - 1) < 1e-10, '부정규 수 근처'); assert.ok(isFinite(DM.exp(709.78)) && DM.exp(709.78) > 1e308);
  // 오차 상한이 아닌 항등식: exp(log x) ≈ x, pow(x, y) ≈ exp(y·log x)
  for (const x of [1e-9, 0.37, 1, 2.5, 1234.5, 1e12]) assert.ok(Math.abs(DM.exp(DM.log(x)) / x - 1) < Number.EPSILON * (2 + Math.abs(DM.log(x))), `exp(log ${x})`); // 로그의 반올림 오차가 지수에서 |log x| 배로 커진다
});

test('④ 엔진 런타임에 외부 pow · log · exp 호출이 없다 (sqrt · floor · ceil · fabs 는 정확한 연산이라 허용)', () => {
  const jsFiles = ['engine/fate_engine.js', 'engine/rng.js', 'compiler/tape.js'];
  for (const f of jsFiles) assert.ok(!/Math\.(pow|exp|log)\(/.test(readFileSync(new URL(f, ROOT), 'utf8').replace(/\/\/.*$/gm, '')), `${f}: Math.pow/exp/log 호출`);
  const rsFiles = readdirSync(new URL('engine/rust/src/', ROOT)).filter((f) => f.endsWith('.rs') && f !== 'detmath.rs');
  for (const f of rsFiles) assert.ok(!/libm::(pow|exp|log)\(/.test(readFileSync(new URL(`engine/rust/src/${f}`, ROOT), 'utf8').replace(/\/\/.*$/gm, '')), `${f}: libm::pow/exp/log 호출`);
  const det = readFileSync(new URL('engine/rust/src/detmath.rs', ROOT), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/libm::(pow|exp|log)\(/.test(det) && !/mul_add/.test(det), 'detmath.rs: 외부 pow/exp/log 또는 mul_add');
  assert.ok(!/Math\.(pow|exp|log)\(/.test(readFileSync(new URL('compiler/detmath.js', ROOT), 'utf8').replace(/\/\/.*$/gm, '')), 'detmath.js: 외부 Math.pow/exp/log');
});
