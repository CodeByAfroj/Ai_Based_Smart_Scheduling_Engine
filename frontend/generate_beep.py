import wave, struct, math, base64
sample_rate = 44100
duration = 0.5
frequency = 880.0
num_samples = int(sample_rate * duration)
with wave.open("beep.wav", "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sample_rate)
    for i in range(num_samples):
        value = int(32767.0 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
        w.writeframes(struct.pack('<h', value))

with open("beep.wav", "rb") as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')
    print("data:audio/wav;base64," + b64)
