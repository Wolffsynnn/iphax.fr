// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — Logique principale (v3 — propre, contractée, fil système inclus)
// ═══════════════════════════════════════════════════════════════════════════

console.log('🚀 main.js v3 démarré');

// ─── Firebase ───
const auth = window.iphaxAuth;
const db = window.iphaxDb;
const {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, onAuthStateChanged, updateProfile, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} = window.fbAuthFns;
const {
  doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp,
  collection, addDoc, query, orderBy, where, limit, onSnapshot, getDocs
} = window.fbDbFns;

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAT GLOBAL
// ═══════════════════════════════════════════════════════════════════════════
let currentUser = null;
let currentUserData = null;
let authReady = false;
let currentBulle = 'membre';

// Chats
let memberConvId = null;
let memberChatUnsub = null;
let ecoConvId = null;
let ecoChatUnsub = null;

// Caches écoutant
let ecoAttenteCache = [], ecoMesCache = [], ecoResoluesCache = [];
let unsubEcoAttente = null, unsubEcoMes = null, unsubEcoResolues = null;

// News & admin
let unsubAdminNews = null, unsubEcoNews = null, unsubAdminDemandes = null;

// Fils
let currentFilId = null;
let currentFilData = null;
let unsubFilPosts = null;
let unsubFilsList = null;

// Mood (membre)
let moodMonth = new Date();
let moodData = {};

// Journal / objectifs (caches)
let journalCache = [], objectifsCache = [];

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const ROLES_PAR_BULLE = {
  membre: ['membre'],
  ecoutant: ['ecoutant', 'responsable', 'chef_service'],
  admin: ['admin', 'moderateur'],
  dev: ['dev', 'developpeur'],
  fondateur: ['fondateur']
};
const LABELS_ESPACES = { membre:'Membre', ecoutant:'Écoutant', admin:'Admin / Modérateur', dev:'Développeur', fondateur:'Fondateur' };
const LABELS_ROLES = {
  membre:'Membre', ecoutant:'Écoutant·e', responsable:'Responsable', chef_service:'Chef de service',
  moderateur:'Modérateur', admin:'Administrateur', dev:'Développeur', developpeur:'Développeur', fondateur:'Fondateur'
};

const MOOD_ELEMENTS = [
  { id:'humeur', label:'😊 Humeur' }, { id:'sommeil', label:'😴 Sommeil' },
  { id:'energie', label:'⚡ Énergie' }, { id:'anxiete', label:'😰 Anxiété' },
  { id:'appetit', label:'🍽️ Appétit' }, { id:'sociabilite', label:'👥 Sociabilité' },
  { id:'depression', label:'🌧️ Dépression' }
];
const MOOD_COLORS = [
  { name:'Excellent', hex:'#0F2551' }, { name:'Très bien', hex:'#1B7A4D' },
  { name:'Bien', hex:'#A8E6CF' }, { name:'Moyen', hex:'#FFD93D' },
  { name:'Bof', hex:'#FF9F45' }, { name:'Mal', hex:'#E04A5A' }, { name:'Très mal', hex:'#7A1525' }
];
const ELEMENT_COLORS = ['#FFD93D','#A78BFA','#FF9F45','#E04A5A','#3DDC97','#00E5FF','#5EB0FF'];

const MOTIFS = ['Anxiété','Solitude','Tristesse','Colère','Harcèlement','Famille','École','Amitié','Amour','Deuil','Autre'];
const CONV_CATEGORIES = ['Anxiété','Solitude','Tristesse','Colère','Famille','École','Amitié','Deuil','Autre'];

const AVATARS = ['🌙','⭐','✨','🌌','🌠','🦉','🐱','🐶','🦊','🐰','🐼','🦋','🌸','🌺','🌻','🍀','💙','🎧','🎨','📚'];
const THEMES = [
  { id:'iphax',    label:'Iphax',    colors:['#00E5FF','#0099FF','#0057C9'] },
  { id:'violet',   label:'Violet',   colors:['#A78BFA','#7C3AED','#5B21B6'] },
  { id:'rose',     label:'Rose',     colors:['#F472B6','#DB2777','#9D174D'] },
  { id:'emeraude', label:'Émeraude', colors:['#3DDC97','#059669','#065F46'] },
  { id:'sunset',   label:'Sunset',   colors:['#FB923C','#EA580C','#9A3412'] }
];
const REACTIONS_EMOJIS = ['👍','❤️','😢','😂','🔥','🎉','😮','😡'];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
}

function showError(id, msg) { const el = $(id); if (el) el.textContent = msg; }
function clearError(id) { const el = $(id); if (el) el.textContent = ''; }

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function calculerAge(date) {
  const auj = new Date(), naiss = new Date(date);
  let age = auj.getFullYear() - naiss.getFullYear();
  const m = auj.getMonth() - naiss.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < naiss.getDate())) age--;
  return age;
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function formatTime(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
}

function formatDate(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '';
}

function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function getDaysInMonth(d) { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }

function formatMonthTitle(d) {
  const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${mois[d.getMonth()]} ${d.getFullYear()}`;
}

function traductError(code, rawMessage) {
  const errors = {
    'auth/email-already-in-use': '📧 Cet email est déjà utilisé.',
    'auth/invalid-email': '📧 Email invalide.',
    'auth/weak-password': '🔑 Mot de passe trop faible.',
    'auth/user-not-found': '👤 Aucun compte avec cet email.',
    'auth/wrong-password': '🔑 Mot de passe incorrect.',
    'auth/invalid-credential': '🔑 Email ou mot de passe incorrect.',
    'auth/too-many-requests': '⏳ Trop de tentatives.',
    'auth/network-request-failed': '📡 Problème de connexion.',
    'auth/popup-closed-by-user': '❌ Connexion annulée.',
    'auth/popup-blocked': '🚫 Popup bloquée.',
    'auth/unauthorized-domain': '🚫 Domaine non autorisé.',
    'permission-denied': '🔒 Pas la permission.'
  };
  return errors[code] || `⚠️ Erreur : ${code || rawMessage || 'inconnue'}`;
}

// ─── Rôles ───
function roleCompatibleAvecBulle(role, bulle) { return (ROLES_PAR_BULLE[bulle] || ['membre']).includes(role); }
function bulleDepuisRole(role) {
  for (const [b, roles] of Object.entries(ROLES_PAR_BULLE)) if (roles.includes(role)) return b;
  return 'membre';
}
function estEcoutant(role) { return ['ecoutant','responsable','chef_service'].includes(role); }
function estAdmin(role) { return ['admin','moderateur'].includes(role); }
function estDev(role) { return ['dev','developpeur'].includes(role); }
function aAccesAdmin(role) { return estAdmin(role) || estDev(role) || role === 'fondateur'; }
function peutCreerFilThera(role) { return estAdmin(role) || estDev(role) || role === 'fondateur' || role === 'responsable' || role === 'chef_service'; }

// ─── Navigation ───
function openPage(appId, pageName) {
  const app = $(appId);
  if (!app) return;
  app.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = app.querySelector(`.page[data-page="${pageName}"]`);
  if (page) page.classList.add('active');
  const content = app.querySelector('.app-content');
  if (content) content.scrollTop = 0;
}

function setActiveNav(appId, pageName) {
  const app = $(appId);
  if (!app) return;
  app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const t = app.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (t) t.classList.add('active');
}

// ─── Modale générique ───
function openModal(html, onMount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  if (onMount) onMount(overlay);
  return overlay;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTRO
// ═══════════════════════════════════════════════════════════════════════════
$('btn-continuer').addEventListener('click', async () => {
  let waited = 0;
  while (!authReady && waited < 2000) { await new Promise(r => setTimeout(r, 50)); waited += 50; }
  if (currentUser && currentUserData) routeUser(currentUserData);
  else if (currentUser) showScreen('screen-cgu');
  else showScreen('screen-auth');
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTAGE
// ═══════════════════════════════════════════════════════════════════════════
function routeUser(data) {
  // Remplir les profils
  ['profil-nom','profil-eco-nom','profil-admin-nom'].forEach(id => {
    const el = $(id); if (el) el.textContent = data.displayName || 'Utilisateur';
  });
  ['profil-username','profil-eco-username','profil-admin-username'].forEach(id => {
    const el = $(id); if (el) el.textContent = '@' + (data.username || 'inconnu');
  });

  if (!data.cguAccepted) { showScreen('screen-cgu'); return; }

  const role = data.role || 'membre';

  if (aAccesAdmin(role)) {
    showScreen('app-admin');
    setTimeout(() => initAdmin(), 100);
  } else if (estEcoutant(role)) {
    showScreen('app-ecoutant');
    setTimeout(() => initEcoutant(), 100);
  } else {
    showScreen('app-membre');
    setTimeout(() => initMembre(), 100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH — Onglets
// ═══════════════════════════════════════════════════════════════════════════
const tabsContainer = document.querySelector('.auth-tabs');
const formLogin = $('form-login');
const formSignup = $('form-signup');

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabsContainer.dataset.active = target;
    formLogin.classList.toggle('active', target === 'login');
    formSignup.classList.toggle('active', target === 'signup');
  });
});

// ─── Bulles de rôle ───
const roleMessages = {
  membre:"Ici, quelqu'un t'écoute 💙", admin:'Espace administration 🔧',
  ecoutant:'Espace écoutant·e — Merci 💚', dev:'Espace développeur 💻', fondateur:'Accès fondateur 👑'
};
const roleTitles = {
  membre:'Bienvenue sur Iphax', admin:'Connexion administration',
  ecoutant:'Connexion écoutant·e', dev:'Connexion développeur', fondateur:'Connexion fondateur'
};

document.querySelectorAll('.role-bubble').forEach(bubble => {
  bubble.addEventListener('click', () => {
    const role = bubble.dataset.role;
    document.querySelectorAll('.role-bubble').forEach(b => b.classList.remove('active'));
    bubble.classList.add('active');
    const sub = $('auth-subtitle'); const tit = $('auth-title');
    if (sub) sub.textContent = roleMessages[role] || roleMessages.membre;
    if (tit) tit.textContent = roleTitles[role] || roleTitles.membre;
    if (role === 'membre') tabsContainer.style.display = 'flex';
    else { tabsContainer.style.display = 'none'; formLogin.classList.add('active'); formSignup.classList.remove('active'); }
    currentBulle = role;
    clearError('login-error'); clearError('signup-error');
  });
});

// ─── Œil mot de passe ───
document.querySelectorAll('.toggle-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const isP = input.type === 'password';
    input.type = isP ? 'text' : 'password';
    btn.style.color = isP ? 'var(--accent)' : 'var(--text-muted)';
  });
});

// ─── Inscription ───
formSignup.addEventListener('submit', async e => {
  e.preventDefault();
  clearError('signup-error');
  const email = $('signup-email').value.trim();
  const username = $('signup-username').value.trim();
  const displayName = $('signup-displayname').value.trim();
  const birthdate = $('signup-birthdate').value;
  const password = $('signup-password').value;

  const age = calculerAge(birthdate);
  if (age >= 18) return showError('signup-error', '❌ Réservé aux moins de 18 ans.');
  if (age < 8) return showError('signup-error', '❌ Minimum 8 ans.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return showError('signup-error', '🔑 1 lettre + 1 chiffre minimum.');
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(username)) return showError('signup-error', '👤 Nom d\'utilisateur invalide.');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    await updateProfile(user, { displayName: username });
    const userData = {
      uid: user.uid, email: user.email, username, displayName,
      birthdate, age, role: 'membre', cguAccepted: false,
      createdAt: serverTimestamp(), lastUsernameChange: null, lastDisplayNameChange: null
    };
    await setDoc(doc(db, 'users', user.uid), userData);
    currentUser = user; currentUserData = userData;
    showScreen('screen-cgu');
  } catch (error) {
    showError('signup-error', traductError(error.code, error.message));
  }
});

// ─── Connexion ───
formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  clearError('login-error');
  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { showError('login-error', '⚠️ Profil incomplet.'); await signOut(auth); return; }
    const data = snap.data();
    const role = data.role || 'membre';

    if (!roleCompatibleAvecBulle(role, currentBulle)) {
      await signOut(auth);
      const vrai = LABELS_ESPACES[bulleDepuisRole(role)];
      const tent = LABELS_ESPACES[currentBulle];
      const rl = LABELS_ROLES[role] || role;
      showError('login-error', `🚫 Mauvais espace ! Compte ${rl}, mais tu essaies de te connecter dans l'espace ${tent}. Utilise la bulle « ${vrai} ».`);
      return;
    }

    currentUser = user; currentUserData = data;
    routeUser(data);
  } catch (error) {
    showError('login-error', traductError(error.code, error.message));
  }
});

