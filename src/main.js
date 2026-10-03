// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — Logique principale (v2 — avec filtres + menu complet)
// ═══════════════════════════════════════════════════════════════════════════

console.log('🚀 main.js démarré');

const auth = window.iphaxAuth;
const db = window.iphaxDb;
const {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, onAuthStateChanged, updateProfile, signOut
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

let memberConvId = null;
let memberConvType = null;
let memberChatUnsubscribe = null;

let ecoConvId = null;
let ecoChatUnsubscribe = null;
let ecoEnAttenteUnsubscribe = null;
let ecoMesConvsUnsubscribe = null;
let ecoResoluesUnsubscribe = null;

let ecoEnAttenteCache = [];
let ecoMesConvsCache = [];
let ecoResoluesCache = [];

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING RÔLES ↔ BULLES
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

function roleCompatibleAvecBulle(role, bulle) {
  return (ROLES_PAR_BULLE[bulle] || ['membre']).includes(role);
}
function bulleDepuisRole(role) {
  for (const [b, roles] of Object.entries(ROLES_PAR_BULLE)) if (roles.includes(role)) return b;
  return 'membre';
}
function estEcoutant(role) {
  return role === 'ecoutant' || role === 'responsable' || role === 'chef_service';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
}
function showError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearError(id) { const el = document.getElementById(id); if (el) el.textContent = ''; }
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
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function traductError(code, rawMessage) {
  console.error('🔍 Code Firebase :', code, '| Message :', rawMessage);
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

// ═══════════════════════════════════════════════════════════════════════════
// INTRO → CONTINUER
// ═══════════════════════════════════════════════════════════════════════════
document.getElementById('btn-continuer').addEventListener('click', async () => {
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
  const pn = document.getElementById('profil-nom');
  const pu = document.getElementById('profil-username');
  if (pn) pn.textContent = data.displayName || 'Utilisateur';
  if (pu) pu.textContent = '@' + (data.username || 'inconnu');

  const pen = document.getElementById('profil-eco-nom');
  const peu = document.getElementById('profil-eco-username');
  if (pen) pen.textContent = data.displayName || 'Utilisateur';
  if (peu) peu.textContent = '@' + (data.username || 'inconnu');

  if (!data.cguAccepted) { showScreen('screen-cgu'); return; }

  const role = data.role || 'membre';
  if (estEcoutant(role)) {
    showScreen('app-ecoutant');
    setTimeout(() => initEcoListeners(), 300);
  } else {
    showScreen('app-membre');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLETS AUTH
// ═══════════════════════════════════════════════════════════════════════════
const tabs = document.querySelectorAll('.tab');
const tabsContainer = document.querySelector('.auth-tabs');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabsContainer.dataset.active = target;
    if (target === 'login') { formLogin.classList.add('active'); formSignup.classList.remove('active'); }
    else { formSignup.classList.add('active'); formLogin.classList.remove('active'); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BULLES DE RÔLE
// ═══════════════════════════════════════════════════════════════════════════
const roleBubbles = document.querySelectorAll('.role-bubble');
const authSubtitle = document.getElementById('auth-subtitle');
const authTitle = document.getElementById('auth-title');

const roleMessages = {
  membre:"Ici, quelqu'un t'écoute 💙", admin:'Espace administration 🔧',
  ecoutant:'Espace écoutant·e — Merci 💚', dev:'Espace développeur 💻', fondateur:'Accès fondateur 👑'
};
const roleTitles = {
  membre:'Bienvenue sur Iphax', admin:'Connexion administration',
  ecoutant:'Connexion écoutant·e', dev:'Connexion développeur', fondateur:'Connexion fondateur'
};

roleBubbles.forEach(bubble => {
  bubble.addEventListener('click', () => {
    const role = bubble.dataset.role;
    roleBubbles.forEach(b => b.classList.remove('active'));
    bubble.classList.add('active');
    if (authSubtitle) authSubtitle.textContent = roleMessages[role] || roleMessages.membre;
    if (authTitle) authTitle.textContent = roleTitles[role] || roleTitles.membre;
    if (role === 'membre') tabsContainer.style.display = 'flex';
    else {
      tabsContainer.style.display = 'none';
      formLogin.classList.add('active'); formSignup.classList.remove('active');
    }
    window.currentRole = role;
    clearError('login-error'); clearError('signup-error');
  });
});
window.currentRole = 'membre';

// ═══════════════════════════════════════════════════════════════════════════
// ŒIL MOT DE PASSE
// ═══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.toggle-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const isP = input.type === 'password';
    input.type = isP ? 'text' : 'password';
    btn.style.color = isP ? 'var(--cyan)' : 'var(--text-muted)';
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════
formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('signup-error');
  const email = document.getElementById('signup-email').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const displayName = document.getElementById('signup-displayname').value.trim();
  const birthdate = document.getElementById('signup-birthdate').value;
  const password = document.getElementById('signup-password').value;

  const age = calculerAge(birthdate);
  if (age >= 18) { showError('signup-error', '❌ Réservé aux moins de 18 ans.'); return; }
  if (age < 8) { showError('signup-error', '❌ Minimum 8 ans.'); return; }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    showError('signup-error', '🔑 1 lettre + 1 chiffre minimum.'); return;
  }
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(username)) {
    showError('signup-error', '👤 Nom d\'utilisateur invalide.'); return;
  }

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

// ═══════════════════════════════════════════════════════════════════════════
// CONNEXION
// ═══════════════════════════════════════════════════════════════════════════
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const bulleChoisie = window.currentRole || 'membre';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      showError('login-error', '⚠️ Profil incomplet.');
      await signOut(auth); return;
    }
    const data = snap.data();
    const role = data.role || 'membre';
    if (!roleCompatibleAvecBulle(role, bulleChoisie)) {
      await signOut(auth);
      const vraiEspace = LABELS_ESPACES[bulleDepuisRole(role)];
      const espaceTente = LABELS_ESPACES[bulleChoisie];
      const roleLabel = LABELS_ROLES[role] || role;
      showError('login-error',
        `🚫 Mauvais espace ! Ton compte est un compte ${roleLabel}, mais tu essaies de te connecter dans l'espace ${espaceTente}. Utilise la bulle « ${vraiEspace} ».`);
      return;
    }
    currentUser = user; currentUserData = data;
    routeUser(data);
  } catch (error) {
    showError('login-error', traductError(error.code, error.message));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE
// ═══════════════════════════════════════════════════════════════════════════
const btnGoogle = document.getElementById('btn-google');
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function handleGoogleUser(user, bulleChoisie) {
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
  if (!roleCompatibleAvecBulle(role, bulleChoisie)) {
    await signOut(auth);
    showScreen('screen-auth');
    setTimeout(() => {
      const vraiEspace = LABELS_ESPACES[bulleDepuisRole(role)];
      const espaceTente = LABELS_ESPACES[bulleChoisie];
      const roleLabel = LABELS_ROLES[role] || role;
      showError('login-error', `🚫 Mauvais espace ! Compte ${roleLabel}. Utilise la bulle « ${vraiEspace} ».`);
    }, 300);
    return;
  }
  currentUser = user; currentUserData = data;
  routeUser(data);
}

btnGoogle.addEventListener('click', async () => {
  clearError('login-error'); clearError('signup-error');
  const bulleChoisie = window.currentRole || 'membre';
  sessionStorage.setItem('iphax_bulle_choisie', bulleChoisie);
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await handleGoogleUser(result.user, bulleChoisie);
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
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
      const bulleChoisie = sessionStorage.getItem('iphax_bulle_choisie') || 'membre';
      sessionStorage.removeItem('iphax_bulle_choisie');
      await handleGoogleUser(result.user, bulleChoisie);
    }
  } catch (e) { console.error('Erreur redirect :', e); }
})();

// ═══════════════════════════════════════════════════════════════════════════
// CGU
// ═══════════════════════════════════════════════════════════════════════════
const cguText = document.getElementById('cgu-text');
const cguCheckbox = document.getElementById('cgu-checkbox');
const cguCheckLabel = document.getElementById('cgu-check-label');
const btnAcceptCgu = document.getElementById('btn-accept-cgu');
const btnRefuseCgu = document.getElementById('btn-refuse-cgu');
let cguUnlocked = false;

if (cguText) {
  cguText.addEventListener('scroll', () => {
    const atBottom = cguText.scrollTop + cguText.clientHeight >= cguText.scrollHeight - 15;
    if (atBottom && !cguUnlocked) {
      cguUnlocked = true;
      cguCheckbox.disabled = false;
      cguCheckLabel.classList.remove('disabled');
    }
  });
}
if (cguCheckbox) cguCheckbox.addEventListener('change', () => { btnAcceptCgu.disabled = !cguCheckbox.checked; });
if (btnRefuseCgu) {
  btnRefuseCgu.addEventListener('click', () => {
    signOut(auth).then(() => { currentUser = null; currentUserData = null; showScreen('screen-intro'); });
    if (cguCheckbox) {
      cguCheckbox.checked = false; cguCheckbox.disabled = true;
      cguCheckLabel.classList.add('disabled');
      btnAcceptCgu.disabled = true; cguUnlocked = false;
    }
  });
}
if (btnAcceptCgu) {
  btnAcceptCgu.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { cguAccepted: true, cguAcceptedAt: serverTimestamp(), cguVersion: '1.0' });
      currentUserData.cguAccepted = true;
      routeUser(currentUserData);
    } catch (error) { alert('❌ Erreur : ' + error.message); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION DES APPS
// ═══════════════════════════════════════════════════════════════════════════
function setupAppNavigation(appId) {
    const app = document.getElementById(appId);
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
        if (appId === 'app-membre' && target !== 'chat' && memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }
        if (appId === 'app-ecoutant' && target !== 'chat-eco' && ecoChatUnsubscribe) { ecoChatUnsubscribe(); ecoChatUnsubscribe = null; }
      });
    });
  }
  setupAppNavigation('app-membre');
  setupAppNavigation('app-ecoutant');
  
  function openPage(appId, pageName) {
    const app = document.getElementById(appId);
    if (!app) return;
    app.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = app.querySelector(`.page[data-page="${pageName}"]`);
    if (page) page.classList.add('active');
    const content = app.querySelector('.app-content');
    if (content) content.scrollTop = 0;
  }
  
  ['btn-back-perso','btn-back-perso-journal','btn-back-perso-objectifs','btn-back-perso-rappels'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => {
      openPage('app-membre', 'perso');
      const app = document.getElementById('app-membre');
      app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const t = app.querySelector('.nav-item[data-page="perso"]'); if (t) t.classList.add('active');
    });
  });
  const btnBackFil = document.getElementById('btn-back-fil');
  if (btnBackFil) btnBackFil.addEventListener('click', () => {
    openPage('app-membre', 'public');
    const app = document.getElementById('app-membre');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const t = app.querySelector('.nav-item[data-page="public"]'); if (t) t.classList.add('active');
  });
  const btnBackChat = document.getElementById('btn-back-chat');
  if (btnBackChat) btnBackChat.addEventListener('click', () => {
    if (memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }
    openPage('app-membre', 'ecouter');
    const app = document.getElementById('app-membre');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const t = app.querySelector('.nav-item[data-page="ecouter"]'); if (t) t.classList.add('active');
  });
  const btnBackChatEco = document.getElementById('btn-back-chat-eco');
  if (btnBackChatEco) btnBackChatEco.addEventListener('click', () => {
    if (ecoChatUnsubscribe) { ecoChatUnsubscribe(); ecoChatUnsubscribe = null; }
    openPage('app-ecoutant', 'conversations');
    const app = document.getElementById('app-ecoutant');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const t = app.querySelector('.nav-item[data-page="conversations"]'); if (t) t.classList.add('active');
  });
  
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      openPage('app-membre', target);
      if (target === 'mood-tracker') await initMoodTracker();
      if (target === 'journal') await loadJournal();
      if (target === 'objectifs') await loadObjectifs();
      if (target === 'rappels') await loadRappels();
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MOOD TRACKER
  // ═══════════════════════════════════════════════════════════════════════════
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
  
  let moodCurrentMonth = new Date();
  let moodData = {};
  
  function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`; }
  function getDaysInMonth(d) { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
  function formatMonthTitle(d) {
    const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${mois[d.getMonth()]} ${d.getFullYear()}`;
  }
  
  function renderMoodLegend() {
    const legend = document.getElementById('mood-legend');
    if (!legend) return;
    legend.innerHTML = MOOD_COLORS.map(c => `<div class="mood-legend-item"><span class="mood-legend-dot" style="background:${c.hex}"></span><span>${c.name}</span></div>`).join('');
  }
  
  function renderMoodTable() {
    const table = document.getElementById('mood-table');
    const title = document.getElementById('mood-month-title');
    if (!table || !title) return;
    title.textContent = formatMonthTitle(moodCurrentMonth);
    const days = getDaysInMonth(moodCurrentMonth);
    const today = new Date();
    const isCurrent = today.getFullYear() === moodCurrentMonth.getFullYear() && today.getMonth() === moodCurrentMonth.getMonth();
  
    let thead = '<thead><tr><th>Élément</th>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(moodCurrentMonth.getFullYear(), moodCurrentMonth.getMonth(), d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = isCurrent && today.getDate() === d;
      thead += `<th class="${isWeekend?'weekend':''} ${isToday?'today':''}">${d}</th>`;
    }
    thead += '</tr></thead>';
  
    let tbody = '<tbody>';
    MOOD_ELEMENTS.forEach(el => {
      tbody += `<tr><th>${el.label}</th>`;
      for (let d = 1; d <= days; d++) {
        const isToday = isCurrent && today.getDate() === d;
        const idx = moodData[d] && moodData[d][el.id] != null ? moodData[d][el.id] : -1;
        const bg = idx >= 0 ? MOOD_COLORS[idx].hex : 'transparent';
        tbody += `<td class="mood-cell ${idx>=0?'has-color':''} ${isToday?'today':''}" data-day="${d}" data-el="${el.id}" style="background:${bg}"></td>`;
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
      const snap = await getDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodCurrentMonth)));
      moodData = snap.exists() ? (snap.data().cells || {}) : {};
    } catch (e) { moodData = {}; }
  }
  async function saveMoodData() {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodCurrentMonth)),
        { cells: moodData, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) { alert('❌ Impossible d\'enregistrer.'); }
  }
  async function changeMonth(d) { moodCurrentMonth.setMonth(moodCurrentMonth.getMonth() + d); await loadMoodData(); renderMoodTable(); }
  async function initMoodTracker() { renderMoodLegend(); await loadMoodData(); renderMoodTable(); }
  
  function openMoodPicker(day, elementId) {
    const el = MOOD_ELEMENTS.find(e => e.id === elementId);
    const elLabel = el ? el.label : elementId;
    const currentColor = (moodData[day] && moodData[day][elementId] != null) ? moodData[day][elementId] : -1;
    const overlay = document.createElement('div');
    overlay.className = 'mood-picker-overlay';
    overlay.innerHTML = `
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
      </div>`;
    document.body.appendChild(overlay);
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
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }
  
  const btnMoodPrev = document.getElementById('mood-prev');
  const btnMoodNext = document.getElementById('mood-next');
  if (btnMoodPrev) btnMoodPrev.addEventListener('click', () => changeMonth(-1));
  if (btnMoodNext) btnMoodNext.addEventListener('click', () => changeMonth(+1));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL INTIME
  // ═══════════════════════════════════════════════════════════════════════════
  let journalCache = [];
  
  async function loadJournal() {
    const list = document.getElementById('journal-list');
    if (!list || !currentUser) return;
    try {
      const q = query(collection(db, 'users', currentUser.uid, 'journal'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      journalCache = [];
      snap.forEach(d => journalCache.push({ id: d.id, ...d.data() }));
      if (journalCache.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucune note pour l\'instant.</p>';
        return;
      }
      list.innerHTML = journalCache.map(entry => {
        const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date();
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
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date();
    const dateStr = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
    overlay.innerHTML = `
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
          <button class="btn btn-ghost" id="journal-close-btn">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#journal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#journal-delete-btn').addEventListener('click', async () => {
      if (!confirm('Supprimer cette note ?')) return;
      try { await deleteDoc(doc(db, 'users', currentUser.uid, 'journal', id)); overlay.remove(); await loadJournal(); }
      catch (e) { alert('❌ Erreur'); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }
  
  const btnNewJournal = document.getElementById('btn-new-journal');
  if (btnNewJournal) btnNewJournal.addEventListener('click', () => {
    let selectedPrivacy = 'private';
    let selectedMood = '';
    const EMOJIS = ['😢','😔','😐','🙂','😄','😰','😡','😴','🥰','🤔'];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
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
          <button class="btn btn-ghost" id="journal-cancel">Annuler</button>
          <button class="btn btn-primary" id="journal-save">💾 Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.journal-privacy-option').forEach(opt => {
      opt.addEventListener('click', () => {
        overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active'); selectedPrivacy = opt.dataset.privacy;
      });
    });
    overlay.querySelectorAll('.mood-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.mood-emoji-btn').forEach(b => b.style.borderColor = 'var(--border)');
        if (selectedMood === btn.dataset.emoji) { selectedMood = ''; btn.style.borderColor = 'var(--border)'; }
        else { selectedMood = btn.dataset.emoji; btn.style.borderColor = 'var(--cyan)'; }
      });
    });
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#journal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#journal-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#journal-title').value.trim();
      const content = overlay.querySelector('#journal-content').value.trim();
      if (!content) { alert('✍️ Écris quelque chose'); return; }
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'journal'), {
          title: title || 'Sans titre', content, shared: selectedPrivacy === 'shared',
          moodEmoji: selectedMood, createdAt: serverTimestamp()
        });
        overlay.remove(); await loadJournal();
      } catch (e) { alert('❌ Erreur'); }
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OBJECTIFS
  // ═══════════════════════════════════════════════════════════════════════════
  let objectifsCache = [];
  
  async function loadObjectifs() {
    const list = document.getElementById('objectifs-list');
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
      list.querySelectorAll('.objectif-check').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const item = objectifsCache.find(o => o.id === btn.dataset.id);
          if (!item) return;
          try { await updateDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id), { done: !item.done }); await loadObjectifs(); }
          catch (e) {}
        });
      });
      list.querySelectorAll('.objectif-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Supprimer cet objectif ?')) return;
          try { await deleteDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id)); await loadObjectifs(); }
          catch (e) {}
        });
      });
    } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
  }
  
  const btnNewObjectif = document.getElementById('btn-new-objectif');
  if (btnNewObjectif) btnNewObjectif.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">🎯 Nouvel objectif</div><button class="modal-close">×</button></div>
        <div class="modal-body"><div class="field"><label>Mon objectif</label><input type="text" id="objectif-text" placeholder="Ex: Boire plus d'eau..." maxlength="120"></div></div>
        <div class="modal-footer"><button class="btn btn-ghost" id="obj-cancel">Annuler</button><button class="btn btn-primary" id="obj-save">Ajouter</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#obj-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
    const list = document.getElementById('rappels-list');
    if (!list || !currentUser) return;
    try {
      const q = query(collection(db, 'users', currentUser.uid, 'rappels'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const rappels = [];
      snap.forEach(d => rappels.push({ id: d.id, ...d.data() }));
      if (rappels.length === 0) { list.innerHTML = '<p class="empty-state">Aucun rappel.</p>'; return; }
      list.innerHTML = rappels.map(r => `<div class="rappel-item"><div class="rappel-text">« ${escapeHtml(r.text)} »</div><button class="rappel-delete" data-id="${r.id}">🗑️</button></div>`).join('');
      list.querySelectorAll('.rappel-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ?')) return;
          try { await deleteDoc(doc(db, 'users', currentUser.uid, 'rappels', btn.dataset.id)); await loadRappels(); }
          catch (e) {}
        });
      });
    } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
  }
  
  const btnNewRappel = document.getElementById('btn-new-rappel');
  if (btnNewRappel) btnNewRappel.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">💡 Nouveau rappel</div><button class="modal-close">×</button></div>
        <div class="modal-body"><div class="field"><label>Ta phrase bienveillante</label><input type="text" id="rappel-text" placeholder="Ex: Je mérite d'être heureux·se..." maxlength="200"></div></div>
        <div class="modal-footer"><button class="btn btn-ghost" id="rap-cancel">Annuler</button><button class="btn btn-primary" id="rap-save">Ajouter</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#rap-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#rap-save').addEventListener('click', async () => {
      const text = overlay.querySelector('#rappel-text').value.trim();
      if (!text) { alert('✍️ Écris ton rappel'); return; }
      try { await addDoc(collection(db, 'users', currentUser.uid, 'rappels'), { text, createdAt: serverTimestamp() }); overlay.remove(); await loadRappels(); }
      catch (e) { alert('❌ Erreur'); }
    });
  });
  
// ═══════════════════════════════════════════════════════════════════════════
// FORMULAIRE DE DEMANDE DE CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════
const MOTIFS = [
    'Anxiété', 'Solitude', 'Tristesse', 'Colère', 'Harcèlement',
    'Famille', 'École', 'Amitié', 'Amour', 'Deuil', 'Autre'
  ];
  
  function openConvForm(type) {
    return new Promise((resolve) => {
      let motif = '';
      let urgence = 3;
      let mots = '';
      let prefNiveau = 'peu-importe';
      let prefAge = 'peu-importe';
      let prefStyle = 'peu-importe';
      let prefGenre = 'peu-importe';
  
      const isReferent = type === 'referent';
  
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:560px;">
          <div class="modal-header">
            <div>
              <div class="modal-title">${isReferent ? '👤 Trouver mon écoutant' : '💬 Nouvelle demande'}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                ${isReferent ? 'Ces infos aideront à te trouver le bon écoutant.' : 'Aide-nous à comprendre ce qui t\'amène.'}
              </div>
            </div>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
  
            <div class="field">
              <label>🎯 Motif principal</label>
              <div class="checkbox-list" data-group="motif">
                ${MOTIFS.map(m => `
                  <label class="checkbox-item">
                    <input type="checkbox" name="motif" value="${m}">
                    <span class="checkbox-box"></span>
                    <span class="checkbox-label">${m}</span>
                  </label>
                `).join('')}
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
  
              <div class="pref-block">
                <div class="pref-label">🎓 Niveau</div>
                <div class="checkbox-list checkbox-list-inline" data-group="niveau">
                  <label class="checkbox-item"><input type="checkbox" name="niveau" value="peu-importe" checked><span class="checkbox-box"></span><span class="checkbox-label">Peu importe</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="niveau" value="formation"><span class="checkbox-box"></span><span class="checkbox-label">En formation</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="niveau" value="confirme"><span class="checkbox-box"></span><span class="checkbox-label">Confirmé</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="niveau" value="experimente"><span class="checkbox-box"></span><span class="checkbox-label">Expérimenté</span></label>
                </div>
              </div>
  
              <div class="pref-block">
                <div class="pref-label">🎂 Âge</div>
                <div class="checkbox-list checkbox-list-inline" data-group="age">
                  <label class="checkbox-item"><input type="checkbox" name="age" value="peu-importe" checked><span class="checkbox-box"></span><span class="checkbox-label">Peu importe</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="age" value="jeune"><span class="checkbox-box"></span><span class="checkbox-label">Jeune (&lt;18)</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="age" value="adulte"><span class="checkbox-box"></span><span class="checkbox-label">Adulte (18+)</span></label>
                </div>
              </div>
  
              <div class="pref-block">
                <div class="pref-label">🗣️ Style</div>
                <div class="checkbox-list checkbox-list-inline" data-group="style">
                  <label class="checkbox-item"><input type="checkbox" name="style" value="peu-importe" checked><span class="checkbox-box"></span><span class="checkbox-label">Peu importe</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="style" value="doux"><span class="checkbox-box"></span><span class="checkbox-label">Doux</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="style" value="direct"><span class="checkbox-box"></span><span class="checkbox-label">Direct</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="style" value="ecoute"><span class="checkbox-box"></span><span class="checkbox-label">Juste écouter</span></label>
                </div>
              </div>
  
              <div class="pref-block">
                <div class="pref-label">⚧️ Genre</div>
                <div class="checkbox-list checkbox-list-inline" data-group="genre">
                  <label class="checkbox-item"><input type="checkbox" name="genre" value="peu-importe" checked><span class="checkbox-box"></span><span class="checkbox-label">Peu importe</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="genre" value="fille"><span class="checkbox-box"></span><span class="checkbox-label">Fille</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="genre" value="garcon"><span class="checkbox-box"></span><span class="checkbox-label">Garçon</span></label>
                  <label class="checkbox-item"><input type="checkbox" name="genre" value="non-binaire"><span class="checkbox-box"></span><span class="checkbox-label">Non-binaire</span></label>
                </div>
              </div>
  
            </div>
  
            <p class="auth-error" id="conv-form-error"></p>
  
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="conv-cancel">Annuler</button>
            <button class="btn btn-primary" id="conv-submit">
              ${isReferent ? 'Envoyer ma demande' : 'Lancer la conversation'}
            </button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
  
      const motifCheckboxes = overlay.querySelectorAll('input[name="motif"]');
      motifCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            motifCheckboxes.forEach(other => { if (other !== cb) other.checked = false; });
            motif = cb.value;
          } else motif = '';
        });
      });
  
      const urgHint = overlay.querySelector('#urg-hint');
      const urgLabels = ['', '1/5 — Juste envie de parler', '2/5 — Un peu préoccupé·e',
                         '3/5 — Moyennement urgent', '4/5 — Assez urgent', '5/5 — Je suis en crise'];
      overlay.querySelectorAll('.urgence-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          urgence = parseInt(btn.dataset.urg, 10);
          overlay.querySelectorAll('.urgence-btn').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          urgHint.textContent = urgLabels[urgence];
        });
      });
      overlay.querySelector('.urgence-btn[data-urg="3"]')?.classList.add('active');
  
      ['niveau', 'age', 'style', 'genre'].forEach(group => {
        const cbs = overlay.querySelectorAll(`input[name="${group}"]`);
        cbs.forEach(cb => {
          cb.addEventListener('change', () => {
            const peuImporteCb = overlay.querySelector(`input[name="${group}"][value="peu-importe"]`);
            if (cb.value === 'peu-importe' && cb.checked) {
              cbs.forEach(other => { if (other !== cb) other.checked = false; });
            } else if (cb.checked) {
              if (peuImporteCb) peuImporteCb.checked = false;
            }
            const anyChecked = Array.from(cbs).some(x => x.checked);
            if (!anyChecked && peuImporteCb) peuImporteCb.checked = true;
  
            const checked = overlay.querySelector(`input[name="${group}"]:checked`);
            const val = checked ? checked.value : 'peu-importe';
            if (group === 'niveau') prefNiveau = val;
            if (group === 'age') prefAge = val;
            if (group === 'style') prefStyle = val;
            if (group === 'genre') prefGenre = val;
          });
        });
      });
  
      const motsInput = overlay.querySelector('#conv-mots');
      motsInput.addEventListener('input', () => { mots = motsInput.value; });
  
      const close = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.querySelector('#conv-cancel').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  
      overlay.querySelector('#conv-submit').addEventListener('click', () => {
        const err = overlay.querySelector('#conv-form-error');
        if (!motif) { err.textContent = '⚠️ Choisis un motif principal.'; return; }
        if (!urgence) { err.textContent = '⚠️ Choisis un niveau d\'urgence.'; return; }
        const result = {
          motif, urgence,
          mots: mots.trim(),
          prefs: { niveau: prefNiveau, age: prefAge, style: prefStyle, genre: prefGenre }
        };
        overlay.remove();
        resolve(result);
      });
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATIONS PARTAGÉES — Membre
  // ═══════════════════════════════════════════════════════════════════════════
  async function findExistingConversation(type) {
    if (!currentUser) return null;
    try {
      const q = query(
        collection(db, 'conversations'),
        where('memberId', '==', currentUser.uid),
        where('type', '==', type),
        where('status', 'in', ['waiting', 'claimed'])
      );
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
        status: 'waiting',
        claimedBy: null, claimedByName: null,
        type: type,
        motif: formData.motif,
        urgence: formData.urgence,
        mots: formData.mots || '',
        prefs: formData.prefs || {},
        createdAt: serverTimestamp(),
        claimedAt: null,
        lastMessage: formData.mots ? formData.mots.substring(0, 60) : '(nouvelle demande)',
        lastMessageAt: serverTimestamp(),
        lastMessageFrom: currentUser.uid
      };
      const ref = await addDoc(collection(db, 'conversations'), newConv);
      return { id: ref.id, ...newConv };
    } catch (e) {
      console.error('Erreur création conv :', e);
      alert('❌ Impossible de créer la conversation.');
      return null;
    }
  }
  
  async function deleteConversation(convId) {
    try {
      const msgsSnap = await getDocs(collection(db, 'conversations', convId, 'messages'));
      for (const m of msgsSnap.docs) {
        await deleteDoc(doc(db, 'conversations', convId, 'messages', m.id));
      }
      await deleteDoc(doc(db, 'conversations', convId));
      return true;
    } catch (e) { console.error('Erreur suppression conv :', e); return false; }
  }
  
  async function openMemberChat(type) {
    memberConvType = type;
    const chatType = type === 'mon-ecoutant' ? 'referent' : 'ephemere';
  
    const existing = await findExistingConversation(chatType);
  
    let needForm = false;
    if (chatType === 'ephemere') needForm = true;
    if (chatType === 'referent' && !existing) needForm = true;
  
    let formData = null;
    if (needForm) {
      formData = await openConvForm(chatType);
      if (!formData) return;
    }
  
    let conv = existing;
    if (!conv) {
      conv = await createConversation(chatType, formData);
      if (!conv) return;
    }
  
    const titleEl = document.getElementById('chat-title');
    const subEl = document.getElementById('chat-subtitle');
    const quitBtn = document.getElementById('btn-quit-chat');
  
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
    if (memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';
  
    const convRef = doc(db, 'conversations', convId);
    const unsubConv = onSnapshot(convRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const subEl = document.getElementById('chat-subtitle');
      if (data.status === 'waiting') {
        if (subEl) subEl.textContent = '⏳ En attente d\'un écoutant…';
      } else if (data.status === 'claimed') {
        if (subEl) subEl.textContent = '💚 ' + (data.claimedByName || 'Écoutant') + ' t\'écoute';
      } else if (data.status === 'resolved') {
        if (subEl) subEl.textContent = '✅ Conversation terminée';
      }
    });
  
    const msgsRef = collection(db, 'conversations', convId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(300));
    const unsubMsgs = onSnapshot(q, (snap) => {
      if (snap.empty) {
        messagesEl.innerHTML = '<p class="empty-state">Dis bonjour 💙</p>';
        return;
      }
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
    }, () => {
      messagesEl.innerHTML = '<p class="empty-state">⚠️ Impossible de charger.</p>';
    });
  
    memberChatUnsubscribe = () => { unsubConv(); unsubMsgs(); };
  }
  
  const memberChatForm = document.getElementById('chat-form');
  if (memberChatForm) {
    memberChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
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
    });
  }
  
  // Bouton "Quitter la conversation"
  const btnQuitChat = document.getElementById('btn-quit-chat');
  if (btnQuitChat) {
    btnQuitChat.addEventListener('click', () => {
      if (!memberConvId) return;
      if (!confirm('Quitter cette conversation ? Tu pourras revenir plus tard.')) return;
      if (memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }
      openPage('app-membre', 'ecouter');
      const app = document.getElementById('app-membre');
      app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const t = app.querySelector('.nav-item[data-page="ecouter"]');
      if (t) t.classList.add('active');
    });
  }
  
  const btnParlerMaintenant = document.getElementById('btn-parler-maintenant');
  if (btnParlerMaintenant) btnParlerMaintenant.addEventListener('click', () => openMemberChat('parler-maintenant'));
  const btnMonEcoutant = document.getElementById('btn-mon-ecoutant');
  if (btnMonEcoutant) btnMonEcoutant.addEventListener('click', () => openMemberChat('mon-ecoutant'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ÉCOUTANT — LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════
  function initEcoListeners() {
    startEnAttenteListener();
    startMesConvsListener();
    startResoluesListener();
  }
  
  function startEnAttenteListener() {
    if (ecoEnAttenteUnsubscribe) ecoEnAttenteUnsubscribe();
    const q = query(collection(db, 'conversations'), where('status', '==', 'waiting'));
    ecoEnAttenteUnsubscribe = onSnapshot(q, (snap) => {
      ecoEnAttenteCache = [];
      snap.forEach(d => ecoEnAttenteCache.push({ id: d.id, ...d.data() }));
      renderEnAttente();
    }, (err) => console.error('Erreur attente :', err));
  }
  
  function renderEnAttente() {
    const container = document.getElementById('convs-en-attente');
    const badge = document.getElementById('badge-attente');
    if (!container) return;
  
    const filtersBox = document.querySelector('.mini-content[data-mini-content="en-attente"] .filters');
    const activeFilter = filtersBox?.dataset.filter || 'tout';
  
    let convs = [...ecoEnAttenteCache].sort((a, b) => {
      const uA = a.urgence || 0, uB = b.urgence || 0;
      if (uB !== uA) return uB - uA;
      return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
    });
  
    convs = applyFilter(convs, activeFilter);
  
    if (badge) {
      if (ecoEnAttenteCache.length > 0) {
        badge.textContent = ecoEnAttenteCache.length;
        badge.style.display = 'inline-block';
      } else badge.style.display = 'none';
    }
  
    if (convs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune conversation en attente ✨</p>';
      return;
    }
  
    container.innerHTML = convs.map(c => {
      const urg = c.urgence || 0;
      const urgenceStars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
      const motif = c.motif ? `<span class="conv-motif">🎯 ${escapeHtml(c.motif)}</span>` : '';
      const mots = c.mots ? `<span class="conv-msg" style="font-style:italic;">"${escapeHtml(c.mots)}"</span>` : '';
      const prefs = c.prefs ? formatPrefsHtml(c.prefs) : '';
  
      return `
        <div class="conv-card conv-urgent" data-conv-id="${c.id}">
          <div class="conv-info">
            <div class="conv-header-row">
              <span class="conv-name">${escapeHtml(c.memberName || 'Membre')}</span>
              <span class="conv-urgency">${urgenceStars}</span>
            </div>
            <span class="conv-username">@${escapeHtml(c.memberUsername || '')}</span>
            ${motif}
            ${mots}
            ${prefs}
            <span class="conv-date">${formatDate(c.createdAt)} ${formatTime(c.createdAt)}</span>
          </div>
          <button class="conv-action" data-claim-id="${c.id}">Prendre</button>
        </div>`;
    }).join('');
  
    container.querySelectorAll('[data-claim-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await claimConversation(btn.dataset.claimId);
      });
    });
  }
  
  function formatPrefsHtml(prefs) {
    const labels = {
      'peu-importe': 'Peu importe', 'formation':'En formation','confirme':'Confirmé','experimente':'Expérimenté',
      'jeune':'Jeune','adulte':'Adulte','doux':'Doux','direct':'Direct','ecoute':'Juste écouter',
      'fille':'Fille','garcon':'Garçon','non-binaire':'Non-binaire'
    };
    const parts = [];
    if (prefs.niveau && prefs.niveau !== 'peu-importe') parts.push('🎓 ' + labels[prefs.niveau]);
    if (prefs.age && prefs.age !== 'peu-importe') parts.push('🎂 ' + labels[prefs.age]);
    if (prefs.style && prefs.style !== 'peu-importe') parts.push('🗣️ ' + labels[prefs.style]);
    if (prefs.genre && prefs.genre !== 'peu-importe') parts.push('⚧️ ' + labels[prefs.genre]);
    if (parts.length === 0) return '';
    return `<span class="conv-prefs">👥 ${parts.join(' · ')}</span>`;
  }
  
  async function claimConversation(convId) {
    if (!currentUser) return;
    try {
      const convRef = doc(db, 'conversations', convId);
      const snap = await getDoc(convRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== 'waiting' || data.claimedBy) {
        alert('⚠️ Déjà prise par un autre écoutant.');
        return;
      }
      await updateDoc(convRef, {
        status: 'claimed',
        claimedBy: currentUser.uid,
        claimedByName: currentUserData?.displayName || 'Écoutant',
        claimedAt: serverTimestamp()
      });
      openEcoChat(convId);
    } catch (e) {
      console.error('Erreur claim :', e);
      alert('❌ Impossible de prendre cette conversation.');
    }
  }
  
  function startMesConvsListener() {
    if (ecoMesConvsUnsubscribe) ecoMesConvsUnsubscribe();
    const q = query(
      collection(db, 'conversations'),
      where('claimedBy', '==', currentUser.uid),
      where('status', '==', 'claimed')
    );
    ecoMesConvsUnsubscribe = onSnapshot(q, (snap) => {
      ecoMesConvsCache = [];
      snap.forEach(d => ecoMesConvsCache.push({ id: d.id, ...d.data() }));
      renderMesConvs();
    }, (err) => console.error('Erreur mes convs :', err));
  }
  
  function renderMesConvs() {
    const container = document.getElementById('convs-mes');
    if (!container) return;
  
    const filtersBox = document.querySelector('.mini-content[data-mini-content="mes-convs"] .filters');
    const activeFilter = filtersBox?.dataset.filter || 'tout';
  
    let convs = [...ecoMesConvsCache].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0);
    });
  
    convs = applyFilter(convs, activeFilter);
  
    if (convs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune conversation.</p>';
      return;
    }
  
    container.innerHTML = convs.map(c => {
      const marked = c.marked ? '<span class="conv-marked">⭐</span>' : '';
      const pinned = c.pinned ? '📌 ' : '';
      const unread = isUnread(c) ? '<span class="conv-pastille"></span>' : '';
      const cat = c.categorie ? `<span class="conv-motif" style="font-size:10px;padding:2px 6px;">🏷️ ${escapeHtml(c.categorie)}</span>` : '';
      const urgenceEco = c.urgenceEco ? `<span class="conv-urgency" style="font-size:9px;">${'🔴'.repeat(c.urgenceEco)}${'⚪'.repeat(5-c.urgenceEco)}</span>` : '';
  
      return `
        <div class="conv-card ${c.pinned?'conv-pinned':''}" data-open-conv="${c.id}">
          <div class="conv-info">
            <span class="conv-name">${pinned}${marked} ${escapeHtml(c.memberName || 'Membre')} <small style="opacity:0.5;font-weight:400;">@${escapeHtml(c.memberUsername || '')}</small></span>
            <span class="conv-msg">${escapeHtml(c.lastMessage || 'Nouvelle conversation')}</span>
            <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap;">
              <span class="conv-msg" style="opacity:0.5;font-size:10px;">${formatTime(c.lastMessageAt)}</span>
              ${cat}
              ${urgenceEco}
            </div>
          </div>
          ${unread}
          <button class="conv-menu">⋯</button>
        </div>
      `;
    }).join('');
  
    container.querySelectorAll('[data-open-conv]').forEach(el => {
      el.addEventListener('click', () => openEcoChat(el.dataset.openConv));
    });
  }
  
  function startResoluesListener() {
    if (ecoResoluesUnsubscribe) ecoResoluesUnsubscribe();
    const q = query(
      collection(db, 'conversations'),
      where('claimedBy', '==', currentUser.uid),
      where('status', '==', 'resolved')
    );
    ecoResoluesUnsubscribe = onSnapshot(q, (snap) => {
      ecoResoluesCache = [];
      snap.forEach(d => ecoResoluesCache.push({ id: d.id, ...d.data() }));
      renderResolues();
    }, (err) => console.error('Erreur résolues :', err));
  }
  
  function renderResolues() {
    const container = document.getElementById('convs-resolues');
    if (!container) return;
    if (ecoResoluesCache.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune conversation résolue ✅</p>';
      return;
    }
    const sorted = [...ecoResoluesCache].sort((a, b) =>
      (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0)
    );
    container.innerHTML = sorted.map(c => `
      <div class="conv-card conv-resolved" data-open-conv="${c.id}">
        <div class="conv-info">
          <span class="conv-name">✅ ${escapeHtml(c.memberName || 'Membre')} <small style="opacity:0.5;font-weight:400;">@${escapeHtml(c.memberUsername || '')}</small></span>
          <span class="conv-msg">${escapeHtml(c.lastMessage || 'Aucun message')}</span>
          <span class="conv-msg" style="opacity:0.5;font-size:10px;">Résolu le ${formatDate(c.resolvedAt)}</span>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('[data-open-conv]').forEach(el => {
      el.addEventListener('click', () => openEcoChat(el.dataset.openConv, true));
    });
  }
  
  async function openEcoChat(convId, readOnly = false) {
    ecoConvId = convId;
    markConvAsRead(convId);
    openPage('app-ecoutant', 'chat-eco');
    const titleEl = document.getElementById('chat-eco-title');
    const subEl = document.getElementById('chat-eco-subtitle');
    const infosEl = document.getElementById('chat-eco-infos');
  
    try {
      const snap = await getDoc(doc(db, 'conversations', convId));
      if (snap.exists()) {
        const c = snap.data();
        if (titleEl) titleEl.textContent = '💬 ' + (c.memberName || 'Membre');
        if (subEl) subEl.textContent = '@' + (c.memberUsername || 'membre');
  
        if (infosEl) {
          infosEl.innerHTML = '';
          const urg = c.urgence || 0;
          const urgenceStars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
          const banner = document.createElement('div');
          banner.className = 'conv-infos-banner';
          banner.innerHTML = `
            ${c.motif ? `<span class="conv-infos-item">🎯 <strong>${escapeHtml(c.motif)}</strong></span>` : ''}
            ${urg ? `<span class="conv-infos-item">🚦 <strong>${urgenceStars}</strong> (${urg}/5)</span>` : ''}
            ${c.mots ? `<span class="conv-infos-item" style="font-style:italic;">📝 "${escapeHtml(c.mots)}"</span>` : ''}
            ${c.prefs ? `<span class="conv-infos-item">👥 ${formatPrefsPlain(c.prefs)}</span>` : ''}
          `;
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
  
  function formatPrefsPlain(prefs) {
    const labels = {
      'peu-importe': 'Peu importe', 'formation':'En formation','confirme':'Confirmé','experimente':'Expérimenté',
      'jeune':'Jeune','adulte':'Adulte','doux':'Doux','direct':'Direct','ecoute':'Juste écouter',
      'fille':'Fille','garcon':'Garçon','non-binaire':'Non-binaire'
    };
    const parts = [];
    if (prefs.niveau && prefs.niveau !== 'peu-importe') parts.push('🎓 ' + labels[prefs.niveau]);
    if (prefs.age && prefs.age !== 'peu-importe') parts.push('🎂 ' + labels[prefs.age]);
    if (prefs.style && prefs.style !== 'peu-importe') parts.push('🗣️ ' + labels[prefs.style]);
    if (prefs.genre && prefs.genre !== 'peu-importe') parts.push('⚧️ ' + labels[prefs.genre]);
    return parts.join(' · ') || 'Aucune préférence';
  }
  
  function startEcoChatListener(convId) {
    if (ecoChatUnsubscribe) { ecoChatUnsubscribe(); ecoChatUnsubscribe = null; }
    const messagesEl = document.getElementById('chat-eco-messages');
    if (!messagesEl) return;
    messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';
  
    const msgsRef = collection(db, 'conversations', convId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(300));
  
    ecoChatUnsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        messagesEl.innerHTML = '<p class="empty-state">Aucun message pour l\'instant.</p>';
        return;
      }
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
    }, (err) => {
      messagesEl.innerHTML = '<p class="empty-state">⚠️ Impossible de charger.</p>';
    });
  }
  
  const ecoChatForm = document.getElementById('chat-eco-form');
  if (ecoChatForm) {
    ecoChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-eco-input');
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
    });
  }
  
  // Mini-onglets écoutant — indicateur glissant
  document.querySelectorAll('.mini-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const container = tab.closest('.mini-tabs');
      if (container) container.dataset.active = tab.dataset.mini;
      const target = tab.dataset.mini;
      document.querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.mini-content').forEach(c => c.classList.remove('active'));
      const content = document.querySelector(`.mini-content[data-mini-content="${target}"]`);
      if (content) content.classList.add('active');
    });
  });
  
// ═══════════════════════════════════════════════════════════════════════════
// FILTRES — Logique (Tout / Non lus / Sans réponse / Marqués)
// ═══════════════════════════════════════════════════════════════════════════
function isUnread(c) {
    if (!c.lastMessageFrom) return false;
    if (c.lastMessageFrom === currentUser.uid) return false;
    if (!c.lastReadAt) return true;
    const lastRead = c.lastReadAt.toMillis ? c.lastReadAt.toMillis() : 0;
    const lastMsg = c.lastMessageAt?.toMillis?.() || 0;
    return lastMsg > lastRead;
  }
  
  function isSansReponse(c) {
    return c.lastMessageFrom === c.memberId;
  }
  
  function applyFilter(convs, filter) {
    switch (filter) {
      case 'non-lus': return convs.filter(isUnread);
      case 'sans-reponse': return convs.filter(isSansReponse);
      case 'marques': return convs.filter(c => c.marked === true);
      case 'tout':
      default: return convs;
    }
  }
  
  // Câbler les filtres
  document.querySelectorAll('.filters').forEach(filtersBox => {
    const buttons = filtersBox.querySelectorAll('.filter');
    buttons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const label = btn.textContent.trim().toLowerCase();
        let filterKey = 'tout';
        if (label.includes('non lu')) filterKey = 'non-lus';
        else if (label.includes('sans réponse')) filterKey = 'sans-reponse';
        else if (label.includes('marqu')) filterKey = 'marques';
        filtersBox.dataset.filter = filterKey;
        const indicator = filtersBox.querySelector('.filter-indicator');
        if (indicator) {
          const count = buttons.length;
          indicator.style.width = `calc(${100 / count}% - ${(8 / count)}px)`;
          indicator.style.transform = `translateX(calc(100% * ${index}))`;
        }
        const parentContent = filtersBox.closest('.mini-content');
        if (parentContent) {
          const section = parentContent.dataset.miniContent;
          if (section === 'en-attente') renderEnAttente();
          else if (section === 'mes-convs') renderMesConvs();
        }
      });
    });
  });
  
  // Injecter les indicateurs de filtre au chargement
  function setupFilterIndicators() {
    document.querySelectorAll('.filters').forEach(container => {
      if (container.querySelector('.filter-indicator')) return;
      const filters = container.querySelectorAll('.filter');
      if (filters.length === 0) return;
      const indicator = document.createElement('span');
      indicator.className = 'filter-indicator';
      const count = filters.length;
      indicator.style.width = `calc(${100 / count}% - ${(8 / count)}px)`;
      container.appendChild(indicator);
    });
  }
  setupFilterIndicators();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MARQUER COMME LU
  // ═══════════════════════════════════════════════════════════════════════════
  async function markConvAsRead(convId) {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'conversations', convId), { lastReadAt: serverTimestamp() });
    } catch (e) { /* silencieux */ }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MENU "⋯" CONVERSATION — 8 actions
  // ═══════════════════════════════════════════════════════════════════════════
  const CONV_CATEGORIES = ['Anxiété', 'Solitude', 'Tristesse', 'Colère', 'Famille', 'École', 'Amitié', 'Deuil', 'Autre'];
  
  function openConvMenu(convId, anchorEl) {
    const existing = document.querySelector('.conv-menu-popup');
    if (existing) existing.remove();
  
    const conv = [...ecoMesConvsCache, ...ecoEnAttenteCache, ...ecoResoluesCache].find(c => c.id === convId);
    if (!conv) return;
  
    const isEphemere = conv.type === 'ephemere';
    const isResolved = conv.status === 'resolved';
  
    const menu = document.createElement('div');
    menu.className = 'conv-menu-popup';
    menu.innerHTML = `
      <button class="conv-menu-item" data-action="urgence">
        <span class="menu-icon">🎯</span> Urgence perso ${conv.urgenceEco ? '· ' + conv.urgenceEco + '/5' : ''}
      </button>
      <button class="conv-menu-item" data-action="important">
        <span class="menu-icon">${conv.marked ? '⭐' : '☆'}</span> ${conv.marked ? 'Retirer important' : 'Marquer important'}
      </button>
      <button class="conv-menu-item" data-action="pin">
        <span class="menu-icon">📌</span> ${conv.pinned ? 'Désépingler' : 'Épingler'}
      </button>
      <button class="conv-menu-item" data-action="categorie">
        <span class="menu-icon">🏷️</span> Catégorie ${conv.categorie ? '· ' + conv.categorie : ''}
      </button>
      <button class="conv-menu-item" data-action="rappel">
        <span class="menu-icon">🔔</span> Rappel ${conv.rappelJours ? '· ' + conv.rappelJours + 'j' : ''}
      </button>
      <button class="conv-menu-item" data-action="notes">
        <span class="menu-icon">📝</span> Notes internes
      </button>
      <div class="conv-menu-sep"></div>
      ${isEphemere ? `
        <button class="conv-menu-item" data-action="${isResolved ? 'unresolve' : 'resoudre'}">
          <span class="menu-icon">${isResolved ? '↩️' : '✅'}</span> ${isResolved ? 'Rouvrir' : 'Marquer comme résolu'}
        </button>
      ` : ''}
      <div class="conv-menu-sep"></div>
      <button class="conv-menu-item danger" data-action="signaler">
        <span class="menu-icon">🚨</span> Signaler à un responsable
      </button>
    `;
    document.body.appendChild(menu);
  
    const rect = anchorEl.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left - 180;
    if (left < 10) left = 10;
    if (top + menu.offsetHeight > window.innerHeight) top = rect.top - menu.offsetHeight - 6;
    menu.style.top = Math.max(10, top) + 'px';
    menu.style.left = left + 'px';
  
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeHandler); }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  
    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        menu.remove();
        await handleConvAction(conv, action);
      });
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
          if (ecoChatUnsubscribe) { ecoChatUnsubscribe(); ecoChatUnsubscribe = null; }
          openPage('app-ecoutant', 'conversations');
        }
        return;
      case 'unresolve':
        return await updateDoc(ref, { status: 'claimed', resolvedAt: null });
      case 'signaler': return openSignalerModal(conv);
    }
  }
  
  function openUrgenceEcoModal(conv) {
    const current = conv.urgenceEco || 0;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <div class="modal-title">🎯 Urgence perso</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Ta note personnelle (invisible pour le membre)</p>
          <div class="conv-opt-grid">
            ${[1,2,3,4,5].map(n => `<button class="conv-opt-btn ${n===current?'active':''}" data-urg="${n}">${n}</button>`).join('')}
          </div>
          <button class="btn btn-ghost btn-full" data-urg="0">Effacer la note</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('[data-urg]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = parseInt(btn.dataset.urg, 10);
        await updateDoc(doc(db, 'conversations', conv.id), { urgenceEco: val > 0 ? val : null });
        overlay.remove();
      });
    });
  }
  
  function openCategorieModal(conv) {
    const current = conv.categorie || '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <div class="modal-title">🏷️ Catégorie</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="conv-cat-grid">
            ${CONV_CATEGORIES.map(c => `<button class="conv-cat-btn ${c===current?'active':''}" data-cat="${c}">${c}</button>`).join('')}
          </div>
          <button class="btn btn-ghost btn-full" data-cat="">Effacer la catégorie</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.dataset.cat;
        await updateDoc(doc(db, 'conversations', conv.id), { categorie: val || null });
        overlay.remove();
      });
    });
  }
  
  function openRappelModal(conv) {
    const current = conv.rappelJours || 0;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <div class="modal-title">🔔 Rappel</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Me rappeler dans…</p>
          <div class="conv-opt-grid" style="grid-template-columns:repeat(4,1fr);">
            ${[1,3,7,14].map(n => `<button class="conv-opt-btn ${n===current?'active':''}" data-j="${n}">${n}j</button>`).join('')}
          </div>
          <button class="btn btn-ghost btn-full" data-j="0">Annuler le rappel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('[data-j]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const j = parseInt(btn.dataset.j, 10);
        await updateDoc(doc(db, 'conversations', conv.id), {
          rappelJours: j > 0 ? j : null,
          rappelAt: j > 0 ? new Date(Date.now() + j * 24 * 60 * 60 * 1000) : null
        });
        overlay.remove();
      });
    });
  }
  
  function openNotesModal(conv) {
    const current = conv.notesInternes || '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <div class="modal-title">📝 Notes internes</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Visible uniquement par toi.</p>
          <textarea id="notes-text" placeholder="Rappels, observations…" style="min-height:180px;">${escapeHtml(current)}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="notes-cancel">Annuler</button>
          <button class="btn btn-primary" id="notes-save">💾 Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#notes-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#notes-save').addEventListener('click', async () => {
      const text = overlay.querySelector('#notes-text').value.trim();
      await updateDoc(doc(db, 'conversations', conv.id), { notesInternes: text || null });
      overlay.remove();
    });
  }
  
  function openSignalerModal(conv) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <div class="modal-title">🚨 Signaler à un responsable</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Cette conversation sera transmise à un responsable.</p>
          <div class="field">
            <label>Raison du signalement</label>
            <textarea id="signal-raison" placeholder="Explique pourquoi tu signales…" style="min-height:120px;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="signal-cancel">Annuler</button>
          <button class="btn btn-primary" id="signal-send">Envoyer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#signal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
  
  // Câbler le bouton "⋯" via délégation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.conv-menu');
    if (!btn) return;
    const card = btn.closest('[data-conv-id], [data-open-conv]');
    if (!card) return;
    const convId = card.dataset.convId || card.dataset.openConv;
    if (convId) openConvMenu(convId, btn);
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FIL GÉNÉRAL
  // ═══════════════════════════════════════════════════════════════════════════
  const btnFilGeneral = document.getElementById('btn-fil-general');
  if (btnFilGeneral) btnFilGeneral.addEventListener('click', async () => {
    openPage('app-membre', 'fil-general');
    await loadFilGeneral();
  });
  
  async function loadFilGeneral() {
    const feed = document.getElementById('fil-general-feed');
    if (!feed) return;
    try {
      const q = query(collection(db, 'fil-general'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      if (snap.empty) { feed.innerHTML = '<p class="empty-state">Aucun post.</p>'; return; }
      feed.innerHTML = '';
      snap.forEach(d => {
        const post = d.data();
        const article = document.createElement('article');
        article.className = 'card';
        article.innerHTML = `
          <span class="card-badge">${post.anonyme ? '🎭 Anonyme' : '👤 ' + escapeHtml(post.authorName || 'Membre')}</span>
          <h3>${escapeHtml(post.title || 'Sans titre')}</h3>
          <p>${escapeHtml(post.content || '')}</p>
          <span class="card-meta">${formatDate(post.createdAt)}</span>`;
        feed.appendChild(article);
      });
    } catch (e) { feed.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
  }
  
  const btnDemandeFil = document.getElementById('btn-demande-fil');
  if (btnDemandeFil) btnDemandeFil.addEventListener('click', () => {
    let anonyme = true;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">✍️ Demander à publier</div><button class="modal-close">×</button></div>
        <div class="modal-body">
          <div class="field"><label>Anonyme ?</label>
            <div class="journal-privacy-choice">
              <button type="button" class="journal-privacy-option active" data-anon="true"><span class="privacy-icon">🎭</span><span class="privacy-label">Anonyme</span></button>
              <button type="button" class="journal-privacy-option" data-anon="false"><span class="privacy-icon">👤</span><span class="privacy-label">Avec mon pseudo</span></button>
            </div>
          </div>
          <div class="field"><label>Titre</label><input type="text" id="fil-title" placeholder="Un titre..." maxlength="100"></div>
          <div class="field"><label>Ton message</label><textarea id="fil-content" placeholder="Témoignage, mot gentil, conseil..." style="min-height:140px;"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="fil-cancel">Annuler</button>
          <button class="btn btn-primary" id="fil-send">Envoyer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.journal-privacy-option').forEach(opt => {
      opt.addEventListener('click', () => {
        overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active'); anonyme = opt.dataset.anon === 'true';
      });
    });
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#fil-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#fil-send').addEventListener('click', async () => {
      const title = overlay.querySelector('#fil-title').value.trim();
      const content = overlay.querySelector('#fil-content').value.trim();
      if (!content) { alert('✍️ Écris ton message'); return; }
      try {
        await addDoc(collection(db, 'demandes-fil'), {
          authorId: currentUser.uid, authorName: currentUserData?.displayName || 'Utilisateur',
          anonyme, title: title || 'Sans titre', content, status: 'pending', createdAt: serverTimestamp()
        });
        overlay.remove();
        alert('✅ Ta demande a été envoyée !');
      } catch (e) { alert('❌ Impossible d\'envoyer.'); }
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DÉCONNEXION
  // ═══════════════════════════════════════════════════════════════════════════
  function handleLogout() {
    if (!confirm('Se déconnecter d\'Iphax ?')) return;
    signOut(auth).then(() => {
      currentUser = null; currentUserData = null;
      if (memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }
      if (ecoChatUnsubscribe) { ecoChatUnsubscribe(); ecoChatUnsubscribe = null; }
      if (ecoEnAttenteUnsubscribe) { ecoEnAttenteUnsubscribe(); ecoEnAttenteUnsubscribe = null; }
      if (ecoMesConvsUnsubscribe) { ecoMesConvsUnsubscribe(); ecoMesConvsUnsubscribe = null; }
      if (ecoResoluesUnsubscribe) { ecoResoluesUnsubscribe(); ecoResoluesUnsubscribe = null; }
      showScreen('screen-intro');
    });
  }
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  const btnLogoutEco = document.getElementById('btn-logout-eco');
  if (btnLogoutEco) btnLogoutEco.addEventListener('click', handleLogout);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH STATE
  // ═══════════════════════════════════════════════════════════════════════════
  onAuthStateChanged(auth, async (user) => {
    authReady = true;
    if (user) {
      currentUser = user;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) currentUserData = snap.data();
      } catch (e) {}
    } else {
      currentUser = null; currentUserData = null;
    }
  });
  
  console.log('✅ main.js entièrement chargé');
  

// ═══════════════════════════════════════════════════════════════════════════
// PROFIL — Rendu de l'en-tête (avatar + nom + bio) + engrenage
// ═══════════════════════════════════════════════════════════════════════════

const AVATARS = [
  '🌙', '⭐', '✨', '🌌', '🌠',
  '🦉', '🐱', '🐶', '🦊', '🐰',
  '🐼', '🦋', '🌸', '🌺', '🌻',
  '🍀', '💙', '🎧', '🎨', '📚'
];

const THEMES = [
  { id: 'iphax',    label: 'Iphax',    colors: ['#00E5FF', '#0099FF', '#0057C9'] },
  { id: 'violet',   label: 'Violet',   colors: ['#A78BFA', '#7C3AED', '#5B21B6'] },
  { id: 'rose',     label: 'Rose',     colors: ['#F472B6', '#DB2777', '#9D174D'] },
  { id: 'emeraude', label: 'Émeraude', colors: ['#3DDC97', '#059669', '#065F46'] },
  { id: 'sunset',   label: 'Sunset',   colors: ['#FB923C', '#EA580C', '#9A3412'] }
];

// Appliquer le thème sauvegardé au démarrage
function applyTheme(themeId) {
  document.body.dataset.theme = themeId || 'iphax';
  try { localStorage.setItem('iphax_theme', themeId || 'iphax'); } catch(e) {}
}
applyTheme(localStorage.getItem('iphax_theme') || 'iphax');

// Calcul jours restants pour cooldown
function joursRestants(lastChangeTs, cooldownJours) {
  if (!lastChangeTs) return 0;
  const last = lastChangeTs.toMillis ? lastChangeTs.toMillis() : new Date(lastChangeTs).getTime();
  const diffMs = (cooldownJours * 24 * 60 * 60 * 1000) - (Date.now() - last);
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

// ─── Rendu de l'en-tête du profil ───
function renderProfilHeader(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!data) return;

  const avatar = data.avatar || '🌙';
  const displayName = data.displayName || 'Utilisateur';
  const username = data.username || 'inconnu';
  const bio = data.bio || '';

  container.innerHTML = `
    <div class="profil-avatar" id="${containerId}-avatar-btn" title="Changer d'avatar">
      <span class="profil-avatar-emoji">${avatar}</span>
      <span class="profil-avatar-edit">✏️</span>
    </div>
    <div class="profil-infos">
      <div class="profil-name">${escapeHtml(displayName)}</div>
      <div class="profil-username">@${escapeHtml(username)}</div>
      ${bio ? `<div class="profil-bio">${escapeHtml(bio)}</div>` : ''}
    </div>
  `;

  const avatarBtn = document.getElementById(`${containerId}-avatar-btn`);
  if (avatarBtn) avatarBtn.addEventListener('click', () => openAvatarPicker(data));
}

// ─── Modale : sélecteur d'avatar ───
function openAvatarPicker(data) {
  const current = data.avatar || '🌙';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-header">
        <div class="modal-title">🖼️ Choisis ton avatar</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="avatar-grid">
          ${AVATARS.map(a => `<button class="avatar-choice ${a===current?'selected':''}" data-avatar="${a}">${a}</button>`).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('.avatar-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen = btn.dataset.avatar;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { avatar: chosen });
        currentUserData.avatar = chosen;
        overlay.remove();
        refreshProfils();
      } catch (e) { alert('❌ Erreur'); }
    });
  });
}

