#!/bin/sh
# Rust 운명 엔진 빌드: WASM(engine/rust/pkg/fate_core.wasm) + 네이티브(target/release/fate_cli) — 소스 해시를 pkg/fate_core.wasm.json 에 적는다.
# 저장소 최상위에서: sh engine/rust/build.sh   (tests/rust_engine.test.mjs 가 소스 해시로 오래된 WASM 을 잡는다)
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cargo build --release
mkdir -p pkg
cp target/wasm32-unknown-unknown/release/fate_core.wasm pkg/fate_core.wasm
SRC=$(cat Cargo.toml Cargo.lock $(find src -name '*.rs' | LC_ALL=C sort) | sha256sum | cut -d' ' -f1)
WASM=$(sha256sum pkg/fate_core.wasm | cut -d' ' -f1)
printf '{\n  "src_sha256": "%s",\n  "wasm_sha256": "%s",\n  "rustc": "%s",\n  "target": "wasm32-unknown-unknown",\n  "profile": "release (lto, codegen-units 1, panic abort)"\n}\n' "$SRC" "$WASM" "$(rustc --version)" > pkg/fate_core.wasm.json
echo "built pkg/fate_core.wasm ($WASM)"