// ─── Google ───
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function handleGoogleUser(user, bulle) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  let data;
  if (!snap.exists()) {
    data = {
      uid: user.uid, email: user.email, username: null,
      displayName: user.displayName || 'Utilisateur',
      birthdate: null, age: null, role: 'membre', provider: 'google',
      cguAccepted: false, createdAt: serverTimestamp()
    };
    await setDoc(ref, data);
  } else data = snap.data();

  const role = data.role || 'membre';
  if (!roleCompatibleAvecBulle(role, bulle)) {
    await signOut(auth);
    showScreen('screen-auth');
    setTimeout(() => {
      const vrai = LABELS_ESPACES[bulleDepuisRole(role)];
      const rl = LABELS_ROLES[role] || role;
      showError('login-error', `🚫 Mauvais espace ! Compte ${rl}. Utilise la bulle « ${vrai} ».`);
    }, 300);
    return;
  }
  currentUser = user; currentUserData = data;
  routeUser(data);
}

$('btn-google').addEventListener('click', async () => {
  clearError('login-error'); clearError('signup-error');
  sessionStorage.setItem('iphax_bulle_choisie', currentBulle);
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await handleGoogleUser(result.user, currentBulle);
  } catch (error) {
    if (['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error.code)) {
      try { await signInWithRedirect(auth, googleProvider); return; }
      catch (e2) { showError('login-error', traductError(e2.code, e2.message)); return; }
    }
    showError('login-error', traductError(error.code, error.message));
  }
});

(async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const bulle = sessionStorage.getItem('iphax_bulle_choisie') || 'membre';
      sessionStorage.removeItem('iphax_bulle_choisie');
      await handleGoogleUser(result.user, bulle);
    }
  } catch (e) { console.error('Erreur redirect :', e); }
})();

// ─── CGU ───
const cguText = $('cgu-text'), cguCheckbox = $('cgu-checkbox'), cguCheckLabel = $('cgu-check-label');
const btnAcceptCgu = $('btn-accept-cgu'), btnRefuseCgu = $('btn-refuse-cgu');
let cguUnlocked = false;

if (cguText) {
  cguText.addEventListener('scroll', () => {
    if (cguText.scrollTop + cguText.clientHeight >= cguText.scrollHeight - 15 && !cguUnlocked) {
      cguUnlocked = true;
      cguCheckbox.disabled = false;
      cguCheckLabel.classList.remove('disabled');
    }
  });
}
if (cguCheckbox) cguCheckbox.addEventListener('change', () => { btnAcceptCgu.disabled = !cguCheckbox.checked; });
if (btnRefuseCgu) btnRefuseCgu.addEventListener('click', () => {
  signOut(auth).then(() => { currentUser = null; currentUserData = null; showScreen('screen-intro'); });
  if (cguCheckbox) { cguCheckbox.checked = false; cguCheckbox.disabled = true; cguCheckLabel.classList.add('disabled'); btnAcceptCgu.disabled = true; cguUnlocked = false; }
});
if (btnAcceptCgu) btnAcceptCgu.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { cguAccepted: true, cguAcceptedAt: serverTimestamp(), cguVersion: '1.0' });
    currentUserData.cguAccepted = true;
    routeUser(currentUserData);
  } catch (e) { alert('❌ Erreur : ' + e.message); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION APPS
// ═══════════════════════════════════════════════════════════════════════════
function setupAppNavigation(appId) {
  const app = $(appId);
  if (!app) return;
  const navItems = app.querySelectorAll('.nav-item');
  const pages = app.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.page;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      pages.forEach(p => p.classList.remove('active'));
      const page = app.querySelector(`.page[data-page="${target}"]`);
      if (page) page.classList.add('active');
      const content = app.querySelector('.app-content');
      if (content) content.scrollTop = 0;

      // Nettoyage chat si on sort
      if (appId === 'app-membre' && target !== 'chat' && memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
      if (appId === 'app-ecoutant' && target !== 'chat-eco' && ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
      if (target !== 'fil-detail' && target !== 'fil-detail-eco' && target !== 'fil-detail-admin' && unsubFilPosts) { unsubFilPosts(); unsubFilPosts = null; }
    });
  });
}
setupAppNavigation('app-membre');
setupAppNavigation('app-ecoutant');
setupAppNavigation('app-admin');

// ─── Boutons "retour" ───
function bindBack(btnId, appId, targetPage) {
  const btn = $(btnId);
  if (btn) btn.addEventListener('click', () => { openPage(appId, targetPage); setActiveNav(appId, targetPage); });
}
bindBack('btn-back-perso', 'app-membre', 'perso');
bindBack('btn-back-perso-journal', 'app-membre', 'perso');
bindBack('btn-back-perso-objectifs', 'app-membre', 'perso');
bindBack('btn-back-perso-rappels', 'app-membre', 'perso');
bindBack('btn-back-fil', 'app-membre', 'public');
bindBack('btn-back-fil-detail', 'app-membre', 'public');
bindBack('btn-back-chat', 'app-membre', 'ecouter');
bindBack('btn-back-chat-eco', 'app-ecoutant', 'conversations');
bindBack('btn-back-fils-eco', 'app-ecoutant', 'fils');
bindBack('btn-back-fils-admin', 'app-admin', 'admin-fils');

// ═══════════════════════════════════════════════════════════════════════════
// INIT MEMBRE
// ═══════════════════════════════════════════════════════════════════════════
function initMembre() {
  // Grid cards (journal, mood, objectifs, rappels)
  document.querySelectorAll('#app-membre .grid-card[data-target]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      openPage('app-membre', target);
      if (target === 'mood-tracker') await initMoodTracker();
      if (target === 'journal') await loadJournal();
      if (target === 'objectifs') await loadObjectifs();
      if (target === 'rappels') await loadRappels();
    });
  });

  // News
  startEcoNewsListener('news-dynamic');

  // Boutons fil général
  const btnFilGeneral = $('btn-fil-general');
  if (btnFilGeneral && !btnFilGeneral.dataset.bound) {
    btnFilGeneral.dataset.bound = '1';
    btnFilGeneral.addEventListener('click', () => openFil('general', 'membre'));
  }

  // Bouton demande fil général
  const btnDemandeFil = $('btn-demande-fil');
  if (btnDemandeFil && !btnDemandeFil.dataset.bound) {
    btnDemandeFil.dataset.bound = '1';
    btnDemandeFil.addEventListener('click', openDemandeFilModal);
  }

  // Fils théra — liste
  loadFilsTheraMembre();

  // Chat membre
  const btnParler = $('btn-parler-maintenant');
  if (btnParler && !btnParler.dataset.bound) { btnParler.dataset.bound = '1'; btnParler.addEventListener('click', () => openMemberChat('parler-maintenant')); }
  const btnMonEco = $('btn-mon-ecoutant');
  if (btnMonEco && !btnMonEco.dataset.bound) { btnMonEco.dataset.bound = '1'; btnMonEco.addEventListener('click', () => openMemberChat('mon-ecoutant')); }

  // Quit chat
  const btnQuit = $('btn-quit-chat');
  if (btnQuit && !btnQuit.dataset.bound) {
    btnQuit.dataset.bound = '1';
    btnQuit.addEventListener('click', quitMemberChat);
  }

  // Formulaire chat membre
  const form = $('chat-form');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', sendMemberMessage);
  }

  // Profil
  initProfilUI();
}