// ─── Modale : sélecteur de thème ───
function openThemePicker() {
  const current = localStorage.getItem('iphax_theme') || 'iphax';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">🎨 Choisis ton thème</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="theme-grid">
          ${THEMES.map(t => `
            <div>
              <button class="theme-choice ${t.id===current?'selected':''}" data-theme="${t.id}"
                style="background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]},${t.colors[2]});"></button>
              <div class="theme-label">${t.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('.theme-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen = btn.dataset.theme;
      applyTheme(chosen);
      overlay.remove();
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: chosen });
        currentUserData.theme = chosen;
      } catch (e) {}
      refreshProfils();
    });
  });
}

// ─── Modale : modifier nom d'affichage ───
function openEditDisplayName() {
  const current = currentUserData.displayName || '';
  const jours = joursRestants(currentUserData.lastDisplayNameChange, 7);
  if (jours > 0) { alert(`⏳ Attends encore ${jours} jour(s) avant de changer ton nom d'affichage.`); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">✏️ Nom d'affichage</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Nom d'affichage (30 car. max, modifiable 1x/7j)</label>
          <input type="text" id="edit-displayname" value="${escapeHtml(current)}" maxlength="30" placeholder="Luna 🌙">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="edit-dn-cancel">Annuler</button>
        <button class="btn btn-primary" id="edit-dn-save">💾 Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-dn-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#edit-dn-save').addEventListener('click', async () => {
    const val = overlay.querySelector('#edit-displayname').value.trim();
    if (!val) { alert('⚠️ Entre un nom.'); return; }
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { displayName: val, lastDisplayNameChange: serverTimestamp() });
      currentUserData.displayName = val;
      overlay.remove();
      refreshProfils();
    } catch (e) { alert('❌ Erreur'); }
  });
}

