with open('frontend/src/components/TaskTreeApp.jsx', 'r') as f:
    app = f.read()

# Add tooltip CSS
tooltip_css = """        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        #tooltip { position: fixed; display: none; background: #fffdf4f0; backdrop-filter: blur(8px); border: 1px solid #ffffffaa; padding: 12px; border-radius: 14px; box-shadow: 0 12px 32px rgba(20,30,15,.25); font-size: 13.5px; line-height: 1.4; z-index: 100; pointer-events: none; color: #2b2620; }
"""
app = app.replace("        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }", tooltip_css)

# Add tooltip div
tooltip_div = """      <button 
        className="fab" 
        id="fabTree"
        onClick={() => setPanelOpen(panelOpen === 'right' ? null : 'right')}
      >
        🌳 Growth
      </button>

      {/* Hover Tooltip for 3D Tree */}
      <div id="tooltip"></div>"""
app = app.replace("""      <button 
        className="fab" 
        id="fabTree"
        onClick={() => setPanelOpen(panelOpen === 'right' ? null : 'right')}
      >
        🌳 Growth
      </button>""", tooltip_div)

with open('frontend/src/components/TaskTreeApp.jsx', 'w') as f:
    f.write(app)
