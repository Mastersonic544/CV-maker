import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   All styles scoped/isolated so they don't leak into the app
───────────────────────────────────────────────────────────── */
const LANDING_CSS = `
  :root {
    --bg:          #020810;
    --bg2:         #040d18;
    --cyan:        #00d4ff;
    --orange:      #ff5c35;
    --text:        #dde4ee;
    --muted:       rgba(221,228,238,0.42);
    --glass:       rgba(4,13,24,0.68);
    --border:      rgba(255,255,255,0.07);
    --resume-bg:   #f1f4f8;
  }

  html { scroll-behavior: smooth; }

  #landing-root {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    overflow-x: hidden;
    min-height: 100vh;
  }

  /* Removed aggressive CSS reset to fix specificity bugs causing cropped paddings */

  /* CURSOR */
  #lnd-cur  { position:fixed; width:8px; height:8px; background:var(--cyan); border-radius:50%; pointer-events:none; z-index:10000; transform:translate(-50%,-50%); transition:width .15s,height .15s; mix-blend-mode:difference; }
  #lnd-ring { position:fixed; width:34px; height:34px; border:1px solid rgba(0,212,255,.45); border-radius:50%; pointer-events:none; z-index:9999; transform:translate(-50%,-50%); transition:width .25s,height .25s,border-color .2s; }

  /* GRAIN */
  #landing-root .grain {
    position:fixed; inset:-200%; width:400%; height:400%;
    pointer-events:none; z-index:9998; opacity:.04;
    animation:grain-shift .4s steps(3) infinite;
    background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  @keyframes grain-shift {
    0%   { transform:translate(0,0);   }
    33%  { transform:translate(-4%,-6%); }
    66%  { transform:translate(6%,3%);  }
    100% { transform:translate(-2%,5%); }
  }

  /* NAV */
  #lnd-nav {
    position:fixed; top:0; left:0; right:0; z-index:800;
    height:60px; padding:0 3.5rem;
    display:flex; align-items:center; justify-content:space-between;
    background:var(--glass);
    backdrop-filter:blur(28px) saturate(160%);
    -webkit-backdrop-filter:blur(28px) saturate(160%);
    border-bottom:1px solid var(--border);
    transform:translateY(-100%);
    transition:transform .5s cubic-bezier(.16,1,.3,1);
  }
  #lnd-nav.show { transform:translateY(0); }
  .nav-brand { font-family:'Syne',sans-serif; font-weight:800; font-size:1.05rem; letter-spacing:-.02em; color:var(--text); }
  .nav-brand em { color:var(--cyan); font-style:normal; }
  .nav-links { display:flex; gap:2.5rem; list-style:none; }
  .nav-links a { font-size:.7rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); text-decoration:none; transition:color .2s; cursor:none; }
  .nav-links a:hover { color:var(--cyan); }
  .nav-btn {
    display: inline-flex; justify-content: center; align-items: center; white-space: nowrap;
    font-family:'DM Mono',monospace; font-size:.78rem; letter-spacing:.08em; text-transform:uppercase;
    color:var(--bg); background:var(--cyan); border:none; padding:.7rem 1.6rem; cursor:none; font-weight:600;
    clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);
    transition:opacity .2s;
  }
  .nav-btn:hover { opacity:.8; }

  /* HERO */
  #lnd-hero {
    min-height:100vh; padding:64px 4rem 0;
    display:grid; grid-template-columns:1fr 1fr;
    align-items:center; position:relative; overflow:hidden;
  }
  #lnd-hero::before {
    content:''; position:absolute; inset:0;
    background-image:radial-gradient(rgba(0,212,255,.11) 1px, transparent 1px);
    background-size:46px 46px;
    mask-image:radial-gradient(ellipse 65% 80% at 75% 50%, rgba(0,0,0,.7), transparent);
    pointer-events:none;
  }
  #lnd-hero::after {
    content:''; position:absolute;
    width:700px; height:700px; right:-80px; top:50%;
    transform:translateY(-50%);
    background:radial-gradient(circle, rgba(0,212,255,.07) 0%, transparent 68%);
    pointer-events:none;
  }

  .hero-copy { position:relative; z-index:2; }
  .hero-eyebrow {
    display:flex; align-items:center; gap:.75rem;
    font-size:.68rem; letter-spacing:.24em; text-transform:uppercase;
    color:var(--cyan); margin-bottom:1.75rem;
    opacity:0; animation:fadeUp .6s .2s forwards;
  }
  .hero-eyebrow::before { content:''; width:22px; height:1px; background:var(--cyan); flex-shrink:0; }
  .hero-h1 {
    font-family:'Syne',sans-serif; font-weight:800;
    font-size:clamp(3rem,5.8vw,6rem); line-height:.92;
    letter-spacing:-.04em; margin-bottom:1.6rem;
  }
  .hero-h1 .line { display:block; overflow:hidden; }
  .hero-h1 .line span { display:block; opacity:0; transform:translateY(105%); }
  .hero-h1 .line:nth-child(1) span { animation:slideUp .72s .4s cubic-bezier(.16,1,.3,1) forwards; }
  .hero-h1 .line:nth-child(2) span { animation:slideUp .72s .56s cubic-bezier(.16,1,.3,1) forwards; }
  .hero-h1 .line:nth-child(3) span { animation:slideUp .72s .72s cubic-bezier(.16,1,.3,1) forwards; }
  .hero-h1 .hl { color:var(--cyan); }
  .hero-sub { font-size:.85rem; line-height:1.8; color:var(--muted); max-width:440px; margin-bottom:2.5rem; opacity:0; animation:fadeUp .7s .9s forwards; }
  .hero-ctas { display:flex; gap:1rem; align-items:center; opacity:0; animation:fadeUp .7s 1.05s forwards; }

  .btn-prim {
    display: inline-flex; justify-content: center; align-items: center; white-space: nowrap; gap: 0.5rem;
    font-family:'DM Mono',monospace; font-size:.88rem; letter-spacing:.07em; text-transform:uppercase;
    color:var(--bg); background:var(--cyan); border:none; padding:1.1rem 2.6rem; cursor:none; font-weight:600;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));
    position:relative; overflow:hidden; transition:opacity .2s;
  }
  .btn-prim::after { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 0%,rgba(255,255,255,.22) 50%,transparent 100%); transform:translateX(-100%); transition:transform .55s ease; }
  .btn-prim:hover { opacity:.92; }
  .btn-prim:hover::after { transform:translateX(100%); }
  .btn-ghost {
    display: inline-flex; justify-content: center; align-items: center; white-space: nowrap; gap: 0.5rem;
    font-family:'DM Mono',monospace; font-size:.88rem; letter-spacing:.07em; text-transform:uppercase;
    color:var(--muted); background:none; border:1px solid var(--border); padding:1.1rem 2.6rem; cursor:none; font-weight:600;
    transition:color .2s,border-color .2s;
  }
  .btn-ghost:hover { color:var(--text); border-color:rgba(255,255,255,.18); }

  /* 3D RESUME */
  .resume-scene { position:relative; z-index:2; display:flex; align-items:center; justify-content:center; perspective:1100px; opacity:0; animation:fadeIn 1s .5s forwards; }
  .r-wrap { transform-style:preserve-3d; transform:rotateX(-8deg) rotateY(18deg); position:relative; will-change:transform; }
  .r-halo { position:absolute; inset:-30px; background:var(--cyan); opacity:.05; filter:blur(55px); border-radius:4px; transform:translateZ(-90px) scale(.88); pointer-events:none; }
  .r-card {
    width:360px; min-height:460px; background:var(--resume-bg); padding:2.25rem 1.85rem 2.25rem;
    position:relative; overflow:hidden;
    box-shadow:0 60px 130px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.09),0 0 90px rgba(0,212,255,.13);
  }
  .r-card::before { content:''; position:absolute; top:0; left:0; width:3px; height:100%; background:linear-gradient(to bottom, var(--cyan), rgba(0,212,255,.25)); }
  .r-scan { position:absolute; left:0; right:0; height:2px; z-index:20; background:linear-gradient(to right,transparent,var(--cyan),transparent); box-shadow:0 0 18px var(--cyan),0 0 40px rgba(0,212,255,.45); animation:scan 3.5s ease-in-out infinite; }
  @keyframes scan { 0%{top:-2px;opacity:0} 4%{opacity:1} 96%{opacity:1} 100%{top:100%;opacity:0} }
  .r-badge { position:absolute; top:1.4rem; right:1.4rem; width:46px; height:46px; border:1.5px solid var(--cyan); background:rgba(0,212,255,.07); display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .r-badge-n { font-family:'Syne',sans-serif; font-weight:800; font-size:1rem; color:var(--cyan); line-height:1; }
  .r-badge-l { font-size:.42rem; letter-spacing:.1em; color:rgba(0,212,255,.55); text-transform:uppercase; margin-top:2px; }
  .rn { font-family:'Syne',sans-serif; font-weight:700; font-size:1.1rem; color:#1a1f2e; letter-spacing:-.02em; margin-bottom:.2rem; }
  .rt { font-size:.62rem; letter-spacing:.12em; text-transform:uppercase; color:#64748b; margin-bottom:.7rem; }
  .rc { display:flex; gap:.85rem; font-size:.56rem; color:#94a3b8; padding-bottom:.7rem; border-bottom:1px solid #e2e8f0; margin-bottom:.9rem; }
  .rs-label { font-size:.52rem; letter-spacing:.2em; text-transform:uppercase; color:#007fa0; font-weight:500; margin-bottom:.45rem; }
  .re { margin-bottom:.8rem; }
  .re-top { display:flex; justify-content:space-between; align-items:baseline; }
  .re-co { font-family:'Syne',sans-serif; font-weight:600; font-size:.72rem; color:#1e293b; }
  .re-dt { font-size:.52rem; color:#94a3b8; }
  .re-role { font-size:.58rem; color:#64748b; margin:.15rem 0 .25rem; }
  .re-bullet { font-size:.57rem; color:#475569; line-height:1.55; padding-left:.7rem; position:relative; }
  .re-bullet::before { content:'▸'; position:absolute; left:0; color:#007fa0; font-size:.48rem; top:.05em; }
  .r-skills-wrap { display:flex; flex-wrap:wrap; gap:.28rem; }
  .r-tag { font-size:.52rem; padding:.18rem .48rem; border:1px solid #e2e8f0; color:#64748b; background:#fff; }
  .float-chip { position:absolute; font-family:'DM Mono',monospace; font-size:.58rem; color:rgba(0,212,255,.35); pointer-events:none; white-space:nowrap; transform-style:preserve-3d; }

  /* SCROLL HINT */
  .scroll-hint { position:absolute; bottom:2.5rem; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:.45rem; opacity:0; animation:fadeIn 1s 1.6s forwards; }
  .scroll-hint span { font-size:.58rem; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); }
  .s-line { width:1px; height:38px; background:linear-gradient(to bottom,var(--cyan),transparent); animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:.5;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(.65)} }

  /* MARQUEE */
  .mq { overflow:hidden; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:.9rem 0; background:rgba(0,212,255,.025); }
  .mq-track { display:flex; gap:2.5rem; width:max-content; animation:mq 28s linear infinite; }
  .mq-item { display:flex; align-items:center; gap:1.25rem; white-space:nowrap; font-family:'Syne',sans-serif; font-weight:700; font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); }
  .mq-dot { width:4px; height:4px; background:var(--cyan); border-radius:50%; flex-shrink:0; }
  @keyframes mq { from{transform:translateX(0)} to{transform:translateX(-50%)} }

  /* SHARED SECTION STYLES */
  .s-label { display:flex; align-items:center; gap:.75rem; font-size:.68rem; letter-spacing:.22em; text-transform:uppercase; color:var(--cyan); margin-bottom:1rem; }
  .s-label::before { content:''; width:22px; height:1px; background:var(--cyan); }
  .s-title { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(2rem,3.8vw,3.5rem); line-height:1; letter-spacing:-.035em; }
  .reveal { opacity:0; transform:translateY(28px); transition:opacity .65s,transform .65s; }
  .reveal.in { opacity:1; transform:translateY(0); }

  /* PROCESS */
  #lnd-process { padding:9rem 4rem; }
  .process-grid { margin-top:4rem; display:grid; grid-template-columns:repeat(3,1fr); gap:1.5px; background:var(--border); border:1px solid var(--border); }
  .p-card { padding:3rem 2.5rem; background:var(--bg); position:relative; overflow:hidden; opacity:0; transform:translateY(24px); transition:opacity .6s,transform .6s,background .3s; }
  .p-card.in { opacity:1; transform:translateY(0); }
  .p-card:nth-child(2){transition-delay:.1s} .p-card:nth-child(3){transition-delay:.2s}
  .p-card:hover { background:rgba(0,212,255,.02); }
  .p-card::after { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(to right,var(--cyan),transparent); opacity:0; transition:opacity .3s; }
  .p-card:hover::after { opacity:1; }
  .p-num { font-family:'Syne',sans-serif; font-weight:800; font-size:4rem; line-height:1; color:rgba(0,212,255,.1); margin-bottom:1.25rem; }
  .p-title { font-family:'Syne',sans-serif; font-weight:700; font-size:1.1rem; margin-bottom:.75rem; }
  .p-body { font-size:.78rem; line-height:1.75; color:var(--muted); }
  .p-tag { display:inline-block; margin-top:1.5rem; font-size:.58rem; letter-spacing:.1em; text-transform:uppercase; padding:.22rem .6rem; border:1px solid var(--border); color:var(--muted); }

  /* STATS */
  .stats-row { display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
  .stat { padding:3.5rem 3rem; border-right:1px solid var(--border); opacity:0; transform:translateY(18px); transition:opacity .5s,transform .5s; }
  .stat:last-child { border-right:none; }
  .stat.in { opacity:1; transform:translateY(0); }
  .stat:nth-child(2){transition-delay:.08s} .stat:nth-child(3){transition-delay:.16s} .stat:nth-child(4){transition-delay:.24s}
  .stat-n { font-family:'Syne',sans-serif; font-weight:800; font-size:3rem; letter-spacing:-.04em; line-height:1; margin-bottom:.5rem; }
  .stat-n em { color:var(--cyan); font-style:normal; }
  .stat-d { font-size:.68rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }

  /* FEATURES */
  #lnd-features { padding:9rem 4rem; }
  .feat-grid { margin-top:3.5rem; display:grid; grid-template-columns:1fr 1fr; gap:1.5px; background:var(--border); border:1px solid var(--border); }
  .feat { padding:3rem; background:var(--bg); opacity:0; transform:translateY(18px); transition:opacity .55s,transform .55s,background .25s; }
  .feat.in { opacity:1; transform:translateY(0); }
  .feat:nth-child(2){transition-delay:.09s} .feat:nth-child(3){transition-delay:.18s} .feat:nth-child(4){transition-delay:.27s}
  .feat:hover { background:rgba(0,212,255,.018); }
  .feat-idx { font-size:.58rem; letter-spacing:.2em; color:var(--cyan); margin-bottom:1.25rem; }
  .feat-title { font-family:'Syne',sans-serif; font-weight:700; font-size:1.3rem; letter-spacing:-.02em; margin-bottom:.7rem; }
  .feat-body { font-size:.78rem; line-height:1.78; color:var(--muted); }
  .feat-pill { display:inline-block; margin-top:1.5rem; font-size:.58rem; letter-spacing:.08em; text-transform:uppercase; padding:.22rem .65rem; border:1px solid var(--border); color:var(--muted); }

  /* TEAM */
  #lnd-team { padding:9rem 0; overflow:hidden; }
  .team-hdr { padding:0 4rem; margin-bottom:5rem; }
  .team-split { display:grid; grid-template-columns:1fr 1fr; }
  .member { padding:5rem 4.5rem; position:relative; overflow:hidden; cursor:none; opacity:0; transition:opacity .8s; }
  .member.in { opacity:1; }
  .member:first-child { border-right:1px solid var(--border); }
  .member::before { content:''; position:absolute; inset:0; opacity:0; transition:opacity .4s; pointer-events:none; }
  .member:first-child::before { background:radial-gradient(ellipse 50% 60% at 40% 50%, rgba(0,212,255,.07), transparent); }
  .member:last-child::before  { background:radial-gradient(ellipse 50% 60% at 60% 50%, rgba(255,92,53,.07), transparent); }
  .member:hover::before { opacity:1; }
  .member-bg-letter { position:absolute; font-family:'Syne',sans-serif; font-weight:800; font-size:18vw; line-height:1; top:50%; transform:translateY(-50%); letter-spacing:-.05em; color:rgba(255,255,255,.02); pointer-events:none; user-select:none; }
  .m-idx  { font-size:.62rem; letter-spacing:.22em; color:var(--muted); margin-bottom:2rem; }
  .m-name { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(2.8rem,4.5vw,5rem); line-height:.88; letter-spacing:-.05em; margin-bottom:1.5rem; transition:color .3s; }
  .member:first-child .m-name:hover { color:var(--cyan); }
  .member:last-child  .m-name:hover { color:var(--orange); }
  .m-role { font-size:.68rem; letter-spacing:.15em; text-transform:uppercase; color:var(--muted); margin-bottom:1.5rem; }
  .m-bar  { height:1px; background:var(--border); transition:width .35s,background .35s; width:40px; }
  .member:first-child:hover .m-bar { width:80px; background:var(--cyan); }
  .member:last-child:hover  .m-bar { width:80px; background:var(--orange); }

  /* CTA */
  #lnd-cta { padding:11rem 4rem; text-align:center; position:relative; overflow:hidden; }
  #lnd-cta::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 55% 55% at 50% 50%, rgba(0,212,255,.05), transparent); }
  .cta-eye { font-size:.68rem; letter-spacing:.24em; text-transform:uppercase; color:var(--cyan); margin-bottom:1.5rem; }
  .cta-h { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(3.5rem,8vw,8.5rem); line-height:.88; letter-spacing:-.05em; margin-bottom:2rem; }
  .cta-sub { font-size:.85rem; color:var(--muted); max-width:480px; margin:0 auto 3rem; line-height:1.8; }

  /* FOOTER */
  #landing-root footer { padding:2.5rem 4rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
  .f-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:1rem; letter-spacing:-.02em; }
  .f-logo em { color:var(--cyan); font-style:normal; }
  .f-copy { font-size:.62rem; color:var(--muted); letter-spacing:.09em; }
  .f-ver  { font-size:.62rem; color:rgba(0,212,255,.35); letter-spacing:.09em; }

  /* COFFEE SECTION */
  #lnd-coffee {
    padding: 7rem 4rem;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    overflow: hidden;
    background: var(--bg);
  }
  #lnd-coffee::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 50% 70% at 50% 50%, rgba(255,92,53,.055), transparent);
    pointer-events: none;
  }
  #lnd-coffee::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,92,53,.07) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: radial-gradient(ellipse 55% 80% at 50% 50%, rgba(0,0,0,.6), transparent);
    pointer-events: none;
  }
  .coffee-eye   { font-size:.68rem; letter-spacing:.24em; text-transform:uppercase; color:var(--orange); margin-bottom:1.25rem; display:flex; align-items:center; gap:.75rem; }
  .coffee-eye::before, .coffee-eye::after { content:''; width:22px; height:1px; background:var(--orange); flex-shrink:0; }
  .coffee-h     { font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(2.4rem,4.5vw,4.2rem); line-height:.95; letter-spacing:-.04em; color:var(--text); margin-bottom:1.25rem; position:relative; z-index:1; }
  .coffee-sub   { font-size:.82rem; color:var(--muted); line-height:1.75; max-width:420px; margin-bottom:2.8rem; position:relative; z-index:1; }
  .coffee-btn-main {
    position: relative; z-index: 1;
    display: inline-flex; align-items: center; gap: .65rem;
    font-family:'DM Mono',monospace; font-size:.82rem; letter-spacing:.08em; text-transform:uppercase;
    color: var(--bg); background: var(--orange); border: none;
    padding: 1rem 2.4rem; cursor: none; font-weight: 600;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    transition: opacity .2s, box-shadow .2s;
    box-shadow: 0 8px 32px rgba(255,92,53,.28);
  }
  .coffee-btn-main:hover { opacity: .88; box-shadow: 0 12px 48px rgba(255,92,53,.4); }

  /* SCROLL TOP BTN */
  #lnd-top-btn {
    position: fixed; bottom: 2.5rem; right: 2.5rem; z-index: 850;
    width: 3.5rem; height: 3.5rem; border-radius: 50%;
    background: var(--cyan); border: none; color: var(--bg);
    display: flex; justify-content: center; align-items: center;
    cursor: none; pointer-events: none; opacity: 0; transform: translateY(20px);
    transition: opacity 0.4s cubic-bezier(.16,1,.3,1), transform 0.4s cubic-bezier(.16,1,.3,1), filter 0.2s;
    box-shadow: 0 10px 40px rgba(0,212,255,0.25);
  }
  #lnd-top-btn.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
  #lnd-top-btn:hover { filter: brightness(1.15); }

  /* KEYFRAMES */
  @keyframes fadeUp  { to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn  { to { opacity:1; } }
`;