// ═══════════════════════════════════════════════════════════════════════════
// MOOD TRACKER
// ═══════════════════════════════════════════════════════════════════════════
function renderMoodLegend() {
  const legend = $('mood-legend');
  if (!legend) return;
  legend.innerHTML = MOOD_COLORS.map(c => `<div class="mood-legend-item"><span class="mood-legend-dot" style="background:${c.hex}"></span><span>${c.name}</span></div>`).join('');
}

function renderMoodTable() {
  const table = $('mood-table'), title = $('mood-month-title');
  if (!table || !title) return;
  title.textContent = formatMonthTitle(moodMonth);
  const days = getDaysInMonth(moodMonth);
  const today = new Date();
  const isCurrent = today.getFullYear() === moodMonth.getFullYear() && today.getMonth() === moodMonth.getMonth();

  let thead = '<thead><tr><th>Élément</th>';
  for (let d = 1; d <= days; d++) {
    const date = new Date(moodMonth.getFullYear(), moodMonth.getMonth(), d);
    const we = date.getDay() === 0 || date.getDay() === 6;
    const tj = isCurrent && today.getDate() === d;
    thead += `<th class="${we?'weekend':''} ${tj?'today':''}">${d}</th>`;
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  MOOD_ELEMENTS.forEach(el => {
    tbody += `<tr><th>${el.label}</th>`;
    for (let d = 1; d <= days; d++) {
      const tj = isCurrent && today.getDate() === d;
      const idx = moodData[d] && moodData[d][el.id] != null ? moodData[d][el.id] : -1;
      const bg = idx >= 0 ? MOOD_COLORS[idx].hex : 'transparent';
      tbody += `<td class="mood-cell ${idx>=0?'has-color':''} ${tj?'today':''}" data-day="${d}" data-el="${el.id}" style="background:${bg}"></td>`;
    }
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
  table.querySelectorAll('.mood-cell').forEach(cell => {
    cell.addEventListener('click', () => openMoodPicker(parseInt(cell.dataset.day, 10), cell.dataset.el));
  });
}

async function loadMoodData() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodMonth)));
    moodData = snap.exists() ? (snap.data().cells || {}) : {};
  } catch (e) { moodData = {}; }
}

async function saveMoodData() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodMonth)),
      { cells: moodData, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { alert('❌ Impossible d\'enregistrer.'); }
}

async function initMoodTracker() { renderMoodLegend(); await loadMoodData(); renderMoodTable(); }

function openMoodPicker(day, elementId) {
  const el = MOOD_ELEMENTS.find(e => e.id === elementId);
  const elLabel = el ? el.label : elementId;
  const currentColor = (moodData[day] && moodData[day][elementId] != null) ? moodData[day][elementId] : -1;
  const overlay = openModal(`
    <div class="mood-picker">
      <div class="mood-picker-title">${elLabel}</div>
      <div class="mood-picker-sub">Jour ${day} — Choisis ton niveau</div>
      <div class="mood-picker-grid">
        ${MOOD_COLORS.map((c,i) => `<button class="mood-color-btn ${i===currentColor?'selected':''}" data-idx="${i}" style="background:${c.hex}" title="${c.name}"></button>`).join('')}
      </div>
      <div class="mood-picker-actions">
        <button class="mood-btn-clear">Effacer</button>
        <button class="mood-btn-cancel">Annuler</button>
      </div>
    </div>`);
  overlay.className = 'mood-picker-overlay';

  overlay.querySelectorAll('.mood-color-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (!moodData[day]) moodData[day] = {};
      moodData[day][elementId] = idx;
      overlay.remove(); renderMoodTable(); await saveMoodData();
    });
  });
  overlay.querySelector('.mood-btn-clear').addEventListener('click', async () => {
    if (moodData[day]) { delete moodData[day][elementId]; if (Object.keys(moodData[day]).length === 0) delete moodData[day]; }
    overlay.remove(); renderMoodTable(); await saveMoodData();
  });
  overlay.querySelector('.mood-btn-cancel').addEventListener('click', () => overlay.remove());
}

$('mood-prev')?.addEventListener('click', async () => { moodMonth.setMonth(moodMonth.getMonth() - 1); await loadMoodData(); renderMoodTable(); });
$('mood-next')?.addEventListener('click', async () => { moodMonth.setMonth(moodMonth.getMonth() + 1); await loadMoodData(); renderMoodTable(); });

// ═══════════════════════════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════════════════════════
async function loadJournal() {
  const list = $('journal-list');
  if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'journal'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    journalCache = [];
    snap.forEach(d => journalCache.push({ id: d.id, ...d.data() }));
    if (journalCache.length === 0) { list.innerHTML = '<p class="empty-state">Aucune note pour l\'instant. Écris ta première 💙</p>'; return; }
    list.innerHTML = journalCache.map(entry => {
      const date = toDate(entry.createdAt) || new Date();
      const dateStr = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const preview = (entry.content || '').substring(0, 180);
      const shared = entry.shared ? 'shared' : 'private';
      const sharedLabel = entry.shared ? '🔓 Partagé' : '🔒 Privé';
      return `
        <div class="journal-entry" data-id="${entry.id}">
          <div class="journal-entry-header">
            <span class="journal-entry-date">${dateStr}</span>
            <span class="journal-entry-mood">${entry.moodEmoji || ''}</span>
          </div>
          <div class="journal-entry-title">${escapeHtml(entry.title || 'Sans titre')}</div>
          <div class="journal-entry-preview">${escapeHtml(preview)}${preview.length>=180?'…':''}</div>
          <span class="journal-entry-badge ${shared}">${sharedLabel}</span>
        </div>`;
    }).join('');
    list.querySelectorAll('.journal-entry').forEach(el => {
      el.addEventListener('click', () => openJournalEntry(el.dataset.id));
    });
  } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
}

