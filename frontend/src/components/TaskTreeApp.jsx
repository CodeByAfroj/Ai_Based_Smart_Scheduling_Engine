import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../contexts/TaskContext';
import { initTree3D } from './Tree3DEngine';

/* ── Size/XP constants (mirrors Tree3DEngine.js) ── */
const SIZES = {
  sprout: { xp: 10, icon: '🌱', label: 'Sprout', leaves: 8 },
  leaf:   { xp: 20, icon: '🍃', label: 'Leaf',   leaves: 14 },
  branch: { xp: 50, icon: '🌿', label: 'Branch', leaves: 22 },
  flower: { xp: 100, icon: '🌸', label: 'Flower', leaves: 0 },
};
const LEVELS = [
  { xp: 0,    name: 'Seed',           emoji: '🌱' },
  { xp: 30,   name: 'Sprout',         emoji: '🌱' },
  { xp: 100,  name: 'Sapling',        emoji: '🌿' },
  { xp: 250,  name: 'Young Tree',     emoji: '🌳' },
  { xp: 500,  name: 'Thriving Tree',  emoji: '🌳' },
  { xp: 1000, name: 'Mighty Tree',    emoji: '🌲' },
  { xp: 2000, name: 'Ancient Tree',   emoji: '🌲' },
  { xp: 3500, name: 'Enchanted Tree', emoji: '✨' },
];
const ACHIEVEMENTS = [
  { id: 'a1', emoji: '🌱', name: 'First Leaf',    desc: 'Complete your first task',          check: s => s.done >= 1 },
  { id: 'a2', emoji: '🌿', name: 'Branching Out', desc: 'Grow 5 tasks',                     check: s => s.done >= 5 },
  { id: 'a3', emoji: '🌳', name: 'Little Grove',  desc: 'Grow 15 tasks',                    check: s => s.done >= 15 },
  { id: 'a4', emoji: '🌸', name: 'First Bloom',   desc: 'Complete a 2hr+ deep-work task',   check: s => s.flowers >= 1 },
  { id: 'a5', emoji: '💐', name: 'Florist',        desc: 'Bloom 5 flowers',                  check: s => s.flowers >= 5 },
  { id: 'a6', emoji: '⭐', name: 'Rising Sun',    desc: 'Earn 250 XP',                      check: s => s.xp >= 250 },
  { id: 'a7', emoji: '🌟', name: 'Forest Legend', desc: 'Earn 1,000 XP',                    check: s => s.xp >= 1000 },
  { id: 'a8', emoji: '🔥', name: 'On Fire',       desc: '3-day streak',                     check: s => s.streak >= 3 },
];