const MQ_ITEMS = ['GAN Scoring Loop', 'Playwright Automation', 'LinkedIn Easy Apply', 'Persona-Driven CVs', 'Gmail SMTP', 'Interview Simulator', 'ATS Optimization', 'HR Persona Research'];
const SKILLS = ['TypeScript', 'Rust', 'Go', 'React', 'K8s', 'Postgres', 'AWS'];
const STATS = [
  { n: '9', em: '.4', d: 'Avg CV Score (GAN)' },
  { n: '20', em: '/day', d: 'Applications Automated' },
  { n: '100', em: '%', d: 'Local — Zero Cloud' },
  { n: '0', em: '$', d: 'Free Tier Stack' },
];
const FEATURES = [
  { idx: '01', title: 'GAN-Style CV Loop', body: 'A Generator and Discriminator LLM fight over your resume until the HR critic awards 9+/10. Every bullet quantified, every tone calibrated to the exact persona of your target company.', pill: 'meta-llama / llama-3.3-70b' },
  { idx: '02', title: 'Hiring Persona Synthesis', body: 'Scrapes CEO LinkedIn posts, HR activity, and company mission statements. The AI synthesizes a detailed personality map — tone, values, red flags — and uses it to shape every word of your application.', pill: 'Playwright + OpenRouter' },
  { idx: '03', title: 'Headless Auto-Apply', body: 'Playwright-powered LinkedIn Easy Apply with human-like timing, scroll simulation, and multi-step form handling. Gmail SMTP for email applications with PDF attachments and LinkedIn DMs for direct HR outreach.', pill: 'Rate-limited — 20 apps/day' },
  { idx: '04', title: 'Interview Simulator', body: 'Before the real thing, the AI role-plays as your target company\'s HR persona in a live chat. Hit "Help Me" for real-time coaching — hidden intent decoded, ideal structure provided — without breaking immersion.', pill: 'Persona-Injected LLM' },
];