function openJournalEntry(id) {
  const entry = journalCache.find(e => e.id === id);
  if (!entry) return;
  const date = toDate(entry.createdAt) || new Date();
  const dateStr = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title">${escapeHtml(entry.title || 'Sans titre')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${dateStr} · ${entry.shared ? '🔓 Partagé' : '🔒 Privé'}</div>
        </div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div style="font-size:14px;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(entry.content || '')}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="journal-delete-btn">🗑️ Supprimer</button>
        <button class="btn btn-ghost modal-close">Fermer</button>
      </div>
    </div>`);
  overlay.querySelector('#journal-delete-btn').addEventListener('click', async () => {
    if (!confirm('Supprimer cette note ?')) return;
    try { await deleteDoc(doc(db, 'users', currentUser.uid, 'journal', id)); overlay.remove(); await loadJournal(); }
    catch (e) { alert('❌ Erreur'); }
  });
}

$('btn-new-journal')?.addEventListener('click', () => {
  let privacy = 'private', mood = '';
  const EMOJIS = ['😢','😔','😐','🙂','😄','😰','😡','😴','🥰','🤔'];
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">📔 Nouvelle note</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="field"><label>Confidentialité</label>
          <div class="journal-privacy-choice">
            <button type="button" class="journal-privacy-option active" data-privacy="private"><span class="privacy-icon">🔒</span><span class="privacy-label">Privé</span></button>
            <button type="button" class="journal-privacy-option" data-privacy="shared"><span class="privacy-icon">🔓</span><span class="privacy-label">Partagé</span></button>
          </div>
        </div>
        <div class="field"><label>Humeur (facultatif)</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${EMOJIS.map(e => `<button type="button" class="mood-emoji-btn" data-emoji="${e}" style="width:40px;height:40px;border-radius:10px;background:rgba(10,26,61,0.6);border:1.5px solid var(--border);font-size:22px;cursor:pointer;">${e}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Titre</label><input type="text" id="journal-title" placeholder="Un titre..." maxlength="80"></div>
        <div class="field"><label>Ton ressenti</label><textarea id="journal-content" placeholder="Écris librement..."></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuler</button>
        <button class="btn btn-primary" id="journal-save">💾 Enregistrer</button>
      </div>
    </div>`);
  overlay.querySelectorAll('.journal-privacy-option').forEach(opt => opt.addEventListener('click', () => {
    overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active'); privacy = opt.dataset.privacy;
  }));
  overlay.querySelectorAll('.mood-emoji-btn').forEach(btn => btn.addEventListener('click', () => {
    overlay.querySelectorAll('.mood-emoji-btn').forEach(b => b.style.borderColor = 'var(--border)');
    if (mood === btn.dataset.emoji) { mood = ''; }
    else { mood = btn.dataset.emoji; btn.style.borderColor = 'var(--accent)'; }
  }));
  overlay.querySelector('#journal-save').addEventListener('click', async () => {
    const title = overlay.querySelector('#journal-title').value.trim();
    const content = overlay.querySelector('#journal-content').value.trim();
    if (!content) { alert('✍️ Écris quelque chose'); return; }
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'journal'), {
        title: title || 'Sans titre', content, shared: privacy === 'shared',
        moodEmoji: mood, createdAt: serverTimestamp()
      });
      overlay.remove(); await loadJournal();
    } catch (e) { alert('❌ Erreur'); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OBJECTIFS
// ═══════════════════════════════════════════════════════════════════════════
async function loadObjectifs() {
  const list = $('objectifs-list');
  if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'objectifs'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    objectifsCache = [];
    snap.forEach(d => objectifsCache.push({ id: d.id, ...d.data() }));
    if (objectifsCache.length === 0) { list.innerHTML = '<p class="empty-state">Aucun objectif.</p>'; return; }
    list.innerHTML = objectifsCache.map(o => `
      <div class="objectif-item ${o.done?'done':''}" data-id="${o.id}">
        <button class="objectif-check" data-id="${o.id}"></button>
        <span class="objectif-text">${escapeHtml(o.text)}</span>
        <button class="objectif-delete" data-id="${o.id}">🗑️</button>
      </div>`).join('');
    list.querySelectorAll('.objectif-check').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      const item = objectifsCache.find(o => o.id === btn.dataset.id);
      if (!item) return;
      try { await updateDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id), { done: !item.done }); await loadObjectifs(); } catch (e) {}
    }));
    list.querySelectorAll('.objectif-delete').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Supprimer cet objectif ?')) return;
      try { await deleteDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id)); await loadObjectifs(); } catch (e) {}
    }));
  } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
}

$('btn-new-objectif')?.addEventListener('click', () => {
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">🎯 Nouvel objectif</div><button class="modal-close">×</button></div>
      <div class="modal-body"><div class="field"><label>Mon objectif</label><input type="text" id="objectif-text" placeholder="Ex: Boire plus d'eau..." maxlength="120"></div></div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="obj-save">Ajouter</button></div>
    </div>`);
  overlay.querySelector('#obj-save').addEventListener('click', async () => {
    const text = overlay.querySelector('#objectif-text').value.trim();
    if (!text) { alert('✍️ Écris ton objectif'); return; }
    try { await addDoc(collection(db, 'users', currentUser.uid, 'objectifs'), { text, done: false, createdAt: serverTimestamp() }); overlay.remove(); await loadObjectifs(); }
    catch (e) { alert('❌ Erreur'); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RAPPELS
// ═══════════════════════════════════════════════════════════════════════════
async function loadRappels() {
  const list = $('rappels-list');
  if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'rappels'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const rappels = [];
    snap.forEach(d => rappels.push({ id: d.id, ...d.data() }));
    if (rappels.length === 0) { list.innerHTML = '<p class="empty-state">Aucun rappel.</p>'; return; }
    list.innerHTML = rappels.map(r => `<div class="rappel-item"><div class="rappel-text">« ${escapeHtml(r.text)} »</div><button class="rappel-delete" data-id="${r.id}">🗑️</button></div>`).join('');
    list.querySelectorAll('.rappel-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ?')) return;
      try { await deleteDoc(doc(db, 'users', currentUser.uid, 'rappels', btn.dataset.id)); await loadRappels(); } catch (e) {}
    }));
  } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
}

