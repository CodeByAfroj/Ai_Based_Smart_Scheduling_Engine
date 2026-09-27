import React, { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const scStates = [
  { title: 'Today, orchestrated.', body: 'Every task lands where your calendar and energy actually allow — nothing to manually arrange.', bg: 'transparent' },
  { title: 'Let the day re-route itself.', body: 'AutoShift, our constraint-solving engine, recalculates everything downstream the moment something changes — no dragging, no re-typing.', bg: 'rgba(232, 163, 61, 0.08)' },
  { title: 'Context-Aware AI.', body: 'Bio-Rhythm AI learns your energy curve and automatically suggests the perfect time for heavy analytical work.', bg: 'rgba(63, 122, 82, 0.08)' },
  { title: 'Deep work, grown one session at a time.', body: 'Smart Focus Mode turns unbroken attention into something you can watch take shape. Leave the app, and growth stops.', bg: 'rgba(32, 48, 31, 0.05)' }
];

export default function MobileLanding({ onLogin, isLoading }) {
  const [scIndex, setScIndex] = useState(0);
  const scTitle = scStates[scIndex].title;
  const scBody = scStates[scIndex].body;

  const textRef = useRef(null);
  const phoneWrapRef = useRef(null);
  const wavePathRef = useRef(null);
  const revealsRef = useRef([]);

  // Setup intersection observers
  useEffect(() => {
    // Wave animation observer
    if (wavePathRef.current) {
      const len = wavePathRef.current.getTotalLength();
      wavePathRef.current.style.strokeDasharray = len;
      wavePathRef.current.style.strokeDashoffset = len;

      const waveObs = new IntersectionObserver((entries, o) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            wavePathRef.current.style.strokeDashoffset = 0;
            o.disconnect();
          }
        });
      }, { threshold: 0.4 });
      waveObs.observe(wavePathRef.current);
    }

    // Reveal elements observer
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          if (e.target.id === 'showcaseWrap') {
            playScreen(0);
          }
        }
      });
    }, { threshold: 0.2 });

    revealsRef.current.forEach(el => {
      if (el) revealObs.observe(el);
    });

    return () => {
      revealObs.disconnect();
    };
  }, []);

  const handleNextState = () => {
    const nextIdx = (scIndex + 1) % scStates.length;

    setScIndex(nextIdx);
    // Play screen specific animations
    playScreen(nextIdx);
  };

  const handlePrevState = () => {
    const prevIdx = (scIndex - 1 + scStates.length) % scStates.length;

    setScIndex(prevIdx);

    playScreen(prevIdx);
  };

  const playScreen = (idx) => {
    setTimeout(() => {
      if (idx === 3) {
        const t = document.getElementById('tTrunk');
        const bl = document.getElementById('tBL');
        const br = document.getElementById('tBR');
        const cp = document.getElementById('tCanopy');
        const bloom = document.getElementById('tBloom');

        if (t && bl && br && cp && bloom) {
          t.style.strokeDashoffset = 86;
          bl.style.strokeDashoffset = 100;
          br.style.strokeDashoffset = 100;
          cp.style.transform = 'scale(.14)';
          cp.style.opacity = .4;
          bloom.setAttribute('r', 0);

          setTimeout(() => {
            t.style.strokeDashoffset = 0;
            bl.style.strokeDashoffset = 0;
            br.style.strokeDashoffset = 0;
            cp.style.transform = 'scale(1)';
            cp.style.opacity = 1;
            bloom.setAttribute('r', 6);
          }, 260);
        }
      } else {
        const el = document.getElementById('screen-' + idx);
        if (el) {
          const rows = el.querySelectorAll('.app-row');
          rows.forEach((r, i) => {
            r.style.animation = 'none';
            r.offsetHeight; // trigger reflow
            r.style.animation = `rowIn .5s cubic-bezier(.2,.8,.2,1) ${i * 70}ms both`;
          });
        }
      }
    }, 50); // slight delay to allow React to render the active class change
  };

  // Initial animation is now triggered by IntersectionObserver on scroll

  const addToReveals = (el) => {
    if (el && !revealsRef.current.includes(el)) {
      revealsRef.current.push(el);
    }
  };

  return (
    <div className="mobile-landing-container">
      {/* 
        Injecting the custom styles. We scope them slightly by nesting under 
        .mobile-landing-container where necessary, but keep variables on root.
      */}
      <style>{`
        .mobile-landing-container {
          --dusk: #16261C; --dusk-2: #1F3326; --moss: #3F7A52; --gold: #E8A33D; --clay: #C8613D;
          --paper: #FBF6EC; --paper-2: #F1E9D4; --ink: #20301F; --ink-soft: #5C6B57;
          --line: rgba(32,48,31,.13);
          
          font-family: 'Inter', system-ui, sans-serif; 
          color: var(--ink); 
          background: var(--paper);
          overflow-x: hidden; 
          line-height: 1.6;
          width: 100%;
          min-height: 100vh;
        }
        
        .mobile-landing-container h1, 
        .mobile-landing-container h2, 
        .mobile-landing-container h3 {
          font-family: 'Fraunces', Georgia, serif; 
          font-weight: 500; 
          line-height: 1.08; 
          letter-spacing: -0.01em;
        }
        
        .mobile-landing-container img, 
        .mobile-landing-container svg { max-width: 100%; }
        
        .mobile-landing-container .wrap { max-width: 520px; margin: 0 auto; padding: 0 28px; }
        .mobile-landing-container a { color: inherit; text-decoration: none; }

        /* ---------- HERO ---------- */
        .mobile-landing-container .hero {
          background: radial-gradient(130% 100% at 20% -10%, var(--paper-2), var(--paper) 62%);
          color: var(--ink); padding: 64px 0 0; position: relative; overflow: hidden;
          border-bottom: none;
        }
        .mobile-landing-container .mark { width: 34px; height: 34px; margin-bottom: 40px; }
        .mobile-landing-container .hero h1 { font-size: 2.5rem; max-width: 9.5ch; }
        .mobile-landing-container .hero p.lede { margin-top: 16px; font-size: 1.05rem; color: var(--ink-soft); max-width: 34ch; }
        .mobile-landing-container .cta-row { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
        
        .mobile-landing-container .btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 11px 18px; border-radius: 100px;
          font-size: .88rem; font-weight: 500; text-decoration: none; border: 1px solid transparent; cursor: pointer;
          transition: transform .28s cubic-bezier(.34,1.4,.4,1), box-shadow .28s ease, background .2s ease;
        }
        .mobile-landing-container .btn-primary { background: var(--gold); color: #241705; }
        .mobile-landing-container .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(232,163,61,.35); }
        .mobile-landing-container .btn-primary:active { transform: translateY(0) scale(.97); }
        .mobile-landing-container .btn-ghost { border-color: rgba(32,48,31,.28); color: var(--ink); }
        .mobile-landing-container .btn-ghost:hover { transform: translateY(-2px); background: rgba(32,48,31,.05); }

        /* ---------- SECTION SHELL ---------- */
        .mobile-landing-container section { padding: 40px 0; border-bottom: 1px solid var(--line); }
        .mobile-landing-container section:last-of-type { border-bottom: none; }

        /* ---------- STICKY NAV ---------- */
        .mobile-landing-container .nav {
          position: sticky; top: 0; z-index: 20; padding-top: calc(14px + env(safe-area-inset-top,0px)); 
          padding-bottom: 14px; background: rgba(251,246,236,.88); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line);
        }
        .mobile-landing-container .nav .wrap { display: flex; align-items: center; justify-content: space-between; }
        .mobile-landing-container .nav .logo { display: flex; align-items: center; gap: 7px; font-family: 'Fraunces', serif; font-weight: 600; font-size: 1.02rem; color: var(--ink); }
        .mobile-landing-container .nav .logo svg { width: 18px; height: 18px; }
        .mobile-landing-container .nav .btn { padding: 8px 16px; font-size: .82rem; }

        /* ---------- PHONE MOCKUP ---------- */
        .mobile-landing-container .phone { width: 216px; background: #132018; border-radius: 32px; padding: 9px; box-shadow: 0 24px 44px rgba(19,32,24,.22); flex: none; }
        .mobile-landing-container .phone-wrap { position: relative; transition: transform .3s ease; }
        
        .mobile-landing-container .phone.big { width: 310px; height: 550px; border-radius: 36px; padding: 8px; position: relative; margin: 0 auto; }
        
        @keyframes rowIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .mobile-landing-container .screen-stack { position: relative; width: 100%; height: 100%; }
        .mobile-landing-container .screen { background: var(--paper); border-radius: 28px; padding: 28px 16px 22px; width: 100%; height: 100%; position: absolute; inset: 0; opacity: 0; transform: perspective(800px) rotateY(-8deg) scale(.95); transition: opacity .6s cubic-bezier(.34,1.4,.4,1), transform .6s cubic-bezier(.34,1.4,.4,1); pointer-events: none; overflow: hidden; }
        .mobile-landing-container .screen.active { opacity: 1; transform: perspective(800px) rotateY(0deg) scale(1); pointer-events: auto; }
        .mobile-landing-container .pagination-dots { display: flex; justify-content: center; gap: 8px; margin-top: 24px; }
        .mobile-landing-container .pagination-dots .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); cursor: pointer; transition: all 0.3s cubic-bezier(.34,1.4,.4,1); }
        .mobile-landing-container .pagination-dots .dot.active { background: var(--moss); width: 20px; border-radius: 10px; }
        .mobile-landing-container .screen::after { content: ''; position: absolute; left: 50%; bottom: 9px; width: 84px; height: 4px; border-radius: 3px; background: rgba(32,48,31,.25); transform: translateX(-50%); }
        .mobile-landing-container .screen.dark::after { background: rgba(243,240,230,.3); }
        .mobile-landing-container .screen.dark { background: #0F1C13; }
        
        .mobile-landing-container .notch { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); width: 64px; height: 6px; border-radius: 4px; background: rgba(0,0,0,.5); }
        
        .mobile-landing-container .app-top { font-size: .9rem; color: var(--ink-soft); margin: 6px 0 16px; }
        .mobile-landing-container .screen.dark .app-top { color: #9FB49F; }
        
        .mobile-landing-container .app-row { display: flex; gap: 9px; align-items: center; padding: 12px 10px; border-radius: 11px; margin-bottom: 9px; background: #fff; border-left: 3px solid var(--c,var(--moss)); font-size: .92rem; color: var(--ink); }
        .mobile-landing-container .app-row .time { font-variant-numeric: tabular-nums; color: var(--ink-soft); width: 44px; flex: none; }
        .mobile-landing-container .app-row.ghost { background: transparent; border-style: dashed; border-left-style: solid; color: var(--ink-soft); opacity: .6; }

        /* ---------- SHOWCASE ---------- */
        .mobile-landing-container .showcase { transition: background 0.8s cubic-bezier(0.4, 0, 0.2, 1); overflow-x: hidden; }
        .mobile-landing-container .showcase-row { position: relative; display: flex; justify-content: center; align-items: center; margin: 0 auto; width: 100%; max-width: 100%; }
        .mobile-landing-container .arrow-btn { position: absolute; top: 50%; z-index: 10; width: 42px; height: 42px; background: transparent; border: none; color: var(--ink); font-size: 2.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; opacity: 0.6; }
        .mobile-landing-container .arrow-btn.left { left: calc(50% - 185px); transform: translateY(-50%); }
        .mobile-landing-container .arrow-btn.right { right: calc(50% - 185px); transform: translateY(-50%); }
        .mobile-landing-container .arrow-btn:hover { opacity: 1; transform: translateY(-50%) scale(1.15); }
        .mobile-landing-container .arrow-btn:active { transform: translateY(-50%) scale(.9); }
        .mobile-landing-container .screen-caption { position: absolute; bottom: 32px; left: 18px; right: 18px; text-align: center; }
        .mobile-landing-container .screen-caption h3 { font-size: 1.15rem; margin-bottom: 6px; }
        .mobile-landing-container .screen-caption p { font-size: 0.85rem; line-height: 1.4; opacity: 0.85; }
        
        .mobile-landing-container .wave path#wavePath { transition: stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1); }
        .mobile-landing-container #tTrunk, .mobile-landing-container #tBL, .mobile-landing-container #tBR { transition: stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1); }
        .mobile-landing-container #tCanopy { transition: transform 1.1s cubic-bezier(.34,1.3,.4,1), opacity 1s ease; }
        .mobile-landing-container #tBloom { transition: r .5s ease .5s; }
        
        .mobile-landing-container .eyebrow-free h2 { font-size: 1.9rem; max-width: 11ch; }
        .mobile-landing-container .section-body { margin-top: 16px; color: var(--ink-soft); font-size: 1.02rem; max-width: 38ch; }

        /* ---------- TREE / FOCUS ---------- */
        .mobile-landing-container .tree-stage { display: flex; justify-content: center; margin: 36px 0 8px; }

        /* ---------- BIO-RHYTHM ---------- */
        .mobile-landing-container .rhythm { background: var(--paper); }
        .mobile-landing-container .wave { margin-top: 30px; }

        /* ---------- FEATURES LIST ---------- */
        .mobile-landing-container .flist { margin-top: 30px; border-top: 1px solid var(--line); }
        .mobile-landing-container .frow { display: flex; gap: 16px; padding: 22px 0; border-bottom: 1px solid var(--line); transition: transform .25s ease;}
        .mobile-landing-container .frow:hover { transform: translateX(4px); }
        .mobile-landing-container .frow .ic { width: 26px; height: 26px; flex: none; color: var(--moss); margin-top: 2px; }
        .mobile-landing-container .frow h3 { font-size: 1.05rem; font-weight: 500; }
        .mobile-landing-container .frow p { color: var(--ink-soft); font-size: .93rem; margin-top: 4px; }

        /* ---------- CTA ---------- */
        .mobile-landing-container .final-card { background: radial-gradient(130% 130% at 25% 0%, var(--dusk-2), var(--dusk) 75%); color: #F3F0E6; border-radius: 22px; padding: 36px 26px; text-align: left; }
        .mobile-landing-container .final-card h2 { color: #fff; font-size: 1.9rem; }
        .mobile-landing-container .final-card .btn-primary { margin-top: 22px; }
        .mobile-landing-container footer { padding: 26px 0 40px; text-align: left; color: var(--ink-soft); font-size: .82rem; }

        .mobile-landing-container .reveal { opacity: 0; transform: translateY(14px); transition: opacity .6s ease, transform .6s ease; }
        .mobile-landing-container .reveal.in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion:reduce) { .mobile-landing-container .reveal { transition: none; opacity: 1; transform: none; } }

        /* ---------- RECOMMENDATION CARD ---------- */
        .mobile-landing-container .desktop-only { display: none !important; }
        .mobile-landing-container .mobile-only { display: block; }
        .mobile-landing-container .recommendation { padding: 80px 0; }
        .mobile-landing-container .rec-card { background: #22233b; border-radius: 24px; padding: 48px; border: 1px solid #333452; color: #fff; max-width: 800px; margin: 0 auto; box-shadow: 0 32px 64px rgba(22, 23, 43, 0.4); }
        .mobile-landing-container .rec-badges { display: flex; gap: 12px; margin-bottom: 24px; }
        .mobile-landing-container .rec-badges .badge { padding: 8px 16px; border-radius: 100px; font-size: .85rem; font-weight: 600; }
        .mobile-landing-container .rec-badges .badge.ai { background: rgba(139, 161, 255, 0.1); color: #8BA1FF; border: 1px solid rgba(139, 161, 255, 0.25); }
        .mobile-landing-container .rec-badges .badge.active { background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); }
        .mobile-landing-container .rec-card h3 { font-size: 2.2rem; margin-bottom: 16px; }
        .mobile-landing-container .rec-card p { font-size: 1.15rem; color: #b1b5d1; line-height: 1.6; }
        .mobile-landing-container .rec-divider { height: 1px; background: #333452; margin: 32px 0; }
        .mobile-landing-container .rec-actions { display: flex; gap: 16px; margin-bottom: 24px; }
        .mobile-landing-container .btn-done { flex: 1; padding: 16px; border-radius: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: background .2s ease; }
        .mobile-landing-container .btn-done:hover { background: rgba(255, 255, 255, 0.1); }
        .mobile-landing-container .btn-focus { flex: 2; padding: 16px; border-radius: 16px; background: #5442F5; border: none; color: #fff; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: background .2s ease, transform .2s ease; box-shadow: 0 8px 24px rgba(84, 66, 245, 0.4); }
        .mobile-landing-container .btn-focus:hover { background: #4635db; transform: translateY(-2px); }
        .mobile-landing-container .rec-footer { text-align: center; font-size: .85rem; color: #6a6c91; font-weight: 500; }

        /* ---------- TABLET RESPONSIVENESS ---------- */
        @media (min-width: 768px) and (max-width: 1023px) {
          .mobile-landing-container .phone.big { width: 440px; height: 580px; border-radius: 28px; padding: 10px; margin: 0 auto; }
          .mobile-landing-container .screen-caption { bottom: 36px; }
          .mobile-landing-container .arrow-btn.left { left: calc(50% - 260px); }
          .mobile-landing-container .arrow-btn.right { right: calc(50% - 260px); }
        }

        /* ---------- DESKTOP RESPONSIVENESS ---------- */
        @media (min-width: 1024px) {
          .mobile-landing-container .desktop-only { display: flex !important; flex-direction: column; justify-content: space-between; height: 100%; padding: 24px 40px 32px; }
          .mobile-landing-container .mobile-only { display: none !important; }
          .mobile-landing-container .wrap { max-width: 1100px; padding: 0 48px; margin: 0 auto; }
          
          /* Hero Desktop */
          .mobile-landing-container .hero { padding: 120px 0 80px; }
          .mobile-landing-container .hero .wrap { display: flex; align-items: center; justify-content: space-between; gap: 40px; }
          .mobile-landing-container .hero-text { flex: 1; max-width: 580px; }
          .mobile-landing-container .hero h1 { font-size: 4.8rem; max-width: 14ch; line-height: 1.05; }
          .mobile-landing-container .hero p.lede { font-size: 1.25rem; max-width: 38ch; margin-top: 24px; }
          .mobile-landing-container .hero-graphic { flex: 1; display: flex; justify-content: flex-end; }
          
          /* Problem Desktop */
          .mobile-landing-container .problem { padding: 100px 0; }
          .mobile-landing-container .problem .wrap { display: flex; align-items: center; justify-content: space-between; gap: 60px; }
          .mobile-landing-container .problem-text { flex: 1; max-width: 500px; }
          .mobile-landing-container .problem svg { flex: 1; max-width: 480px; margin-top: 0 !important; }
          .mobile-landing-container .eyebrow-free h2 { font-size: 3.2rem; max-width: 12ch; line-height: 1.1; }
          .mobile-landing-container .section-body { font-size: 1.2rem; max-width: 42ch; margin-top: 24px; }
          
          /* Rhythm Desktop */
          .mobile-landing-container .rhythm { padding: 100px 0; }
          .mobile-landing-container .rhythm .wrap { display: flex; align-items: center; justify-content: space-between; gap: 40px; }
          .mobile-landing-container .rhythm-text { flex: 1; max-width: 500px; }
          .mobile-landing-container .rhythm svg { flex: 1; max-width: 500px; margin-top: 0 !important; }
          
          /* Showcase Desktop (Laptop Mockup) */
          .mobile-landing-container .showcase { padding: 120px 0; }
          .mobile-landing-container .showcase .wrap { display: flex; flex-direction: column; align-items: center; }
          .mobile-landing-container .showcase-row { max-width: 100%; margin: 0; width: 100%; display: flex; justify-content: center; position: relative; }
          .mobile-landing-container .arrow-btn.left { left: calc(50% - 460px); }
          .mobile-landing-container .arrow-btn.right { right: calc(50% - 460px); }
          
          .mobile-landing-container .phone.big { 
            width: 820px; 
            height: 520px; 
            border-radius: 16px 16px 0 0; 
            padding: 12px 12px 0 12px; 
            position: relative;
            background: #132018;
            box-shadow: none;
          }
          /* Laptop Base */
          .mobile-landing-container .phone.big::after {
            content: '';
            position: absolute;
            bottom: -20px;
            left: -40px;
            right: -40px;
            height: 20px;
            background: #202F24;
            border-radius: 0 0 20px 20px;
            box-shadow: 0 24px 44px rgba(19,32,24,.3);
          }
          .mobile-landing-container .notch { display: none; /* No notch on laptop */ }
          .mobile-landing-container .screen { border-radius: 8px 8px 0 0; }
          .mobile-landing-container .screen-caption { bottom: 40px; left: 60px; right: 60px; }
          
          /* Features Desktop */
          .mobile-landing-container .features { padding: 100px 0; }
          .mobile-landing-container .features h2 { font-size: 3rem; max-width: 18ch; text-align: center; margin: 0 auto; }
          .mobile-landing-container .flist { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; border-top: none; margin-top: 60px; }
          .mobile-landing-container .frow { flex-direction: column; text-align: center; align-items: center; border: 1px solid var(--line); border-radius: 20px; padding: 40px 24px; background: #fff; }
          .mobile-landing-container .frow .ic { width: 36px; height: 36px; margin-bottom: 20px; }
          
          /* Trust & Final CTA Desktop */
          .mobile-landing-container .trust-card { display: flex; align-items: center; gap: 40px; padding: 40px!important; }
          .mobile-landing-container .final-card { display: flex; align-items: center; justify-content: space-between; padding: 60px 48px; text-align: left; }
          .mobile-landing-container .final-card h2 { margin: 0; max-width: 16ch; font-size: 2.8rem; }
          .mobile-landing-container .final-card .btn-primary { margin-top: 0; }
        }
      `}</style>

      <nav className="nav">
        <div className="wrap">
          <div className="logo">
            <img src="/logo.png" alt="TaskPulse Logo" style={{ width: '22px', height: '22px', borderRadius: '4px' }} />
            TaskPulse
          </div>
          <button className="btn btn-primary" onClick={onLogin} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log in"}
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap">
          <div className="hero-text">
            <h1>Your day keeps rebuilding itself.</h1>
            <p className="lede">TaskPulse orchestrates your schedule so one missed meeting never means a lost afternoon.</p>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={onLogin} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in with Google"}
              </button>
              <a className="btn btn-ghost" href="#showcase">See how it works</a>
            </div>
          </div>
          <div className="hero-graphic desktop-only">
            <svg viewBox="0 0 400 300" width="100%" height="auto" style={{ maxWidth: '440px' }}>
              <rect x="50" y="40" width="300" height="220" rx="16" fill="var(--paper-2)" stroke="var(--line)" strokeWidth="2" />
              <rect x="70" y="70" width="260" height="12" rx="6" fill="var(--ink-soft)" opacity="0.2" />

              <rect x="70" y="100" width="160" height="40" rx="8" fill="var(--moss)" opacity="0.9" />
              <rect x="240" y="100" width="90" height="40" rx="8" fill="var(--gold)" opacity="0.9" />

              <rect x="70" y="150" width="260" height="40" rx="8" fill="var(--clay)" opacity="0.9" />

              <rect x="70" y="200" width="110" height="40" rx="8" fill="var(--ink-soft)" opacity="0.1" />
              <rect x="190" y="200" width="140" height="40" rx="8" fill="var(--ink-soft)" opacity="0.1" />

              <circle cx="95" cy="120" r="6" fill="#fff" opacity="0.5" />
              <circle cx="265" cy="120" r="6" fill="#fff" opacity="0.5" />
              <circle cx="95" cy="170" r="6" fill="#fff" opacity="0.5" />
            </svg>
          </div>
        </div>
      </section>

      <section className="problem eyebrow-free">
        <div className="wrap reveal" ref={addToReveals}>
          <div className="problem-text">
            <h2>Decision fatigue is the real deadline you're missing.</h2>
            <p className="section-body">Every re-plan costs focus. A slipped call, a long lunch, an overrunning task — and suddenly you're the one dragging blocks around a calendar instead of doing the work in them.</p>
          </div>
          <svg viewBox="0 0 400 150" width="100%" height="auto" style={{ marginTop: '28px' }}>
            <rect x="30" y="90" width="340" height="14" rx="7" fill="var(--paper-2)" />
            <g transform="translate(50 20) rotate(-8)">
              <rect width="70" height="70" fill="#F6E27A" />
              <line x1="10" y1="20" x2="60" y2="20" stroke="#B89B2E" strokeWidth="3" />
              <line x1="10" y1="34" x2="50" y2="34" stroke="#B89B2E" strokeWidth="3" />
            </g>
            <g transform="translate(150 8) rotate(6)">
              <rect width="72" height="72" fill="#F2B6A0" />
              <line x1="10" y1="20" x2="55" y2="20" stroke="var(--clay)" strokeWidth="3" />
              <line x1="10" y1="34" x2="45" y2="34" stroke="var(--clay)" strokeWidth="3" />
            </g>
            <g transform="translate(250 22) rotate(-3)">
              <rect width="66" height="66" fill="#BFE0C8" />
              <line x1="8" y1="18" x2="52" y2="18" stroke="var(--moss)" strokeWidth="3" />
              <line x1="8" y1="32" x2="40" y2="32" stroke="var(--moss)" strokeWidth="3" />
            </g>
            <circle cx="330" cy="58" r="22" fill="#fff" stroke="var(--clay)" strokeWidth="3" />
            <line x1="330" y1="58" x2="330" y2="44" stroke="var(--clay)" strokeWidth="3" strokeLinecap="round" />
            <line x1="330" y1="58" x2="340" y2="62" stroke="var(--clay)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      <section className="showcase" id="showcase" style={{ background: scStates[scIndex].bg }}>
        <div className="wrap reveal" id="showcaseWrap" ref={addToReveals}>
          <div className="showcase-row">
            <button className="arrow-btn left" onClick={handlePrevState} aria-label="Previous">‹</button>
            <div className="phone-wrap" ref={phoneWrapRef}>
              <div className="phone big">
                <div className="screen-stack">
                  <div className={`screen ${scIndex === 0 ? 'active' : ''}`} id="screen-0">
                    <div className="notch"></div>
                    <div className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 20px' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>Create tasks</div>
                        <div style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginTop: '2px' }}>Let's start by creating your tasks</div>
                      </div>
                      <button className='rounded-full' style={{ background: '#5442F5', color: '#fff', border: 'none', padding: '8px 16px', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>+</span>
                      </button>
                    </div>
                    <div className="app-row" style={{ '--c': 'var(--moss)' }}><span className="time">9:00</span><span>Deep work — Q3 report</span></div>
                    <div className="app-row" style={{ '--c': 'var(--gold)' }}><span className="time">11:00</span><span>Client call</span></div>
                    <div className="app-row" style={{ '--c': 'var(--clay)' }}><span className="time">12:30</span><span>Design review</span></div>
                    <div className="app-row ghost"><span className="time">2:00</span><span>Focus block</span></div>

                    <div className="screen-caption" style={{ color: 'var(--ink)' }}>
                      <h3>Today, orchestrated.</h3>
                      <p>Every task lands where your calendar and energy actually allow — nothing to manually arrange.</p>
                    </div>
                  </div>
                  <div className={`screen ${scIndex === 1 ? 'active' : ''}`} id="screen-1">
                    <div className="notch"></div>
                    <div className="app-top" style={{ color: 'var(--gold)' }}>AutoShift Triggered</div>
                    <div className="app-row" style={{ '--c': 'var(--moss)', opacity: 0.5 }}><span className="time">9:00</span><del>Deep work</del> <span style={{ fontSize: '.75rem', color: 'var(--moss)', marginLeft: '6px' }}>✓</span></div>

                    <div className="app-row" style={{ '--c': 'var(--gold)', border: '2px solid rgba(232, 163, 61, 0.4)', background: 'rgba(232, 163, 61, 0.06)', padding: '12px 14px' }}>
                      <span className="time">1:15</span>
                      <div>
                        <span style={{ fontWeight: 600 }}>Client call</span>
                        <div style={{ fontSize: '.75rem', color: 'var(--gold)', fontWeight: 600, marginTop: '2px' }}>ran 2h 15m long</div>
                      </div>
                    </div>

                    <div className="app-row ghost" style={{ '--c': 'var(--clay)' }}>
                      <span className="time" style={{ color: 'var(--clay)' }}>2:30</span>
                      <div>
                        <span>Design review</span>
                        <div style={{ fontSize: '.75rem', color: 'var(--ink-soft)', marginTop: '2px' }}>Shifted automatically ↓</div>
                      </div>
                    </div>

                    <div className="screen-caption" style={{ color: 'var(--ink)' }}>
                      <h3>Let the day re-route itself.</h3>
                      <p>AutoShift recalculates everything downstream the moment something changes — no dragging, no re-typing.</p>
                    </div>
                  </div>
                  <div className={`screen ${scIndex === 2 ? 'active' : ''}`} id="screen-2" style={{ background: '#1A1B2E', color: 'white' }}>

                    <div className="mobile-only">
                      <div className="notch"></div>
                      <div className="app-top" style={{ color: '#8A8FB5' }}>Today · 2:00 PM</div>

                      <div style={{ background: '#252640', borderRadius: '16px', padding: '14px 12px', marginTop: '10px', border: '1px solid #363753' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '.62rem', padding: '3px 7px', background: 'rgba(139, 161, 255, 0.15)', color: '#8BA1FF', borderRadius: '100px', fontWeight: 600, border: '1px solid rgba(139, 161, 255, 0.3)' }}>⚡ AI REC</span>
                          <span style={{ fontSize: '.62rem', padding: '3px 7px', background: 'rgba(212, 193, 168, 0.15)', color: '#D4C1A8', borderRadius: '100px', fontWeight: 600, border: '1px solid rgba(212, 193, 168, 0.3)' }}>☕ POST-LUNCH</span>
                        </div>

                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: '#fff' }}>Client Sync</div>
                        <p style={{ fontSize: '.75rem', color: '#9AA0C6', lineHeight: 1.4, marginBottom: '10px' }}>
                          Knock this out now while your afternoon momentum is high. Protect your evening for total relaxation.
                        </p>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #4A4C6D', color: '#fff', borderRadius: '8px', fontSize: '.72rem', fontWeight: 600 }}>✓ Done</button>
                          <button style={{ flex: 1.2, padding: '8px', background: '#5442F5', border: 'none', color: '#fff', borderRadius: '8px', fontSize: '.72rem', fontWeight: 600 }}>Start Focus ▶</button>
                        </div>
                      </div>

                      <div className="screen-caption" style={{ color: '#fff' }}>
                        <h3>Context-Aware AI.</h3>
                        <p style={{ color: '#9AA0C6' }}>Bio-Rhythm AI automatically suggests the perfect time for heavy analytical work.</p>
                      </div>
                    </div>

                    <div className="desktop-only">
                      <div className="rec-card" style={{ boxShadow: 'none', border: '1px solid #333452', background: '#22233b', borderRadius: '20px', padding: '24px 36px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
                        <div className="rec-badges" style={{ marginBottom: '14px' }}>
                          <span className="badge ai" style={{ fontSize: '.78rem', padding: '5px 14px' }}>⚡ AI RECOMMENDATION</span>
                          <span className="badge active" style={{ fontSize: '.78rem', padding: '5px 14px' }}>🟢 Active Working Window</span>
                        </div>

                        <h3 style={{ fontSize: '1.6rem', marginBottom: '8px', color: '#fff' }}>Meeting</h3>
                        <p style={{ fontSize: '1rem', color: '#b1b5d1', lineHeight: 1.5, marginBottom: '16px' }}>
                          Knock out this meeting now to clear your plate and protect your balanced
                          afternoon. You'll feel great knowing your collaboration is done!
                        </p>

                        <div className="rec-actions" style={{ display: 'flex', gap: '12px' }}>
                          <button className="btn-done" style={{ padding: '12px', fontSize: '1rem' }}>✓ Done</button>
                          <button className="btn-focus" style={{ padding: '12px', fontSize: '1rem' }}>Start Focus ▶</button>
                        </div>
                      </div>

                      <div className="screen-caption" style={{ color: '#fff', position: 'relative', bottom: 'auto', left: 'auto', right: 'auto', margin: '16px 0 0', textCenter: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Context-Aware AI.</h3>
                        <p style={{ color: '#9AA0C6', fontSize: '.9rem' }}>Bio-Rhythm AI automatically suggests the perfect time for heavy analytical work.</p>
                      </div>
                    </div>

                  </div>
                  <div className={`screen dark ${scIndex === 3 ? 'active' : ''}`} id="screen-3">
                    <div className="notch"></div>
                    <div className="app-top">My Focus Tree .</div>
                    <div className="tree-stage">
                      <svg width="190" height="190" viewBox="0 0 150 170">
                        <ellipse cx="75" cy="156" rx="36" ry="6" fill="rgba(0,0,0,.18)" />
                        <path id="tTrunk" d="M75 156 C 73 132, 78 108, 75 88" fill="none" stroke="#6B4A2C" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="86" style={{ transition: 'stroke-dashoffset .6s ease-out' }} />
                        <path id="tBL" d="M75 118 C 62 112, 55 104, 50 96" fill="none" stroke="#6B4A2C" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" style={{ transition: 'stroke-dashoffset .6s ease-out .1s' }} />
                        <path id="tBR" d="M75 108 C 86 102, 93 94, 98 86" fill="none" stroke="#6B4A2C" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" style={{ transition: 'stroke-dashoffset .6s ease-out .15s' }} />
                        <g id="tCanopy" style={{ transform: 'scale(.14)', opacity: .4, transformOrigin: '75px 96px', transition: 'transform .7s cubic-bezier(.34,1.4,.4,1) .3s, opacity .4s .3s' }}>
                          <ellipse cx="49" cy="92" rx="24" ry="20" fill="#33623F" transform="rotate(-10 49 92)" />
                          <ellipse cx="98" cy="90" rx="22" ry="19" fill="#356647" transform="rotate(12 98 90)" />
                          <ellipse cx="75" cy="66" rx="32" ry="28" fill="#4C7E5A" />
                          <ellipse cx="62" cy="60" rx="13" ry="11" fill="#5F9169" opacity=".8" />
                          <circle id="tBloom" cx="88" cy="52" r="0" fill="#E7B94C" style={{ transition: 'r .5s ease .7s' }} />
                        </g>
                      </svg>
                    </div>

                    <div className="screen-caption" style={{ color: '#fff' }}>
                      <h3 style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>Deep work, grown.</h3>
                      <p style={{ color: '#E2E6DF', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>Smart Focus Mode turns unbroken attention into something you can watch take shape.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pagination-dots">
                {scStates.map((_, i) => (
                  <span
                    key={i}
                    className={`dot ${i === scIndex ? 'active' : ''}`}
                    onClick={() => { setScIndex(i); playScreen(i); }}
                    aria-label={`Go to screen ${i + 1}`}
                  ></span>
                ))}
              </div>
            </div>
            <button className="arrow-btn right" onClick={handleNextState} aria-label="Next">›</button>
          </div>
        </div>
      </section>



      <section className="rhythm eyebrow-free">
        <div className="wrap reveal" ref={addToReveals}>
          <div className="rhythm-text">
            <h2>Timed to when your mind is sharpest.</h2>
            <p className="section-body">Bio-Rhythm AI learns your energy curve and slots analytical work into your peaks — leaving low-focus stretches for email and admin.</p>
          </div>
          <svg className="wave" viewBox="0 0 460 90" width="100%" height="90">
            <path ref={wavePathRef} id="wavePath" d="M0 60 C 60 10, 120 10, 180 45 C 240 78, 300 20, 360 30 C 400 36, 430 55, 460 50" fill="none" stroke="var(--moss)" strokeWidth="3" />
            <circle cx="150" cy="22" r="4" fill="#E7B94C" />
            <circle cx="360" cy="30" r="4" fill="#E7B94C" />
          </svg>
        </div>
      </section>

      <section className="features">
        <div className="wrap reveal" ref={addToReveals}>
          <h2>Built to hold up under a real day.</h2>
          <div className="flist">
            <div className="frow">
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              <div><h3>Alarms that actually fire</h3><p>Native Android alarms wake a critical task even when the browser would've stayed silent.</p></div>
            </div>
            <div className="frow">
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
              <div><h3>Zero-drift calendar sync</h3><p>Two-way Google Calendar sync with buffers protected automatically, so you're never double-booked.</p></div>
            </div>
            <div className="frow">
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              <div><h3>4.5 Hours Saved Weekly</h3><p>By eliminating manual rescheduling and decision fatigue, users gain back an entire afternoon every week.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap reveal" ref={addToReveals}>
          <div className="trust-card" style={{ border: '1px solid var(--line)', borderRadius: '18px', padding: '22px 20px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '1.25rem', color: 'var(--ink)', margin: 0 }}>Your data is bulletproof.</h3>
            </div>
            <div className="trust-content" style={{ marginTop: '8px', fontSize: '0.96rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Trust is our foundation. Google Calendar sync runs on strict OAuth that you can revoke at any time.
              </p>
              <p style={{ margin: '0 0 8px 0', color: 'var(--ink)', fontWeight: 600 }}>
                Your schedule data is never sold, and we never use it to train AI models.
              </p>
              <p style={{ margin: 0 }}>
                All Bio-Rhythm AI analysis happens locally on your device via On-Device ML, meaning your private schedule data never touches external servers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="final">
        <div className="wrap reveal" ref={addToReveals}>
          <div className="final-card">
            <div className="final-text">
              <h2>Take control of your time.</h2>
              <p className="section-body" style={{ color: '#C9D6C9' }}>Log in to TaskPulse and start growing your focus today.</p>
            </div>
            <button className="btn btn-primary" onClick={onLogin} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in with Google"}
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">TaskPulse — orchestrated focus.</div>
      </footer>
    </div>
  );
}
