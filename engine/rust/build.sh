#!/bin/sh
# Rust 운명 엔진 빌드: WASM(engine/rust/pkg/fate_core.wasm) + 네이티브(target/release/fate_cli) — 소스 해시를 pkg/fate_core.wasm.json 에 적는다.
# 저장소 최상위에서: sh engine/rust/build.sh   (tests/rust_engine.test.mjs 가 소스 해시로 오래된 WASM 을 잡는다)
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cargo build --release
# FMA 방지 (곱셈과 덧셈을 한 번에 하는 명령은 반올림이 한 번이라 JS 와 비트가 달라진다): 네이티브에 FMA 명령이 있거나 WASM 대상에 SIMD 가 켜져 있으면 실패
FMA_NATIVE=unchecked
if command -v objdump >/dev/null 2>&1; then
  FMA_NATIVE=$(objdump -d target/release/fate_cli | grep -ciE 'vfn?m(add|sub)' || true)
  if [ "$FMA_NATIVE" != "0" ]; then echo "실패: 네이티브 빌드에 FMA 명령 $FMA_NATIVE 개 — RUSTFLAGS 의 target-cpu · target-feature 를 확인" >&2; exit 1; fi
else
  echo "경고: objdump 가 없어 네이티브 FMA 검사를 못 함" >&2
fi
if rustc --print cfg --target wasm32-unknown-unknown | grep -qiE 'simd128|relaxed'; then echo "실패: WASM 대상에 SIMD 가 켜져 있음 — FMA 가 생길 수 있다" >&2; exit 1; fi
mkdir -p pkg
cp target/wasm32-unknown-unknown/release/fate_core.wasm pkg/fate_core.wasm
SRC=$(cat Cargo.toml Cargo.lock $(find src -name '*.rs' | LC_ALL=C sort) | sha256sum | cut -d' ' -f1)
WASM=$(sha256sum pkg/fate_core.wasm | cut -d' ' -f1)
printf '{\n  "src_sha256": "%s",\n  "wasm_sha256": "%s",\n  "rustc": "%s",\n  "target": "wasm32-unknown-unknown",\n  "profile": "release (lto, codegen-units 1, panic abort)",\n  "fma_instructions_native": "%s"\n}\n' "$SRC" "$WASM" "$(rustc --version)" "$FMA_NATIVE" > pkg/fate_core.wasm.json
echo "built pkg/fate_core.wasm ($WASM)"
