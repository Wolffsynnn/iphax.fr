// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — theme-bg.js (Canvas 2D — multi-thèmes)
// ═══════════════════════════════════════════════════════════════════════════

(function() {
    let canvas, ctx, raf, W, H;
    let running = false;
    let currentTheme = null;
    let particles = [];
  
    // Couleurs par thème (null = pas d'animation)
    const THEME_COLORS = {
      iphax:     null,
      treegreen: ['#0B5D31','#0F7A43','#166B3A','#1F8A57','#2A9D63'],
      fire:      ['#B23344','#D04858','#E04A5A','#FF6B3D','#FFA45B'],
      cherry:    ['#FBD5E3','#F8C4D8','#F5B3CC','#F2A2C0'],
      midnight:  null,
      golden:    null,
      autumn:    ['#8B2F0E','#A83A15','#C4441E','#E04A1F','#D97742'],
      sea:       ['#2BB6B6','#5ED8D8','#8EE6E6','#1F8A8A'],
      ocean:     ['#1F6FBF','#3DA0F0','#5EB0FF','#0F3F7A'],
      dark:      null,
      white:     null
    };
  
    // Forme par thème
    const THEME_SHAPES = {
      treegreen: 'leaf',
      fire:      'flame',
      cherry:    'petal-flower',
      autumn:    'autumn-leaf',
      sea:       'bubble',
      ocean:     'bubble'
    };
  
    const THEME_COUNT = {
      treegreen: 60,
      fire:      55,
      cherry:    55,
      autumn:    55,
      sea:       50,
      ocean:     50
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
  
    /* ─────────────── DESSINS ─────────────── */
  
    function drawLeaf(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = opacity;
  
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, shade(color, 1.15));
      grad.addColorStop(1, shade(color, 0.85));
  
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.7, -size * 0.6, size * 0.7, size * 0.6, 0, size);
      ctx.bezierCurveTo(-size * 0.7, size * 0.6, -size * 0.7, -size * 0.6, 0, -size);
      ctx.closePath();
      ctx.fill();
  
      ctx.strokeStyle = shade(color, 0.6);
      ctx.lineWidth = Math.max(0.7, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.95);
      ctx.lineTo(0, size * 0.95);
      ctx.stroke();
  
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
  
    function drawAutumnLeaf(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = opacity;
  
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, 0.8));
  
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.75, size, 0, 0, Math.PI * 2);
      ctx.fill();
  
      ctx.strokeStyle = shade(color, 0.5);
      ctx.lineWidth = Math.max(0.7, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.9);
      ctx.lineTo(0, size * 0.9);
      ctx.stroke();
  
      ctx.restore();
    }
  
    function drawPetal(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = opacity;
  
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, 0.85));
  
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.bezierCurveTo(size * 0.7, size * 0.4, size * 0.7, -size * 0.6, 0, -size);
      ctx.bezierCurveTo(-size * 0.7, -size * 0.6, -size * 0.7, size * 0.4, 0, size);
      ctx.closePath();
      ctx.fill();
  
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.9, size * 0.12, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
  
      ctx.restore();
    }
  
    function drawFlower(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
  
      const petalCount = 6 + Math.floor(Math.random() * 3);
      const petalSize = size * 0.55;
  
      for (let i = 0; i < petalCount; i++) {
        const angle = rot + (i / petalCount) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(0, 0, 0, -petalSize);
        grad.addColorStop(0, color);
        grad.addColorStop(1, shade(color, 1.1));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, -petalSize * 0.5, petalSize * 0.35, petalSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
  
      ctx.fillStyle = '#FDD9E5';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
  
      ctx.fillStyle = '#FFE8B0';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
  
      ctx.restore();
    }
  
    function drawFlame(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
  
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
  
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.bezierCurveTo(size * 0.6, size * 0.3, size * 0.4, -size * 0.6, 0, -size);
      ctx.bezierCurveTo(-size * 0.4, -size * 0.6, -size * 0.6, size * 0.3, 0, size);
      ctx.closePath();
      ctx.fill();
  
      ctx.restore();
    }
  
    function drawBubble(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
  
      const grad = ctx.createRadialGradient(
        -size * 0.3, -size * 0.3, 0,
        0, 0, size
      );
      grad.addColorStop(0, 'rgba(255,255,255,0.8)');
      grad.addColorStop(0.4, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
  
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
  
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(0.5, size * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.stroke();
  
      ctx.restore();
    }

    function drawStar(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.5);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.lineTo(size * 1.5, 0);
      ctx.lineTo(size * 0.3, size * 0.3);
      ctx.lineTo(0, size * 1.5);
      ctx.lineTo(-size * 0.3, size * 0.3);
      ctx.lineTo(-size * 1.5, 0);
      ctx.lineTo(-size * 0.3, -size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  
    function drawNebula(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity * 0.5;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, shade(color, 0.7));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  
    function drawCloud(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity * 0.35;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
      ctx.arc(size * 1.2, -size * 0.3, size * 1.6, 0, Math.PI * 2);
      ctx.arc(-size * 1.2, -size * 0.4, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  
    function drawShootingStar(x, y, size, rot, color, opacity) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = opacity;
      const grad = ctx.createLinearGradient(-size * 6, 0, 0, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, color);
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, size * 0.15);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-size * 6, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  
    function drawShape(p) {
      const shape = THEME_SHAPES[currentTheme];
      if (shape === 'petal-flower') {
        if (p.type === 'flower') drawFlower(p.x, p.y, p.size * 0.9, p.rot, p.color, p.opacity);
        else drawPetal(p.x, p.y, p.size, p.rot, p.color, p.opacity);
      } else if (shape === 'flame') {
        drawFlame(p.x, p.y, p.size, p.rot, p.color, p.opacity);
      } else if (shape === 'autumn-leaf') {
        drawAutumnLeaf(p.x, p.y, p.size, p.rot, p.color, p.opacity);
      } else if (shape === 'bubble') {
        drawBubble(p.x, p.y, p.size * 0.6, p.rot, p.color, p.opacity);
      } else if (shape === 'star') {
        if (p.type === 'shooting') drawShootingStar(p.x, p.y, p.size, p.rot, p.color, p.opacity);
        else if (p.type === 'nebula') drawNebula(p.x, p.y, p.size * 1.5, p.rot, p.color, p.opacity);
        else if (p.type === 'cloud') drawCloud(p.x, p.y, p.size * 1.8, p.rot, p.color, p.opacity);
        else drawStar(p.x, p.y, p.size * 0.5, p.rot, p.color, p.opacity);
      } else {
        drawLeaf(p.x, p.y, p.size, p.rot, p.color, p.opacity);
      }
    }
    function drawStar(x, y, size, rot, color, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = opacity;
    
        // Halo
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
    
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
        ctx.fill();
    
        // Étoile à 4 branches
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.5);
        ctx.lineTo(size * 0.3, -size * 0.3);
        ctx.lineTo(size * 1.5, 0);
        ctx.lineTo(size * 0.3, size * 0.3);
        ctx.lineTo(0, size * 1.5);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.lineTo(-size * 1.5, 0);
        ctx.lineTo(-size * 0.3, -size * 0.3);
        ctx.closePath();
        ctx.fill();
    
        ctx.restore();
      }
    
      function drawNebula(x, y, size, rot, color, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = opacity * 0.5;
    
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, shade(color, 0.7));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
    
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
        ctx.fill();
    
        ctx.restore();
      }
    
      function drawCloud(x, y, size, rot, color, opacity) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = opacity * 0.35;
    
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
    
        ctx.fillStyle = grad;
        // Plusieurs cercles pour effet nuage
        ctx.beginPath();
        ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
        ctx.arc(size * 1.2, -size * 0.3, size * 1.6, 0, Math.PI * 2);
        ctx.arc(-size * 1.2, -size * 0.4, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
    
        ctx.restore();
      }
  
    /* ─────────────── PARTICULES ─────────────── */
  
    function makeParticle(colors) {
      const shape = THEME_SHAPES[currentTheme];
      let type = 'leaf';
      if (shape === 'petal-flower') {
        type = Math.random() < 0.5 ? 'petal' : 'flower';
      } else if (shape === 'star') {
        const r = Math.random();
        if (r < 0.70) type = 'star';
        else if (r < 0.90) type = 'nebula';
        else if (r < 0.98) type = 'cloud';
        else type = 'shooting';
      }
      const monte = (shape === 'bubble' || shape === 'flame');
      const lent = (shape === 'star' && type !== 'shooting');
      return {
        type,
        x: Math.random() * W,
        y: monte ? (H + Math.random() * H) : Math.random() * -H,
        size: 6 + Math.random() * 10,
        vy: monte ? -(0.5 + Math.random() * 1.3) : (lent ? (Math.random() - 0.5) * 0.2 : (0.5 + Math.random() * 1.3)),
        vx: (Math.random() - 0.5) * 0.8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.01 + Math.random() * 0.025,
        swingAmplitude: 0.6 + Math.random() * 1.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.4 + Math.random() * 0.45
      };
    }
  
    function initParticles() {
      const colors = THEME_COLORS[currentTheme];
      if (!colors) { particles = []; return; }
      const baseCount = THEME_COUNT[currentTheme] || 40;
      const areaFactor = Math.min(1.5, (W * H) / 800000);
      const count = Math.floor(baseCount * areaFactor);
      particles = [];
      for (let i = 0; i < count; i++) {
        const p = makeParticle(colors);
        p.y = Math.random() * H;
        particles.push(p);
      }
    }
  
    function updateParticle(p) {
      const shape = THEME_SHAPES[currentTheme];
      const monte = (shape === 'bubble' || shape === 'flame');
  
      p.swing += p.swingSpeed;
      p.x += p.vx + Math.sin(p.swing) * p.swingAmplitude * 0.4;
      p.y += p.vy;
      p.rot += p.rotSpeed * 0.3;
  
      if (monte) {
        if (p.y < -50) {
          p.y = H + 50;
          p.x = Math.random() * W;
        }
      } else {
        if (p.y > H + 50) {
          p.y = -50;
          p.x = Math.random() * W;
        }
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
        drawShape(p);
      });
    }
  
    function applyTheme(themeId) {
      currentTheme = themeId;
      const themesAvecAnimation = ['treegreen', 'fire', 'cherry', 'autumn', 'sea', 'ocean'];
      if (canvas) {
        canvas.style.display = themesAvecAnimation.includes(themeId) ? 'block' : 'none';
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
  
    console.log('✅ theme-bg.js prêt');
  })();