with open('frontend/src/components/TaskTreeApp.jsx', 'r') as f:
    app = f.read()

# Add #toasts CSS
toasts_css = """        #toasts { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 50; pointer-events: none; }
        .toast { background: #fffdf4e8; padding: 12px 20px; border-radius: 12px; box-shadow: 0 12px 32px rgba(20,30,15,0.25); font-weight: bold; font-size: 14px; animation: slideDown 0.5s cubic-bezier(0.2,1.2,0.4,1); pointer-events: auto; }
        .toast.gold { background: linear-gradient(to right, #ffd97a, #f9a8d4); color: #2b2620; }
"""
app = app.replace("        #tooltip {", toasts_css + "        #tooltip {")

# Add #toasts div
toasts_div = """      <button 
        className="fab" 
        id="fabTree"
        onClick={() => setPanelOpen(panelOpen === 'right' ? null : 'right')}
      >
        🌳 Growth
      </button>

      {/* Tooltips and Toasts */}
      <div id="tooltip"></div>
      <div id="toasts"></div>"""
app = app.replace("""      <button 
        className="fab" 
        id="fabTree"
        onClick={() => setPanelOpen(panelOpen === 'right' ? null : 'right')}
      >
        🌳 Growth
      </button>

      {/* Hover Tooltip for 3D Tree */}
      <div id="tooltip"></div>""", toasts_div)

# Now I should remove the static toast I had added before (the "Your seed is waiting" one) and just let it render or keep it separate.
# Actually, the static toast is fine because it's rendered conditionally by React, whereas the 3D engine appends to #toasts.

with open('frontend/src/components/TaskTreeApp.jsx', 'w') as f:
    f.write(app)
