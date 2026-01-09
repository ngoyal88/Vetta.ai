import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const AudioVisualizer = ({ isSpeaking = false, audioLevel = 0 }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const composerRef = useRef(null);
  const uniformsRef = useRef(null);
  const clockRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!window.WebGLRenderingContext) {
      setWebglOk(false);
      return;
    }

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, -2, 14);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup with guard
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      setWebglOk(true);
    } catch (err) {
      console.error('WebGL renderer init failed:', err);
      setWebglOk(false);
      return () => {};
    }

    // Shader uniforms
    const uniforms = {
      u_time: { type: 'f', value: 0.0 },
      u_frequency: { type: 'f', value: 0.0 },
      u_red: { type: 'f', value: 0.024 },   // Cyan color
      u_green: { type: 'f', value: 0.714 },
      u_blue: { type: 'f', value: 0.831 }
    };
    uniformsRef.current = uniforms;

    // Vertex shader with Perlin noise
    const vertexShader = `
      uniform float u_time;
      uniform float u_frequency;

      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+10.0)*x);
      }
      
      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      
      vec3 fade(vec3 t) {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
      }

      float pnoise(vec3 P, vec3 rep) {
        vec3 Pi0 = mod(floor(P), rep);
        vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P);
        vec3 Pf1 = Pf0 - vec3(1.0);
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
      }

      void main() {
        float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
        float displacement = (u_frequency / 30.0) * (noise / 10.0);
        vec3 newPosition = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;

    // Fragment shader
    const fragmentShader = `
      uniform float u_red;
      uniform float u_blue;
      uniform float u_green;
      
      void main() {
        gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1.0);
      }
    `;

    // Create material
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      wireframe: true
    });

    // Create geometry
    const geometry = new THREE.IcosahedronGeometry(4, 30);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Post-processing
    const renderScene = new RenderPass(scene, camera);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight)
    );
    bloomPass.threshold = 0.2;
    bloomPass.strength = 1.5;
    bloomPass.radius = 0.8;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    composerRef.current = composer;

    // Clock
    const clock = new THREE.Clock();
    clockRef.current = clock;

    // Mouse move handler
    const handleMouseMove = (e) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseRef.current.x = (e.clientX - windowHalfX) / 100;
      mouseRef.current.y = (e.clientY - windowHalfY) / 100;
    };

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      composer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;

      camera.position.x += (mouseRef.current.x - camera.position.x) * 0.05;
      camera.position.y += (-mouseRef.current.y - camera.position.y) * 0.05;
      camera.lookAt(scene.position);
      
      uniforms.u_time.value = clock.getElapsedTime();
      
      // Update frequency based on speaking state and audio level
      const targetFrequency = isSpeaking ? (audioLevel > 0 ? audioLevel * 50 : 30) : 5;
      uniforms.u_frequency.value += (targetFrequency - uniforms.u_frequency.value) * 0.1;
      
      composer.render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (containerRef.current && renderer?.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
    };
  }, []);

  // Update colors and frequency when speaking state changes
  useEffect(() => {
    if (uniformsRef.current) {
      // Cyan when speaking, slightly dimmer when not
      if (isSpeaking) {
        uniformsRef.current.u_red.value = 0.024;
        uniformsRef.current.u_green.value = 0.714;
        uniformsRef.current.u_blue.value = 0.831;
      } else {
        uniformsRef.current.u_red.value = 0.02;
        uniformsRef.current.u_green.value = 0.5;
        uniformsRef.current.u_blue.value = 0.6;
      }
    }
  }, [isSpeaking]);

  if (!webglOk) {
    // Lightweight fallback: animated radial gradient
    return (
      <div
        className="w-full h-full min-h-[300px] rounded-2xl bg-gradient-to-br from-cyan-900 via-slate-900 to-black border border-cyan-600/30 relative overflow-hidden"
      >
        <div className="absolute inset-0 animate-pulse" style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.25), transparent 45%), radial-gradient(circle at 70% 70%, rgba(99,102,241,0.25), transparent 50%)'
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-cyan-500/40 bg-cyan-500/10 animate-[pulse_2s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '300px'
      }} 
    />
  );
};

export default AudioVisualizer;