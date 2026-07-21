import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

const VS = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/* Softer ambient orb — diffuse core + long falloff so it reads as room light, not a sticker. */
const FS = `precision highp float;
uniform float u_time;
uniform float u_energy;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 a0 = x - floor(x + 0.5);
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = v_texCoord;
  // Correct for non-square canvas so the glow stays circular.
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float dist = length(p);

  float energy = clamp(u_energy, 0.0, 1.0);
  float n = snoise(uv * 2.4 + u_time * (0.18 + energy * 0.45)) * (0.03 + energy * 0.05);

  // Soft core + wide halo (no hard cut).
  float core = exp(-pow(dist * (3.4 - energy * 0.9 + n), 2.0));
  float mid  = exp(-pow(dist * (2.0 - energy * 0.5), 2.0)) * 0.55;
  float halo = exp(-dist * (1.15 - energy * 0.25)) * (0.22 + energy * 0.28);

  // Vetta primary / teal (linear-ish approximations of #adc6ff / #4fdbc8)
  vec3 colorA = vec3(0.68, 0.78, 1.0);
  vec3 colorB = vec3(0.31, 0.86, 0.78);
  float mixT = 0.35 + energy * 0.4 + 0.15 * sin(u_time * (0.9 + energy));
  vec3 col = mix(colorA, colorB, clamp(mixT + n * 2.0, 0.0, 1.0));

  float field = core * 0.9 + mid + halo;
  float alpha = field * (0.42 + energy * 0.38);

  // Fade toward canvas edges so the orb dissolves into the stage.
  float edge = smoothstep(0.92, 0.35, length((uv - 0.5) * 1.65));
  alpha *= edge;

  gl_FragColor = vec4(col * field, alpha);
}`;

type Props = {
  energyRef: MutableRefObject<number>;
  aiSpeaking?: boolean;
  status?: string;
  className?: string;
};

export default function AgentNeuralOrb({
  energyRef,
  aiSpeaking = false,
  status = "listening",
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const energyLiveRef = energyRef;
  const speakingRef = useRef(aiSpeaking);
  speakingRef.current = aiSpeaking;
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) return undefined;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return undefined;

    const prog = gl.createProgram();
    if (!prog) return undefined;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uEnergy = gl.getUniformLocation(prog, "u_energy");
    const uRes = gl.getUniformLocation(prog, "u_resolution");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
    ro?.observe(canvas);
    syncSize();

    let raf = 0;
    const render = (t: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(render);
        return;
      }
      syncSize();
      const live = energyLiveRef.current;
      const energy = reducedMotion
        ? speakingRef.current
          ? 0.2
          : 0.07
        : live;
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uEnergy) gl.uniform1f(uEnergy, energy);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [energyLiveRef, reducedMotion]);

  const label =
    status === "thinking" ? "Processing…" : aiSpeaking ? "Speaking" : "Listening";

  return (
    <div
      className={`ir-orb ${aiSpeaking ? "ir-orb--speaking" : ""} ${className}`.trim()}
      aria-live="polite"
      aria-label={`AI interviewer ${label.toLowerCase()}`}
    >
      <canvas ref={canvasRef} className="ir-orb__canvas" aria-hidden />
      <p className="ir-orb__status">{label}</p>
    </div>
  );
}
