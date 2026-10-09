//! fate_core — 행정부 운명 엔진 (Rust · 네이티브 C-FFI · WASM). docs/design/engine-port-roadmap.md 1·1.5단계 (결합 Rodas3)
//!
//! 입력: 컴파일러 IR 을 평평하게 직렬화한 f64 덩어리 (engine/fate_rust.js packIR). 법칙 코드 없음 — 테이프만 해석한다.
//! 출력: 원자료 버퍼 (기록점 N·LO·누적 진행량·신호·Δ 당 단계 수, 스냅숏, 사건, 통계). 판정·파일 쓰기 없음.
//! 메모리: `fe_init` 에서 모든 버퍼를 한 번 잡는다 — 이후 `fe_run_main`·`fe_probe` 는 할당하지 않는다(WASM byteLength 불변).

pub mod engine;
pub mod tape;

use engine::Engine;

static mut ENGINE: *mut Engine = core::ptr::null_mut();
static mut STAGE: *mut f64 = core::ptr::null_mut();
static mut STAGE_LEN: usize = 0;

/// IR 덩어리를 쓸 준비 버퍼 (f64 n 개). JS 가 여기에 쓰고 fe_init 을 부른다.
#[no_mangle]
pub extern "C" fn fe_stage(n: u32) -> *mut f64 {
    let mut v = vec![0.0f64; n as usize];
    let p = v.as_mut_ptr();
    core::mem::forget(v);
    unsafe { STAGE = p; STAGE_LEN = n as usize; }
    p
}

/// 엔진 생성. 0 = 성공, 음수 = 형식 오류.
#[no_mangle]
pub extern "C" fn fe_init() -> i32 {
    unsafe {
        if STAGE.is_null() { return -1; }
        let blob = core::slice::from_raw_parts(STAGE, STAGE_LEN);
        match Engine::new(blob) {
            Ok(e) => { if !ENGINE.is_null() { drop(Box::from_raw(ENGINE)); } ENGINE = Box::into_raw(Box::new(e)); 0 }
            Err(_) => -2,
        }
    }
}

#[inline]
fn eng() -> &'static mut Engine { unsafe { &mut *ENGINE } }

#[no_mangle]
pub extern "C" fn fe_run_main() { eng().run_main(); }

#[no_mangle]
pub extern "C" fn fe_probe(k: u32) -> i32 { if eng().probe(k as usize) { 0 } else { -1 } }

/// 2단계: 버퍼 16(probe_in)에 쓴 시작 상태에서 시각 t0 부터 탐침 — 결과는 버퍼 11(probe_n)
#[no_mangle]
pub extern "C" fn fe_probe_from(t0: f64) { eng().probe_from(t0); }

// 출력 버퍼 번호 → (주소, 길이)
fn buf(id: u32) -> (*const f64, usize) {
    let e = eng();
    let s: &[f64] = match id {
        0 => &e.rec_t[..e.n_rec],
        1 => &e.rec_n[..e.n_rec * e.nb],
        2 => &e.rec_lo[..e.n_rec * e.nb],
        3 => &e.rec_cum[..e.n_rec * 2 * e.nr],
        4 => &e.rec_sig[..e.n_rec * e.nsig],
        5 => &e.rec_meta[..e.n_rec * 2],
        6 => &e.snap_t[..e.n_snap],
        7 => &e.events[..e.n_events * 3],
        8 => &e.stats[..],
        9 => &e.run_info[..],
        10 => &e.res_out[..],
        11 => &e.probe_n[..],
        12 => &e.fin_n[..],
        13 => &e.fin_lo[..],
        14 => &e.fin_cum[..],
        15 => &e.snap_n[..e.n_snap * e.nb],
        16 => &e.probe_in[..],
        _ => &[],
    };
    (s.as_ptr(), s.len())
}
#[no_mangle]
pub extern "C" fn fe_ptr(id: u32) -> *const f64 { buf(id).0 }
#[no_mangle]
pub extern "C" fn fe_len(id: u32) -> u32 { buf(id).1 as u32 }
