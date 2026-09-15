import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Mic, MicOff, X, Settings, Sparkles, Zap } from 'lucide-react';

/**
 * Helper to generate a soft glowing radial texture for points
 */
function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Organic3DVoiceEntity Component
 * Premium futuristic 3D energy field visualization.
 * 2200 particles, depth-based fading (80% subtle / 15% medium / 5% highlight),
 * fluid orbital strands, natural audio responsiveness, zero noisy central explosion.
 */
function Organic3DVoiceEntity({ isListening, isLoading, isSpeaking, micLevel }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 540;
    const height = container.clientHeight || 540;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.65);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const particleTexture = createParticleTexture();

    // 2. Controlled Particle Field (2200 particles following energy field structure)
    const particleCount = 2200;
    const geometry = new THREE.BufferGeometry();
    const basePositions = new Float32Array(particleCount * 3);
    const currentPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const baseColors = new Float32Array(particleCount * 3);
    const phaseOffsets = new Float32Array(particleCount);

    // Controlled color palette: Dominant Violet/Blue, Cyan, Soft Magenta, Rare Gold Accent
    const colorPalette = [
      new THREE.Color(0x7c3aed), // Violet (Dominant)
      new THREE.Color(0x3b82f6), // Electric Blue (Dominant)
      new THREE.Color(0x06b6d4), // Cyan
      new THREE.Color(0xc084fc), // Soft Magenta
      new THREE.Color(0xfacc15), // Subtle Gold Accent (~3% rare)
    ];

    const baseRadius = 1.15;

    for (let i = 0; i < particleCount; i++) {
      // Golden ratio spherical distribution for clean, intentional structure
      const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      // Tight radial distribution (clean boundary, no outer random scattering)
      const radialNoise = (Math.random() - 0.5) * 0.14;
      const r = baseRadius + radialNoise;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;

      currentPositions[i * 3] = x;
      currentPositions[i * 3 + 1] = y;
      currentPositions[i * 3 + 2] = z;

      phaseOffsets[i] = Math.random() * Math.PI * 2;

      // Selective color distribution: Dominant Violet/Blue
      const randColor = Math.random();
      let color;
      if (randColor > 0.97) {
        color = colorPalette[4]; // Gold highlight (~3%)
      } else if (randColor > 0.80) {
        color = colorPalette[3]; // Soft Magenta (~17%)
      } else if (randColor > 0.50) {
        color = colorPalette[2]; // Cyan (~30%)
      } else if (randColor > 0.25) {
        color = colorPalette[1]; // Electric Blue (~25%)
      } else {
        color = colorPalette[0]; // Violet (~25%)
      }

      // Controlled intensity hierarchy: 80% subtle, 15% medium, 5% highlight
      let intensity = 0.5 + Math.random() * 0.3; // Default 80% subtle
      if (randColor > 0.95) intensity = 1.0; // 5% bright highlight
      else if (randColor > 0.80) intensity = 0.75; // 15% medium

      baseColors[i * 3] = color.r * intensity;
      baseColors[i * 3 + 1] = color.g * intensity;
      baseColors[i * 3 + 2] = color.b * intensity;

      colors[i * 3] = baseColors[i * 3];
      colors[i * 3 + 1] = baseColors[i * 3 + 1];
      colors[i * 3 + 2] = baseColors[i * 3 + 2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.044,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleCloud = new THREE.Points(geometry, particleMaterial);
    scene.add(particleCloud);

    // 3. Subtle Flowing Energy Strands (Thinner, softer, less dominant)
    const strandCount = 12;
    const strandPointsPerRing = 80;
    const strandGroup = new THREE.Group();

    const strandMaterials = [];
    const strandGeometries = [];

    for (let s = 0; s < strandCount; s++) {
      const strandGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(strandPointsPerRing * 3);
      const colArray = new Float32Array(strandPointsPerRing * 3);

      const tiltAngleX = (s / strandCount) * Math.PI;
      const tiltAngleY = (s / strandCount) * Math.PI * 0.55;

      const strandColor = colorPalette[s % 3].clone().lerp(colorPalette[(s + 1) % 4], 0.3);

      for (let p = 0; p < strandPointsPerRing; p++) {
        const angle = (p / strandPointsPerRing) * Math.PI * 2;
        const sr = baseRadius * 0.98;

        const lx = Math.cos(angle) * sr;
        const ly = Math.sin(angle) * sr;

        const vec = new THREE.Vector3(lx, ly, 0);
        vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltAngleX);
        vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), tiltAngleY);

        posArray[p * 3] = vec.x;
        posArray[p * 3 + 1] = vec.y;
        posArray[p * 3 + 2] = vec.z;

        const fade = 0.3 + 0.5 * Math.sin((p / strandPointsPerRing) * Math.PI);
        colArray[p * 3] = strandColor.r * fade * 0.7;
        colArray[p * 3 + 1] = strandColor.g * fade * 0.7;
        colArray[p * 3 + 2] = strandColor.b * fade * 0.7;
      }

      strandGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      strandGeometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const lineMesh = new THREE.LineLoop(strandGeometry, mat);
      strandGroup.add(lineMesh);
      strandMaterials.push(mat);
      strandGeometries.push(strandGeometry);
    }

    scene.add(strandGroup);

    // 4. Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();
    let currentDeformFactor = 0;
    let targetDeform = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Audio reactivity & State modulation
      if (isSpeaking) {
        targetDeform = 0.35 + Math.sin(time * 5) * 0.12;
      } else if (isLoading) {
        targetDeform = 0.22 + Math.sin(time * 3) * 0.07;
      } else if (isListening) {
        targetDeform = 0.10 + micLevel * 0.45;
      } else {
        targetDeform = 0.05; // Gentle breathing in calm idle state
      }

      // Smooth lerp for liquid organic deformation
      currentDeformFactor += (targetDeform - currentDeformFactor) * 0.05;

      const posArr = geometry.attributes.position.array;
      const colArr = geometry.attributes.color.array;

      for (let i = 0; i < particleCount; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        const phase = phaseOffsets[i];

        // Multi-frequency wave flow around surface
        const wave1 = Math.sin(time * 1.5 + bx * 2.0 + phase) * 0.07;
        const wave2 = Math.cos(time * 1.8 + by * 2.0 + phase) * 0.07;
        const wave3 = Math.sin(time * 1.2 + bz * 2.0 + phase) * 0.05;

        const totalDeform = (wave1 + wave2 + wave3) * currentDeformFactor;

        const cx = bx * (1 + totalDeform);
        const cy = by * (1 + totalDeform);
        const cz = bz * (1 + totalDeform);

        posArr[i * 3] = cx;
        posArr[i * 3 + 1] = cy;
        posArr[i * 3 + 2] = cz;

        // Depth-based brightness modulation (Front = brighter, Back = dimmer)
        const depthFactor = THREE.MathUtils.clamp((cz + baseRadius) / (baseRadius * 2), 0.35, 1.0);
        colArr[i * 3] = baseColors[i * 3] * depthFactor;
        colArr[i * 3 + 1] = baseColors[i * 3 + 1] * depthFactor;
        colArr[i * 3 + 2] = baseColors[i * 3 + 2] * depthFactor;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;

      // Slow, serene rotation (no obvious planet spin)
      const rotSpeed = 0.08 + currentDeformFactor * 0.12;
      particleCloud.rotation.y = time * rotSpeed;
      particleCloud.rotation.x = Math.sin(time * 0.1) * 0.1;

      strandGroup.rotation.y = time * (rotSpeed * 0.8);
      strandGroup.rotation.z = Math.cos(time * 0.08) * 0.08;

      // Deform strand geometries subtly
      strandGroup.children.forEach((mesh, index) => {
        const strandGeo = mesh.geometry;
        const sPosArr = strandGeo.attributes.position.array;
        const tiltAngleX = (index / strandCount) * Math.PI;

        for (let p = 0; p < strandPointsPerRing; p++) {
          const angle = (p / strandPointsPerRing) * Math.PI * 2;
          const wave = Math.sin(angle * 3.0 + time * 2.0 + index) * 0.05 * (0.5 + currentDeformFactor);
          const sr = baseRadius * (0.98 + wave);

          const lx = Math.cos(angle) * sr;
          const ly = Math.sin(angle) * sr;

          const vec = new THREE.Vector3(lx, ly, 0);
          vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltAngleX);
          vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), (index / strandCount) * Math.PI * 0.55);

          sPosArr[p * 3] = vec.x;
          sPosArr[p * 3 + 1] = vec.y;
          sPosArr[p * 3 + 2] = vec.z;
        }
        strandGeo.attributes.position.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };

    animate();

    // 5. Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 540;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      strandGeometries.forEach(g => g.dispose());
      strandMaterials.forEach(m => m.dispose());
      renderer.dispose();
    };
  }, [isListening, isLoading, isSpeaking, micLevel]);

  return <div ref={mountRef} className="w-full h-full relative" />;
}

