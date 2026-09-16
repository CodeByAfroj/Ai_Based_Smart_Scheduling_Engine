import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend', 'app'))
from activity import classify_activity, ClassifyRequest, SensorReading

req = ClassifyRequest(
    window_duration_sec=2.5,
    readings=[
        SensorReading(timestamp=123, accel_x=1, accel_y=2, accel_z=3, gyro_x=0, gyro_y=0, gyro_z=0),
        SensorReading(timestamp=124, accel_x=1, accel_y=2, accel_z=3, gyro_x=0, gyro_y=0, gyro_z=0)
    ]
)

try:
    res = classify_activity(req)
    print("Success:", res)
except Exception as e:
    print("Error:", e)