// ─── Modale : modifier nom d'utilisateur ───
function openEditUsername() {
  const current = currentUserData.username || '';
  const jours = joursRestants(currentUserData.lastUsernameChange, 30);
  if (jours > 0) { alert(`⏳ Attends encore ${jours} jour(s) avant de changer ton nom d'utilisateur.`); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">✏️ Nom d'utilisateur</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Nom d'utilisateur (3-24 car., unique, 1x/30j)</label>
          <div class="field-input">
            <span class="field-prefix">@</span>
            <input type="text" id="edit-username" value="${escapeHtml(current)}" minlength="3" maxlength="24" pattern="^[A-Za-z][A-Za-z0-9._-]{2,23}$" autocomplete="off">
          </div>
          <p class="field-hint" id="un-hint">3-24 car., commence par une lettre, autorisé : . _ -</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="edit-un-cancel">Annuler</button>
        <button class="btn btn-primary" id="edit-un-save">💾 Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-un-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#edit-un-save').addEventListener('click', async () => {
    const val = overlay.querySelector('#edit-username').value.trim();
    const hint = overlay.querySelector('#un-hint');

    if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(val)) {
      hint.textContent = '⚠️ Nom invalide (3-24 car., commence par une lettre).';
      hint.style.color = 'var(--error)';
      return;
    }
    // Si c'est le même, pas de vérification
    if (val.toLowerCase() === (current || '').toLowerCase()) {
      overlay.remove();
      return;
    }

    hint.textContent = '🔍 Vérification...';
    hint.style.color = 'var(--text-muted)';

    try {
      // Vérifier si le username est déjà pris
      const q = query(collection(db, 'users'), where('username', '==', val));
      const snap = await getDocs(q);
      const taken = snap.docs.some(d => d.id !== currentUser.uid);

      if (taken) {
        hint.textContent = '❌ Ce nom d\'utilisateur est déjà pris.';
        hint.style.color = 'var(--error)';
        return;
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        username: val,
        lastUsernameChange: serverTimestamp()
      });
      currentUserData.username = val;
      overlay.remove();
      refreshProfils();
    } catch (e) {
      console.error(e);
      hint.textContent = '❌ Erreur, réessaie.';
      hint.style.color = 'var(--error)';
    }
  });
}

