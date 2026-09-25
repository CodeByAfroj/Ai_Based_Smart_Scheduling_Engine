import React, { useMemo } from "react";
import { useTasks } from "../contexts/TaskContext";

// deterministic pseudo-random, so the tree looks the same on every render
function seeded(i) {
  const x = Math.sin(i * 999.7) * 10000;
  return x - Math.floor(x);
}

function TreeSVG({ tasks }) {
  const geometry = useMemo(() => {
    const done = tasks.filter((t) => t.done);
    const smalls = done.filter((t) => t.size === "small").length;
    const mediums = done.filter((t) => t.size === "medium").length;
    const larges = done.filter((t) => t.size === "large").length;
    const total = done.length;

    if (total === 0) return { total: 0 };

    const trunkH = Math.min(65 + total * 4, 175);
    const baseY = 376,
      topY = baseY - trunkH;
    const trunkWTop = Math.max(6, 16 - total * 0.3);
    const trunkPath = `M ${200 - 15} ${baseY} C ${200 - 16} ${baseY - trunkH * 0.5}, ${
      200 - trunkWTop - 2
    } ${topY + 16}, ${200 - trunkWTop} ${topY}
       L ${200 + trunkWTop} ${topY} C ${200 + trunkWTop + 2} ${topY + 16}, ${
      200 + 16
    } ${baseY - trunkH * 0.5}, ${200 + 15} ${baseY} Z`;

    // branches: one per medium task
    const branches = [];
    const branchTips = [];
    const branchCount = Math.min(mediums, 10);
    for (let i = 0; i < branchCount; i++) {
      const r1 = seeded(i),
        r2 = seeded(i + 50);
      const side = i % 2 === 0 ? -1 : 1;
      const startY = topY + trunkH * 0.55 * r1;
      const angle = side * (35 + r2 * 30);
      const len = 55 + r2 * 35;
      const rad = (angle * Math.PI) / 180;
      const sx = 200,
        sy = startY;
      const ex = sx + Math.sin(rad) * len,
        ey = sy - Math.cos(rad) * len * 0.85;
      const midx = sx + Math.sin(rad) * len * 0.5 + side * 8,
        midy = sy - Math.cos(rad) * len * 0.5;
      const lengthTotal = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2)) * 1.2;
      branches.push({
        d: `M ${sx} ${sy} Q ${midx} ${midy} ${ex} ${ey}`,
        w: Math.max(6 - i * 0.3, 2),
        len: lengthTotal,
        delay: i * 0.2
      });
      branchTips.push({ x: ex, y: ey });
    }

    // canopy leaves
    const canopyCx = 200,
      canopyCy = topY - 10;
    const canopyR = 35 + Math.min(total, 40) * 2.2;
    const leafCount = Math.min(smalls + mediums * 3, 90);
    const leaves = [];
    for (let i = 0; i < leafCount; i++) {
      const a = seeded(i) * Math.PI * 2;
      const rr = Math.pow(seeded(i + 200), 0.6) * canopyR;
      const lx = canopyCx + Math.cos(a) * rr * 1.15;
      const ly = canopyCy + Math.sin(a) * rr * 0.85 - rr * 0.15;
      const size = 5 + seeded(i + 300) * 5;
      const rot = seeded(i + 400) * 360;
      const roll = seeded(i + 500);
      const fill = roll > 0.75 ? "var(--leaf-bright)" : roll > 0.35 ? "var(--leaf)" : "var(--leaf-dark)";
      leaves.push({ lx, ly, size, rot, fill, shadowR: 6 + seeded(i + 300) * 4, delay: seeded(i + 900) * 1.5 });
    }

    // blossoms: one per large task
    const blossoms = [];
    for (let i = 0; i < larges; i++) {
      let cx, cy;
      if (branchTips.length > 0) {
        const tip = branchTips[i % branchTips.length];
        cx = tip.x;
        cy = tip.y;
      } else {
        const a = seeded(i + 600) * Math.PI * 2;
        cx = canopyCx + Math.cos(a) * canopyR * 0.9;
        cy = canopyCy + Math.sin(a) * canopyR * 0.7;
      }
      blossoms.push({ cx, cy });
    }

    // fireflies
    const fCount = Math.min(3 + Math.floor(total / 4), 7);
    const fireflies = Array.from({ length: fCount }, (_, i) => ({
      x: canopyCx + (seeded(i + 700) - 0.5) * canopyR * 2.4,
      y: canopyCy + (seeded(i + 750) - 0.5) * canopyR * 1.8 + 10,
      delay: seeded(i + 800) * 5,
    }));

    // ground grass flecks
    const grass = Array.from({ length: 14 }, (_, g) => ({
      x: 200 + (seeded(g + 900) - 0.5) * 180,
      h: 4 + seeded(g + 950) * 7,
    }));

    return { total, trunkPath, baseY, topY, branches, leaves, blossoms, fireflies, grass, canopyCx, canopyCy };
  }, [tasks]);

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full block">
      <defs>
        <linearGradient id="trunkShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--trunk-dark)" />
          <stop offset="45%" stopColor="transparent" />
          <stop offset="100%" stopColor="var(--trunk-light)" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="branchShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--trunk-light)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--trunk-dark)" stopOpacity="0.8" />
        </linearGradient>
        <radialGradient id="groundGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4F6B4E" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4F6B4E" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {geometry.total === 0 ? (
        <>
          <ellipse cx={200} cy={376} rx={70} ry={9} fill="url(#groundGlow)" />
          <path
            d="M200 376 C 198 348, 202 332, 200 316"
            stroke="var(--trunk)"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <g filter="url(#softGlow)">
            <ellipse cx={190} cy={317} rx={11} ry={5.5} fill="var(--leaf)" transform="rotate(-25 190 317)" />
            <ellipse cx={210} cy={317} rx={11} ry={5.5} fill="var(--leaf)" transform="rotate(25 210 317)" />
          </g>
        </>
      ) : (
        <>
          <ellipse cx={200} cy={374} rx={120} ry={16} fill="url(#groundGlow)" />
          {geometry.grass.map((g, i) => (
            <path
              key={i}
              d={`M ${g.x} 378 q 2 -${g.h} 4 0`}
              stroke="var(--leaf-dark)"
              strokeWidth={1.4}
              fill="none"
              opacity={0.5}
              strokeLinecap="round"
            />
          ))}

          <path d={`M ${200 - 24} 376 Q ${200 - 15} 362 ${200 - 13} ${geometry.baseY}`} stroke="var(--trunk-dark)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
          <path d={`M ${200 + 24} 376 Q ${200 + 15} 362 ${200 + 13} ${geometry.baseY}`} stroke="var(--trunk-dark)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />

          <path d={geometry.trunkPath} fill="var(--trunk)" />
          <path d={geometry.trunkPath} fill="url(#trunkShade)" />

          {geometry.branches.map((b, i) => (
            <g key={i}>
              <path d={b.d} fill="none" stroke="var(--trunk-dark)" strokeWidth={b.w + 1.5} strokeLinecap="round" className="animate-[grow-branch_1.5s_ease-out_forwards]" style={{ strokeDasharray: b.len, strokeDashoffset: b.len, animationDelay: `${b.delay}s` }} />
              <path d={b.d} fill="none" stroke="var(--trunk)" strokeWidth={b.w} strokeLinecap="round" className="animate-[grow-branch_1.5s_ease-out_forwards]" style={{ strokeDasharray: b.len, strokeDashoffset: b.len, animationDelay: `${b.delay}s` }} />
              <path d={b.d} fill="none" stroke="url(#branchShade)" strokeWidth={b.w * 0.8} strokeLinecap="round" className="animate-[grow-branch_1.5s_ease-out_forwards]" style={{ strokeDasharray: b.len, strokeDashoffset: b.len, animationDelay: `${b.delay}s` }} />
            </g>
          ))}

          <g className="origin-[200px_210px] animate-[sway_7s_ease-in-out_infinite] motion-reduce:animate-none">
            <g filter="url(#softGlow)" opacity={0.22}>
              {geometry.leaves.map((l, i) => (
                <circle key={i} cx={l.lx} cy={l.ly} r={l.shadowR} fill="var(--leaf-dark)" />
              ))}
            </g>
            {geometry.leaves.map((l, i) => (
              <g key={i} transform={`rotate(${l.rot} ${l.lx} ${l.ly})`}>
                <ellipse
                  cx={l.lx}
                  cy={l.ly}
                  rx={l.size}
                  ry={l.size * 0.6}
                  fill={l.fill}
                  opacity={0}
                  className="animate-[pop-leaf_0.8s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
                  style={{ transformOrigin: `${l.lx}px ${l.ly}px`, animationDelay: `${l.delay + 0.5}s` }}
                />
              </g>
            ))}
            {geometry.blossoms.map((b, i) => (
              <g key={i} filter="url(#softGlow)">
                {Array.from({ length: 5 }, (_, p) => {
                  const pa = p * ((Math.PI * 2) / 5);
                  const petalR = 7;
                  return (
                    <circle
                      key={p}
                      cx={b.cx + Math.cos(pa) * petalR}
                      cy={b.cy + Math.sin(pa) * petalR}
                      r={petalR * 0.85}
                      fill="var(--flower)"
                      opacity={0.95}
                    />
                  );
                })}
                <circle cx={b.cx} cy={b.cy} r={5} fill="var(--flower-core)" />
              </g>
            ))}
          </g>

          {geometry.fireflies.map((f, i) => (
            <circle
              key={i}
              cx={f.x}
              cy={f.y}
              r={1.8}
              fill="var(--flower-core)"
              className="animate-[drift_6s_ease-in-out_infinite] motion-reduce:animate-none"
              style={{ animationDelay: `${f.delay}s` }}
            />
          ))}
        </>
      )}
    </svg>
  );
}