$('btn-new-rappel')?.addEventListener('click', () => {
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">💡 Nouveau rappel</div><button class="modal-close">×</button></div>
      <div class="modal-body"><div class="field"><label>Ta phrase bienveillante</label><input type="text" id="rappel-text" placeholder="Ex: Je mérite d'être heureux·se..." maxlength="200"></div></div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="rap-save">Ajouter</button></div>
    </div>`);
  overlay.querySelector('#rap-save').addEventListener('click', async () => {
    const text = overlay.querySelector('#rappel-text').value.trim();
    if (!text) { alert('✍️ Écris ton rappel'); return; }
    try { await addDoc(collection(db, 'users', currentUser.uid, 'rappels'), { text, createdAt: serverTimestamp() }); overlay.remove(); await loadRappels(); }
    catch (e) { alert('❌ Erreur'); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORMULAIRE CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════
function openConvForm(type) {
  return new Promise(resolve => {
    let motif = '', urgence = 3, mots = '';
    let prefNiveau = 'peu-importe', prefAge = 'peu-importe', prefStyle = 'peu-importe', prefGenre = 'peu-importe';
    const isReferent = type === 'referent';

    const overlay = openModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">${isReferent ? '👤 Trouver mon écoutant' : '💬 Nouvelle demande'}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${isReferent ? 'Ces infos aideront à te trouver le bon écoutant.' : 'Aide-nous à comprendre ce qui t\'amène.'}</div>
          </div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>🎯 Motif principal</label>
            <div class="checkbox-list">
              ${MOTIFS.map(m => `<label class="checkbox-item"><input type="checkbox" name="motif" value="${m}"><span class="checkbox-box"></span><span class="checkbox-label">${m}</span></label>`).join('')}
            </div>
          </div>
          <div class="field">
            <label>🚦 Niveau d'urgence</label>
            <div class="urgence-picker">
              ${[1,2,3,4,5].map(n => `<button type="button" class="urgence-btn" data-urg="${n}">${'🔴'.repeat(n)}${'⚪'.repeat(5-n)}</button>`).join('')}
            </div>
            <p class="field-hint" id="urg-hint">3/5 — Moyennement urgent</p>
          </div>
          <div class="field">
            <label>📝 Quelques mots <span style="color:var(--text-muted);font-weight:400;">(facultatif)</span></label>
            <textarea id="conv-mots" placeholder="Dis-nous en quelques mots ce qui t'amène…" maxlength="500" style="min-height:100px;"></textarea>
          </div>
          <div class="field">
            <label>👥 Préférences d'écoutant <span style="color:var(--text-muted);font-weight:400;">(facultatif)</span></label>
            ${['niveau','age','style','genre'].map(g => `
              <div class="pref-block">
                <div class="pref-label">${g==='niveau'?'🎓 Niveau':g==='age'?'🎂 Âge':g==='style'?'🗣️ Style':'⚧️ Genre'}</div>
                <div class="checkbox-list checkbox-list-inline" data-group="${g}">
                  <label class="checkbox-item"><input type="checkbox" name="${g}" value="peu-importe" checked><span class="checkbox-box"></span><span class="checkbox-label">Peu importe</span></label>
                  ${g==='niveau'?`<label class="checkbox-item"><input type="checkbox" name="${g}" value="formation"><span class="checkbox-box"></span><span class="checkbox-label">En formation</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="confirme"><span class="checkbox-box"></span><span class="checkbox-label">Confirmé</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="experimente"><span class="checkbox-box"></span><span class="checkbox-label">Expérimenté</span></label>`:''}
                  ${g==='age'?`<label class="checkbox-item"><input type="checkbox" name="${g}" value="jeune"><span class="checkbox-box"></span><span class="checkbox-label">Jeune (&lt;18)</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="adulte"><span class="checkbox-box"></span><span class="checkbox-label">Adulte (18+)</span></label>`:''}
                  ${g==='style'?`<label class="checkbox-item"><input type="checkbox" name="${g}" value="doux"><span class="checkbox-box"></span><span class="checkbox-label">Doux</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="direct"><span class="checkbox-box"></span><span class="checkbox-label">Direct</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="ecoute"><span class="checkbox-box"></span><span class="checkbox-label">Juste écouter</span></label>`:''}
                  ${g==='genre'?`<label class="checkbox-item"><input type="checkbox" name="${g}" value="fille"><span class="checkbox-box"></span><span class="checkbox-label">Fille</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="garcon"><span class="checkbox-box"></span><span class="checkbox-label">Garçon</span></label><label class="checkbox-item"><input type="checkbox" name="${g}" value="non-binaire"><span class="checkbox-box"></span><span class="checkbox-label">Non-binaire</span></label>`:''}
                </div>
              </div>
            `).join('')}
          </div>
          <p class="auth-error" id="conv-form-error"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost modal-close">Annuler</button>
          <button class="btn btn-primary" id="conv-submit">${isReferent ? 'Envoyer ma demande' : 'Lancer la conversation'}</button>
        </div>
      </div>`, ov => {
        ov.querySelector('.modal-close').addEventListener('click', () => { ov.remove(); resolve(null); });
        ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(null); } });
      });

    // Motif
    const motifCbs = overlay.querySelectorAll('input[name="motif"]');
    motifCbs.forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) { motifCbs.forEach(o => { if (o !== cb) o.checked = false; }); motif = cb.value; }
      else motif = '';
    }));

    // Urgence
    const urgLabels = ['', '1/5 — Juste envie de parler', '2/5 — Un peu préoccupé·e', '3/5 — Moyennement urgent', '4/5 — Assez urgent', '5/5 — Je suis en crise'];
    const urgHint = overlay.querySelector('#urg-hint');
    overlay.querySelectorAll('.urgence-btn').forEach(btn => btn.addEventListener('click', () => {
      urgence = parseInt(btn.dataset.urg, 10);
      overlay.querySelectorAll('.urgence-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      urgHint.textContent = urgLabels[urgence];
    }));
    overlay.querySelector('.urgence-btn[data-urg="3"]')?.classList.add('active');

    // Prefs
    ['niveau','age','style','genre'].forEach(group => {
      const cbs = overlay.querySelectorAll(`input[name="${group}"]`);
      cbs.forEach(cb => cb.addEventListener('change', () => {
        const pi = overlay.querySelector(`input[name="${group}"][value="peu-importe"]`);
        if (cb.value === 'peu-importe' && cb.checked) cbs.forEach(o => { if (o !== cb) o.checked = false; });
        else if (cb.checked) { if (pi) pi.checked = false; }
        const anyChecked = Array.from(cbs).some(x => x.checked);
        if (!anyChecked && pi) pi.checked = true;
        const val = overlay.querySelector(`input[name="${group}"]:checked`)?.value || 'peu-importe';
        if (group === 'niveau') prefNiveau = val;
        if (group === 'age') prefAge = val;
        if (group === 'style') prefStyle = val;
        if (group === 'genre') prefGenre = val;
      }));
    });

    const motsInput = overlay.querySelector('#conv-mots');
    motsInput.addEventListener('input', () => { mots = motsInput.value; });

    overlay.querySelector('#conv-submit').addEventListener('click', () => {
      const err = overlay.querySelector('#conv-form-error');
      if (!motif) { err.textContent = '⚠️ Choisis un motif principal.'; return; }
      overlay.remove();
      resolve({ motif, urgence, mots: mots.trim(), prefs: { niveau: prefNiveau, age: prefAge, style: prefStyle, genre: prefGenre } });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATIONS — Membre
// ═══════════════════════════════════════════════════════════════════════════
async function findExistingConversation(type) {
  if (!currentUser) return null;
  try {
    const q = query(collection(db, 'conversations'),
      where('memberId', '==', currentUser.uid),
      where('type', '==', type),
      where('status', 'in', ['waiting', 'claimed']));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docs = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      return docs[0];
    }
  } catch (e) { console.warn('Erreur recherche conv :', e); }
  return null;
}

async function createConversation(type, formData) {
  if (!currentUser) return null;
  try {
    const newConv = {
      memberId: currentUser.uid,
      memberName: currentUserData?.displayName || 'Membre',
      memberUsername: currentUserData?.username || 'membre',
      status: 'waiting', claimedBy: null, claimedByName: null,
      type, motif: formData.motif, urgence: formData.urgence,
      mots: formData.mots || '', prefs: formData.prefs || {},
      createdAt: serverTimestamp(), claimedAt: null,
      lastMessage: formData.mots ? formData.mots.substring(0, 60) : '(nouvelle demande)',
      lastMessageAt: serverTimestamp(), lastMessageFrom: currentUser.uid
    };
    const ref = await addDoc(collection(db, 'conversations'), newConv);
    return { id: ref.id, ...newConv };
  } catch (e) { console.error('Erreur création conv :', e); alert('❌ Impossible de créer la conversation.'); return null; }
}

async function openMemberChat(type) {
  const chatType = type === 'mon-ecoutant' ? 'referent' : 'ephemere';
  const existing = await findExistingConversation(chatType);

  let needForm = chatType === 'ephemere' || (chatType === 'referent' && !existing);
  let formData = null;
  if (needForm) { formData = await openConvForm(chatType); if (!formData) return; }

  let conv = existing;
  if (!conv) { conv = await createConversation(chatType, formData); if (!conv) return; }

  const titleEl = $('chat-title'), subEl = $('chat-subtitle'), quitBtn = $('btn-quit-chat');
  if (type === 'mon-ecoutant') {
    if (titleEl) titleEl.textContent = '👤 Mon écoutant';
    if (subEl) subEl.textContent = 'Écoutant référent permanent';
    if (quitBtn) quitBtn.style.display = 'none';
  } else {
    if (titleEl) titleEl.textContent = '💬 Parler maintenant';
    if (subEl) subEl.textContent = 'En attente d\'un écoutant…';
    if (quitBtn) quitBtn.style.display = 'inline-flex';
  }

  openPage('app-membre', 'chat');
  memberConvId = conv.id;
  startMemberChatListener(conv.id);
}

function startMemberChatListener(convId) {
  if (memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
  const messagesEl = $('chat-messages');
  if (!messagesEl) return;
  messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';

  const unsubConv = onSnapshot(doc(db, 'conversations', convId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const subEl = $('chat-subtitle');
    if (data.status === 'waiting') { if (subEl) subEl.textContent = '⏳ En attente d\'un écoutant…'; }
    else if (data.status === 'claimed') { if (subEl) subEl.textContent = '💚 ' + (data.claimedByName || 'Écoutant') + ' t\'écoute'; }
    else if (data.status === 'resolved') { if (subEl) subEl.textContent = '✅ Conversation terminée'; }
  });

  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  const unsubMsgs = onSnapshot(q, snap => {
    if (snap.empty) { messagesEl.innerHTML = '<p class="empty-state">Dis bonjour 💙</p>'; return; }
    messagesEl.innerHTML = '';
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === currentUser.uid;
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
      div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.createdAt)}</span>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, () => { messagesEl.innerHTML = '<p class="empty-state">⚠️ Impossible de charger.</p>'; });

  memberChatUnsub = () => { unsubConv(); unsubMsgs(); };
}

async function sendMemberMessage(e) {
  e.preventDefault();
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || !currentUser || !memberConvId) return;
  input.value = '';
  try {
    await addDoc(collection(db, 'conversations', memberConvId, 'messages'), {
      text, senderId: currentUser.uid,
      senderName: currentUserData?.displayName || 'Membre',
      senderRole: 'membre', createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'conversations', memberConvId), {
      lastMessage: text.substring(0, 60),
      lastMessageAt: serverTimestamp(),
      lastMessageFrom: currentUser.uid
    });
  } catch (err) { console.error(err); alert('❌ Impossible d\'envoyer.'); }
}

async function quitMemberChat() {
  if (!memberConvId) return;
  if (!confirm('Quitter cette conversation ? Tu pourras revenir plus tard.')) return;
  const convId = memberConvId;
  if (memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
  try { await updateDoc(doc(db, 'conversations', convId), { status: 'abandoned', abandonedAt: serverTimestamp() }); }
  catch (e) { console.warn('Erreur abandon :', e); }
  memberConvId = null;
  openPage('app-membre', 'ecouter');
  setActiveNav('app-membre', 'ecouter');
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT ÉCOUTANT
// ═══════════════════════════════════════════════════════════════════════════
function initEcoutant() {
  startAttenteListener();
  startMesConvsListener();
  startResoluesListener();

  // Mini-onglets
  document.querySelectorAll('#app-ecoutant .mini-tab').forEach(tab => {
    if (tab.dataset.bound) return;
    tab.dataset.bound = '1';
    tab.addEventListener('click', () => {
      const container = tab.closest('.mini-tabs');
      if (container) container.dataset.active = tab.dataset.mini;
      tab.closest('.mini-tabs').querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const page = tab.closest('.page');
      page.querySelectorAll('.mini-content').forEach(c => c.classList.remove('active'));
      const content = page.querySelector(`.mini-content[data-mini-content="${tab.dataset.mini}"]`);
      if (content) content.classList.add('active');
    });
  });

  // Filtres
  setupFilters();

  // News
  startEcoNewsListener('news-eco-dynamic');

  // Chat
  const form = $('chat-eco-form');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', sendEcoMessage);
  }

  // Fils
  loadFilsList('eco');
  const btnProp = $('btn-proposer-post-eco');
  if (btnProp && !btnProp.dataset.bound) {
    btnProp.dataset.bound = '1';
    btnProp.addEventListener('click', openDemandeFilModal);
  }
  const btnNewPostEco = $('btn-fil-eco-new-post');
  if (btnNewPostEco && !btnNewPostEco.dataset.bound) {
    btnNewPostEco.dataset.bound = '1';
    btnNewPostEco.addEventListener('click', () => openCreatePostModal());
  }

  // Profil
  initProfilUI();
}

// ─── Listener conversations ───
function startAttenteListener() {
  if (unsubEcoAttente) unsubEcoAttente();
  const q = query(collection(db, 'conversations'), where('status', '==', 'waiting'));
  unsubEcoAttente = onSnapshot(q, snap => {
    ecoAttenteCache = [];
    snap.forEach(d => ecoAttenteCache.push({ id: d.id, ...d.data() }));
    renderAttente();
  }, err => console.error('Erreur attente :', err));
}

function renderAttente() {
  const container = $('convs-en-attente');
  const badge = $('badge-attente');
  if (!container) return;

  const filtersBox = document.querySelector('.mini-content[data-mini-content="en-attente"] .filters');
  const activeFilter = filtersBox?.dataset.filter || 'tout';

  let convs = [...ecoAttenteCache].sort((a, b) => {
    const uA = a.urgence || 0, uB = b.urgence || 0;
    if (uB !== uA) return uB - uA;
    return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
  });
  convs = applyFilter(convs, activeFilter);

  if (badge) {
    if (ecoAttenteCache.length > 0) { badge.textContent = ecoAttenteCache.length; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }

  if (convs.length === 0) { container.innerHTML = '<p class="empty-state">Aucune conversation en attente ✨</p>'; return; }

  container.innerHTML = convs.map(c => {
    const urg = c.urgence || 0;
    const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
    return `
      <div class="conv-card conv-urgent" data-conv-id="${c.id}">
        <div class="conv-info">
          <div class="conv-header-row">
            <span class="conv-name">${escapeHtml(c.memberName || 'Membre')}</span>
            <span class="conv-urgency">${stars}</span>
          </div>
          <span class="conv-username">@${escapeHtml(c.memberUsername || '')}</span>
          ${c.motif ? `<span class="conv-motif">🎯 ${escapeHtml(c.motif)}</span>` : ''}
          ${c.mots ? `<span class="conv-msg" style="font-style:italic;">"${escapeHtml(c.mots)}"</span>` : ''}
          ${c.prefs ? `<span class="conv-prefs">👥 ${formatPrefsPlain(c.prefs)}</span>` : ''}
          <span class="conv-date">${formatDate(c.createdAt)} ${formatTime(c.createdAt)}</span>
        </div>
        <button class="conv-action" data-claim-id="${c.id}">Prendre</button>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-claim-id]').forEach(btn => {
    btn.addEventListener('click', async e => { e.stopPropagation(); await claimConversation(btn.dataset.claimId); });
  });
}

function formatPrefsPlain(prefs) {
  const labels = { 'peu-importe':'Peu importe','formation':'En formation','confirme':'Confirmé','experimente':'Expérimenté','jeune':'Jeune','adulte':'Adulte','doux':'Doux','direct':'Direct','ecoute':'Juste écouter','fille':'Fille','garcon':'Garçon','non-binaire':'Non-binaire' };
  const parts = [];
  if (prefs.niveau && prefs.niveau !== 'peu-importe') parts.push('🎓 ' + labels[prefs.niveau]);
  if (prefs.age && prefs.age !== 'peu-importe') parts.push('🎂 ' + labels[prefs.age]);
  if (prefs.style && prefs.style !== 'peu-importe') parts.push('🗣️ ' + labels[prefs.style]);
  if (prefs.genre && prefs.genre !== 'peu-importe') parts.push('⚧️ ' + labels[prefs.genre]);
  return parts.join(' · ') || 'Aucune préférence';
}

async function claimConversation(convId) {
  if (!currentUser) return;
  try {
    const ref = doc(db, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'waiting' || data.claimedBy) { alert('⚠️ Déjà prise par un autre écoutant.'); return; }
    await updateDoc(ref, {
      status: 'claimed', claimedBy: currentUser.uid,
      claimedByName: currentUserData?.displayName || 'Écoutant',
      claimedAt: serverTimestamp()
    });
    openEcoChat(convId);
  } catch (e) { console.error('Erreur claim :', e); alert('❌ Impossible de prendre cette conversation.'); }
}

function startMesConvsListener() {
  if (unsubEcoMes) unsubEcoMes();
  const q = query(collection(db, 'conversations'),
    where('claimedBy', '==', currentUser.uid),
    where('status', '==', 'claimed'));
  unsubEcoMes = onSnapshot(q, snap => {
    ecoMesCache = [];
    snap.forEach(d => ecoMesCache.push({ id: d.id, ...d.data() }));
    renderMesConvs();
  }, err => console.error('Erreur mes convs :', err));
}

function renderMesConvs() {
  const container = $('convs-mes');
  if (!container) return;
  const filtersBox = document.querySelector('.mini-content[data-mini-content="mes-convs"] .filters');
  const activeFilter = filtersBox?.dataset.filter || 'tout';

  let convs = [...ecoMesCache].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0);
  });
  convs = applyFilter(convs, activeFilter);

  if (convs.length === 0) { container.innerHTML = '<p class="empty-state">Aucune conversation.</p>'; return; }

  container.innerHTML = convs.map(c => {
    const marked = c.marked ? '<span class="conv-marked">⭐</span>' : '';
    const pinned = c.pinned ? '📌 ' : '';
    const unread = isUnread(c) ? '<span class="conv-pastille"></span>' : '';
    const cat = c.categorie ? `<span class="conv-motif" style="font-size:10px;padding:2px 6px;">🏷️ ${escapeHtml(c.categorie)}</span>` : '';
    const urgEco = c.urgenceEco ? `<span class="conv-urgency" style="font-size:9px;">${'🔴'.repeat(c.urgenceEco)}${'⚪'.repeat(5-c.urgenceEco)}</span>` : '';
    return `
      <div class="conv-card ${c.pinned?'conv-pinned':''}" data-open-conv="${c.id}">
        <div class="conv-info">
          <span class="conv-name">${pinned}${marked} ${escapeHtml(c.memberName || 'Membre')} <small style="opacity:0.5;font-weight:400;">@${escapeHtml(c.memberUsername || '')}</small></span>
          <span class="conv-msg">${escapeHtml(c.lastMessage || 'Nouvelle conversation')}</span>
          <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap;">
            <span class="conv-msg" style="opacity:0.5;font-size:10px;">${formatTime(c.lastMessageAt)}</span>
            ${cat}${urgEco}
          </div>
        </div>
        ${unread}
        <button class="conv-menu">⋯</button>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-open-conv]').forEach(el => el.addEventListener('click', () => openEcoChat(el.dataset.openConv)));
}

function startResoluesListener() {
  if (unsubEcoResolues) unsubEcoResolues();
  const q = query(collection(db, 'conversations'),
    where('claimedBy', '==', currentUser.uid),
    where('status', '==', 'resolved'));
  unsubEcoResolues = onSnapshot(q, snap => {
    ecoResoluesCache = [];
    snap.forEach(d => ecoResoluesCache.push({ id: d.id, ...d.data() }));
    renderResolues();
  }, err => console.error('Erreur résolues :', err));
}

function renderResolues() {
  const container = $('convs-resolues');
  if (!container) return;
  if (ecoResoluesCache.length === 0) { container.innerHTML = '<p class="empty-state">Aucune conversation résolue ✅</p>'; return; }
  const sorted = [...ecoResoluesCache].sort((a, b) => (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0));
  container.innerHTML = sorted.map(c => `
    <div class="conv-card conv-resolved" data-open-conv="${c.id}">
      <div class="conv-info">
        <span class="conv-name">✅ ${escapeHtml(c.memberName || 'Membre')} <small style="opacity:0.5;font-weight:400;">@${escapeHtml(c.memberUsername || '')}</small></span>
        <span class="conv-msg">${escapeHtml(c.lastMessage || 'Aucun message')}</span>
        <span class="conv-msg" style="opacity:0.5;font-size:10px;">Résolu le ${formatDate(c.resolvedAt)}</span>
      </div>
    </div>`).join('');
  container.querySelectorAll('[data-open-conv]').forEach(el => el.addEventListener('click', () => openEcoChat(el.dataset.openConv, true)));
}

async function openEcoChat(convId, readOnly = false) {
  ecoConvId = convId;
  markConvAsRead(convId);
  openPage('app-ecoutant', 'chat-eco');
  const titleEl = $('chat-eco-title'), subEl = $('chat-eco-subtitle'), infosEl = $('chat-eco-infos');

  try {
    const snap = await getDoc(doc(db, 'conversations', convId));
    if (snap.exists()) {
      const c = snap.data();
      if (titleEl) titleEl.textContent = '💬 ' + (c.memberName || 'Membre');
      if (subEl) subEl.textContent = '@' + (c.memberUsername || 'membre');
      if (infosEl) {
        infosEl.innerHTML = '';
        const urg = c.urgence || 0;
        const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
        const banner = document.createElement('div');
        banner.className = 'conv-infos-banner';
        banner.innerHTML = `
          ${c.motif ? `<span class="conv-infos-item">🎯 <strong>${escapeHtml(c.motif)}</strong></span>` : ''}
          ${urg ? `<span class="conv-infos-item">🚦 <strong>${stars}</strong> (${urg}/5)</span>` : ''}
          ${c.mots ? `<span class="conv-infos-item" style="font-style:italic;">📝 "${escapeHtml(c.mots)}"</span>` : ''}
          ${c.prefs ? `<span class="conv-infos-item">👥 ${formatPrefsPlain(c.prefs)}</span>` : ''}`;
        infosEl.appendChild(banner);
        if (c.notesInternes) {
          const notes = document.createElement('div');
          notes.className = 'conv-notes-banner';
          notes.textContent = c.notesInternes;
          infosEl.appendChild(notes);
        }
      }
    }
  } catch (e) {}
  startEcoChatListener(convId);
}

function startEcoChatListener(convId) {
  if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
  const messagesEl = $('chat-eco-messages');
  if (!messagesEl) return;
  messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';

  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  ecoChatUnsub = onSnapshot(q, snap => {
    if (snap.empty) { messagesEl.innerHTML = '<p class="empty-state">Aucun message pour l\'instant.</p>'; return; }
    messagesEl.innerHTML = '';
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === currentUser.uid;
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
      div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.createdAt)}</span>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, () => { messagesEl.innerHTML = '<p class="empty-state">⚠️ Impossible de charger.</p>'; });
}

async function sendEcoMessage(e) {
  e.preventDefault();
  const input = $('chat-eco-input');
  const text = input.value.trim();
  if (!text || !currentUser || !ecoConvId) return;
  input.value = '';
  try {
    await addDoc(collection(db, 'conversations', ecoConvId, 'messages'), {
      text, senderId: currentUser.uid,
      senderName: currentUserData?.displayName || 'Écoutant',
      senderRole: 'ecoutant', createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'conversations', ecoConvId), {
      lastMessage: text.substring(0, 60),
      lastMessageAt: serverTimestamp(),
      lastMessageFrom: currentUser.uid
    });
  } catch (err) { console.error(err); alert('❌ Impossible d\'envoyer.'); }
}

// ─── Filtres ───
function isUnread(c) {
  if (!c.lastMessageFrom) return false;
  if (c.lastMessageFrom === currentUser.uid) return false;
  if (!c.lastReadAt) return true;
  const lastRead = c.lastReadAt.toMillis ? c.lastReadAt.toMillis() : 0;
  const lastMsg = c.lastMessageAt?.toMillis?.() || 0;
  return lastMsg > lastRead;
}
function isSansReponse(c) { return c.lastMessageFrom === c.memberId; }
function applyFilter(convs, filter) {
  switch (filter) {
    case 'non-lus': return convs.filter(isUnread);
    case 'sans-reponse': return convs.filter(isSansReponse);
    case 'marques': return convs.filter(c => c.marked === true);
    default: return convs;
  }
}

function setupFilters() {
  document.querySelectorAll('.filters').forEach(filtersBox => {
    if (filtersBox.dataset.bound) return;
    filtersBox.dataset.bound = '1';
    // Indicateur
    if (!filtersBox.querySelector('.filter-indicator')) {
      const ind = document.createElement('span');
      ind.className = 'filter-indicator';
      filtersBox.appendChild(ind);
    }
    const indicator = filtersBox.querySelector('.filter-indicator');
    const buttons = filtersBox.querySelectorAll('.filter');
    const count = buttons.length;
    indicator.style.width = `calc(${100 / count}% - ${(8 / count)}px)`;

    buttons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const label = btn.textContent.trim().toLowerCase();
        let key = 'tout';
        if (label.includes('non lu')) key = 'non-lus';
        else if (label.includes('sans réponse')) key = 'sans-reponse';
        else if (label.includes('marqu')) key = 'marques';
        filtersBox.dataset.filter = key;
        indicator.style.transform = `translateX(calc(100% * ${index}))`;
        const parent = filtersBox.closest('.mini-content');
        if (parent) {
          const section = parent.dataset.miniContent;
          if (section === 'en-attente') renderAttente();
          else if (section === 'mes-convs') renderMesConvs();
        }
      });
    });
  });
}

