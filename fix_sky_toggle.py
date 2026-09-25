with open('frontend/src/components/Tree3DEngine.js', 'r') as f:
    content = f.read()

# export setSky
idx = content.find("updateTasks: (newTasks) => {")
if idx != -1:
    content = content[:idx] + """setSky: (mode) => {
      state.sky = mode;
      // Force immediate update of sky state if needed, or tickSky will handle it
    },
    """ + content[idx:]

with open('frontend/src/components/Tree3DEngine.js', 'w') as f:
    f.write(content)

with open('frontend/src/components/TaskTreeApp.jsx', 'r') as f:
    app = f.read()

app = app.replace("const [panelOpen, setPanelOpen] = useState(null);", "const [panelOpen, setPanelOpen] = useState(null);\n  const [skyMode, setSkyMode] = useState('auto');")

app = app.replace("""        <div className="sky-toggle hidden md:flex">
          <button title="Day">☀️</button>
          <button title="Sunset">🌇</button>
          <button title="Night">🌙</button>
          <button className="active" title="Auto">✨</button>
        </div>""", """        <div className="sky-toggle hidden md:flex">
          <button className={skyMode === 'day' ? 'active' : ''} onClick={() => { setSkyMode('day'); if(engineRef.current) engineRef.current.setSky('day'); }} title="Day">☀️</button>
          <button className={skyMode === 'sunset' ? 'active' : ''} onClick={() => { setSkyMode('sunset'); if(engineRef.current) engineRef.current.setSky('sunset'); }} title="Sunset">🌇</button>
          <button className={skyMode === 'night' ? 'active' : ''} onClick={() => { setSkyMode('night'); if(engineRef.current) engineRef.current.setSky('night'); }} title="Night">🌙</button>
          <button className={skyMode === 'auto' ? 'active' : ''} onClick={() => { setSkyMode('auto'); if(engineRef.current) engineRef.current.setSky('auto'); }} title="Auto">✨</button>
        </div>""")

with open('frontend/src/components/TaskTreeApp.jsx', 'w') as f:
    f.write(app)