/* ── Desktop detection hook (≥1024px) ── */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export default function TaskTreeApp() {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const engineRef = useRef(null);
  const isDesktop = useIsDesktop();

  const [panelOpen, setPanelOpen] = useState(null);
  const [skyMode, setSkyMode] = useState('auto');
  const [skyMenuOpen, setSkyMenuOpen] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowHud(false), 3500);
    const toggleHud = () => setShowHud(prev => !prev);
    window.addEventListener('toggle-tree-hud', toggleHud);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('toggle-tree-hud', toggleHud);
    };
  }, []);

  const treeTasks = useMemo(() => {
    return tasks.map(t => {
      const duration = t.duration_minutes || 0;
      // Thresholds: <15min→sprout, 15-29min→sprout, 30-59min→leaf, 60-119min→branch, ≥120min→flower
      let size;
      if (duration >= 120) size = 'flower';
      else if (duration >= 60) size = 'branch';
      else if (duration >= 30) size = 'leaf';
      else size = 'sprout';

      // Category from task data
      const cat = t.tag_type || t.category || t.cat || 'Work';

      return {
        id: t.id,
        title: t.name,
        done: t.status === 'completed',
        size,
        hours: Math.max(duration, 15) / 60,
        cat,
        completedAt: t.updated_at || t.completed_at || Date.now()
      };
    });
  }, [tasks]);


  const doneTasks = useMemo(() => {
    return treeTasks
      .filter(t => t.done)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }, [treeTasks]);
  
  // Calculate XP and level based on the engine's original logic
  const xp = doneTasks.reduce((a, t) => {
    const sizes = { sprout: 10, leaf: 20, branch: 50, flower: 100 };
    return a + (sizes[t.size] || 20);
  }, 0);
  const hours = doneTasks.reduce((a, t) => a + t.hours, 0);
  const flowers = doneTasks.filter(t => t.size === 'flower').length;
  
  // Streak calculation
  const streakDays = useMemo(() => {
    const daySet = new Set(
      doneTasks
        .map(t => t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : null)
        .filter(Boolean)
    );
    let streak = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    while (daySet.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [doneTasks]);

  let lvlIdx = 0;
  LEVELS.forEach((L, i) => { if (xp >= L.xp) lvlIdx = i; });
  const level = LEVELS[lvlIdx];
  const nextLvl = LEVELS[lvlIdx + 1];
  const progress = nextLvl ? ((xp - level.xp) / (nextLvl.xp - level.xp)) * 100 : 100;

  // Achievement stats object
  const achStats = { done: doneTasks.length, xp, flowers, streak: streakDays };

  const latestTasksRef = useRef(treeTasks);
  useEffect(() => { latestTasksRef.current = treeTasks; }, [treeTasks]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    let timer;
    // Defer the heavy 3D engine initialization by 100ms.
    // This allows the browser to smoothly animate the route transition FIRST
    // before the main thread gets blocked by generating 3D geometries.
    timer = setTimeout(() => {
      if (containerRef.current && !engineRef.current) {
        engineRef.current = initTree3D(containerRef.current);
        engineRef.current.updateTasks(latestTasksRef.current);
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (engineRef.current) {
        engineRef.current.cleanup();
        engineRef.current = null;
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateTasks(treeTasks);
    }
  }, [treeTasks]);

  /* ── Desktop Insights Panel (right column) ── */
  const DesktopInsightsPanel = () => (
    <>
      {/* Edge toggle tab — always visible */}
      <button
        className="insights-toggle-tab"
        onClick={() => setInsightsOpen(prev => !prev)}
        title={insightsOpen ? 'Close Insights' : 'Open Insights'}
      >
        <span className="tab-icon">{insightsOpen ? '›' : '‹'}</span>
        {!insightsOpen && <span className="tab-label">Insights</span>}
      </button>

    <aside className={`insights-panel ${insightsOpen ? 'open' : ''}`}>
      <style>{`
        /* Toggle tab on right edge */
        .insights-toggle-tab {
          position: absolute;
          top: 50%;
          right: ${insightsOpen ? '326px' : '0'};
          transform: translateY(-50%);
          z-index: 25;
          border: 0;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid ${insightsOpen ? 'rgba(123, 224, 141, 0.3)' : 'rgba(255,255,255,0.12)'};
          border-right: ${insightsOpen ? '1px solid rgba(123, 224, 141, 0.3)' : 'none'};
          border-radius: ${insightsOpen ? '12px' : '12px 0 0 12px'};
          padding: ${insightsOpen ? '12px 8px' : '14px 10px 14px 12px'};
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: ${insightsOpen ? '#7be08d' : 'rgba(255,255,255,0.8)'};
          box-shadow: ${insightsOpen ? '-4px 0 25px rgba(123,224,141,0.25), -4px 0 20px rgba(0,0,0,0.4)' : '-4px 0 20px rgba(0,0,0,0.3)'};
          transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
        }
        .insights-toggle-tab:hover {
          background: rgba(10, 20, 15, 0.75);
          color: #7be08d;
        }
        .insights-toggle-tab .tab-icon {
          font-size: 20px;
          font-weight: 900;
          line-height: 1;
        }
        .insights-toggle-tab .tab-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .insights-panel {
          position: absolute;
          top: 80px;
          right: 0;
          bottom: 12px;
          width: 320px;
          z-index: 22;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
          overflow-x: hidden;
          pointer-events: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
          -webkit-mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
          padding: 12px 14px 24px 14px;
          transform: translateX(110%);
          transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
          opacity: 0;
        }
        .insights-panel.open {
          transform: translateX(0);
          opacity: 1;
        }
        .insights-panel::-webkit-scrollbar { width: 4px; }
        .insights-panel::-webkit-scrollbar-track { background: transparent; }
        .insights-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }

        /* Staggered card entrance animation */
        @keyframes cardSlideIn {
          0% {
            opacity: 0;
            transform: translateX(30px) scale(0.92);
          }
          60% {
            transform: translateX(-4px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .glass-card {
          background: rgba(0, 0, 0, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 12px 14px;
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .insights-panel.open .glass-card:nth-child(1) { animation: cardSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
        .insights-panel.open .glass-card:nth-child(2) { animation: cardSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both; }
        .insights-panel.open .glass-card:nth-child(3) { animation: cardSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.19s both; }
        .insights-panel.open .glass-card:nth-child(4) { animation: cardSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both; }
        .glass-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .glass-card-header h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.55);
        }
        .glass-card-header .icon-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #7be08d;
          box-shadow: 0 0 8px rgba(123,224,141,0.5);
        }

        /* Progress bar */
        .growth-bar-track {
          width: 100%;
          height: 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 99px;
          overflow: hidden;
          position: relative;
        }
        .growth-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #ffd97a, #7be08d);
          transition: width 1s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: 0 0 12px rgba(123,224,141,0.4);
        }

        /* Task list */
        .task-list-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 12px;
          transition: all 0.25s ease;
          cursor: default;
          border: 1px solid transparent;
        }
        .task-list-item:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.1);
        }
        .task-list-item.highlighted {
          background: rgba(123,224,141,0.15);
          border-color: rgba(123,224,141,0.3);
        }
        .task-list-item .size-badge {
          font-size: 18px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .task-list-item .task-info {
          flex: 1;
          min-width: 0;
        }
        .task-list-item .task-title {
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-list-item .task-meta {
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          margin-top: 1px;
        }
        .task-list-item .xp-tag {
          font-size: 10px;
          font-weight: 700;
          color: #ffd97a;
          background: rgba(255,217,122,0.12);
          padding: 2px 8px;
          border-radius: 99px;
          flex-shrink: 0;
        }

        /* Achievements */
        .ach-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ach-badge {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          position: relative;
          transition: all 0.3s ease;
          cursor: default;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .ach-badge.unlocked {
          background: rgba(255,255,255,0.1);
          border-color: rgba(123,224,141,0.3);
          box-shadow: 0 0 12px rgba(123,224,141,0.15);
        }
        .ach-badge.unlocked:hover {
          box-shadow: 0 0 20px rgba(123,224,141,0.3);
        }
        .ach-badge.locked {
          background: rgba(255,255,255,0.03);
          filter: grayscale(1) opacity(0.35);
        }
        .ach-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(10px);
          color: #fff;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 30;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .ach-badge:hover .ach-tooltip { opacity: 1; }

        /* Streak card */
        .streak-bar {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .streak-dot {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: all 0.3s ease;
        }
        .streak-dot.active {
          background: rgba(255,217,122,0.2);
          border: 1px solid rgba(255,217,122,0.4);
        }
        .streak-dot.empty {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
      `}</style>


      {/* ── 2. Streak Fruits ── */}
      <div className="glass-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🍎</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Streak
            </span>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 900, color: '#ffd97a',
            background: 'rgba(255,217,122,0.12)', padding: '3px 10px',
            borderRadius: 99
          }}>
            {streakDays} {streakDays === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="streak-bar">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`streak-dot ${i < streakDays ? 'active' : 'empty'}`}
              title={i < streakDays ? `Day ${i + 1}` : 'Keep growing!'}
            >
              {i < streakDays ? '🍎' : ''}
            </div>
          ))}
          {streakDays > 8 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ffd97a', marginLeft: 4 }}>
              +{streakDays - 8}
            </span>
          )}
        </div>
        {streakDays >= 3 && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontWeight: 600 }}>
            🔥 You're on fire! Keep the streak alive.
          </div>
        )}
      </div>

      {/* ── 3. Completed Tasks (linked to branches) ── */}
      <div className="glass-card" style={{ padding: '12px' }}>
        <div className="glass-card-header" style={{ paddingLeft: 4 }}>
          <div className="icon-dot" />
          <h3>Grown Tasks</h3>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px', borderRadius: 99,
          }}>
            {doneTasks.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {doneTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              Complete a task to grow your first leaf 🌱
            </div>
          ) : (
            doneTasks.slice(0, 5).map(t => {
              const sizeInfo = SIZES[t.size] || SIZES.leaf;
              return (
                <div
                  key={t.id}
                  className={`task-list-item ${hoveredTaskId === t.id ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHoveredTaskId(t.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  <div className="size-badge">{sizeInfo.icon}</div>
                  <div className="task-info">
                    <div className="task-title">{t.title}</div>
                    <div className="task-meta">
                      {sizeInfo.label} · {t.cat} · {new Date(t.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="xp-tag">+{sizeInfo.xp}</div>
                </div>
              );
            })
          )}
          {doneTasks.length > 5 && (
            <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '4px 0', fontWeight: 600 }}>
              +{doneTasks.length - 5} more tasks grown
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Achievements ── */}
      <div className="glass-card">
        <div className="glass-card-header">
          <div className="icon-dot" style={{ background: '#ffd97a', boxShadow: '0 0 8px rgba(255,217,122,0.5)' }} />
          <h3>Achievements</h3>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px', borderRadius: 99,
          }}>
            {ACHIEVEMENTS.filter(a => a.check(achStats)).length}/{ACHIEVEMENTS.length}
          </span>
        </div>

        <div className="ach-grid">
          {ACHIEVEMENTS.map(a => {
            const unlocked = a.check(achStats);
            return (
              <div key={a.id} className={`ach-badge ${unlocked ? 'unlocked' : 'locked'}`}>
                {a.emoji}
                <div className="ach-tooltip">
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{a.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>{a.desc}</div>
                  {!unlocked && (
                    <div style={{ color: '#ffd97a', marginTop: 2, fontSize: 10 }}>🔒 Locked</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
    </>
  );

  return (
    <div className="task-tree-app relative w-full h-full overflow-hidden text-[#2b2620] bg-black">
      <style>{`
        .task-tree-app { font-family: ui-rounded, system-ui, -apple-system, sans-serif; }
        .hud { position: absolute; z-index: 10; pointer-events: none; }
        .hud > * { pointer-events: auto; }
        header.hud { top: calc(76px + env(safe-area-inset-top)); left: 16px; right: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 12px; }
        @media (min-width: 1024px) {
          header.hud { left: 272px; top: 80px; }
        }
        .brand { display: flex; align-items: center; gap: 10px; background: #fffdf4e8; backdrop-filter: blur(14px); border-radius: 16px; padding: 8px 14px 8px 8px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); }
        .logo { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #57b66b, #2c7a3b); display: grid; place-items: center; font-size: 23px; }
        .brand h1 { margin: 0; font-size: 16px; font-weight: bold; }
        .brand p { margin: 0; font-size: 11px; color: #8a8478; }
        .pill { background: #2b2620ee; color: #fff; border-radius: 999px; padding: 8px 14px; font-size: 12.5px; display: flex; align-items: center; gap: 8px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); white-space: nowrap; flex-shrink: 1; }
        .pill .xpbar { width: clamp(50px, 15vw, 110px); height: 8px; background: #ffffff2e; border-radius: 99px; overflow: hidden; }
        .pill .xpbar i { display: block; height: 100%; background: linear-gradient(90deg, #ffd97a, #7be08d); border-radius: 99px; transition: width 0.8s; }
        .streak { background: #fffdf4e8; backdrop-filter: blur(14px); border: 1px solid #fff; border-radius: 999px; padding: 8px 13px; font-size: 12.5px; font-weight: 800; box-shadow: 0 12px 32px rgba(20,30,15,0.25); }
        .iconbtn { border: 1px solid #fff; background: #fffdf4e8; backdrop-filter: blur(14px); border-radius: 12px; padding: 9px 12px; cursor: pointer; font-size: 15px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); transition: transform 0.2s; }
        .iconbtn:active { transform: scale(0.95); }
        .sky-toggle { display: flex; background: #2b2620cc; backdrop-filter: blur(14px); border-radius: 999px; padding: 4px; gap: 2px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); }
        .sky-toggle button { border: 0; background: transparent; border-radius: 999px; padding: 7px 11px; font-size: 14px; cursor: pointer; filter: grayscale(0.4); color: white; }
        .sky-toggle button.active { background: #fff; filter: none; color: black; }
        .panel { background: #fffdf4e8; backdrop-filter: blur(16px); border: 1px solid #ffffffaa; border-radius: 20px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); padding: 16px; width: 322px; max-height: calc(100vh - 190px); overflow-y: auto; transition: transform 0.3s cubic-bezier(0.2,1.2,0.4,1); }
        #panelLeft { position: absolute; left: 12px; top: 78px; transform: translateX(-120%); }
        #panelRight { position: absolute; right: 12px; top: 78px; width: 296px; transform: translateX(120%); }
        #panelLeft.open { transform: translateX(0); }
        #panelRight.open { transform: translateX(0); }
        .fab { display: block; position: absolute; bottom: 30px; z-index: 30; border: 0; border-radius: 999px; padding: 13px 18px; font-size: 15px; font-weight: 800; box-shadow: 0 12px 32px rgba(20,30,15,0.25); cursor: pointer; transition: transform 0.2s; pointer-events: auto; }
        .fab:active { transform: scale(0.95); }
        #fabTasks { left: 24px; background: linear-gradient(135deg, #4caf5d, #2c7a3b); color: #fff; }
        #fabTree { right: 24px; background: #2b2620; color: #fff; }
        .toast { position: absolute; top: 80px; left: 50%; transform: translateX(-50%); background: #fffdf4e8; padding: 12px 20px; border-radius: 12px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); font-weight: bold; font-size: 14px; animation: slideDown 0.5s cubic-bezier(0.2,1.2,0.4,1); z-index: 50; }
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        #toasts { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 50; pointer-events: none; align-items: center; }
        .toast { background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); color: #ffffff; padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 14px; animation: slideDown 0.5s cubic-bezier(0.2,1.2,0.4,1); white-space: nowrap; text-shadow: 0 2px 4px rgba(0,0,0,0.5); pointer-events: auto; }
        .toast.gold { background: linear-gradient(135deg, rgba(255,217,122,0.85), rgba(249,168,212,0.85)); color: #2b2620; text-shadow: none; border: 1px solid rgba(255,255,255,0.4); }
        #tooltip { position: fixed; display: none; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px 16px; border-radius: 14px; box-shadow: 0 12px 32px rgba(20,30,15,.5); font-size: 13.5px; line-height: 1.4; z-index: 100; pointer-events: none; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); white-space: nowrap; }

      `}</style>

      {/* 3D Canvas Container */}
      <div id="scene" ref={containerRef} className="absolute inset-0 z-0"></div>

      {/* Premium HUD Header */}
      <header className={`hud transition-all duration-700 ease-out ${showHud ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Unified Stats & Legend Glass Card */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.5)] rounded-3xl p-3 flex flex-col items-center gap-2.5 max-w-full overflow-hidden">
          
          <div className="flex items-center gap-3 px-2">
            <div className="text-[13px] font-black text-white tracking-wide flex items-center gap-1.5 drop-shadow-md">
              <span className="text-base">🌳</span> My Focus Tree
            </div>
            <div className="h-4 w-[1px] bg-white/20"></div>
            <div className="text-[11px] font-semibold text-white/80 tracking-wide drop-shadow-sm whitespace-nowrap">
              {doneTasks.length} tasks · {Math.round(hours * 10) / 10} hrs
            </div>
          </div>

          <div className="w-[90%] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[11px] font-bold text-white/90 drop-shadow-md px-2">
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Growth</span>
            <span className="flex items-center gap-1">🌱 &lt;30m</span>
            <span className="flex items-center gap-1">🍃 30m</span>
            <span className="flex items-center gap-1">🌿 1h</span>
            <span className="flex items-center gap-1">🌸 2h</span>
          </div>

        </div>

        {/* Expandable Sky Toggles (Top Right) */}
        <div className="relative flex flex-col items-end pointer-events-auto">
          <div 
            className={`flex flex-col bg-black/40 backdrop-blur-xl border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.5)] rounded-full p-1.5 gap-2 transition-all duration-300 ease-out overflow-hidden`}
          >
            {/* Active/Main Toggle Button */}
            <button 
              className="w-10 h-10 flex justify-center items-center rounded-full bg-white text-black text-lg shadow-md hover:scale-105 transition-transform"
              onClick={() => setSkyMenuOpen(!skyMenuOpen)}
              title="Change Sky Mode"
            >
              {skyMode === 'day' ? '☀️' : skyMode === 'sunset' ? '🌇' : skyMode === 'night' ? '🌙' : '✨'}
            </button>

            {/* Expandable Options */}
            <div className={`flex flex-col gap-2 transition-all duration-300 ease-out origin-top ${skyMenuOpen ? 'max-h-64 opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95 pointer-events-none hidden'}`}>
              <button className={`w-10 h-10 flex justify-center items-center rounded-full text-lg transition-all hover:bg-white/20 ${skyMode === 'day' ? 'hidden' : 'text-white grayscale-[0.4] hover:grayscale-0'}`} onClick={() => { setSkyMode('day'); setSkyMenuOpen(false); if(engineRef.current) engineRef.current.setSky('day'); }} title="Day">☀️</button>
              <button className={`w-10 h-10 flex justify-center items-center rounded-full text-lg transition-all hover:bg-white/20 ${skyMode === 'sunset' ? 'hidden' : 'text-white grayscale-[0.4] hover:grayscale-0'}`} onClick={() => { setSkyMode('sunset'); setSkyMenuOpen(false); if(engineRef.current) engineRef.current.setSky('sunset'); }} title="Sunset">🌇</button>
              <button className={`w-10 h-10 flex justify-center items-center rounded-full text-lg transition-all hover:bg-white/20 ${skyMode === 'night' ? 'hidden' : 'text-white grayscale-[0.4] hover:grayscale-0'}`} onClick={() => { setSkyMode('night'); setSkyMenuOpen(false); if(engineRef.current) engineRef.current.setSky('night'); }} title="Night">🌙</button>
              <button className={`w-10 h-10 flex justify-center items-center rounded-full text-lg transition-all hover:bg-white/20 ${skyMode === 'auto' ? 'hidden' : 'text-white grayscale-[0.4] hover:grayscale-0'}`} onClick={() => { setSkyMode('auto'); setSkyMenuOpen(false); if(engineRef.current) engineRef.current.setSky('auto'); }} title="Auto">✨</button>
            </div>
          </div>
        </div>
      </header>

      {/* Toasts */}
      {doneTasks.length === 0 && (
        <div className="toast pointer-events-auto">
          🌱 Your seed is waiting... complete a task!
        </div>
      )}

      {/* ── DESKTOP: Persistent Right Insights Panel ── */}
      {isDesktop && DesktopInsightsPanel()}

      {/* ── MOBILE: Existing slide-in panels + FABs ── */}
      {!isDesktop && (
        <>
          {/* Left Panel */}
          <aside className={`panel hud \${panelOpen === 'left' ? 'open' : ''}`} id="panelLeft">
            <h2 className="text-[15px] font-bold mb-1">🌱 Your Tasks</h2>
            <p className="text-sm text-[#8a8478] mb-4">Tasks are synced from your main dashboard.</p>
            
            <div className="space-y-3">
              {treeTasks.filter(t => !t.done).map(t => (
                <div key={t.id} className="p-3 bg-white/50 border border-white rounded-xl shadow-sm text-sm font-semibold flex items-center justify-between">
                  <span className="truncate pr-2">{t.title}</span>
                  <span className="text-[11px] px-2 py-1 bg-black/5 rounded-full">{t.size}</span>
                </div>
              ))}
              {treeTasks.filter(t => !t.done).length === 0 && (
                <div className="text-center text-sm py-4 text-[#8a8478] italic">No pending tasks.</div>
              )}
            </div>
          </aside>

          {/* Right Panel (mobile slide-in) */}
          <aside className={`panel hud \${panelOpen === 'right' ? 'open' : ''}`} id="panelRight">
            <div className="bg-[#2b2620] text-white p-4 rounded-xl shadow-inner mb-4">
              <div className="text-[10px] font-bold opacity-70 tracking-wider">YOUR TREE · LEVEL {lvlIdx}</div>
              <div className="text-lg font-bold my-1">{level.emoji} {level.name}</div>
              <div className="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#ffd97a] to-[#7be08d]" style={{ width: `\${progress}%` }}></div>
              </div>
              {nextLvl && (
                <div className="text-[10px] font-bold opacity-70 tracking-wider mt-2 text-right">
                  {nextLvl.xp - xp} to {nextLvl.name}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/50 border border-white p-3 rounded-xl text-center">
                <div className="text-xl font-black text-[#2c7a3b]">{doneTasks.length}</div>
                <div className="text-[11px] font-bold text-[#8a8478] uppercase">🍃 Grown</div>
              </div>
              <div className="bg-white/50 border border-white p-3 rounded-xl text-center">
                <div className="text-xl font-black text-[#ca8a04]">{Math.round(hours * 10) / 10}</div>
                <div className="text-[11px] font-bold text-[#8a8478] uppercase">⏳ Hours</div>
              </div>
            </div>

            {/* Streak (mobile) */}
            <div className="bg-white/50 border border-white p-3 rounded-xl text-center mb-4">
              <div className="text-xl font-black text-[#ea580c]">🍎 × {streakDays}</div>
              <div className="text-[11px] font-bold text-[#8a8478] uppercase">Streak Days</div>
            </div>

            {/* Achievements (mobile) */}
            <div className="flex flex-wrap gap-2 justify-center">
              {ACHIEVEMENTS.map(a => {
                const unlocked = a.check(achStats);
                return (
                  <div key={a.id} title={`${a.name}: ${a.desc}`} className={`w-9 h-9 rounded-lg flex items-center justify-center text-base border ${unlocked ? 'bg-white/30 border-[#7be08d]' : 'bg-white/5 border-white/10 grayscale opacity-30'}`}>
                    {a.emoji}
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}

      {/* Tooltips and Toasts */}
      <div id="tooltip"></div>
      <div id="toasts"></div>
    </div>
  );
}

