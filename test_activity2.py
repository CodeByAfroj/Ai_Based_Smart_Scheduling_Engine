import sys
import os
import random
sys.path.append(os.path.join(os.getcwd(), 'backend', 'app'))
from activity import classify_activity, ClassifyRequest, SensorReading

readings = []
for i in range(128):
    readings.append(SensorReading(
        timestamp=i*0.02,
        accel_x=random.random()*5,
        accel_y=random.random()*5,
        accel_z=random.random()*5 + 8,
        gyro_x=random.random()*2,
        gyro_y=random.random()*2,
        gyro_z=random.random()*2
    ))

req = ClassifyRequest(
    window_duration_sec=2.5,
    readings=readings
)

try:
    res = classify_activity(req)
    print("Success:", res)
except Exception as e:
    print("Error:", e)
