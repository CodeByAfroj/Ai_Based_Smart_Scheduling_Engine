import React, { useMemo, useRef } from "react";
import { useTasks } from "../contexts/TaskContext";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Sparkles, ContactShadows, SoftShadows } from "@react-three/drei";
import { motion } from "framer-motion-3d";
import * as THREE from 'three';

// Procedural random
function seededRandom(s) {
  return function() {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

// Organic Branch Component
const Branch = ({ position, rotation, length, radius, level, maxLevel, delay, taskNodes, isBlossom, isLeaf }) => {
  const meshRef = useRef();

  return (
    <motion.group 
      position={position} 
      rotation={rotation}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 1.5, type: 'spring', bounce: 0.3, delay: delay }}
    >
      {/* Branch stem */}
      <mesh position={[0, length / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.7, radius, length, 12, 1, false]} />
        <meshStandardMaterial 
          color={new THREE.Color("#4a3628").lerp(new THREE.Color("#2d1f15"), level / maxLevel)} 
          roughness={0.9} 
          metalness={0.1} 
        />
      </mesh>
      
      {/* Joint */}
      <mesh position={[0, length, 0]} castShadow>
        <sphereGeometry args={[radius * 0.8, 12, 12]} />
        <meshStandardMaterial color="#4a3628" roughness={0.9} />
      </mesh>

      {/* Children or leaves/blossoms */}
      {level < maxLevel && taskNodes && taskNodes.length > 0 && (
        <group position={[0, length, 0]}>
          {taskNodes.map((child, i) => (
             <Branch 
               key={i}
               position={[0, 0, 0]}
               rotation={child.rotation}
               length={child.length}
               radius={child.radius}
               level={level + 1}
               maxLevel={maxLevel}
               delay={delay + 0.2 + (i * 0.1)}
               taskNodes={child.children}
               isBlossom={child.isBlossom}
               isLeaf={child.isLeaf}
             />
          ))}
        </group>
      )}

      {/* Leaf or Blossom at the tip */}
      {isBlossom && level >= maxLevel && (
        <motion.group
          position={[0, length, 0]}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, type: 'spring', delay: delay + 0.5 }}
        >
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            {/* Glowing Blossom */}
            <mesh castShadow>
               <sphereGeometry args={[radius * 4, 16, 16]} />
               <meshStandardMaterial color="#ff7b9c" emissive="#ff477e" emissiveIntensity={0.4} roughness={0.2} toneMapped={false} />
            </mesh>
            <pointLight color="#ff7b9c" intensity={0.5} distance={2} />
          </Float>
        </motion.group>
      )}

      {isLeaf && level >= maxLevel && !isBlossom && (
        <motion.group
          position={[0, length, 0]}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, type: 'spring', delay: delay + 0.4 }}
        >
          <mesh castShadow rotation={[Math.PI / 4, Math.PI / 4, 0]}>
             <cylinderGeometry args={[0, radius * 3, radius * 6, 4]} />
             <meshStandardMaterial color="#4ade80" roughness={0.6} />
          </mesh>
        </motion.group>
      )}
    </motion.group>
  );
};

// Tree Generator
function generateTreeStructure(tasks) {
  const seed = 12345;
  const rand = seededRandom(seed);
  
  const completed = tasks.filter(t => t.status === 'completed');
  if (completed.length === 0) return null;

  // Distribute tasks across a fractal structure
  // Base trunk
  const root = {
    rotation: [0, 0, 0],
    length: 2,
    radius: 0.3,
    isLeaf: false,
    isBlossom: false,
    children: []
  };

  let currentNodes = [root];
  
  completed.forEach((task, index) => {
    // Priority dictates what it becomes
    const isBlossom = task.priority >= 4;
    const isBranch = task.priority >= 2 && task.priority < 4;
    const isLeaf = task.priority < 2;

    // Pick a random leaf/empty node to append to
    const targetNode = currentNodes[Math.floor(rand() * currentNodes.length)];
    
    const angleX = (rand() - 0.5) * Math.PI * 0.8;
    const angleZ = (rand() - 0.5) * Math.PI * 0.8;
    const childLen = targetNode.length * 0.8;
    const childRad = targetNode.radius * 0.75;

    const newNode = {
      rotation: [angleX, 0, angleZ],
      length: childLen,
      radius: childRad,
      isLeaf: isLeaf,
      isBlossom: isBlossom,
      children: []
    };

    targetNode.children.push(newNode);
    
    if (isBranch) {
      currentNodes.push(newNode); // Only branches can have more children
    }
  });

  return root;
}

