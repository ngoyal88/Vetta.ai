import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GRID_SIZE = 24;
const SPACING = 0.32;

const AudioVisualizer = ({ isSpeaking = false, audioLevel = 0 }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const pointsRef = useRef(null);
  const composerRef = useRef(null);
  const uniformsRef = useRef(null);
  const clockRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isSpeakingRef = useRef(isSpeaking);
  const audioLevelRef = useRef(audioLevel);
  const [webglOk, setWebglOk] = useState(true);

  isSpeakingRef.current = isSpeaking;
  audioLevelRef.current = audioLevel;

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    let rendererForCleanup = null;

    if (!window.WebGLRenderingContext) {
      setWebglOk(false);
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      containerEl.clientWidth / containerEl.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      containerEl.appendChild(renderer.domElement);
      rendererForCleanup = renderer;
      rendererRef.current = renderer;
      setWebglOk(true);
    } catch (err) {
      console.error('WebGL renderer init failed:', err);
      setWebglOk(false);
      return () => {};
    }

    const positions = [];
    const half = (GRID_SIZE * SPACING) / 2;
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        positions.push(-half + i * SPACING, -half + j * SPACING, 0);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const uniforms = {
      u_time: { value: 0 },
      u_speech: { value: 0 },
      u_red: { value: 0.024 },
      u_green: { value: 0.714 },
      u_blue: { value: 0.831 },
    };
    uniformsRef.current = uniforms;

    const vertexShader = `
      uniform float u_time;
      uniform float u_speech;
      attribute vec3 position;
      void main() {
        vec3 pos = position;
        float wave = sin(pos.x * 2.0 + u_time) * cos(pos.y * 2.0 + u_time * 0.7);
        float z = pos.z + u_speech * wave * 1.2;
        vec4 mv = modelViewMatrix * vec4(pos.x, pos.y, z, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 4.0 + u_speech * 2.0;
      }
    `;
    const fragmentShader = `
      uniform float u_red;
      uniform float u_green;
      uniform float u_blue;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(u_red, u_green, u_blue, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerEl.clientWidth, containerEl.clientHeight)
    );
    bloomPass.threshold = 0.3;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.6;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    const clock = new THREE.Clock();
    clockRef.current = clock;

    const handleResize = () => {
      if (!containerEl) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      bloomPass.resolution.set(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      if (!sceneRef.current) return;
      const t = clock.getElapsedTime();
      uniforms.u_time.value = t;
      const speaking = isSpeakingRef.current;
      const level = audioLevelRef.current;
      const target = speaking ? (level > 0 ? level * 0.8 + 0.2 : 0.5) : 0;
      uniforms.u_speech.value += (target - uniforms.u_speech.value) * 0.08;
      composer.render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (containerEl && rendererForCleanup?.domElement) containerEl.removeChild(rendererForCleanup.domElement);
      geometry.dispose();
      material.dispose();
      rendererForCleanup?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setup runs once; isSpeaking/audioLevel read via refs in animation loop
  }, []);

  useEffect(() => {
    if (!uniformsRef.current) return;
    if (isSpeaking) {
      uniformsRef.current.u_red.value = 0.024;
      uniformsRef.current.u_green.value = 0.714;
      uniformsRef.current.u_blue.value = 0.831;
    } else {
      uniformsRef.current.u_red.value = 0.02;
      uniformsRef.current.u_green.value = 0.5;
      uniformsRef.current.u_blue.value = 0.6;
    }
  }, [isSpeaking]);

  if (!webglOk) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-2xl bg-gradient-to-br from-cyan-900 via-slate-900 to-black border border-cyan-600/30 relative overflow-hidden">
        <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.25), transparent 45%)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-cyan-500/40 bg-cyan-500/10 animate-[pulse_2s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />
  );
};

export default AudioVisualizer;
