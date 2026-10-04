// Hero atmosphere: layered price-wave lines that drift upward to the right, orange for the asset,
// blue for liquidity, with floating particles. Reacts to the pointer; pauses off-screen; static if motion is reduced.
const TAU = Math.PI * 2;

export function mountAtmosphere(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, raf = 0, visible = true, t0 = performance.now();
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false };
  let lines = [], dots = [];

  function setup() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = w < 640 ? 14 : 24;
    lines = Array.from({ length: n }, (_, i) => {
      const k = i / (n - 1);
      return { k, base: h * (0.28 + 0.62 * k), amp: 10 + 44 * k, f1: 1.1 + k * 0.5, f2: 2.4 + k * 0.9, ph: i * 0.55,
        rise: 0.16 * h * (0.4 + k), blue: i % 6 === 3, speed: 0.12 + k * 0.06 };
    });
    dots = Array.from({ length: w < 640 ? 26 : 56 }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 1.4, p: Math.random() * TAU }));
    frame(performance.now(), true);
  }

  function frame(now, once) {
    const t = (now - t0) / 1000;
    mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    ctx.clearRect(0, 0, w, h);
    const step = w < 640 ? 14 : 9;
    for (const L of lines) {
      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) {
        const u = x / w, th = u * TAU * 1.35 + t * L.speed * 2 + L.ph;
        // Sum of waves plus a sawtooth term gives the uneven 5-3 character of an Elliott structure.
        const saw = (((u * 3.2 + L.ph * 0.07 + t * 0.03) % 1) - 0.5) * 0.9;
        let y = L.base - u * L.rise + L.amp * (Math.sin(th * L.f1) * 0.7 + Math.sin(th * L.f2 + t * 0.4) * 0.3 + saw * 0.5);
        if (mouse.on) { const dx = x - mouse.x, dy = y - mouse.y, g = Math.exp(-(dx * dx) / (2 * 130 * 130)) * Math.exp(-(dy * dy) / (2 * 190 * 190)); y -= g * 46; }
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const g = ctx.createLinearGradient(0, 0, w, 0), a = 0.1 + 0.5 * L.k;
      const c = L.blue ? '79,140,255' : '247,147,26';
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.35, `rgba(${c},${a * 0.7})`); g.addColorStop(0.8, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},${a * 0.3})`);
      ctx.strokeStyle = g; ctx.lineWidth = 0.7 + L.k * 1.1; ctx.stroke();
    }
    for (const d of dots) {
      if (!once && !reduce) { d.y -= d.v * 0.016; d.x += d.v * 0.01; if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; } if (d.x > w + 4) d.x = -4; }
      const tw = 0.35 + 0.35 * Math.sin(t * 1.3 + d.p);
      ctx.fillStyle = `rgba(255,190,110,${tw})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
    }
    if (!once && !reduce && visible && !document.hidden) raf = requestAnimationFrame((n) => frame(n));
    else raf = 0;
  }
  const start = () => { if (!raf && !reduce && visible && !document.hidden) raf = requestAnimationFrame((n) => frame(n)); };

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; if (!mouse.on) { mouse.x = mouse.tx; mouse.y = mouse.ty; } mouse.on = true;
  });
  host.addEventListener('pointerleave', () => { mouse.on = false; });
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = 0; setup(); start(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
  document.addEventListener('visibilitychange', start);
  setup(); start();
}
