// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — theme-bg.js
alert('theme-bg chargé');
// Fond animé WebGL (Three.js) selon le thème actif
// ═══════════════════════════════════════════════════════════════════════════

const THEME_BG = {
    canvas: null,
    renderer: null,
    scene: null,
    camera: null,
    particles: null,
    clock: null,
    currentTheme: null,
    currentPalette: null,
    raf: null,
    count: 60,
    data: [],
    loaded: false
  };
  
  /* Palettes par thème : { shape: 'leaf' | 'flame' | 'star' | 'petal' | 'sun' | 'autumnLeaf' | 'none', colors: [...] } */
  const THEME_PALETTES = {
    iphax:  { shape: 'none',  colors: ['#00E5FF','#0099FF','#5EB0FF'] },
    vert:   { shape: 'leaf',  colors: ['#2BB673','#38D18A','#5ED8A0','#1F8A57'] },
    rouge:  { shape: 'flame', colors: ['#E04A5A','#FF6B7A','#FFB347','#FF8C42'] },
    rose:   { shape: 'petal', colors: ['#F472B6','#F98FCB','#FFB6D9','#C4488F'] },
    violet: { shape: 'star',  colors: ['#A78BFA','#BFA4FB','#DDD0FF','#7C5CE0'] },
    jaune:  { shape: 'sun',   colors: ['#E5B800','#F5CC2E','#FFE066','#FFF1A6'] },
    orange: { shape: 'autumnLeaf', colors: ['#F2874A','#FF9E62','#E07B39','#C46228'] }
  };
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* Charge Three.js depuis un CDN si pas déjà chargé                        */
  /* ─────────────────────────────────────────────────────────────────────── */
  function loadThreeJS() {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve(window.THREE);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = () => resolve(window.THREE);
      s.onerror = () => reject(new Error('Impossible de charger Three.js'));
      document.head.appendChild(s);
    });
  }
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* Crée une texture canvas pour une forme donnée                           */
  /* ─────────────────────────────────────────────────────────────────────── */
  function createShapeTexture(shape, color) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
  
    const cx = size / 2, cy = size / 2;
  
    switch (shape) {
      case 'leaf': {
        // Feuille : ellipse penchée + nervure
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(0, 32);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'flame': {
        // Flamme : forme arrondie vers le haut + pointe
        ctx.beginPath();
        ctx.moveTo(cx, cy - 40);
        ctx.bezierCurveTo(cx + 24, cy - 18, cx + 22, cy + 18, cx, cy + 34);
        ctx.bezierCurveTo(cx - 22, cy + 18, cx - 24, cy - 18, cx, cy - 40);
        ctx.fill();
        // cœur plus clair
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.bezierCurveTo(cx + 8, cy, cx + 6, cy + 14, cx, cy + 20);
        ctx.bezierCurveTo(cx - 6, cy + 14, cx - 8, cy, cx, cy - 10);
        ctx.fill();
        break;
      }
      case 'petal': {
        // Pétale arrondi
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'star': {
        // Étoile 4 branches + halo
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 30);
        ctx.lineTo(cx + 6, cy - 6);
        ctx.lineTo(cx + 30, cy);
        ctx.lineTo(cx + 6, cy + 6);
        ctx.lineTo(cx, cy + 30);
        ctx.lineTo(cx - 6, cy + 6);
        ctx.lineTo(cx - 30, cy);
        ctx.lineTo(cx - 6, cy - 6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'sun': {
        // Bulle lumineuse douce
        const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
        g2.addColorStop(0, '#FFFFFF');
        g2.addColorStop(0.4, color);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, size, size);
        break;
      }
      case 'autumnLeaf': {
        // Feuille plus large pour l'automne
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(-10, -28);
        ctx.lineTo(10, 28);
        ctx.stroke();
        ctx.restore();
        break;
      }
      default: {
        // Petit cercle doux (par défaut)
        const g3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
        g3.addColorStop(0, color);
        g3.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g3;
        ctx.fillRect(0, 0, size, size);
      }
    }
  
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* Init du fond                                                            */
  /* ─────────────────────────────────────────────────────────────────────── */
  async function initThemeBg() {
    if (THEME_BG.loaded) return;
    try {
      await loadThreeJS();
    } catch (e) {
      console.warn('Three.js non chargé, fond animé désactivé.', e);
      return;
    }
  
    const canvas = document.createElement('canvas');
    canvas.id = 'theme-bg-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;background:red;opacity:0.5;';
    document.body.insertBefore(canvas, document.body.firstChild);
  
    THEME_BG.canvas = canvas;
    THEME_BG.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    THEME_BG.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    THEME_BG.renderer.setSize(window.innerWidth, window.innerHeight);
  
    THEME_BG.scene = new THREE.Scene();
    THEME_BG.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    THEME_BG.camera.position.z = 100;
  
    THEME_BG.clock = new THREE.Clock();
    THEME_BG.loaded = true;
  
    // Écoute redimensionnement
    window.addEventListener('resize', () => {
      if (!THEME_BG.renderer) return;
      THEME_BG.renderer.setSize(window.innerWidth, window.innerHeight);
      THEME_BG.camera.aspect = window.innerWidth / window.innerHeight;
      THEME_BG.camera.updateProjectionMatrix();
    });
  
    // Premier thème
    applyThemeBg(document.body.dataset.theme || 'iphax');
  
    // Boucle d'animation
    animateThemeBg();
  }
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* Change le thème du fond                                                 */
  /* ─────────────────────────────────────────────────────────────────────── */
  function applyThemeBg(themeId) {
    if (!THEME_BG.loaded) return;
    if (THEME_BG.currentTheme === themeId) return;
  
    const palette = THEME_PALETTES[themeId] || THEME_PALETTES.iphax;
    THEME_BG.currentTheme = themeId;
    THEME_BG.currentPalette = palette;
  
    // Nettoie les anciens
    if (THEME_BG.particles) {
      THEME_BG.scene.remove(THEME_BG.particles);
      THEME_BG.particles.geometry.dispose();
      THEME_BG.particles.material.dispose();
      THEME_BG.particles = null;
    }
    THEME_BG.data = [];
  
    if (palette.shape === 'none') return;
  
    const count = THEME_BG.count;
    const positions = new Float32Array(count * 3);
    const textures = palette.colors.map(c => createShapeTexture(palette.shape, c));
  
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 400;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  
      THEME_BG.data.push({
        velocity: {
          x: (Math.random() - 0.5) * 0.15,
          y: -(0.15 + Math.random() * 0.35),
          z: 0
        },
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        tex: textures[Math.floor(Math.random() * textures.length)],
        scale: 0.6 + Math.random() * 1.2
      });
    }
  
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
    // Matériau Points avec plusieurs textures → on crée un groupe de Sprites à la place
    // Pour simplifier et permettre plusieurs textures, on utilise un Group de Sprites
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: THEME_BG.data[i].tex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const s = THEME_BG.data[i].scale * 10;
      sprite.scale.set(s, s, 1);
      sprite.userData.index = i;
      group.add(sprite);
    }
  
    THEME_BG.particles = group;
    THEME_BG.scene.add(group);
  }
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* Boucle d'animation                                                      */
  /* ─────────────────────────────────────────────────────────────────────── */
  function animateThemeBg() {
    THEME_BG.raf = requestAnimationFrame(animateThemeBg);
    if (!THEME_BG.particles) {
      THEME_BG.renderer.render(THEME_BG.scene, THEME_BG.camera);
      return;
    }
  
    const W = 220, H = 180;
  
    THEME_BG.particles.children.forEach((sprite, i) => {
      const d = THEME_BG.data[i];
      if (!d) return;
  
      sprite.position.x += d.velocity.x;
      sprite.position.y += d.velocity.y;
      sprite.position.x += Math.sin(Date.now() * 0.0008 + i) * 0.15;
  
      sprite.material.rotation += d.rotSpeed;
  
      // Wrap : quand ça sort, ça revient en haut
      if (sprite.position.y < -H) {
        sprite.position.y = H;
        sprite.position.x = (Math.random() - 0.5) * 400;
      }
      if (sprite.position.x < -W) sprite.position.x = W;
      if (sprite.position.x > W) sprite.position.x = -W;
    });
  
    THEME_BG.renderer.render(THEME_BG.scene, THEME_BG.camera);
  }
  
  /* ─────────────────────────────────────────────────────────────────────── */
  /* API globale                                                             */
  /* ─────────────────────────────────────────────────────────────────────── */
  window.iphaxThemeBg = {
    init: initThemeBg,
    apply: applyThemeBg
  };
  
  /* Auto-init au chargement */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initThemeBg, 400));
  } else {
    setTimeout(initThemeBg, 400);
  }
  
  console.log('✅ theme-bg.js prêt');
  alert('theme-bg initialisé');