// ─── Modale : modifier bio ───
function openEditBio() {
  const current = currentUserData.bio || '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">📝 Bio</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Courte description (150 car. max)</label>
          <textarea id="edit-bio" maxlength="150" placeholder="Quelques mots sur toi…" style="min-height:100px;">${escapeHtml(current)}</textarea>
          <div class="bio-counter" id="bio-counter">${current.length}/150</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="edit-bio-cancel">Annuler</button>
        <button class="btn btn-primary" id="edit-bio-save">💾 Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-bio-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const ta = overlay.querySelector('#edit-bio');
  const counter = overlay.querySelector('#bio-counter');
  ta.addEventListener('input', () => { counter.textContent = `${ta.value.length}/150`; });
  overlay.querySelector('#edit-bio-save').addEventListener('click', async () => {
    const val = ta.value.trim();
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { bio: val || null });
      currentUserData.bio = val;
      overlay.remove();
      refreshProfils();
    } catch (e) { alert('❌ Erreur'); }
  });
}

// ─── Modale : Paramètres ───
function openSettingsModal() {
  const currentTheme = localStorage.getItem('iphax_theme') || 'iphax';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <div class="modal-header">
        <div class="modal-title">⚙️ Paramètres</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label style="font-size:14px;color:var(--text-primary);font-weight:600;">🎨 Thème</label>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 10px 4px;">Clique sur une couleur pour changer instantanément.</p>
          <div class="theme-grid">
            ${THEMES.map(t => `
              <div>
                <button class="theme-choice ${t.id===currentTheme?'selected':''}" data-theme="${t.id}"
                  style="background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]},${t.colors[2]});"></button>
                <div class="theme-label">${t.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="field" style="margin-top:24px;">
          <label style="font-size:14px;color:var(--text-primary);font-weight:600;">👤 Profil</label>
          <button class="btn btn-ghost btn-full" id="settings-dn" style="justify-content:flex-start;">✏️ Modifier le nom d'affichage</button>
          <button class="btn btn-ghost btn-full" id="settings-un" style="justify-content:flex-start;margin-top:8px;">👤 Modifier le nom d'utilisateur</button>
          <button class="btn btn-ghost btn-full" id="settings-bio" style="justify-content:flex-start;margin-top:8px;">📝 Modifier la bio</button>
        </div>

        <div class="field" style="margin-top:24px;">
          <label style="font-size:14px;color:var(--text-primary);font-weight:600;">🔐 Sécurité</label>
          <button class="btn btn-ghost btn-full" id="settings-password" style="justify-content:flex-start;">🔑 Changer le mot de passe</button>
        </div>

        <div class="field" style="margin-top:24px;">
          <label style="font-size:14px;color:var(--text-primary);font-weight:600;">ℹ️ Informations privées</label>
          <div style="padding:12px;background:rgba(10,26,61,0.5);border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary);">
            📧 ${escapeHtml(currentUserData?.email || 'non renseigné')}<br>
            🎂 ${escapeHtml(currentUserData?.birthdate || 'non renseignée')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="settings-logout" style="flex:1;">🚪 Déconnexion</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // 🎨 Thème — clic direct sur une couleur
  overlay.querySelectorAll('.theme-choice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen = btn.dataset.theme;
      applyTheme(chosen);
      overlay.querySelectorAll('.theme-choice').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: chosen });
        currentUserData.theme = chosen;
      } catch (e) {}
    });
  });

  // Autres boutons
  overlay.querySelector('#settings-dn').addEventListener('click', () => { overlay.remove(); setTimeout(openEditDisplayName, 150); });
  overlay.querySelector('#settings-un').addEventListener('click', () => { overlay.remove(); setTimeout(openEditUsername, 150); });
  overlay.querySelector('#settings-bio').addEventListener('click', () => { overlay.remove(); setTimeout(openEditBio, 150); });
  overlay.querySelector('#settings-password').addEventListener('click', () => { overlay.remove(); setTimeout(openChangePassword, 150); });
  overlay.querySelector('#settings-logout').addEventListener('click', () => { overlay.remove(); handleLogout(); });
}

// ─── Rafraîchir les profils ───
function refreshProfils() {
  if (!currentUserData) return;
  renderProfilHeader('profil-header', currentUserData);
  renderProfilHeader('profil-eco-header', currentUserData);
}

// ─── Câbler les engrenages ⚙️ ───
function setupSettingsGears() {
  const gearMembre = document.getElementById('btn-gear');
  if (gearMembre && !gearMembre.dataset.bound) {
    gearMembre.dataset.bound = '1';
    gearMembre.addEventListener('click', openSettingsModal);
  }
  const gearEco = document.getElementById('btn-gear-eco');
  if (gearEco && !gearEco.dataset.bound) {
    gearEco.dataset.bound = '1';
    gearEco.addEventListener('click', openSettingsModal);
  }
}

// ─── Surveillance : rendu automatique du profil ───
setInterval(() => {
  if (!currentUserData) return;
  const pH = document.getElementById('profil-header');
  const peH = document.getElementById('profil-eco-header');
  if (pH && !pH.innerHTML.trim()) renderProfilHeader('profil-header', currentUserData);
  if (peH && !peH.innerHTML.trim()) renderProfilHeader('profil-eco-header', currentUserData);
  setupSettingsGears();
}, 500);

console.log('✅ Profil + engrenage chargés');

// ═══════════════════════════════════════════════════════════════════════════
// CHANGER LE MOT DE PASSE (style TikTok)
// ═══════════════════════════════════════════════════════════════════════════
const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = window.fbAuthFns;

function openChangePassword() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">🔑 Changer le mot de passe</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Mot de passe actuel</label>
          <div class="field-input">
            <input type="password" id="pw-current" placeholder="Ton mot de passe actuel" autocomplete="current-password">
          </div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Nouveau mot de passe</label>
          <div class="field-input">
            <input type="password" id="pw-new" placeholder="Min. 8 car., 1 lettre + 1 chiffre" autocomplete="new-password">
          </div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Confirmer le nouveau mot de passe</label>
          <div class="field-input">
            <input type="password" id="pw-confirm" placeholder="Retape le nouveau mot de passe" autocomplete="new-password">
          </div>
        </div>
        <p class="auth-error" id="pw-error" style="margin-top:12px;"></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="pw-cancel">Annuler</button>
        <button class="btn btn-primary" id="pw-save">💾 Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#pw-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#pw-save').addEventListener('click', async () => {
    const current = overlay.querySelector('#pw-current').value;
    const newPw = overlay.querySelector('#pw-new').value;
    const confirm = overlay.querySelector('#pw-confirm').value;
    const err = overlay.querySelector('#pw-error');
    err.textContent = '';

    if (!current) { err.textContent = '⚠️ Entre ton mot de passe actuel.'; return; }
    if (newPw.length < 8) { err.textContent = '⚠️ Nouveau mot de passe : 8 car. minimum.'; return; }
    if (!/[A-Za-z]/.test(newPw) || !/[0-9]/.test(newPw)) { err.textContent = '⚠️ Il faut au moins 1 lettre et 1 chiffre.'; return; }
    if (newPw !== confirm) { err.textContent = '⚠️ Les deux mots de passe ne correspondent pas.'; return; }
    if (newPw === current) { err.textContent = '⚠️ Choisis un mot de passe différent.'; return; }

    try {
      err.textContent = '🔍 Vérification...';
      err.style.color = 'var(--text-muted)';

      // 1. Réauthentifier avec le mot de passe actuel
      const credential = EmailAuthProvider.credential(currentUser.email, current);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Changer le mot de passe
      await updatePassword(currentUser, newPw);

      overlay.remove();
      alert('✅ Mot de passe changé avec succès !');
    } catch (e) {
      console.error(e);
      err.style.color = 'var(--error)';
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        err.textContent = '❌ Mot de passe actuel incorrect.';
      } else if (e.code === 'auth/too-many-requests') {
        err.textContent = '⏳ Trop de tentatives. Patiente.';
      } else {
        err.textContent = '❌ Erreur : ' + (e.message || 'réessaie.');
      }
    }
  });
}

console.log('✅ Changement de mot de passe prêt');

// ═══════════════════════════════════════════════════════════════════════════
// MOOD VIEWER — l'écoutant voit le mood tracker de son écouté
// ═══════════════════════════════════════════════════════════════════════════

const ELEMENT_COLORS = [
  '#FFD93D', // humeur
  '#A78BFA', // sommeil
  '#FF9F45', // energie
  '#E04A5A', // anxiete
  '#3DDC97', // appetit
  '#00E5FF', // sociabilite
  '#5EB0FF'  // depression
];

// Récupérer tous les moods d'un user (X derniers mois)
async function fetchAllMoods(userId, monthsBack = 6) {
  const result = {};
  const now = new Date();
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = getMonthKey(d);
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'moods', monthKey));
      if (snap.exists()) result[monthKey] = snap.data().cells || {};
    } catch (e) { /* ignore */ }
  }
  return result;
}

// Générer le SVG du graphique
function buildMoodChart(data, daysCount, mode) {
  const W = 720, H = 320;
  const padL = 30, padR = 20, padT = 20, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const today = new Date();
  const points = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const monthKey = getMonthKey(d);
    const day = d.getDate();
    const cells = (data[monthKey] && data[monthKey][day]) || {};
    points.push({ day: day, cells: cells });
  }

  const maxY = 6;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="mood-chart-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;

  // Grille horizontale + valeurs Y
  for (let lvl = 0; lvl <= maxY; lvl++) {
    const y = padT + innerH - (lvl / maxY) * innerH;
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="rgba(143,166,199,0.6)" font-size="9">${lvl}</text>`;
  }

  if (mode === 'line') {
    MOOD_ELEMENTS.forEach((el, elIdx) => {
      const color = ELEMENT_COLORS[elIdx];
      const pts = [];
      points.forEach((p, i) => {
        const val = p.cells[el.id];
        if (val == null) return;
        const x = padL + (i / (points.length - 1 || 1)) * innerW;
        const y = padT + innerH - (val / maxY) * innerH;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      });
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
      }
      points.forEach((p, i) => {
        const val = p.cells[el.id];
        if (val == null) return;
        const x = padL + (i / (points.length - 1 || 1)) * innerW;
        const y = padT + innerH - (val / maxY) * innerH;
        svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"/>`;
      });
    });
  } else {
    // Barres : 7 mini-barres par jour
    const clusterW = innerW / points.length;
    const barW = Math.max(0.8, (clusterW * 0.9) / 7);
    const gap = (clusterW - barW * 7) / 2;

    points.forEach((p, i) => {
      MOOD_ELEMENTS.forEach((el, elIdx) => {
        const val = p.cells[el.id];
        if (val == null) return;
        const color = ELEMENT_COLORS[elIdx];
        const x = padL + i * clusterW + gap + elIdx * barW;
        const h = (val / maxY) * innerH;
        const y = padT + innerH - h;
        svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(2)}" height="${h.toFixed(1)}" fill="${color}" opacity="0.9" rx="0.5"/>`;
      });
    });
  }

  // Labels de jours en bas
  const labelStep = Math.max(1, Math.ceil(points.length / 12));
  points.forEach((p, i) => {
    if (i % labelStep !== 0 && i !== points.length - 1) return;
    const x = padL + (i / (points.length - 1 || 1)) * innerW;
    svg += `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="rgba(143,166,199,0.6)" font-size="9">${p.day}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

// Modale : voir le mood tracker d'un membre
async function openMoodViewerFor(memberId, memberName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:900px;">
      <div class="modal-header">
        <div>
          <div class="modal-title">📊 Mood tracker de ${escapeHtml(memberName || 'Membre')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Suivi personnel — visible uniquement par toi et lui</div>
        </div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" id="mood-viewer-body">
        <p class="empty-state">Chargement…</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // État local du viewer
  let viewMonth = new Date();
  let viewMode = 'line'; // 'line' ou 'bar'
  let viewPeriod = 30;

  // Charger un mois pour le tableau
  async function loadMonth(month) {
    const key = getMonthKey(month);
    try {
      const snap = await getDoc(doc(db, 'users', memberId, 'moods', key));
      return snap.exists() ? (snap.data().cells || {}) : {};
    } catch (e) { return {}; }
  }

  // Charger les N derniers jours pour le graphique
  async function loadRecent(days) {
    const today = new Date();
    const all = {};
    const monthsToFetch = new Set();
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
  }

  // Rendu du tableau
  function buildTable(cells) {
    const days = getDaysInMonth(viewMonth);
    const today = new Date();
    const isCurrent = today.getFullYear() === viewMonth.getFullYear() && today.getMonth() === viewMonth.getMonth();

    let html = '<table class="mood-table">';
    html += '<thead><tr><th>Élément</th>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = isCurrent && today.getDate() === d;
      html += `<th class="${isWeekend?'weekend':''} ${isToday?'today':''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';
    MOOD_ELEMENTS.forEach(el => {
      html += `<tr><th>${el.label}</th>`;
      for (let d = 1; d <= days; d++) {
        const isToday = isCurrent && today.getDate() === d;
        const idx = cells[d] && cells[d][el.id] != null ? cells[d][el.id] : -1;
        const bg = idx >= 0 ? MOOD_COLORS[idx].hex : 'transparent';
        html += `<td class="mood-cell ${idx>=0?'has-color':''} ${isToday?'today':''}" style="background:${bg}"></td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  // Construction du graphique
  function buildChart(allMoodData, daysCount, mode) {
    const W = 860, H = 320;
    const padL = 30, padR = 20, padT = 20, padB = 30;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const today = new Date();
    const points = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const mk = getMonthKey(d);
      const day = d.getDate();
      const cells = (allMoodData[mk] && allMoodData[mk][day]) || {};
      points.push({ day, cells });
    }

    const maxY = 6;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="mood-chart-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;

    // Grille
    for (let lvl = 0; lvl <= maxY; lvl++) {
      const y = padT + innerH - (lvl / maxY) * innerH;
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
      svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="rgba(143,166,199,0.6)" font-size="9">${lvl}</text>`;
    }

    if (mode === 'line') {
      MOOD_ELEMENTS.forEach((el, elIdx) => {
        const color = ELEMENT_COLORS[elIdx];
        const pts = [];
        points.forEach((p, i) => {
          const val = p.cells[el.id];
          if (val == null) return;
          const x = padL + (i / (points.length - 1 || 1)) * innerW;
          const y = padT + innerH - (val / maxY) * innerH;
          pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        });
        if (pts.length > 1) {
          svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`;
        }
        points.forEach((p, i) => {
          const val = p.cells[el.id];
          if (val == null) return;
          const x = padL + (i / (points.length - 1 || 1)) * innerW;
          const y = padT + innerH - (val / maxY) * innerH;
          svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"/>`;
        });
      });
    } else {
      const clusterW = innerW / points.length;
      const barW = Math.max(0.8, (clusterW * 0.9) / 7);
      const gap = (clusterW - barW * 7) / 2;

      points.forEach((p, i) => {
        MOOD_ELEMENTS.forEach((el, elIdx) => {
          const val = p.cells[el.id];
          if (val == null) return;
          const color = ELEMENT_COLORS[elIdx];
          const x = padL + i * clusterW + gap + elIdx * barW;
          const h = (val / maxY) * innerH;
          const y = padT + innerH - h;
          svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(2)}" height="${h.toFixed(1)}" fill="${color}" opacity="0.9" rx="0.5"/>`;
        });
      });
    }

    // Labels jours
    const labelStep = Math.max(1, Math.ceil(points.length / 15));
    points.forEach((p, i) => {
      if (i % labelStep !== 0 && i !== points.length - 1) return;
      const x = padL + (i / (points.length - 1 || 1)) * innerW;
      svg += `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="rgba(143,166,199,0.6)" font-size="9">${p.day}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  // Rendu complet
  async function renderAll() {
    const body = overlay.querySelector('#mood-viewer-body');

    // Charger les données nécessaires
    const tableCells = await loadMonth(viewMonth);
    const chartData = await loadRecent(viewPeriod);

    const monthTitle = formatMonthTitle(viewMonth);

    body.innerHTML = `
      <!-- SECTION TABLEAU -->
      <div class="section-label" style="margin-top:0;">📋 Tableau — ${monthTitle}</div>
      <div class="mood-month-nav" style="margin-bottom:10px;">
        <button class="mood-nav-btn" id="mv-prev" type="button">←</button>
        <h2 class="mood-month-title">${monthTitle}</h2>
        <button class="mood-nav-btn" id="mv-next" type="button">→</button>
      </div>
      <div class="mood-table-wrapper" style="max-height:380px;">
        ${buildTable(tableCells)}
      </div>

      <!-- SECTION GRAPHIQUE -->
      <div class="section-label" style="margin-top:24px;">📈 Graphique</div>
      <div class="mood-viewer-controls">
        <div class="mood-view-periods">
          <button class="mood-period-btn ${viewPeriod===7?'active':''}" data-period="7" type="button">7 jours</button>
          <button class="mood-period-btn ${viewPeriod===30?'active':''}" data-period="30" type="button">30 jours</button>
          <button class="mood-period-btn ${viewPeriod===90?'active':''}" data-period="90" type="button">3 mois</button>
          <button class="mood-period-btn ${viewPeriod===180?'active':''}" data-period="180" type="button">6 mois</button>
        </div>
        <div class="mood-view-modes">
          <button class="mood-mode-btn ${viewMode==='line'?'active':''}" data-mode="line" type="button">📈 Courbes</button>
          <button class="mood-mode-btn ${viewMode==='bar'?'active':''}" data-mode="bar" type="button">📊 Barres</button>
        </div>
      </div>
      <div class="mood-view-legend">
        ${MOOD_ELEMENTS.map((el, i) => `
          <span class="mood-view-legend-item">
            <span class="mood-view-legend-dot" style="background:${ELEMENT_COLORS[i]}"></span>
            ${el.label}
          </span>
        `).join('')}
      </div>
      <div class="mood-view-chart">
        ${buildChart(chartData, viewPeriod, viewMode)}
      </div>
    `;

    // Navigation mois
    body.querySelector('#mv-prev').addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      renderAll();
    });
    body.querySelector('#mv-next').addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      renderAll();
    });

    // Périodes
    body.querySelectorAll('.mood-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        viewPeriod = parseInt(btn.dataset.period, 10);
        renderAll();
      });
    });

    // Modes
    body.querySelectorAll('.mood-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.mode;
        renderAll();
      });
    });
  }

  renderAll();

  // Fermer
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ─── Gestion du bouton "Mood" dans le chat écoutant ───
setInterval(() => {
  const moodBtn = document.getElementById('btn-see-mood-eco');
  if (!moodBtn) return;
  if (!ecoConvId) { moodBtn.style.display = 'none'; return; }

  const conv = [...ecoMesConvsCache, ...ecoEnAttenteCache, ...ecoResoluesCache].find(c => c.id === ecoConvId);
  if (conv && conv.memberId) {
    moodBtn.style.display = 'inline-flex';
    moodBtn.dataset.memberId = conv.memberId;
    moodBtn.dataset.memberName = conv.memberName || 'Membre';
  }
}, 500);

// Bind du bouton (une seule fois)
(function bindMoodBtn() {
  const moodBtn = document.getElementById('btn-see-mood-eco');
  if (!moodBtn || moodBtn.dataset.bound) return;
  moodBtn.dataset.bound = '1';
  moodBtn.addEventListener('click', () => {
    const mid = moodBtn.dataset.memberId;
    const mname = moodBtn.dataset.memberName;
    if (mid) openMoodViewerFor(mid, mname);
  });
})();

console.log('✅ Mood viewer (écoutant) chargé');

// ═══════════════════════════════════════════════════════════════════════════
// ★ BOUTON "QUITTER" — marque la conversation comme ABANDONNÉE
// ═══════════════════════════════════════════════════════════════════════════
setTimeout(() => {
  const btnQuitChat = document.getElementById('btn-quit-chat');
  if (!btnQuitChat) return;

  // Cloner le bouton pour supprimer TOUS ses anciens listeners
  const newBtn = btnQuitChat.cloneNode(true);
  btnQuitChat.parentNode.replaceChild(newBtn, btnQuitChat);

  // Nouveau listener
  newBtn.addEventListener('click', async () => {
    if (!memberConvId) return;
    if (!confirm('Quitter cette conversation ?')) return;

    const convIdToAbandon = memberConvId;
    if (memberChatUnsubscribe) { memberChatUnsubscribe(); memberChatUnsubscribe = null; }

    try {
      await updateDoc(doc(db, 'conversations', convIdToAbandon), {
        status: 'abandoned',
        abandonedAt: serverTimestamp()
      });
      console.log('🚪 Conversation abandonnée');
    } catch (e) { console.warn('Erreur abandon :', e); }

    memberConvId = null;

    openPage('app-membre', 'ecouter');
    const app = document.getElementById('app-membre');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const t = app.querySelector('.nav-item[data-page="ecouter"]');
    if (t) t.classList.add('active');
  });

  console.log('✅ Bouton "Quitter" recâblé');
}, 1500);

// ═══════════════════════════════════════════════════════════════════════════
// ★ APP ADMIN / MODÉRATEUR
// ═══════════════════════════════════════════════════════════════════════════

// ─── Est-ce un rôle admin ? ───
function estAdmin(role) {
  return ['admin', 'moderateur'].includes(role);
}
function estDev(role) {
  return ['dev', 'developpeur'].includes(role);
}
function aAccesAdmin(role) {
  return estAdmin(role) || estDev(role) || role === 'fondateur' || role === 'responsable' || role === 'chef_service';
}

// ─── Navigation Admin (setup comme les autres) ───
setupAppNavigation('app-admin');

// ─── Aiguillage : ajouter l'app admin dans routeUser ───
// (On étend la fonction en la réécrivant)
const _oldRouteUser = routeUser;
window.routeUser = function(data) {
  const pn = document.getElementById('profil-nom');
  const pu = document.getElementById('profil-username');
  if (pn) pn.textContent = data.displayName || 'Utilisateur';
  if (pu) pu.textContent = '@' + (data.username || 'inconnu');

  const pen = document.getElementById('profil-eco-nom');
  const peu = document.getElementById('profil-eco-username');
  if (pen) pen.textContent = data.displayName || 'Utilisateur';
  if (peu) peu.textContent = '@' + (data.username || 'inconnu');

  if (!data.cguAccepted) { showScreen('screen-cgu'); return; }

  const role = data.role || 'membre';

  if (aAccesAdmin(role)) {
    showScreen('app-admin');
    setTimeout(() => initAdmin(), 300);
  } else if (estEcoutant(role)) {
    showScreen('app-ecoutant');
    setTimeout(() => initEcoListeners(), 300);
  } else {
    showScreen('app-membre');
  }
};
routeUser = window.routeUser;

// ─── Initialisation de l'app Admin ───
function initAdmin() {
  // Rendu du profil admin
  renderProfilHeader('profil-admin-header', currentUserData);

  // Câbler l'engrenage admin
  const gearAdmin = document.getElementById('btn-gear-admin');
  if (gearAdmin && !gearAdmin.dataset.bound) {
    gearAdmin.dataset.bound = '1';
    gearAdmin.addEventListener('click', openSettingsModal);
  }

  // Mini-onglets Panel Admin
  setupAdminMiniTabs('admin-panel-tabs');
  // Mini-onglets Supervision
  setupAdminMiniTabs('admin-sup-tabs');

  // Charger les sections
  loadAdminDemandes();
  loadAdminMembres('');
  loadAdminEcoutants('');
  loadAdminConvs();
  loadAdminSignalements();

  // Recherches
  const searchMembres = document.getElementById('admin-search-membres');
  if (searchMembres && !searchMembres.dataset.bound) {
    searchMembres.dataset.bound = '1';
    searchMembres.addEventListener('input', (e) => loadAdminMembres(e.target.value));
  }
  const searchEcoutants = document.getElementById('admin-search-ecoutants');
  if (searchEcoutants && !searchEcoutants.dataset.bound) {
    searchEcoutants.dataset.bound = '1';
    searchEcoutants.addEventListener('input', (e) => loadAdminEcoutants(e.target.value));
  }
  const searchUsers = document.getElementById('admin-search-users');
  if (searchUsers && !searchUsers.dataset.bound) {
    searchUsers.dataset.bound = '1';
    searchUsers.addEventListener('input', (e) => loadAdminUsersSearch(e.target.value));
  }

  console.log('✅ App admin initialisée');
}

// ─── Mini-onglets admin (générique) ───
function setupAdminMiniTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tabs = container.querySelectorAll('.mini-tab');
  const indicator = container.querySelector('.mini-tab-indicator');

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.dataset.active = tab.dataset.mini;

      if (indicator) {
        const total = tabs.length;
        indicator.style.width = `calc(${100 / total}% - ${(8 / total)}px)`;
        indicator.style.transform = `translateX(calc(100% * ${index}))`;
      }

      // Afficher le contenu correspondant
      const parentPage = container.closest('.page');
      if (parentPage) {
        parentPage.querySelectorAll('.mini-content').forEach(c => c.classList.remove('active'));
        const content = parentPage.querySelector(`.mini-content[data-mini-content="${tab.dataset.mini}"]`);
        if (content) content.classList.add('active');
      }
    });
  });
}

// ─── Charger les membres ───
async function loadAdminMembres(search) {
  const list = document.getElementById('admin-membres-list');
  if (!list) return;
  try {
    const q = query(collection(db, 'users'), limit(200));
    const snap = await getDocs(q);
    const users = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.role === 'membre') users.push({ id: d.id, ...data });
    });

    const filtered = search
      ? users.filter(u =>
          (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
          (u.displayName || '').toLowerCase().includes(search.toLowerCase())
        )
      : users;

    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucun membre trouvé.</p>';
      return;
    }

    list.innerHTML = filtered.map(u => `
      <div class="admin-user-card" data-uid="${u.id}">
        <div class="admin-user-avatar">${u.avatar || '👤'}</div>
        <div class="admin-user-infos">
          <div class="admin-user-name">${escapeHtml(u.displayName || 'Sans nom')}</div>
          <div class="admin-user-meta">@${escapeHtml(u.username || 'inconnu')}</div>
        </div>
        <span class="admin-role-badge">${u.role || 'membre'}</span>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Erreur membres :', e);
    list.innerHTML = '<p class="empty-state">Impossible de charger.</p>';
  }
}

// ─── Charger les écoutants ───
async function loadAdminEcoutants(search) {
  const list = document.getElementById('admin-ecoutants-list');
  if (!list) return;
  try {
    const q = query(collection(db, 'users'), limit(200));
    const snap = await getDocs(q);
    const users = [];
    snap.forEach(d => {
      const data = d.data();
      if (estEcoutant(data.role)) users.push({ id: d.id, ...data });
    });

    const filtered = search
      ? users.filter(u =>
          (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
          (u.displayName || '').toLowerCase().includes(search.toLowerCase())
        )
      : users;

    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucun écoutant trouvé.</p>';
      return;
    }

    list.innerHTML = filtered.map(u => `
      <div class="admin-user-card" data-uid="${u.id}">
        <div class="admin-user-avatar">${u.avatar || '🧑‍⚕️'}</div>
        <div class="admin-user-infos">
          <div class="admin-user-name">${escapeHtml(u.displayName || 'Sans nom')}</div>
          <div class="admin-user-meta">@${escapeHtml(u.username || 'inconnu')}</div>
        </div>
        <span class="admin-role-badge">${u.role || 'ecoutant'}</span>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Erreur écoutants :', e);
    list.innerHTML = '<p class="empty-state">Impossible de charger.</p>';
  }
}

// ─── Charger les conversations actives ───
async function loadAdminConvs() {
  const list = document.getElementById('admin-convs-list');
  if (!list) return;
  try {
    const q = query(
      collection(db, 'conversations'),
      where('status', 'in', ['waiting', 'claimed']),
      limit(100)
    );
    const snap = await getDocs(q);
    const convs = [];
    snap.forEach(d => convs.push({ id: d.id, ...d.data() }));

    convs.sort((a, b) => (b.urgence || 0) - (a.urgence || 0));

    if (convs.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucune conversation active ✨</p>';
      return;
    }

    list.innerHTML = convs.map(c => {
      const urg = c.urgence || 0;
      const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
      const status = c.status === 'waiting' ? '⏳ En attente' : '💚 ' + (c.claimedByName || 'En cours');
      return `
        <div class="conv-card ${urg >= 4 ? 'conv-urgent' : ''}">
          <div class="conv-info">
            <div class="conv-header-row">
              <span class="conv-name">${escapeHtml(c.memberName || 'Membre')}</span>
              <span class="conv-urgency">${stars}</span>
            </div>
            <span class="conv-username">@${escapeHtml(c.memberUsername || '')} · ${status}</span>
            ${c.motif ? `<span class="conv-motif">🎯 ${escapeHtml(c.motif)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.warn('Erreur convs admin :', e);
    list.innerHTML = '<p class="empty-state">Impossible de charger.</p>';
  }
}

// ─── Charger les signalements ───
async function loadAdminSignalements() {
  const list = document.getElementById('admin-signalements-list');
  if (!list) return;
  try {
    const q = query(collection(db, 'signalements'), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = '<p class="empty-state">Aucun signalement ✨</p>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <span class="card-badge" style="background:rgba(255,107,122,0.15);color:var(--error);">🚨 Signalement</span>
        <h3>${escapeHtml(data.memberName || 'Membre')}</h3>
        <p><strong>Raison :</strong> ${escapeHtml(data.raison || '')}</p>
        <span class="card-meta">Signalé par ${escapeHtml(data.ecoutantName || 'Écoutant')}</span>
      `;
      list.appendChild(card);
    });
  } catch (e) {
    console.warn('Erreur signalements :', e);
    list.innerHTML = '<p class="empty-state">Impossible de charger.</p>';
  }
}

// ─── Recherche utilisateurs (mini-onglet "Créer") ───
async function loadAdminUsersSearch(search) {
  const container = document.getElementById('admin-users-results');
  if (!container) return;
  if (!search || search.length < 2) {
    container.innerHTML = '<p class="empty-state">Tape au moins 2 lettres</p>';
    return;
  }
  try {
    const q = query(collection(db, 'users'), limit(200));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => {
      const data = d.data();
      if (
        (data.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (data.displayName || '').toLowerCase().includes(search.toLowerCase())
      ) {
        results.push({ id: d.id, ...data });
      }
    });

    if (results.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun résultat</p>';
      return;
    }

    container.innerHTML = results.map(u => `
      <div class="admin-user-card" data-uid="${u.id}" data-name="${escapeHtml(u.displayName || u.username || 'User')}">
        <div class="admin-user-avatar">${u.avatar || '👤'}</div>
        <div class="admin-user-infos">
          <div class="admin-user-name">${escapeHtml(u.displayName || 'Sans nom')}</div>
          <div class="admin-user-meta">@${escapeHtml(u.username || 'inconnu')}</div>
        </div>
        <span class="admin-role-badge">${u.role || 'membre'}</span>
      </div>
    `).join('');

    container.querySelectorAll('.admin-user-card').forEach(card => {
      card.addEventListener('click', () => {
        openAdminPrivateChat(card.dataset.uid, card.dataset.name);
      });
    });
  } catch (e) {
    console.warn(e);
  }
}

// ─── Créer/ouvrir un chat privé admin ↔ user ───
async function openAdminPrivateChat(targetUid, targetName) {
  if (!currentUser) return;
  try {
    // On cherche une conv existante admin-<targetUid> avec type admin-user
    const convId = 'admin_' + currentUser.uid + '_' + targetUid;

    const snap = await getDoc(doc(db, 'conversations', convId));
    if (!snap.exists()) {
      await setDoc(doc(db, 'conversations', convId), {
        type: 'admin-user',
        adminId: currentUser.uid,
        adminName: currentUserData?.displayName || 'Admin',
        memberId: targetUid,
        memberName: targetName || 'Utilisateur',
        status: 'claimed',
        createdAt: serverTimestamp(),
        lastMessage: '(nouvelle conversation)',
        lastMessageAt: serverTimestamp(),
        lastMessageFrom: currentUser.uid
      });
    }

    // Ouvrir le chat (en réutilisant la page chat-eco)
    ecoConvId = convId;
    openPage('app-admin', 'admin-supervision');
    // NOTE : pour l'instant on affiche juste un message
    alert('💬 Chat admin ↔ ' + targetName + ' ouvert.\n\nFonctionnalité complète à venir.');
  } catch (e) {
    console.warn('Erreur chat admin :', e);
    alert('❌ Impossible de créer le chat.');
  }
}

// ─── Créer une news (admin) ───
const btnNewNews = document.getElementById('btn-admin-new-news');
if (btnNewNews) {
  btnNewNews.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">📰 Nouvelle news</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Type</label>
            <select id="news-type" style="width:100%;padding:12px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);">
              <option value="📰 Annonce">📰 Annonce</option>
              <option value="🎉 Événement">🎉 Événement</option>
              <option value="💬 Témoignage">💬 Témoignage</option>
              <option value="🆕 Nouveau contenu">🆕 Nouveau contenu</option>
            </select>
          </div>
          <div class="field" style="margin-top:14px;">
            <label>Titre</label>
            <input type="text" id="news-title" maxlength="100" placeholder="Titre...">
          </div>
          <div class="field" style="margin-top:14px;">
            <label>Contenu</label>
            <textarea id="news-content" placeholder="Contenu de la news..." style="min-height:140px;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="news-cancel">Annuler</button>
          <button class="btn btn-primary" id="news-save">Publier</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#news-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#news-save').addEventListener('click', async () => {
      const type = overlay.querySelector('#news-type').value;
      const title = overlay.querySelector('#news-title').value.trim();
      const content = overlay.querySelector('#news-content').value.trim();
      if (!title || !content) { alert('⚠️ Titre et contenu obligatoires'); return; }
      try {
        await addDoc(collection(db, 'news'), {
          type, title, content,
          authorName: currentUserData?.displayName || 'Admin',
          createdAt: serverTimestamp()
        });
        overlay.remove();
        alert('✅ News publiée !');
      } catch (e) { alert('❌ Erreur'); }
    });
  });
}