const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // ── Fonts ──────────────────────────────────────────────
    const pc1 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    const pc2 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });
    const font = Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&display=swap',
    });
    document.head.append(pc1, pc2, font);

    // ── Body cursor ───────────────────────────────────────
    document.body.style.cursor = 'none';

    // ── Custom cursor ─────────────────────────────────────
    const cur = document.getElementById('lnd-cur');
    const ring = document.getElementById('lnd-ring');
    let mX = 0, mY = 0, rX = 0, rY = 0;

    const onMove = (e) => {
      mX = e.clientX; mY = e.clientY;
      if (cur) { cur.style.left = mX + 'px'; cur.style.top = mY + 'px'; }
    };
    document.addEventListener('mousemove', onMove);

    let rafRing;
    const tickRing = () => {
      rX += (mX - rX) * 0.11; rY += (mY - rY) * 0.11;
      if (ring) { ring.style.left = rX + 'px'; ring.style.top = rY + 'px'; }
      rafRing = requestAnimationFrame(tickRing);
    };
    rafRing = requestAnimationFrame(tickRing);

    const hoverEls = document.querySelectorAll('#landing-root button, #landing-root a, #landing-root .member, #landing-root .feat, #landing-root .p-card');
    const onEnter = () => {
      if (cur) { cur.style.width = '14px'; cur.style.height = '14px'; }
      if (ring) { ring.style.width = '52px'; ring.style.height = '52px'; ring.style.borderColor = 'rgba(0,212,255,.85)'; }
    };
    const onLeave = () => {
      if (cur) { cur.style.width = '8px'; cur.style.height = '8px'; }
      if (ring) { ring.style.width = '34px'; ring.style.height = '34px'; ring.style.borderColor = 'rgba(0,212,255,.45)'; }
    };
    hoverEls.forEach(el => { el.addEventListener('mouseenter', onEnter); el.addEventListener('mouseleave', onLeave); });

    // ── Navbar & TopBtn show/hide ──────────────────────────────────
    const nav = document.getElementById('lnd-nav');
    const topBtn = document.getElementById('lnd-top-btn');
    const onScroll = () => {
      if (nav) nav.classList.toggle('show', window.scrollY > 60);
      if (topBtn) topBtn.classList.toggle('show', window.scrollY > 800);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── 3D resume parallax + mouse tilt ──────────────────
    const rWrap = document.getElementById('lnd-rWrap');
    const hero = document.getElementById('lnd-hero');
    let sRX = -8, sRY = 18, mRX = 0, mRY = 0, raf;

    const applyTilt = () => {
      if (rWrap) rWrap.style.transform = `rotateX(${sRX + mRX}deg) rotateY(${sRY + mRY}deg) translateZ(20px)`;
    };
    const onScrollP = () => {
      if (!hero) return;
      const p = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / hero.offsetHeight));
      sRX = -8 + p * 8; sRY = 18 - p * 18;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(applyTilt);
    };
    const onMouseP = (e) => {
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      mRX = (e.clientY / window.innerHeight - 0.5) * -14;
      mRY = (e.clientX / window.innerWidth - 0.5) * 14;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(applyTilt);
    };
    window.addEventListener('scroll', onScrollP, { passive: true });
    document.addEventListener('mousemove', onMouseP);

    // ── IntersectionObserver reveals ──────────────────────
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.14 });
    document.querySelectorAll('#landing-root .reveal, #landing-root .p-card, #landing-root .feat, #landing-root .stat, #landing-root .member').forEach(el => io.observe(el));

    return () => {
      document.body.style.cursor = '';
      [pc1, pc2, font].forEach(el => { try { document.head.removeChild(el); } catch { /* gone */ } });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousemove', onMouseP);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScrollP);
      cancelAnimationFrame(rafRing);
      cancelAnimationFrame(raf);
      hoverEls.forEach(el => { el.removeEventListener('mouseenter', onEnter); el.removeEventListener('mouseleave', onLeave); });
      io.disconnect();
    };
  }, []);

  const goToApp = () => navigate('/profile-selector');
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div id="landing-root">
      <style>{LANDING_CSS}</style>
      <div className="grain" />
      <div id="lnd-cur" />
      <div id="lnd-ring" />

      {/* ── NAV ── */}
      <nav id="lnd-nav">
        <div className="nav-brand">CV<em>.</em>MAKER</div>
        <ul className="nav-links">
          <li><a href="#lnd-process" onClick={(e) => { e.preventDefault(); scrollTo('lnd-process'); }}>Process</a></li>
          <li><a href="#lnd-features" onClick={(e) => { e.preventDefault(); scrollTo('lnd-features'); }}>Features</a></li>
          <li><a href="#lnd-team" onClick={(e) => { e.preventDefault(); scrollTo('lnd-team'); }}>Team</a></li>
        </ul>
        <button className="nav-btn" onClick={goToApp}>Get Started</button>
      </nav>

      {/* ── HERO ── */}
      <section id="lnd-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">AI-Powered Job Automation</div>
          <h1 className="hero-h1">
            <span className="line"><span>AUTOMATE</span></span>
            <span className="line"><span>YOUR <span className="hl">AMBITION</span></span></span>
            <span className="line"><span>LAND THE JOB</span></span>
          </h1>
          <p className="hero-sub">
            CV Maker crafts hyper-targeted resumes through a GAN scoring loop, then auto-applies via
            LinkedIn Easy Apply, SMTP, and DMs — while you focus on what's next.
          </p>
          <div className="hero-ctas">
            <button className="btn-prim" onClick={goToApp}>Get Started →</button>
            <button className="btn-ghost" onClick={() => scrollTo('lnd-process')}>See How It Works</button>
          </div>
        </div>

        {/* 3D Resume */}
        <div className="resume-scene">
          <div className="float-chip" style={{ top: '12%', left: '-8%', transform: 'translateZ(-70px)' }}>SCORE: 9.4 / 10</div>
          <div className="float-chip" style={{ bottom: '22%', right: '-2%', transform: 'translateZ(-50px)', fontSize: '.5rem', opacity: .22 }}>GAN_ITER_03 ✓</div>
          <div className="float-chip" style={{ top: '58%', left: '-6%', transform: 'translateZ(-55px)', fontSize: '.5rem', opacity: .2 }}>ATS_MATCH: 94%</div>

          <div className="r-wrap" id="lnd-rWrap">
            <div className="r-halo" />
            <div className="r-card">
              <div className="r-scan" />
              <div className="r-badge">
                <div className="r-badge-n">9.4</div>
                <div className="r-badge-l">SCORE</div>
              </div>
              <div className="rn">Alex Rivera</div>
              <div className="rt">Senior Full-Stack Engineer</div>
              <div className="rc">
                <span>github.com/arivera</span>
                <span>alex@rivera.dev</span>
                <span>Remote / Open</span>
              </div>
              <div style={{ marginBottom: '.8rem' }}>
                <div className="rs-label">Experience</div>
                <div className="re">
                  <div className="re-top"><span className="re-co">Stripe</span><span className="re-dt">2022 — Present</span></div>
                  <div className="re-role">Senior Software Engineer</div>
                  <div className="re-bullet">Engineered pipeline processing $2.3B/day in volume</div>
                  <div className="re-bullet">Reduced API latency 47% via distributed cache layer</div>
                </div>
                <div className="re">
                  <div className="re-top"><span className="re-co">Vercel</span><span className="re-dt">2020 — 2022</span></div>
                  <div className="re-role">Software Engineer</div>
                  <div className="re-bullet">Built edge runtime serving 3M+ deployments/day</div>
                </div>
              </div>
              <div>
                <div className="rs-label">Skills</div>
                <div className="r-skills-wrap">
                  {SKILLS.map(s => <span key={s} className="r-tag">{s}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-hint">
          <span>Scroll</span>
          <div className="s-line" />
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="mq">
        <div className="mq-track">
          {[...MQ_ITEMS, ...MQ_ITEMS].map((item, i) => (
            <div key={i} className="mq-item"><span className="mq-dot" />{item}</div>
          ))}
        </div>
      </div>

      {/* ── PROCESS ── */}
      <section id="lnd-process" style={{ padding: '9rem 4rem' }}>
        <div className="s-label reveal">The Process</div>
        <div className="s-title reveal">Three phases.<br />Zero manual effort.</div>
        <div className="process-grid">
          {[
            { n: '01', title: 'Discover & Research', body: 'Feed your profile once. AI suggests roles, scrapes LinkedIn for live listings, then deep-dives each company — CEO posts, HR signals, cultural values — to synthesize a hiring persona for every target.', tag: 'OpenRouter · Playwright' },
            { n: '02', title: 'Generate & Score', body: 'Two LLM instances go to war. One generates your CV, the other scores it as a ruthless HR critic. The loop runs until you hit 9+/10. A completely different, optimized document per company — never reused.', tag: 'GAN Loop · Llama 3.3 70B' },
            { n: '03', title: 'Apply & Practice', body: 'The queue sends via LinkedIn Easy Apply, Gmail SMTP, and LinkedIn DMs with human-like timing. The interview simulator then role-plays as your exact HR contact so you arrive knowing the answers.', tag: 'Rate-Limited · 20/day' },
          ].map(({ n, title, body, tag }) => (
            <div key={n} className="p-card">
              <div className="p-num">{n}</div>
              <div className="p-title">{title}</div>
              <p className="p-body">{body}</p>
              <span className="p-tag">{tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats-row">
        {STATS.map(({ n, em, d }) => (
          <div key={d} className="stat">
            <div className="stat-n">{n}<em>{em}</em></div>
            <div className="stat-d">{d}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section id="lnd-features" style={{ padding: '9rem 4rem' }}>
        <div className="s-label reveal">Capabilities</div>
        <div className="s-title reveal">Built different.</div>
        <div className="feat-grid">
          {FEATURES.map(({ idx, title, body, pill }) => (
            <div key={idx} className="feat">
              <div className="feat-idx">Feature / {idx}</div>
              <div className="feat-title">{title}</div>
              <p className="feat-body">{body}</p>
              <span className="feat-pill">{pill}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── TEAM ── */}
      <section id="lnd-team" style={{ padding: '9rem 0', overflow: 'hidden' }}>
        <div className="team-hdr">
          <div className="s-label reveal">Built By</div>
          <div className="s-title reveal">The engineers<br />behind the machine.</div>
        </div>
        <div className="team-split">
          <a href="https://yassinedhouib.netlify.app" target="_blank" rel="noreferrer" className="member" style={{ display: 'block', textDecoration: 'none' }}>
            <div className="member-bg-letter" style={{ right: '-2rem' }}>Y</div>
            <div className="m-idx">01 — Developer</div>
            <div className="m-name">YASSINE<br />DHOUIB</div>
            <div className="m-role">Full-Stack · AI Integration</div>
            <div className="m-bar" />
          </a>
          <a href="https://sizied.netlify.app/" target="_blank" rel="noreferrer" className="member" style={{ display: 'block', textDecoration: 'none' }}>
            <div className="member-bg-letter" style={{ left: '-2rem' }}>Z</div>
            <div className="m-idx">02 — Developer</div>
            <div className="m-name">ZIED<br />CHERIF</div>
            <div className="m-role">Frontend · Automation</div>
            <div className="m-bar" />
          </a>
        </div>
      </section>

      {/* ── COFFEE ── */}
      <section id="lnd-coffee">
        <div className="coffee-eye">like what you see?</div>
        <div className="coffee-h reveal">BUY US<br />A COFFEE.</div>
        <p className="coffee-sub reveal">
          We built this for free. If it's saving you time and landing you interviews,
          a coffee goes a long way in keeping us going.
        </p>
        <button className="coffee-btn-main">
          ☕ Buy us a coffee
        </button>
      </section>

      {/* ── CTA ── */}
      <section id="lnd-cta">
        <div className="cta-eye">Ready to automate?</div>
        <div className="cta-h reveal">STOP<br />APPLYING<br />MANUALLY.</div>
        <p className="cta-sub">Set up once. Let the machine handle the rest.<br />Your time is worth more than copy-pasting cover letters.</p>
        <button className="btn-prim" onClick={goToApp}>
          Get Started →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="f-logo">CV<em>.</em>MAKER</div>
        <div className="f-copy">© 2026 Yassine Dhouib &amp; Zied Cherif</div>
        <div className="f-ver">v1.0.0 — Local AI Stack</div>
      </footer>

      {/* ── SCROLL TO TOP ── */}
      <button id="lnd-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <ArrowUp className="w-6 h-6" />
      </button>

    </div>
  );
};

export default Landing;
