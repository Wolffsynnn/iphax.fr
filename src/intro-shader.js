// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — intro-shader.js
// Shader WebGL : pulsations radiales douces (santé mentale)
// ═══════════════════════════════════════════════════════════════════════════

(function() {
    let canvas, gl, program, raf;
    let startTime = 0;
    let running = false;
  
    const VERTEX_SHADER = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
  
    const FRAGMENT_SHADER = `
      precision highp float;
  
      uniform vec2  u_resolution;
      uniform float u_time;
  
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
  
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
  
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }
  
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float d = length(uv);
  
        float breath = 0.5 + 0.5 * sin(u_time * 0.6);
        float breath2 = 0.5 + 0.5 * sin(u_time * 0.25 + 1.5);
  
        float wave1 = sin(d * 8.0  - u_time * 1.5);
        float wave2 = sin(d * 16.0 - u_time * 2.5);
        float wave3 = sin(d * 24.0 - u_time * 3.8);
        float waves = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
  
        vec2 noiseUV = uv * 1.8;
        noiseUV.x += u_time * 0.03;
        noiseUV.y += u_time * 0.02;
        float n = fbm(noiseUV * 3.0);
  
        float distortion = n * 0.15;
        float dDistorted = d + distortion;
  
        float waveNeb = sin(dDistorted * 10.0 - u_time * 1.8);
  
        float falloff = exp(-d * 1.4);
        float center = smoothstep(0.0, 0.9, d);
        float intensity = falloff * (0.6 + waves * 0.4) * (0.7 + breath * 0.3);
  
        vec3 colDeep = vec3(0.01, 0.03, 0.10);
        vec3 colMid  = vec3(0.00, 0.25, 0.50);
        vec3 colCyan = vec3(0.00, 0.85, 1.00);
        vec3 colGlow = vec3(0.40, 1.00, 1.00);
  
        vec3 color = colDeep;
        color = mix(color, colMid, intensity);
        color = mix(color, colCyan, pow(intensity, 2.0) * 0.8);
        color = mix(color, colGlow, pow(intensity, 5.0) * breath2);
  
        float nebulaGlow = smoothstep(0.4, 0.9, n) * falloff;
        color += colCyan * nebulaGlow * 0.35;
  
        float ring = sin(dDistorted * 4.0 - u_time * 1.2);
        ring = smoothstep(0.95, 1.0, ring);
        color += colGlow * ring * falloff * 0.4;
  
        color *= center;
        float vignette = 1.0 - smoothstep(0.7, 1.6, d);
        color *= vignette;
  
        float grain = hash(gl_FragCoord.xy + u_time) * 0.03 - 0.015;
        color += grain;
  
        color = pow(color, vec3(0.95));
  
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  
    function createShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }
  
    function createProgram(vsSource, fsSource) {
      const vs = createShader(gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(prog));
        return null;
      }
      return prog;
    }
  
    function createCanvas() {
      canvas = document.createElement('canvas');
      canvas.id = 'iphax-intro-shader';
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;' +
        'pointer-events:none;z-index:-1;';
      document.body.insertBefore(canvas, document.body.firstChild);
      gl = canvas.getContext('webgl', { alpha: false, antialias: false });
      if (!gl) {
        console.warn('WebGL non supporté, shader désactivé');
        canvas.remove();
        canvas = null;
        return;
      }
      resize();
      window.addEventListener('resize', resize);
  
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1, 1,
        -1, 1,   1, -1,  1, 1
      ]), gl.STATIC_DRAW);
  
      program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
      if (!program) return;
  
      gl.useProgram(program);
  
      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  
      program.u_resolution = gl.getUniformLocation(program, 'u_resolution');
      program.u_time = gl.getUniformLocation(program, 'u_time');
    }
  
    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  
    function render() {
      if (!running || !gl || !program) return;
      raf = requestAnimationFrame(render);
  
      const t = (performance.now() - startTime) / 1000;
      gl.uniform2f(program.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(program.u_time, t);
  
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  
    function updateVisibility() {
      if (!canvas) return;
      const introActive = document.getElementById('screen-intro')?.classList.contains('active');
      const authActive = document.getElementById('screen-auth')?.classList.contains('active');
      canvas.style.display = (introActive || authActive) ? 'block' : 'none';
    }
  
    function init() {
      createCanvas();
      if (!canvas) return;
  
      const observer = new MutationObserver(updateVisibility);
      const intro = document.getElementById('screen-intro');
      const auth = document.getElementById('screen-auth');
      if (intro) observer.observe(intro, { attributes: true, attributeFilter: ['class'] });
      if (auth) observer.observe(auth, { attributes: true, attributeFilter: ['class'] });
      updateVisibility();
  
      running = true;
      startTime = performance.now();
      render();
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
    } else {
      setTimeout(init, 200);
    }
  
    console.log('✅ intro-shader.js prêt');
  })();