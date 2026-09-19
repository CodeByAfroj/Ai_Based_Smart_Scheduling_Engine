import os, sys
sys.path.append(os.path.abspath('backend'))
from app.nlp_routes import *
try:
    from app.notifications import schedule_push_via_qstash
    print("SUCCESS")
except Exception as e:
    print("FAIL:", e)
