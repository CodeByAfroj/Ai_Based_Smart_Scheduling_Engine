import re

with open('frontend/src/components/TaskTreeApp.jsx', 'r') as f:
    content = f.read()

# Add skyMenuOpen state
content = re.sub(r'const \[skyMode, setSkyMode\] = useState\(\'auto\'\);', r'const [skyMode, setSkyMode] = useState(\'auto\');\n  const [skyMenuOpen, setSkyMenuOpen] = useState(false);', content)

# Change header CSS
content = content.replace(
    'header.hud { top: 16px; left: 12px; right: 12px; display: flex; flex-direction: column; align-items: center; gap: 12px; }',
    'header.hud { top: 16px; left: 16px; right: 16px; display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 12px; }'
)

# Replace sky toggle JSX
old_sky = """        {/* Sky Toggles */}
        <div className="sky-toggle hidden md:flex scale-90 origin-top shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <button className={skyMode === 'day' ? 'active' : ''} onClick={() => { setSkyMode('day'); if(engineRef.current) engineRef.current.setSky('day'); }} title="Day">☀️</button>
          <button className={skyMode === 'sunset' ? 'active' : ''} onClick={() => { setSkyMode('sunset'); if(engineRef.current) engineRef.current.setSky('sunset'); }} title="Sunset">🌇</button>
          <button className={skyMode === 'night' ? 'active' : ''} onClick={() => { setSkyMode('night'); if(engineRef.current) engineRef.current.setSky('night'); }} title="Night">🌙</button>
          <button className={skyMode === 'auto' ? 'active' : ''} onClick={() => { setSkyMode('auto'); if(engineRef.current) engineRef.current.setSky('auto'); }} title="Auto">✨</button>
        </div>"""

new_sky = """        {/* Expandable Sky Toggles (Top Right) */}
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
        </div>"""

content = content.replace(old_sky, new_sky)

with open('frontend/src/components/TaskTreeApp.jsx', 'w') as f:
    f.write(content)
