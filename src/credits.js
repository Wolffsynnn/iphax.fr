// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — credits.js
// Écran de crédits animé (défilement vertical + shader de fond)
// ═══════════════════════════════════════════════════════════════════════════

(function() {
    const CREDITS_DATA = [
      { type: 'title',  text: 'IPHAX' },
      { type: 'space' },
  
      { type: 'sub',    text: 'Un projet de' },
      { type: 'big',    text: 'Moonlight Studio' },
      { type: 'sub',    text: '&' },
      { type: 'big',    text: 'RAPTOR' },
      { type: 'space' },
      { type: 'space' },
  
      { type: 'section', text: 'FONDATEURS' },
      { type: 'name',    text: 'ti.wxs' },
      { type: 'name',    text: 'Maelys.rpt' },
      { type: 'name',    text: 'Marie' },
      { type: 'space' },
  
      { type: 'section', text: 'DIRECTION' },
      { type: 'line',    text: 'Directeur : Marie / Maelys.rpt' },
      { type: 'line',    text: 'Co-directeur : Ana' },
      { type: 'space' },
  
      { type: 'section', text: 'DÉVELOPPEMENT' },
      { type: 'line',    text: 'Développeur principal : ti.wxs / elt.ntss' },
      { type: 'line',    text: 'Développeur front-end : Moonlight Studio' },
      { type: 'line',    text: 'Développeur back-end : Moonlight Studio' },
      { type: 'line',    text: 'DevOps : elt.ntss' },
      { type: 'space' },
  
      { type: 'section', text: 'DESIGN' },
      { type: 'line',    text: 'UI Designer : Anonyme' },
      { type: 'line',    text: 'UX Designer : Anonyme' },
      { type: 'line',    text: 'Illustrateur : Anonyme' },
      { type: 'line',    text: 'Logo & identité : Anonyme' },
      { type: 'space' },
  
      { type: 'section', text: 'ÉQUIPE ÉCOUTE' },
      { type: 'line',    text: 'Responsable écoutant : maelys.rptt' },
      { type: 'line',    text: 'Superviseurs : maelys.rpt' },
      { type: 'space' },
  
      { type: 'section', text: 'MODÉRATION & ADMIN' },
      { type: 'line',    text: 'Administrateurs : Marie' },
      { type: 'line',    text: 'Modérateurs : x' },
      { type: 'space' },
  
      { type: 'section', text: 'CONTENU & RESSOURCES' },
      { type: 'line',    text: 'Rédacteurs : ti.wxs' },
      { type: 'line',    text: 'Relecteurs : maelys.rpt' },
      { type: 'space' },
  
      { type: 'section', text: 'ANIMATION DU PROJET' },
      { type: 'line',    text: 'Community manager : philo_nts' },
      { type: 'line',    text: 'Réseaux sociaux : philo_nts' },
      { type: 'space' },
  
      { type: 'section', text: 'PARTENAIRES & SOUTIENS' },
      { type: 'name',    text: 'x' },
      { type: 'space' },
  
      { type: 'section', text: 'REMERCIEMENTS' },
      { type: 'thanks',  text: 'Merci à ti.wxs et elt.ntss pour la PWA fonctionnelle' },
      { type: 'thanks',  text: 'Merci à Maelys pour la gestion d\'équipe' },
      { type: 'thanks',  text: 'Merci à Philomène pour la gestion des réseaux sociaux, et de l\'image' },
      { type: 'space' },
  
      { type: 'section', text: 'TECHNOLOGIES' },
      { type: 'name',    text: 'Firebase' },
      { type: 'name',    text: 'Three.js' },
      { type: 'name',    text: 'WebGL & GLSL' },
      { type: 'name',    text: 'Inter Font' },
      { type: 'space' },
  
      { type: 'section', text: 'VERSION' },
      { type: 'big',     text: 'Bêta v1.0' },
      { type: 'space' },
      { type: 'space' },
  
      { type: 'thanks',  text: 'Merci d\'être là 💙' },
      { type: 'thanks',  text: 'Ici, quelqu\'un t\'écoute' },
      { type: 'space' },
      { type: 'space' },
      { type: 'space' }
    ];
  
    let screen, scroller, skipBtn, shaderCanvas;
    let raf, gl, program, startTime;
    let scrollY = 0;
    let running = false;
    let autoScrollSpeed = 1.8; // ⚡ pixels par frame (était 0.6 → 3x plus rapide)
    let onDoneCallback = null;
  
    const VERTEX_SHADER = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `;
  
    const FRAGMENT_SHADER = `
      precision mediump float;
      uniform vec2  u_resolution;
      uniform float u_time;
  
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float d = length(uv);
        float t = u_time;
  
        float wave = sin(d * 8.0 - t * 1.5) * 0.5 + sin(d * 16.0 - t * 2.5) * 0.3;
  
        vec3 col1 = vec3(0.01, 0.03, 0.10);
        vec3 col2 = vec3(0.00, 0.20, 0.45);
        vec3 col3 = vec3(0.00, 0.80, 1.00);
  
        float intensity = exp(-d * 1.5) * (0.5 + wave * 0.5);
        vec3 color = mix(col1, col2, intensity);
        color = mix(color, col3, pow(intensity, 3.0));
  
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  
    function createShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
  
    function createProgram(vs, fs) {
      const v = createShader(gl.VERTEX_SHADER, vs);
      const f = createShader(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('Link error:', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }
  
    function setupShader() {
      shaderCanvas = document.createElement('canvas');
      shaderCanvas.className = 'credits-shader';
      shaderCanvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;' +
        'pointer-events:none;z-index:0;';
      screen.insertBefore(shaderCanvas, screen.firstChild);
      gl = shaderCanvas.getContext('webgl', { alpha: false, antialias: false });
      if (!gl) { shaderCanvas.remove(); return; }
  
      resizeShader();
      window.addEventListener('resize', resizeShader);
  
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1
      ]), gl.STATIC_DRAW);
  
      program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
      if (!program) return;
      gl.useProgram(program);
  
      const loc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  
      program.u_resolution = gl.getUniformLocation(program, 'u_resolution');
      program.u_time = gl.getUniformLocation(program, 'u_time');
  
      startTime = performance.now();
    }
  
    function resizeShader() {
      if (!gl || !shaderCanvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      shaderCanvas.width = shaderCanvas.clientWidth * dpr;
      shaderCanvas.height = shaderCanvas.clientHeight * dpr;
      gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
    }
  
    function renderShader() {
      if (!gl || !program || !running) return;
      const t = (performance.now() - startTime) / 1000;
      gl.uniform2f(program.u_resolution, shaderCanvas.width, shaderCanvas.height);
      gl.uniform1f(program.u_time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  
    function buildCredits() {
      scroller = document.createElement('div');
      scroller.className = 'credits-scroller';
      scroller.innerHTML = CREDITS_DATA.map(item => {
        if (item.type === 'space')   return '<div class="credits-space"></div>';
        if (item.type === 'title')   return `<div class="credits-title">${item.text}</div>`;
        if (item.type === 'section') return `<div class="credits-section">${item.text}</div>`;
        if (item.type === 'big')     return `<div class="credits-big">${item.text}</div>`;
        if (item.type === 'name')    return `<div class="credits-name">${item.text}</div>`;
        if (item.type === 'sub')     return `<div class="credits-sub">${item.text}</div>`;
        if (item.type === 'thanks')  return `<div class="credits-thanks">${item.text}</div>`;
        return `<div class="credits-line">${item.text}</div>`;
      }).join('');
      screen.appendChild(scroller);
    }
  
    function animate() {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      renderShader();
  
      scrollY += autoScrollSpeed;
      scroller.style.transform = `translate3d(0, ${-scrollY}px, 0)`;
  
      const totalHeight = scroller.scrollHeight;
      if (scrollY > totalHeight + 100) {
        finish();
      }
    }
  
    function finish() {
      if (!running) return;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (screen) {
        screen.classList.remove('active');
        screen.style.display = 'none';
      }
      if (onDoneCallback) onDoneCallback();
    }
  
    function createScreen() {
      screen = document.createElement('section');
      screen.id = 'screen-credits';
      screen.className = 'screen';
      screen.style.cssText = 'position:fixed;inset:0;z-index:100;overflow:hidden;background:#000;';
  
      skipBtn = document.createElement('button');
      skipBtn.className = 'credits-skip';
      skipBtn.type = 'button';
      skipBtn.textContent = 'Passer →';
      skipBtn.addEventListener('click', finish);
      screen.appendChild(skipBtn);
  
      document.body.appendChild(screen);
    }
  
    window.iphaxCredits = {
      show: function(onDone) {
        onDoneCallback = onDone || function() {};
        if (!screen) createScreen();
        screen.style.display = 'block';
        screen.classList.add('active');
        // Reset
        scrollY = 0;
        if (scroller) scroller.remove();
        buildCredits();
        scroller.style.transform = 'translate3d(0, 0, 0)';
        if (!gl) setupShader();
        running = true;
        startTime = performance.now();
        animate();
      },
      finish: finish
    };
  
    console.log('✅ credits.js prêt');
  })();