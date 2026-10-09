//! 네이티브 대조용 실행 파일: 표준 입력으로 IR 덩어리(f64 LE)를 받고, 본 실행 + 지정한 탐침들의 원자료를 표준 출력(f64 LE)으로 낸다.
//! 쓰는 것은 표준 출력뿐 (파일 쓰기 없음). 인자: fate_cli [--threads T] k1 k2 …  (탐침 스냅숏 번호)
//! 할당 계수기: 전역 할당기를 감싸 힙 할당 횟수를 센다(스레드마다 따로) — 루프 할당 0 의 네이티브 증거.
//! 2단계: 같은 탐침을 직렬(본 엔진)과 병렬(스레드마다 자기 Engine, probe_from)로 돌려 둘을 함께 낸다 — 비트 일치·속도 비교용.
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;
use fate_core::engine::Engine;

struct Counting;
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
thread_local! { static LOCAL: Cell<usize> = const { Cell::new(0) }; }
fn bump() { ALLOCS.fetch_add(1, Ordering::Relaxed); let _ = LOCAL.try_with(|c| c.set(c.get() + 1)); }
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 { bump(); System.alloc(l) }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) { System.dealloc(p, l) }
    unsafe fn realloc(&self, p: *mut u8, l: Layout, n: usize) -> *mut u8 { bump(); System.realloc(p, l, n) }
}
#[global_allocator]
static GLOBAL: Counting = Counting;
fn local() -> usize { LOCAL.with(|c| c.get()) }

fn main() {
    let mut raw = Vec::new();
    std::io::stdin().read_to_end(&mut raw).expect("stdin");
    let blob: Vec<f64> = raw.chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let mut threads = 1usize;
    if let Some(p) = args.iter().position(|a| a == "--threads") { threads = args[p + 1].parse().expect("threads"); args.drain(p..p + 2); }
    let probes: Vec<usize> = args.iter().map(|a| a.parse().expect("probe index")).collect();
    let mut e = Engine::new(&blob).expect("IR blob");
    let nb = e.nb;
    let mut probe_out = vec![0.0f64; probes.len() * nb];
    let before = ALLOCS.load(Ordering::Relaxed);
    e.run_main();
    let t_serial = Instant::now();
    for (q, &k) in probes.iter().enumerate() { e.probe(k); probe_out[q * nb..(q + 1) * nb].copy_from_slice(&e.probe_n); }
    let serial_ns = t_serial.elapsed().as_nanos() as f64;
    let loop_allocs = ALLOCS.load(Ordering::Relaxed) - before; // 본 실행 + 직렬 탐침 동안의 힙 할당
    // 병렬: 스레드마다 자기 엔진(할당은 여기서 끝), 탐침 q 는 스레드 q mod T 가 — 시작 상태는 본 실행의 스냅숏
    let starts: Vec<(f64, Vec<f64>)> = probes.iter().map(|&k| (e.snap_t[k], e.snap_n[k * nb..(k + 1) * nb].to_vec())).collect();
    let mut engines: Vec<Engine> = (0..threads).map(|_| Engine::new(&blob).expect("IR blob")).collect();
    let mut par_out = vec![0.0f64; probes.len() * nb];
    let mut thread_allocs = 0usize;
    let t_par = Instant::now();
    std::thread::scope(|s| {
        let handles: Vec<_> = engines.iter_mut().enumerate().map(|(w, eng)| {
            let starts = &starts;
            s.spawn(move || {
                let mine: Vec<usize> = (w..starts.len()).step_by(threads).collect();
                let mut res = vec![0.0f64; mine.len() * eng.nb]; // 결과 버퍼는 루프 전에
                let a1 = local();
                for (j, &q) in mine.iter().enumerate() {
                    eng.probe_in.copy_from_slice(&starts[q].1);
                    eng.probe_from(starts[q].0);
                    let nb = eng.nb; res[j * nb..(j + 1) * nb].copy_from_slice(&eng.probe_n);
                }
                (mine, res, local() - a1) // a1 이후: 탐침 루프 동안의 이 스레드 힙 할당
            })
        }).collect();
        for h in handles {
            let (mine, res, allocs) = h.join().expect("thread");
            thread_allocs += allocs;
            for (j, &q) in mine.iter().enumerate() { par_out[q * nb..(q + 1) * nb].copy_from_slice(&res[j * nb..(j + 1) * nb]); }
        }
    });
    let par_ns = t_par.elapsed().as_nanos() as f64;
    let fin_n = e.fin_n.clone();
    let mut out: Vec<f64> = Vec::new();
    let mut put = |v: &[f64]| { out.push(v.len() as f64); out.extend_from_slice(v); };
    put(&e.rec_t[..e.n_rec]); put(&e.rec_n[..e.n_rec * nb]); put(&e.rec_lo[..e.n_rec * nb]); put(&e.rec_cum[..e.n_rec * 2 * e.nr]);
    put(&e.stats); put(&fin_n); put(&probe_out); put(&[loop_allocs as f64]);
    put(&par_out); put(&[thread_allocs as f64, serial_ns, par_ns, threads as f64]);
    let bytes: Vec<u8> = out.iter().flat_map(|x| x.to_le_bytes()).collect();
    std::io::stdout().write_all(&bytes).expect("stdout");
}