async function markConvAsRead(convId) {
  if (!currentUser) return;
  try { await updateDoc(doc(db, 'conversations', convId), { lastReadAt: serverTimestamp() }); } catch (e) {}
}

// ─── Menu ⋯ conversation ───
function openConvMenu(convId, anchorEl) {
  document.querySelector('.conv-menu-popup')?.remove();
  const conv = [...ecoMesCache, ...ecoAttenteCache, ...ecoResoluesCache].find(c => c.id === convId);
  if (!conv) return;
  const isEphemere = conv.type === 'ephemere';
  const isResolved = conv.status === 'resolved';

  const menu = document.createElement('div');
  menu.className = 'conv-menu-popup';
  menu.innerHTML = `
    <button class="conv-menu-item" data-action="urgence"><span class="menu-icon">🎯</span> Urgence perso ${conv.urgenceEco ? '· ' + conv.urgenceEco + '/5' : ''}</button>
    <button class="conv-menu-item" data-action="important"><span class="menu-icon">${conv.marked ? '⭐' : '☆'}</span> ${conv.marked ? 'Retirer important' : 'Marquer important'}</button>
    <button class="conv-menu-item" data-action="pin"><span class="menu-icon">📌</span> ${conv.pinned ? 'Désépingler' : 'Épingler'}</button>
    <button class="conv-menu-item" data-action="categorie"><span class="menu-icon">🏷️</span> Catégorie ${conv.categorie ? '· ' + conv.categorie : ''}</button>
    <button class="conv-menu-item" data-action="rappel"><span class="menu-icon">🔔</span> Rappel ${conv.rappelJours ? '· ' + conv.rappelJours + 'j' : ''}</button>
    <button class="conv-menu-item" data-action="notes"><span class="menu-icon">📝</span> Notes internes</button>
    <div class="conv-menu-sep"></div>
    ${isEphemere ? `<button class="conv-menu-item" data-action="${isResolved ? 'unresolve' : 'resoudre'}"><span class="menu-icon">${isResolved ? '↩️' : '✅'}</span> ${isResolved ? 'Rouvrir' : 'Marquer comme résolu'}</button><div class="conv-menu-sep"></div>` : ''}
    <button class="conv-menu-item danger" data-action="signaler"><span class="menu-icon">🚨</span> Signaler à un responsable</button>`;
  document.body.appendChild(menu);

  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 6, left = rect.left - 180;
  if (left < 10) left = 10;
  if (top + menu.offsetHeight > window.innerHeight) top = rect.top - menu.offsetHeight - 6;
  menu.style.top = Math.max(10, top) + 'px';
  menu.style.left = left + 'px';

  const closeHandler = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeHandler); } };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);

  menu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => { const action = btn.dataset.action; menu.remove(); await handleConvAction(conv, action); });
  });
}