/**
 * TaskPulse 2-Way Voice Interaction UI
 * Refined, futuristic, ultra-clean voice assistant UI.
 */
export default function ChatGPTVoiceOrb({
  isListening,
  isLoading,
  isSpeaking,
  latestTranscript,
  latestAiResponse,
  selectedVoiceURI,
  onVoiceChange,
  onToggleMic,
  onCloseVoiceMode
}) {
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  const neuralVoices = [
    { uri: 'en-US-AvaNeural', name: 'Ava (Warm Female - Recommended)' },
    { uri: 'en-US-EmmaNeural', name: 'Emma (Natural Soft Female)' },
    { uri: 'en-US-JennyNeural', name: 'Jenny (Professional Female)' },
    { uri: 'en-US-AndrewNeural', name: 'Andrew (Warm Male)' },
    { uri: 'en-US-BrianNeural', name: 'Brian (Deep Male)' },
  ];

  useEffect(() => {
    let interval;
    if (isListening || isSpeaking) {
      interval = setInterval(() => {
        setMicAudioLevel(Math.random() * 0.4 + 0.3);
      }, 90);
    } else {
      setMicAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  let stateLabel = 'Listening...';
  let dotColor = 'bg-cyan-400';
  let stateBadgeStyle = 'border-cyan-500/25 text-cyan-200 bg-slate-950/80 shadow-cyan-950/40';

  if (isLoading) {
    stateLabel = 'Thinking...';
    dotColor = 'bg-violet-400';
    stateBadgeStyle = 'border-violet-500/25 text-violet-200 bg-slate-950/80 shadow-violet-950/40';
  } else if (isSpeaking) {
    stateLabel = 'Speaking...';
    dotColor = 'bg-blue-400';
    stateBadgeStyle = 'border-blue-500/25 text-blue-200 bg-slate-950/80 shadow-blue-950/40';
  } else if (isListening) {
    stateLabel = 'Listening...';
    dotColor = 'bg-cyan-400';
    stateBadgeStyle = 'border-cyan-500/25 text-cyan-200 bg-slate-950/80 shadow-cyan-950/40';
  }

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex flex-col justify-between bg-[#000000] text-white select-none overflow-hidden animate-in fade-in duration-500 font-sans">
      
      {/* Soft Ambient Radial Background Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-purple-950/10 to-transparent opacity-80" />

      {/* 1. Header Bar */}
      <div className="w-full px-8 py-5 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-md">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tracking-wide text-slate-200">
              TaskPulse Voice
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
              2-WAY VOICE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVoicePicker(!showVoicePicker)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-2 transition-all backdrop-blur-md shadow-sm"
            title="Select AI Voice"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Voice: {neuralVoices.find(v => v.uri === selectedVoiceURI)?.name.split(' ')[0] || 'Ava'}</span>
          </button>

          <button
            onClick={onCloseVoiceMode}
            className="p-2 rounded-full bg-slate-900/80 hover:bg-red-950/30 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-300 transition-all backdrop-blur-md shadow-sm"
            title="Exit Voice Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Voice Selection Dropdown */}
      {showVoicePicker && (
        <div className="absolute top-18 right-8 z-50 w-72 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl p-3 backdrop-blur-2xl animate-in fade-in duration-200">
          <h4 className="text-[10px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider mb-1">AI Voice Model</h4>
          <div className="space-y-1">
            {neuralVoices.map(voice => (
              <button
                key={voice.uri}
                onClick={() => {
                  onVoiceChange(voice.uri);
                  setShowVoicePicker(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                  selectedVoiceURI === voice.uri
                    ? 'bg-indigo-900/40 border border-indigo-500/30 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-900/80'
                }`}
              >
                <span>{voice.name}</span>
                {selectedVoiceURI === voice.uri && <Sparkles className="w-3.5 h-3.5 text-indigo-300" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Centered Content (Visualization + Status + Transcript) */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-4xl mx-auto px-4 pointer-events-none">
        
        {/* Floating 3D Visualization Entity */}
        <div 
          onClick={onToggleMic}
          className="w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] md:w-[540px] md:h-[540px] max-h-[56vh] relative flex items-center justify-center cursor-pointer pointer-events-auto transition-transform duration-300 hover:scale-[1.01]"
        >
          {/* Subtle halo glow behind sphere */}
          <div className="absolute w-[75%] h-[75%] rounded-full bg-gradient-to-r from-blue-600/15 via-purple-600/15 to-transparent blur-3xl pointer-events-none opacity-60" />

          <Organic3DVoiceEntity
            isListening={isListening}
            isLoading={isLoading}
            isSpeaking={isSpeaking}
            micLevel={micAudioLevel}
          />
        </div>

        {/* Compact Status Indicator Pill (Sitting directly below visualization) */}
        <div className="mt-5 mb-2">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[11px] font-medium tracking-wide backdrop-blur-xl transition-all duration-300 shadow-lg ${stateBadgeStyle}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-ping`} />
            <span>{stateLabel}</span>
          </div>
        </div>

        {/* Minimal Subtitle / Live Transcript Bubble */}
        <div className="w-full max-w-lg min-h-[40px] flex items-center justify-center text-center px-4">
          {latestTranscript && (
            <div className="text-xs font-normal text-slate-300 bg-slate-950/70 px-4 py-1.5 rounded-xl border border-slate-800/70 shadow-lg backdrop-blur-md animate-in fade-in duration-300">
              <span className="text-indigo-400 font-medium mr-2">You</span>
              <span className="text-slate-400 mr-1">"</span>
              <span>{latestTranscript}</span>
              <span className="text-slate-400 ml-0.5">"</span>
            </div>
          )}

          {!latestTranscript && latestAiResponse && (
            <div className="text-xs font-normal text-slate-300 bg-slate-950/70 px-4 py-1.5 rounded-xl border border-slate-800/70 shadow-lg backdrop-blur-md animate-in fade-in duration-300 line-clamp-2">
              <span className="text-cyan-400 font-medium mr-2">TaskPulse</span>
              <span>{latestAiResponse.replace(/```json[\s\S]*?```/gi, '').trim()}</span>
            </div>
          )}

          {!latestTranscript && !latestAiResponse && (
            <p className="text-[11px] text-slate-500 font-light tracking-wide">
              Tap visualization or speak naturally
            </p>
          )}
        </div>
      </div>

      {/* 3. Floating Bottom Controls (Lifted slightly, clear primary/secondary spacing) */}
      <div className="w-full pb-12 pt-3 flex items-center justify-center gap-7 z-20 pointer-events-auto">
        {/* Primary 64px Microphone Button */}
        <button
          onClick={onToggleMic}
          className={`rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 border backdrop-blur-xl relative group ${
            isListening
              ? 'bg-slate-950/85 border-cyan-500/40 text-cyan-300 shadow-cyan-950/40 ring-2 ring-cyan-500/20'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
          }`}
          style={{ width: '64px', height: '64px' }}
          title={isListening ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-60 pointer-events-none" />
          )}
          {isListening ? (
            <Mic className="w-6 h-6 text-cyan-400 animate-pulse" />
          ) : (
            <MicOff className="w-6 h-6 text-slate-400 group-hover:text-slate-200" />
          )}
        </button>

        {/* Secondary 48px Close Button */}
        <button
          onClick={onCloseVoiceMode}
          className="rounded-full bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700 flex items-center justify-center transition-all shadow-xl backdrop-blur-xl"
          style={{ width: '48px', height: '48px' }}
          title="Exit Voice Mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