const AnimatedTree = ({ tasks }) => {
  const treeData = useMemo(() => generateTreeStructure(tasks), [tasks]);
  const group = useRef();

  useFrame((state) => {
    if (group.current) {
      // Gentle wind swaying
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
      group.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.4) * 0.02;
    }
  });

  if (!treeData) return (
    <Text position={[0, 1, 0]} color="#94A69A" fontSize={0.2} anchorX="center" anchorY="middle">
       A seed, waiting to be planted. Complete a task to start growing.
    </Text>
  );

  return (
    <group ref={group} position={[0, -2, 0]}>
      <Branch 
        position={[0,0,0]} 
        rotation={treeData.rotation}
        length={treeData.length}
        radius={treeData.radius}
        level={0}
        maxLevel={10}
        delay={0.1}
        taskNodes={treeData.children}
        isBlossom={treeData.isBlossom}
        isLeaf={treeData.isLeaf}
      />
      <Sparkles count={50} scale={5} size={2} speed={0.4} opacity={0.2} color="#ffeb3b" position={[0, 3, 0]} />
    </group>
  );
};

// --- Helper Text Component so we don't import another huge lib for just one text ---
import { Text } from '@react-three/drei';

export default function Analytics() {
  const { tasks, loadingTasks } = useTasks();

  if (loadingTasks) return <div className="p-10 text-center text-white">Loading your 3D world...</div>;

  return (
    <div className="w-full h-[100dvh] bg-gradient-to-b from-[#091216] to-[#04080a] relative overflow-hidden">
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none flex flex-col items-center">
         <h1 className="text-3xl md:text-4xl font-bold text-white/90 drop-shadow-md tracking-tight mb-2 font-serif italic">Your Tree Remembers</h1>
         <p className="text-white/60 text-sm max-w-md text-center">
            Completed tasks manifest visually. Small tasks sprout leaves. Moderate efforts branch out. High-priority tasks bloom into glowing blossoms.
         </p>
      </div>
      
      <div className="absolute bottom-8 right-8 z-10 pointer-events-none text-right hidden sm:block">
         <p className="text-white/40 text-xs tracking-widest uppercase">Drag to rotate • Scroll to zoom</p>
      </div>

      {/* 3D Canvas */}
      <Canvas 
         camera={{ position: [0, 2, 8], fov: 45 }}
         className="w-full h-full cursor-grab active:cursor-grabbing"
         shadows
      >
        <SoftShadows size={20} samples={16} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
           position={[5, 10, 5]} 
           intensity={1} 
           castShadow 
           shadow-mapSize={1024}
           shadow-bias={-0.001}
        />
        <pointLight position={[-5, 5, -5]} intensity={0.5} color="#4ade80" />
        
        <AnimatedTree tasks={tasks} />

        {/* Environment and Ground */}
        <ContactShadows position={[0, -2, 0]} opacity={0.7} scale={10} blur={2} far={4} />
        <mesh position={[0, -2.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
           <planeGeometry args={[50, 50]} />
           <meshStandardMaterial color="#06120d" roughness={1} />
        </mesh>
        
        <Environment preset="night" />
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 2 + 0.1}
          minDistance={3}
          maxDistance={12}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