async function handleConvAction(conv, action) {
  const ref = doc(db, 'conversations', conv.id);
  switch (action) {
    case 'urgence': return openUrgenceEcoModal(conv);
    case 'important': return await updateDoc(ref, { marked: !conv.marked });
    case 'pin': return await updateDoc(ref, { pinned: !conv.pinned });
    case 'categorie': return openCategorieModal(conv);
    case 'rappel': return openRappelModal(conv);
    case 'notes': return openNotesModal(conv);
    case 'resoudre':
      await updateDoc(ref, { status: 'resolved', resolvedAt: serverTimestamp() });
      if (ecoConvId === conv.id) {
        if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
        openPage('app-ecoutant', 'conversations');
      }
      return;
    case 'unresolve': return await updateDoc(ref, { status: 'claimed', resolvedAt: null });
    case 'signaler': return openSignalerModal(conv);
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.conv-menu');
  if (!btn) return;
  const card = btn.closest('[data-conv-id], [data-open-conv]');
  if (!card) return;
  const convId = card.dataset.convId || card.dataset.openConv;
  if (convId) openConvMenu(convId, btn);
});

function openUrgenceEcoModal(conv) {
  const current = conv.urgenceEco || 0;
  const overlay = openModal(`
    <div class="modal" style="max-width:400px;">
      <div class="modal-header"><div class="modal-title">🎯 Urgence perso</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Ta note personnelle (invisible pour le membre)</p>
        <div class="conv-opt-grid">
          ${[1,2,3,4,5].map(n => `<button class="conv-opt-btn ${n===current?'active':''}" data-urg="${n}">${n}</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-full" data-urg="0">Effacer la note</button>
      </div>
    </div>`);
  overlay.querySelectorAll('[data-urg]').forEach(btn => btn.addEventListener('click', async () => {
    const val = parseInt(btn.dataset.urg, 10);
    await updateDoc(doc(db, 'conversations', conv.id), { urgenceEco: val > 0 ? val : null });
    overlay.remove();
  }));
}

function openCategorieModal(conv) {
  const current = conv.categorie || '';
  const overlay = openModal(`
    <div class="modal" style="max-width:400px;">
      <div class="modal-header"><div class="modal-title">🏷️ Catégorie</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="conv-cat-grid">
          ${CONV_CATEGORIES.map(c => `<button class="conv-cat-btn ${c===current?'active':''}" data-cat="${c}">${c}</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-full" data-cat="">Effacer la catégorie</button>
      </div>
    </div>`);
  overlay.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', async () => {
    await updateDoc(doc(db, 'conversations', conv.id), { categorie: btn.dataset.cat || null });
    overlay.remove();
  }));
}