console.log('✅ Module Admin chargé');

// ═══════════════════════════════════════════════════════════════════════════
// ★ ADMIN — News en temps réel + boutons qui marchent
// ═══════════════════════════════════════════════════════════════════════════

let adminNewsUnsubscribe = null;

// ─── Bouton "Créer une news" ───
function openCreateNewsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <div class="modal-header">
        <div class="modal-title">📰 Nouvelle news</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Type</label>
          <select id="news-type" style="width:100%;padding:12px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);font-family:inherit;">
            <option value="📰 Annonce">📰 Annonce</option>
            <option value="🎉 Événement">🎉 Événement</option>
            <option value="💬 Témoignage">💬 Témoignage</option>
            <option value="🆕 Nouveau contenu">🆕 Nouveau contenu</option>
            <option value="📌 Épinglé">📌 Épinglé</option>
          </select>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Titre</label>
          <input type="text" id="news-title" maxlength="100" placeholder="Titre...">
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Contenu</label>
          <textarea id="news-content" placeholder="Contenu de la news..." style="min-height:140px;"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="news-cancel">Annuler</button>
        <button class="btn btn-primary" id="news-save">Publier</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#news-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#news-save').addEventListener('click', async () => {
    const type = overlay.querySelector('#news-type').value;
    const title = overlay.querySelector('#news-title').value.trim();
    const content = overlay.querySelector('#news-content').value.trim();
    if (!title || !content) { alert('⚠️ Titre et contenu obligatoires'); return; }
    try {
      await addDoc(collection(db, 'news'), {
        type, title, content,
        authorName: currentUserData?.displayName || 'Admin',
        createdAt: serverTimestamp()
      });
      overlay.remove();
      // Pas besoin de recharger : onSnapshot s'en occupe
    } catch (e) {
      console.error(e);
      alert('❌ Erreur : ' + (e.message || 'réessaie.'));
    }
  });
}

