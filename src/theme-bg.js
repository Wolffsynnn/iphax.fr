// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — theme-bg.js (Canvas 2D — feuilles réalistes)
// ═══════════════════════════════════════════════════════════════════════════

(function() {
    let canvas, ctx, raf, W, H;
    let running = false;
    let currentTheme = null;
  
    const THEME_COLORS = {
      iphax:  null,
      vert:   ['#0B5D31','#0F7A43','#1F8A57','#2BB673','#38D18A','#5ED8A0'],
      rouge:  null,
      rose:   null,
      violet: null,
      jaune:  null,
      orange: null
    };
  
    function createCanvas() {
      canvas = document.createElement('canvas');
      canvas.id = 'iphax-bg-canvas';
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;' +
        'pointer-events:none;z-index:0;';
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
  
    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = window.innerWidth;
      H = window.innerHeight;
    }
  
    // Assombrit ou éclaircit une couleur hex
    function shade(hex, factor) {
      const c = hex.replace('#', '');
      let r = parseInt(c.substring(0, 2), 16);
      let g = parseInt(c.substring(2, 4), 16);
      let b = parseInt(c.substring(4, 6), 16);
      r = Math.min(255, Math.max(0, Math.round(r * factor)));
      g = Math.min(255, Math.max(0, Math.round(g * factor)));
      b = Math.min(255, Math.max(0, Math.round(b * factor)));
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }
  
    // Dessine une feuille réaliste
    function drawLeaf(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = opacity;
  
      // Dégradé principal
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, shade(color, 1.15));
      grad.addColorStop(1, shade(color, 0.85));
  
      // Forme
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.7, -size * 0.6, size * 0.7, size * 0.6, 0, size);
      ctx.bezierCurveTo(-size * 0.7, size * 0.6, -size * 0.7, -size * 0.6, 0, -size);
      ctx.closePath();
      ctx.fill();
  
      // Nervure centrale
      ctx.strokeStyle = shade(color, 0.6);
      ctx.lineWidth = Math.max(0.7, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.95);
      ctx.lineTo(0, size * 0.95);
      ctx.stroke();
  
      // Nervures secondaires
      ctx.lineWidth = Math.max(0.4, size * 0.015);
      for (let i = 0; i < 4; i++) {
        const t = -0.7 + i * 0.4;
        const y0 = size * t;
        const y1 = y0 + size * 0.18;
        const spread = size * 0.35;
  
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(spread * 0.6, y0 + size * 0.05, spread, y1);
        ctx.stroke();
  
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(-spread * 0.6, y0 + size * 0.05, -spread, y1);
        ctx.stroke();
      }
  
      ctx.restore();
    }
  
    let particles = [];

    function makeParticle(colors) {
      return {
        x: Math.random() * W,
        y: Math.random() * -H,
        size: 12 + Math.random() * 22,
        vy: 0.5 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.01 + Math.random() * 0.02,
        swingAmplitude: 0.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.5 + Math.random() * 0.5
      };
    }
  
    function initParticles() {
      const colors = THEME_COLORS[currentTheme];
      if (!colors) { particles = []; return; }
  
      const count = Math.min(50, Math.floor((W * H) / 26000));
      particles = [];
      for (let i = 0; i < count; i++) {
        const p = makeParticle(colors);
        p.y = Math.random() * H;
        particles.push(p);
      }
    }
  
    function updateParticle(p) {
      p.swing += p.swingSpeed;
      p.x += p.vx + Math.sin(p.swing) * p.swingAmplitude * 0.3;
      p.y += p.vy;
      p.rot += p.rotSpeed;
  
      if (p.y > H + 50) {
        p.y = -50;
        p.x = Math.random() * W;
      }
      if (p.x < -50) p.x = W + 50;
      if (p.x > W + 50) p.x = -50;
    }
  
    function loop() {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, W, H);
  
      particles.forEach(p => {
        updateParticle(p);
        drawLeaf(p.x, p.y, p.size, p.rot, p.color, p.opacity);
      });
    }
  
    function applyTheme(themeId) {
      currentTheme = themeId;
      const themesAvecFeuilles = ['vert'];
      if (canvas) {
        canvas.style.display = themesAvecFeuilles.includes(themeId) ? 'block' : 'none';
      }
      initParticles();
    }
    
    function init() {
      createCanvas();
      applyTheme(document.body.dataset.theme || 'iphax');
      running = true;
      loop();
    }
  
    window.iphaxThemeBg = {
      init: init,
      apply: applyTheme
    };
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
    } else {
      setTimeout(init, 300);
    }
  
    console.log('✅ theme-bg.js (Canvas pur) prêt');
  })();