function openRappelModal(conv) {
  const current = conv.rappelJours || 0;
  const overlay = openModal(`
    <div class="modal" style="max-width:400px;">
      <div class="modal-header"><div class="modal-title">🔔 Rappel</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Me rappeler dans…</p>
        <div class="conv-opt-grid" style="grid-template-columns:repeat(4,1fr);">
          ${[1,3,7,14].map(n => `<button class="conv-opt-btn ${n===current?'active':''}" data-j="${n}">${n}j</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-full" data-j="0">Annuler le rappel</button>
      </div>
    </div>`);
  overlay.querySelectorAll('[data-j]').forEach(btn => btn.addEventListener('click', async () => {
    const j = parseInt(btn.dataset.j, 10);
    await updateDoc(doc(db, 'conversations', conv.id), {
      rappelJours: j > 0 ? j : null,
      rappelAt: j > 0 ? new Date(Date.now() + j * 24 * 60 * 60 * 1000) : null
    });
    overlay.remove();
  }));
}

function openNotesModal(conv) {
  const current = conv.notesInternes || '';
  const overlay = openModal(`
    <div class="modal" style="max-width:500px;">
      <div class="modal-header"><div class="modal-title">📝 Notes internes</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Visible uniquement par toi.</p>
        <textarea id="notes-text" placeholder="Rappels, observations…" style="min-height:180px;">${escapeHtml(current)}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuler</button>
        <button class="btn btn-primary" id="notes-save">💾 Enregistrer</button>
      </div>
    </div>`);
  overlay.querySelector('#notes-save').addEventListener('click', async () => {
    const text = overlay.querySelector('#notes-text').value.trim();
    await updateDoc(doc(db, 'conversations', conv.id), { notesInternes: text || null });
    overlay.remove();
  });
}

function openSignalerModal(conv) {
  const overlay = openModal(`
    <div class="modal" style="max-width:500px;">
      <div class="modal-header"><div class="modal-title">🚨 Signaler à un responsable</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Cette conversation sera transmise à un responsable.</p>
        <div class="field"><label>Raison du signalement</label><textarea id="signal-raison" placeholder="Explique pourquoi tu signales…" style="min-height:120px;"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuler</button>
        <button class="btn btn-primary" id="signal-send">Envoyer</button>
      </div>
    </div>`);
  overlay.querySelector('#signal-send').addEventListener('click', async () => {
    const raison = overlay.querySelector('#signal-raison').value.trim();
    if (!raison) { alert('⚠️ Indique une raison.'); return; }
    try {
      await addDoc(collection(db, 'signalements'), {
        convId: conv.id, memberId: conv.memberId, memberName: conv.memberName,
        ecoutantId: currentUser.uid, ecoutantName: currentUserData?.displayName || 'Écoutant',
        raison, status: 'pending', createdAt: serverTimestamp()
      });
      overlay.remove();
      alert('✅ Signalement envoyé.');
    } catch (e) { alert('❌ Erreur.'); }
  });
}

// ─── Mood viewer (écoutant voit le mood de son écouté) ───
function openMoodViewerFor(memberId, memberName) {
  let viewMonth = new Date(), viewMode = 'line', viewPeriod = 30;

  const overlay = openModal(`
    <div class="modal" style="max-width:900px;">
      <div class="modal-header">
        <div>
          <div class="modal-title">📊 Mood tracker de ${escapeHtml(memberName || 'Membre')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Suivi personnel — visible uniquement par toi</div>
        </div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" id="mood-viewer-body"><p class="empty-state">Chargement…</p></div>
    </div>`);

  const loadMonth = async month => {
    try {
      const snap = await getDoc(doc(db, 'users', memberId, 'moods', getMonthKey(month)));
      return snap.exists() ? (snap.data().cells || {}) : {};
    } catch (e) { return {}; }
  };

  const loadRecent = async days => {
    const today = new Date(), all = {}, monthsToFetch = new Set();
    for (let i = 0; i < days; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      monthsToFetch.add(getMonthKey(d));
    }
    for (const mk of monthsToFetch) {
      try {
        const snap = await getDoc(doc(db, 'users', memberId, 'moods', mk));
        if (snap.exists()) all[mk] = snap.data().cells || {};
      } catch (e) {}
    }
    return all;
  };

  const buildTable = cells => {
    const days = getDaysInMonth(viewMonth);
    const today = new Date();
    const isCurrent = today.getFullYear() === viewMonth.getFullYear() && today.getMonth() === viewMonth.getMonth();
    let html = '<table class="mood-table"><thead><tr><th>Élément</th>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const we = date.getDay() === 0 || date.getDay() === 6;
      const tj = isCurrent && today.getDate() === d;
      html += `<th class="${we?'weekend':''} ${tj?'today':''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';
    MOOD_ELEMENTS.forEach(el => {
      html += `<tr><th>${el.label}</th>`;
      for (let d = 1; d <= days; d++) {
        const tj = isCurrent && today.getDate() === d;
        const idx = cells[d] && cells[d][el.id] != null ? cells[d][el.id] : -1;
        const bg = idx >= 0 ? MOOD_COLORS[idx].hex : 'transparent';
        html += `<td class="mood-cell ${idx>=0?'has-color':''} ${tj?'today':''}" style="background:${bg}"></td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  };

  const buildChart = (allData, daysCount, mode) => {
    const W = 860, H = 320, padL = 30, padR = 20, padT = 20, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const today = new Date(), points = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const mk = getMonthKey(d), day = d.getDate();
      points.push({ day, cells: (allData[mk] && allData[mk][day]) || {} });
    }
    const maxY = 6;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="mood-chart-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;
    for (let lvl = 0; lvl <= maxY; lvl++) {
      const y = padT + innerH - (lvl / maxY) * innerH;
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)"/>`;
      svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="rgba(143,166,199,0.6)" font-size="9">${lvl}</text>`;
    }
    if (mode === 'line') {
      MOOD_ELEMENTS.forEach((el, elIdx) => {
        const color = ELEMENT_COLORS[elIdx], pts = [];
        points.forEach((p, i) => {
          const val = p.cells[el.id]; if (val == null) return;
          const x = padL + (i / (points.length - 1 || 1)) * innerW;
          const y = padT + innerH - (val / maxY) * innerH;
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        });
        if (pts.length > 1) svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" opacity="0.95"/>`;
        points.forEach((p, i) => {
          const val = p.cells[el.id]; if (val == null) return;
          const x = padL + (i / (points.length - 1 || 1)) * innerW;
          const y = padT + innerH - (val / maxY) * innerH;
          svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"/>`;
        });
      });
    } else {
      const clusterW = innerW / points.length, barW = Math.max(0.8, (clusterW * 0.9) / 7), gap = (clusterW - barW * 7) / 2;
      points.forEach((p, i) => {
        MOOD_ELEMENTS.forEach((el, elIdx) => {
          const val = p.cells[el.id]; if (val == null) return;
          const color = ELEMENT_COLORS[elIdx];
          const x = padL + i * clusterW + gap + elIdx * barW;
          const h = (val / maxY) * innerH, y = padT + innerH - h;
          svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(2)}" height="${h.toFixed(1)}" fill="${color}" opacity="0.9" rx="0.5"/>`;
        });
      });
    }
    const labelStep = Math.max(1, Math.ceil(points.length / 15));
    points.forEach((p, i) => {
      if (i % labelStep !== 0 && i !== points.length - 1) return;
      const x = padL + (i / (points.length - 1 || 1)) * innerW;
      svg += `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="rgba(143,166,199,0.6)" font-size="9">${p.day}</text>`;
    });
    return svg + '</svg>';
  };

  const renderAll = async () => {
    const body = overlay.querySelector('#mood-viewer-body');
    const tableCells = await loadMonth(viewMonth);
    const chartData = await loadRecent(viewPeriod);
    const monthTitle = formatMonthTitle(viewMonth);

    body.innerHTML = `
      <div class="section-label" style="margin-top:0;">📋 Tableau — ${monthTitle}</div>
      <div class="mood-month-nav" style="margin-bottom:10px;">
        <button class="mood-nav-btn" id="mv-prev" type="button">←</button>
        <h2 class="mood-month-title">${monthTitle}</h2>
        <button class="mood-nav-btn" id="mv-next" type="button">→</button>
      </div>
      <div class="mood-table-wrapper" style="max-height:380px;">${buildTable(tableCells)}</div>
      <div class="section-label" style="margin-top:24px;">📈 Graphique</div>
      <div class="mood-viewer-controls">
        <div class="mood-view-periods">
          ${[7,30,90,180].map(p => `<button class="mood-period-btn ${viewPeriod===p?'active':''}" data-period="${p}" type="button">${p===7?'7 jours':p===30?'30 jours':p===90?'3 mois':'6 mois'}</button>`).join('')}
        </div>
        <div class="mood-view-modes">
          <button class="mood-mode-btn ${viewMode==='line'?'active':''}" data-mode="line" type="button">📈 Courbes</button>
          <button class="mood-mode-btn ${viewMode==='bar'?'active':''}" data-mode="bar" type="button">📊 Barres</button>
        </div>
      </div>
      <div class="mood-view-legend">
        ${MOOD_ELEMENTS.map((el, i) => `<span class="mood-view-legend-item"><span class="mood-view-legend-dot" style="background:${ELEMENT_COLORS[i]}"></span>${el.label}</span>`).join('')}
      </div>
      <div class="mood-view-chart">${buildChart(chartData, viewPeriod, viewMode)}</div>`;

    body.querySelector('#mv-prev').addEventListener('click', () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); renderAll(); });
    body.querySelector('#mv-next').addEventListener('click', () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); renderAll(); });
    body.querySelectorAll('.mood-period-btn').forEach(btn => btn.addEventListener('click', () => { viewPeriod = parseInt(btn.dataset.period, 10); renderAll(); }));
    body.querySelectorAll('.mood-mode-btn').forEach(btn => btn.addEventListener('click', () => { viewMode = btn.dataset.mode; renderAll(); }));
  };

  renderAll();
}

// ─── Bind bouton mood viewer (une fois pour toutes) ───
setTimeout(() => {
  const moodBtn = $('btn-see-mood-eco');
  if (moodBtn && !moodBtn.dataset.bound) {
    moodBtn.dataset.bound = '1';
    moodBtn.addEventListener('click', () => {
      const mid = moodBtn.dataset.memberId, mname = moodBtn.dataset.memberName;
      if (mid) openMoodViewerFor(mid, mname);
    });
  }
}, 200);

// ─── MAJ du bouton mood selon la conv ouverte ───
function updateMoodBtn() {
  const moodBtn = $('btn-see-mood-eco');
  if (!moodBtn) return;
  if (!ecoConvId) { moodBtn.style.display = 'none'; return; }
  const conv = [...ecoMesCache, ...ecoAttenteCache, ...ecoResoluesCache].find(c => c.id === ecoConvId);
  if (conv && conv.memberId) {
    moodBtn.style.display = 'inline-flex';
    moodBtn.dataset.memberId = conv.memberId;
    moodBtn.dataset.memberName = conv.memberName || 'Membre';
  }
}
setInterval(updateMoodBtn, 800);

// ═══════════════════════════════════════════════════════════════════════════
// NEWS — Écoute temps réel (membre + écoutant)
// ═══════════════════════════════════════════════════════════════════════════
function startEcoNewsListener(containerId) {
  const container = $(containerId);
  if (!container) return;

  if (containerId === 'news-eco-dynamic' && unsubEcoNews) unsubEcoNews();

  const q = query(collection(db, 'news'), limit(50));
  const unsub = onSnapshot(q, snap => {
    const news = [];
    snap.forEach(d => news.push({ id: d.id, ...d.data() }));
    news.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (news.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '';
    news.forEach(n => {
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <span class="card-badge">${escapeHtml(n.type || '📰 Info')}</span>
        <h3>${escapeHtml(n.title || 'Sans titre')}</h3>
        <p>${escapeHtml(n.content || '')}</p>
        <span class="card-meta">Par ${escapeHtml(n.authorName || 'Admin')} • ${formatDate(n.createdAt)}</span>`;
      container.appendChild(article);
    });
  }, err => console.warn('Erreur news :', err));

  if (containerId === 'news-eco-dynamic') unsubEcoNews = unsub;
}

console.log('✅ main.js v3 — Partie 1/2 chargée');