// ─── Demandes : Accepter / Refuser (temps réel) ───
let adminDemandesUnsubscribe = null;

function loadAdminDemandes() {
  const list = document.getElementById('admin-demandes-list');
  if (!list) return;

  if (adminDemandesUnsubscribe) adminDemandesUnsubscribe();

  const q = query(collection(db, 'demandes-fil'), orderBy('createdAt', 'desc'));
  adminDemandesUnsubscribe = onSnapshot(q, (snap) => {
    if (snap.empty) {
      list.innerHTML = '<p class="empty-state">Aucune demande ✨</p>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <span class="card-badge">${data.anonyme ? '🎭 Anonyme' : '👤 ' + escapeHtml(data.authorName || 'Membre')}</span>
        <h3>${escapeHtml(data.title || 'Sans titre')}</h3>
        <p>${escapeHtml(data.content || '')}</p>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-primary btn-small" data-action="valider" data-id="${d.id}">✅ Publier</button>
          <button class="btn btn-danger btn-small" data-action="refuser" data-id="${d.id}">❌ Refuser</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        btn.disabled = true;
        btn.textContent = '⏳...';
        try {
          if (action === 'valider') {
            const snap2 = await getDoc(doc(db, 'demandes-fil', id));
            if (snap2.exists()) {
              const data = snap2.data();
              await addDoc(collection(db, 'fil-general'), {
                title: data.title, content: data.content,
                anonyme: data.anonyme, authorName: data.authorName,
                createdAt: serverTimestamp()
              });
            }
          }
          await deleteDoc(doc(db, 'demandes-fil', id));
          // onSnapshot va rafraîchir automatiquement
        } catch (e) {
          console.error('Erreur action demande :', e);
          alert('❌ Erreur : ' + (e.message || 'réessaie.'));
          btn.disabled = false;
        }
      });
    });
  }, (err) => {
    console.warn('Erreur demandes :', err);
    list.innerHTML = '<p class="empty-state">Impossible de charger.</p>';
  });
}

