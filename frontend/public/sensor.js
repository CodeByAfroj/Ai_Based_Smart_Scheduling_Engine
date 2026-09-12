/**
 * Sensor collection and local ONNX inference logic
 */
let isCollecting = false;
let session = null;
let labelMapping = null;
const WINDOW_SIZE_MS = 2560; // ~2.5 seconds
const SAMPLE_RATE_HZ = 50.0;
let readings = [];

async function loadModels() {
    try {
        // We will fetch the label mapping from the backend, or we could hardcode it.
        // Let's assume we can fetch it from our backend running on localhost:8000 for this demo
        const mappingRes = await fetch('http://localhost:8000/activity_classifier/model/label_mapping.json');
        if (mappingRes.ok) {
            labelMapping = await mappingRes.json();
        } else {
            console.warn("Could not load mapping from backend, using default.");
            labelMapping = {
                "walking": "free", "sitting": "free", "standing": "free", "driving": "busy", "riding_vehicle": "busy"
            };
        }
        
        // Load ONNX model
        // Note: the .onnx file must be served statically. We assume the backend serves it or it's placed in public.
        // For this demo, since train.py places it in backend/activity_classifier/model, we will just fallback 
        // to backend classification if it's not present locally, or try to load from a known URL.
        try {
            session = await ort.InferenceSession.create('http://localhost:8000/activity_rf.onnx');
            console.log('ONNX model loaded successfully');
        } catch (e) {
            console.warn('Could not load ONNX model directly, will fallback to backend inference.', e);
        }
        
    } catch (err) {
        console.error("Error initializing models:", err);
    }
}

async function requestPermissions() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permissionState = await DeviceMotionEvent.requestPermission();
        return permissionState === 'granted';
    }
    return true; // Non-iOS 13+ devices
}

function handleMotion(event) {
    if (!isCollecting) return;
    
    // We expect accel in m/s^2. event.accelerationIncludingGravity or event.acceleration
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    
    const gyro = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
    
    readings.push({
        timestamp: Date.now(),
        accel_x: acc.x || 0,
        accel_y: acc.y || 0,
        accel_z: acc.z || 0,
        gyro_x: gyro.alpha || 0,
        gyro_y: gyro.beta || 0,
        gyro_z: gyro.gamma || 0
    });
}

async function processWindow() {
    if (readings.length === 0) return;
    
    const windowReadings = [...readings];
    readings = []; // Reset for next window
    
    // 1. Convert to 2D array [ [ax, ay, az, gx, gy, gz], ... ]
    const data = windowReadings.map(r => [
        r.accel_x, r.accel_y, r.accel_z, r.gyro_x, r.gyro_y, r.gyro_z
    ]);
    
    // 2. Extract features locally
    const features = window.computeFeatures(data, SAMPLE_RATE_HZ);
    
    if (features.length === 0) return;
    
    // 3. Try ONNX locally
    if (session) {
        try {
            const tensor = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);
            const feeds = {};
            feeds[session.inputNames[0]] = tensor;
            
            const results = await session.run(feeds);
            // Result interpretation depends on sklearn2onnx conversion. Usually 'output_label' or similar.
            const outputLabel = results[session.outputNames[0]].data[0];
            
            let activity = String(outputLabel);
            // Some models output integers which we need to map to strings, but let's assume it outputs strings 
            // if we trained on string labels.
            
            const busy = labelMapping ? (labelMapping[activity] === 'busy') : false;
            
            if (window.updateGlobalState) {
                window.updateGlobalState(activity, busy);
            }
            return;
        } catch (e) {
            console.error("Local ONNX inference failed, falling back to server", e);
        }
    }
    
    // 4. Fallback to server
    try {
        const res = await fetch('http://localhost:8000/classify-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                window_duration_sec: WINDOW_SIZE_MS / 1000.0,
                readings: windowReadings
            })
        });
        
        if (res.ok) {
            const result = await res.json();
            if (window.updateGlobalState) {
                window.updateGlobalState(result.activity, result.busy);
            }
        }
    } catch (e) {
        console.error("Server fallback failed:", e);
    }
}

function initSensorLogic() {
    const startBtn = document.getElementById('start-sensors-btn');
    const statusDiv = document.getElementById('sensor-status');
    
    loadModels();
    
    startBtn.addEventListener('click', async () => {
        if (isCollecting) {
            isCollecting = false;
            startBtn.innerText = "Start Sensor Collection";
            statusDiv.innerText = "Stopped.";
            window.removeEventListener('devicemotion', handleMotion);
            return;
        }
        
        const granted = await requestPermissions();
        if (granted) {
            isCollecting = true;
            startBtn.innerText = "Stop Sensor Collection";
            statusDiv.innerText = "Collecting data...";
            window.addEventListener('devicemotion', handleMotion);
            
            // Start processing loop
            setInterval(() => {
                if (isCollecting) {
                    processWindow();
                }
            }, WINDOW_SIZE_MS);
        } else {
            statusDiv.innerText = "Permission denied.";
        }
    });
}

window.initSensorLogic = initSensorLogic;
