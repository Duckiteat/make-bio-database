//! 네이티브 대조용 실행 파일: 표준 입력으로 IR 덩어리(f64 LE)를 받고, 본 실행 + 지정한 탐침들의 원자료를 표준 출력(f64 LE)으로 낸다.
//! 쓰는 것은 표준 출력뿐 (파일 쓰기 없음). 탐침 번호는 인자: fate_cli 3 7 11
//! 할당 계수기: 전역 할당기를 감싸 `run_main`·탐침 동안의 힙 할당 횟수를 센다 — 1단계 완료 조건(루프 할당 0)의 네이티브 증거.
use std::alloc::{GlobalAlloc, Layout, System};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use fate_core::engine::Engine;

struct Counting;
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 { ALLOCS.fetch_add(1, Ordering::Relaxed); System.alloc(l) }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) { System.dealloc(p, l) }
    unsafe fn realloc(&self, p: *mut u8, l: Layout, n: usize) -> *mut u8 { ALLOCS.fetch_add(1, Ordering::Relaxed); System.realloc(p, l, n) }
}
#[global_allocator]
static GLOBAL: Counting = Counting;

fn main() {
    let mut raw = Vec::new();
    std::io::stdin().read_to_end(&mut raw).expect("stdin");
    let blob: Vec<f64> = raw.chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    let probes: Vec<usize> = std::env::args().skip(1).map(|a| a.parse().expect("probe index")).collect();
    let mut e = Engine::new(&blob).expect("IR blob");
    let mut probe_out = vec![0.0f64; probes.len() * e.nb];
    let before = ALLOCS.load(Ordering::Relaxed);
    e.run_main();
    for (q, &k) in probes.iter().enumerate() { e.probe(k); let nb = e.nb; probe_out[q * nb..(q + 1) * nb].copy_from_slice(&e.probe_n); }
    let after_probes = ALLOCS.load(Ordering::Relaxed);
    let loop_allocs = after_probes - before; // 본 실행 + 탐침 동안의 힙 할당 (탐침은 fin_n 을 건드리지 않는다)
    let fin_n = e.fin_n.clone();
    let mut out: Vec<f64> = Vec::new();
    let mut put = |v: &[f64]| { out.push(v.len() as f64); out.extend_from_slice(v); };
    put(&e.rec_t[..e.n_rec]); put(&e.rec_n[..e.n_rec * e.nb]); put(&e.rec_lo[..e.n_rec * e.nb]); put(&e.rec_cum[..e.n_rec * 2 * e.nr]);
    put(&e.stats); put(&fin_n); put(&probe_out); put(&[loop_allocs as f64]);
    let bytes: Vec<u8> = out.iter().flat_map(|x| x.to_le_bytes()).collect();
    std::io::stdout().write_all(&bytes).expect("stdout");
}