export default function Analytics() {
  const { tasks, loadingTasks: loading } = useTasks();

  const treeTasks = useMemo(() => {
    return tasks.map(t => {
      let size = "small";
      const priority = t.priority || 1;
      const duration = t.duration_minutes || 0;
      
      if (priority >= 4 || duration >= 120) size = "large";
      else if (priority >= 2 || duration >= 30) size = "medium";
      
      return {
        id: t.id,
        name: t.name,
        done: t.status === 'completed',
        size
      };
    });
  }, [tasks]);

  const isEmpty = treeTasks.filter((t) => t.done).length === 0;
  const tagLabel = { small: "leaf", medium: "branch", large: "blossom" };
  const doneTasks = treeTasks.filter(t => t.done);

  if (loading) return <div className="p-10 text-center text-[var(--text-muted)]">Loading growth...</div>;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center bg-[#0B1613] text-[#F1ECE1] font-sans pb-28"
      style={{
        "--trunk": "#6B4A34",
        "--trunk-dark": "#3C2A1E",
        "--trunk-light": "#8B6448",
        "--leaf": "#7FA37A",
        "--leaf-dark": "#3F5C42",
        "--leaf-bright": "#9BC199",
        "--flower": "#E3A857",
        "--flower-core": "#F8DDA6",
        backgroundImage:
          "radial-gradient(ellipse 100% 55% at 50% 8%, #13221D 0%, #0B1613 50%, #070F0D 100%)",
      }}
    >
      <style>{`
        @keyframes sway { 0%,100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
        @keyframes drift { 0%,100% { opacity: 0.15; transform: translateY(0); } 50% { opacity: 0.85; transform: translateY(-10px); } }
        @keyframes grow-branch { 0% { stroke-dashoffset: 1000; } 100% { stroke-dashoffset: 0; } }
        @keyframes pop-leaf { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 0.95; } }
      `}</style>

      <div className="w-full max-w-[680px] px-5 pt-11 pb-16">
        <h1 className="text-center font-normal text-[27px] sm:text-[34px] mb-2 leading-tight font-serif italic text-white/90">
          Your tree remembers every task.
        </h1>
        <p className="text-center text-[#94A69A] text-sm mb-8 leading-relaxed max-w-[420px] mx-auto">
          Small tasks become leaves. Medium tasks become branches. High priority tasks blossom.
        </p>

        <div
          className="relative w-full aspect-square max-h-[460px] mx-auto mb-7 rounded-[28px] overflow-hidden"
          style={{
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.35), 0 20px 50px -20px rgba(0,0,0,0.6)",
            backgroundImage:
              "radial-gradient(ellipse 70% 40% at 50% 82%, rgba(63,92,66,0.4), transparent 65%), radial-gradient(ellipse 120% 70% at 50% 0%, rgba(30,50,44,0.5), transparent 60%)",
          }}
        >
          <TreeSVG tasks={treeTasks} />
          {isEmpty && (
            <div
              className="absolute bottom-3.5 left-0 right-0 text-center text-[#94A69A] text-[13px] italic pointer-events-none font-serif"
            >
              a seed, waiting to be planted
            </div>
          )}
        </div>

        <div className="rounded-[20px] p-5 bg-white/[0.04] border border-white/[0.09] backdrop-blur-md shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
          <h2 className="text-sm font-semibold text-[#94A69A] uppercase tracking-wider mb-4 border-b border-white/10 pb-3">Completed Tasks ({doneTasks.length})</h2>
          
          <div className="flex flex-col max-h-[270px] overflow-y-auto pr-2 no-scrollbar">
            {doneTasks.length === 0 && (
              <div className="text-[#94A69A] text-sm text-center py-4 italic font-serif">
                nothing planted yet — complete tasks in the dashboard to grow the tree
              </div>
            )}
            {doneTasks
              .slice()
              .reverse()
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 py-2.5 border-b border-white/[0.055] last:border-none"
                >
                  <div className="w-[19px] h-[19px] rounded-full border-[1.5px] border-[#7FA37A] flex items-center justify-center shrink-0 bg-[#7FA37A]">
                    <span className="text-[#0B1613] text-[11px] font-bold">✓</span>
                  </div>
                  <span className="flex-1 text-sm text-white/80">{t.name}</span>
                  <span className="text-[10.5px] text-[#94A69A] border border-white/[0.09] rounded-full px-2.5 py-1 whitespace-nowrap">
                    {tagLabel[t.size]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
