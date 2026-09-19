import os
import sys
sys.path.append(os.path.abspath('backend'))
from app.nlp_routes import *
from app.notifications import schedule_push_via_qstash
print("Import successful!")
