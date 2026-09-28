import sys
import os
import random
sys.path.append(os.path.join(os.getcwd(), 'backend', 'app'))
from activity import classify_activity, ClassifyRequest, SensorReading

for attempt in range(10):
    readings = []
    for i in range(128):
        readings.append(SensorReading(
            timestamp=i*0.02,
            accel_x=random.random()*10,
            accel_y=random.random()*10,
            accel_z=random.random()*10,
            gyro_x=random.random()*5,
            gyro_y=random.random()*5,
            gyro_z=random.random()*5
        ))
    req = ClassifyRequest(window_duration_sec=2.5, readings=readings)
    res = classify_activity(req)
    print(f"[{attempt}] {res.activity} - {res.confidence}")