// ─── Rebind des boutons au démarrage de l'admin ───
setInterval(() => {
  // Bouton "Créer une news"
  const btnNews = document.getElementById('btn-admin-new-news');
  if (btnNews && !btnNews.dataset.bound) {
    btnNews.dataset.bound = '1';
    btnNews.addEventListener('click', openCreateNewsModal);
  }

  // Si on est sur la page news admin et que la liste est vide, charger
  const newsList = document.getElementById('admin-news-list');
  if (newsList && newsList.innerHTML.includes('Chargement') && !adminNewsUnsubscribe) {
    loadAdminNews();
  }

  // Si on est sur la page demandes admin et que rien n'est chargé, charger
  const demList = document.getElementById('admin-demandes-list');
  if (demList && demList.innerHTML.includes('Impossible') && !adminDemandesUnsubscribe) {
    loadAdminDemandes();
  }
}, 1000);

console.log('✅ Admin news + demandes chargés');

// ═══════════════════════════════════════════════════════════════════════════
// ★ NEWS — Suppression (admin) + Affichage temps réel (écoutant)
// ═══════════════════════════════════════════════════════════════════════════

// ─── ADMIN : listener news avec bouton supprimer ───
let _adminNewsUnsub_v2 = null;

function loadAdminNews() {
  const list = document.getElementById('admin-news-list');
  if (!list) return;

  if (_adminNewsUnsub_v2) _adminNewsUnsub_v2();

  const q = query(collection(db, 'news'), limit(50));

  _adminNewsUnsub_v2 = onSnapshot(q, (snap) => {
    const news = [];
    snap.forEach(d => news.push({ id: d.id, ...d.data() }));

    news.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    if (news.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucune news pour l\'instant. Clique sur "Créer une news" ✨</p>';
      return;
    }

    list.innerHTML = '';
    news.forEach(n => {
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <span class="card-badge">${escapeHtml(n.type || '📰 Info')}</span>
          <button class="news-delete-btn" data-id="${n.id}" title="Supprimer" style="background:transparent;border:none;color:var(--error);cursor:pointer;font-size:16px;padding:2px 6px;">🗑️</button>
        </div>
        <h3>${escapeHtml(n.title || 'Sans titre')}</h3>
        <p>${escapeHtml(n.content || '')}</p>
        <span class="card-meta">Par ${escapeHtml(n.authorName || 'Admin')} • ${formatDate(n.createdAt)}</span>
      `;
      list.appendChild(article);
    });

    // Câbler les boutons supprimer
    list.querySelectorAll('.news-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cette news ?')) return;
        try {
          await deleteDoc(doc(db, 'news', btn.dataset.id));
          // onSnapshot va rafraîchir automatiquement
        } catch (e) {
          console.error(e);
          alert('❌ Erreur : ' + (e.message || 'réessaie.'));
        }
      });
    });
  }, (err) => {
    console.error('❌ Erreur news admin :', err);
    list.innerHTML = '<p class="empty-state">Erreur : ' + (err.code || err.message) + '</p>';
  });
}

// ─── ÉCOUTANT : afficher les news en temps réel ───
let _ecoNewsUnsub = null;

function startEcoutantNewsListener() {
  const container = document.getElementById('news-eco-dynamic');
  if (!container) return;

  if (_ecoNewsUnsub) _ecoNewsUnsub();

  const q = query(collection(db, 'news'), limit(50));

  _ecoNewsUnsub = onSnapshot(q, (snap) => {
    const news = [];
    snap.forEach(d => news.push({ id: d.id, ...d.data() }));

    news.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    if (news.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    news.forEach(n => {
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <span class="card-badge">${escapeHtml(n.type || '📰 Info')}</span>
        <h3>${escapeHtml(n.title || 'Sans titre')}</h3>
        <p>${escapeHtml(n.content || '')}</p>
        <span class="card-meta">Par ${escapeHtml(n.authorName || 'Admin')} • ${formatDate(n.createdAt)}</span>
      `;
      container.appendChild(article);
    });
  }, (err) => {
    console.warn('Erreur news écoutant :', err);
  });
}

// ─── Lancer le listener news écoutant quand on est sur la page ───
setInterval(() => {
  const ecoNewsPage = document.getElementById('news-eco-dynamic');
  if (ecoNewsPage && !_ecoNewsUnsub) {
    startEcoutantNewsListener();
  }
}, 1000);

// ─── Recharger les news admin quand on entre sur la page ───
setInterval(() => {
  const adminList = document.getElementById('admin-news-list');
  if (adminList && !_adminNewsUnsub_v2) {
    loadAdminNews();
  }
}, 1000);

console.log('✅ News admin (delete) + News écoutant (sync) chargés');