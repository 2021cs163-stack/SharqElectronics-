import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, PerspectiveCamera, TorusKnot, Box } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Gear({ position, rotation, scale = 1, speed = 1 }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += 0.01 * speed;
    }
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <TorusKnot ref={meshRef} args={[1, 0.4, 128, 32, 2, 3]}>
        <MeshDistortMaterial
          color="hsl(207, 89%, 50%)"
          speed={2}
          distort={0.2}
          radius={1}
          metalness={0.9}
          roughness={0.1}
          emissive="hsl(207, 89%, 20%)"
          emissiveIntensity={0.5}
        />
      </TorusKnot>
    </group>
  );
}

function IndustrialCore() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <Gear position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1.2} speed={1} />
      <Gear position={[2, 1, -1]} rotation={[0, Math.PI / 4, 0]} scale={0.5} speed={-1.5} />
      <Gear position={[-2, -1, 1]} rotation={[Math.PI / 3, 0, Math.PI / 6]} scale={0.4} speed={2} />

      {/* Central "Shield" element */}
      <Box args={[0.5, 0.5, 0.5]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#ffffff" metalness={1} roughness={0} emissive="#3b82f6" emissiveIntensity={2} />
      </Box>
    </group>
  );
}

export function ToolScene() {
  return (
    <div className="h-[400px] w-full cursor-grab active:cursor-grabbing">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} />
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow color="#3b82f6" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
        <rectAreaLight width={10} height={10} position={[5, 5, 5]} intensity={2} color="#3b82f6" />

        <IndustrialCore />

        <OrbitControls enableZoom={false} makeDefault />
      </Canvas>
    </div>
  );
}
