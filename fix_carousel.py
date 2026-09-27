import re

with open('frontend/src/components/MobileLanding.jsx', 'r') as f:
    content = f.read()

# 1. Update CSS
css_old = """        .mobile-landing-container .screen-stack { position: relative; min-height: 480px; overflow: hidden; border-radius: 32px; }
        .mobile-landing-container .screen { background: var(--paper); padding: 34px 18px 26px; min-height: 480px; position: absolute; inset: 0; opacity: 0; transition: transform .5s cubic-bezier(.34,1.4,.4,1), opacity .5s ease; pointer-events: none; overflow: hidden; }
        
        .mobile-landing-container .screen-stack.next .screen { transform: translateX(100%); opacity: 0; }
        .mobile-landing-container .screen-stack.prev .screen { transform: translateX(-100%); opacity: 0; }
        .mobile-landing-container .screen-stack .screen.active { transform: translateX(0); opacity: 1; pointer-events: auto; }
        .mobile-landing-container .screen-stack.next .screen:not(.active) { transform: translateX(-100%); opacity: 0; }
        .mobile-landing-container .screen-stack.prev .screen:not(.active) { transform: translateX(100%); opacity: 0; }"""

css_new = """        .mobile-landing-container .phone-wrap { width: 330px; margin: 0 auto; overflow: hidden; padding: 20px 10px; }
        .mobile-landing-container .carousel-track { display: flex; transition: transform 0.6s cubic-bezier(.34,1.4,.4,1); }
        .mobile-landing-container .phone.big { flex: 0 0 300px; margin-right: 20px; }
        .mobile-landing-container .screen { background: var(--paper); border-radius: 32px; padding: 34px 18px 26px; min-height: 480px; position: relative; width: 100%; overflow: hidden; }
        .mobile-landing-container .screen.active { pointer-events: auto; }"""
content = content.replace(css_old, css_new)

# 2. Restructure HTML
html_old = """            <div className="phone-wrap" ref={phoneWrapRef}>
              <div className="phone big">
                <div className={`screen-stack ${slideDir}`}>"""

html_new = """            <div className="phone-wrap" ref={phoneWrapRef}>
              <div className="carousel-track" style={{ transform: `translateX(calc(-${scIndex} * 320px))` }}>
                <div className="phone big">"""
content = content.replace(html_old, html_new)

# Wrap screen-1, screen-2, screen-3 in phone big
content = content.replace("""                  <div className={`screen ${scIndex === 1 ? 'active' : ''}`} id="screen-1">""", """                </div>
                <div className="phone big">
                  <div className={`screen ${scIndex === 1 ? 'active' : ''}`} id="screen-1">""")

content = content.replace("""                  <div className={`screen ${scIndex === 2 ? 'active' : ''}`} id="screen-2" style={{ background: '#1A1B2E', color: 'white' }}>""", """                </div>
                <div className="phone big">
                  <div className={`screen ${scIndex === 2 ? 'active' : ''}`} id="screen-2" style={{ background: '#1A1B2E', color: 'white' }}>""")

content = content.replace("""                  <div className={`screen dark ${scIndex === 3 ? 'active' : ''}`} id="screen-3">""", """                </div>
                <div className="phone big">
                  <div className={`screen dark ${scIndex === 3 ? 'active' : ''}`} id="screen-3">""")

# Remove the closing tags for screen-stack
# Originally:
#                   </div>
#                 </div>
#               </div>
#             </div>
#             <button className="arrow-btn right" onClick={handleNextState} aria-label="Next">›</button>
html_end_old = """                  </div>
                </div>
              </div>
            </div>
            <button className="arrow-btn right" onClick={handleNextState} aria-label="Next">›</button>"""
html_end_new = """                  </div>
                </div>
              </div>
            </div>
            <button className="arrow-btn right" onClick={handleNextState} aria-label="Next">›</button>"""
content = content.replace(html_end_old, html_end_new) # Actually, the closing divs count matches now! We removed screen-stack, added carousel-track. We removed phone big wrapper, added it to each screen.

with open('frontend/src/components/MobileLanding.jsx', 'w') as f:
    f.write(content)
