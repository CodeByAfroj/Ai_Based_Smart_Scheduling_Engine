import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../contexts/TaskContext';
import { initTree3D } from './Tree3DEngine';

export default function TaskTreeApp() {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { tasks } = useTasks();
  const engineRef = useRef(null);

  const [panelOpen, setPanelOpen] = useState(null);
  const [skyMode, setSkyMode] = useState('auto');
  const [showHud, setShowHud] = useState(true);

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


  const doneTasks = treeTasks.filter(t => t.done);
  
  // Calculate XP and level based on the engine's original logic
  const xp = doneTasks.reduce((a, t) => {
    const sizes = { sprout: 10, leaf: 20, branch: 50, flower: 100 };
    return a + (sizes[t.size] || 20);
  }, 0);
  const hours = doneTasks.reduce((a, t) => a + t.hours, 0);
  
  const LEVELS = [
    {xp:0,name:'Seed',emoji:'🌱'},{xp:30,name:'Sprout',emoji:'🌱'},
    {xp:100,name:'Sapling',emoji:'🌿'},{xp:250,name:'Young Tree',emoji:'🌳'},
    {xp:500,name:'Thriving Tree',emoji:'🌳'},{xp:1000,name:'Mighty Tree',emoji:'🌲'},
    {xp:2000,name:'Ancient Tree',emoji:'🌲'},{xp:3500,name:'Enchanted Tree',emoji:'✨'}
  ];
  
  let lvlIdx = 0;
  LEVELS.forEach((L, i) => { if (xp >= L.xp) lvlIdx = i; });
  const level = LEVELS[lvlIdx];
  const nextLvl = LEVELS[lvlIdx + 1];
  const progress = nextLvl ? ((xp - level.xp) / (nextLvl.xp - level.xp)) * 100 : 100;

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize 3D Engine
    engineRef.current = initTree3D(containerRef.current);
    engineRef.current.updateTasks(treeTasks);
    
    return () => {
      if (engineRef.current) {
        engineRef.current.cleanup();
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateTasks(treeTasks);
    }
  }, [treeTasks]);

  return (
    <div className="task-tree-app relative w-full h-screen overflow-hidden text-[#2b2620] bg-black">
      <style>{`
        .task-tree-app { font-family: ui-rounded, system-ui, -apple-system, sans-serif; }
        .hud { position: absolute; z-index: 10; pointer-events: none; }
        .hud > * { pointer-events: auto; }
        header.hud { top: 12px; left: 12px; right: 12px; display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
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
        #gardenTag { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: #2b2620ee; color: white; padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: bold; pointer-events: auto; }
        .toast { position: absolute; top: 80px; left: 50%; transform: translateX(-50%); background: #fffdf4e8; padding: 12px 20px; border-radius: 12px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); font-weight: bold; font-size: 14px; animation: slideDown 0.5s cubic-bezier(0.2,1.2,0.4,1); z-index: 50; }
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        #toasts { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 50; pointer-events: none; align-items: center; }
        .toast { background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); color: #ffffff; padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 14px; animation: slideDown 0.5s cubic-bezier(0.2,1.2,0.4,1); white-space: nowrap; text-shadow: 0 2px 4px rgba(0,0,0,0.5); pointer-events: auto; }
        .toast.gold { background: linear-gradient(135deg, rgba(255,217,122,0.85), rgba(249,168,212,0.85)); color: #2b2620; text-shadow: none; border: 1px solid rgba(255,255,255,0.4); }
        #tooltip { position: fixed; display: none; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px 16px; border-radius: 14px; box-shadow: 0 12px 32px rgba(20,30,15,.5); font-size: 13.5px; line-height: 1.4; z-index: 100; pointer-events: none; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); white-space: nowrap; }

      `}</style>

      {/* 3D Canvas Container */}
      <div id="scene" ref={containerRef} className="absolute inset-0 z-0"></div>

      {/* HUD Header */}
      <header className={`hud transition-opacity duration-500 ${showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        <div className="bg-black/45 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-lg pointer-events-auto shrink-0">
          <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">How it grows</div>
          <div className="flex gap-2 text-[11px] font-bold text-white text-shadow-sm">
            <span title="<30 min">🌱 &lt;30m</span>
            <span title="30-59 min">🍃 30m</span>
            <span title="1-2 hrs">🌿 1h</span>
            <span title="2+ hrs">🌸 2h</span>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="sky-toggle hidden md:flex">
          <button className={skyMode === 'day' ? 'active' : ''} onClick={() => { setSkyMode('day'); if(engineRef.current) engineRef.current.setSky('day'); }} title="Day">☀️</button>
          <button className={skyMode === 'sunset' ? 'active' : ''} onClick={() => { setSkyMode('sunset'); if(engineRef.current) engineRef.current.setSky('sunset'); }} title="Sunset">🌇</button>
          <button className={skyMode === 'night' ? 'active' : ''} onClick={() => { setSkyMode('night'); if(engineRef.current) engineRef.current.setSky('night'); }} title="Night">🌙</button>
          <button className={skyMode === 'auto' ? 'active' : ''} onClick={() => { setSkyMode('auto'); if(engineRef.current) engineRef.current.setSky('auto'); }} title="Auto">✨</button>
        </div>
      </header>

      {/* Toasts */}
      {doneTasks.length === 0 && (
        <div className="toast pointer-events-auto">
          🌱 Your seed is waiting... complete a task!
        </div>
      )}

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

      {/* Right Panel */}
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
      </aside>

      {/* Floating Action Buttons */}
      <button 
        className="fab" 
        id="fabTasks"
        onClick={() => setPanelOpen(panelOpen === 'left' ? null : 'left')}
      >
        🌱 Tasks
      </button>

      <div id="gardenTag">
        🌳 My Focus Tree &nbsp;<small className="opacity-75 font-normal">{doneTasks.length} tasks · {Math.round(hours * 10) / 10} hrs · 0🔥</small>
      </div>

      <button 
        className="fab" 
        id="fabTree"
        onClick={() => setPanelOpen(panelOpen === 'right' ? null : 'right')}
      >
        🌳 Growth
      </button>

      {/* Tooltips and Toasts */}
      <div id="tooltip"></div>
      <div id="toasts"></div>
    </div>
  );
}
