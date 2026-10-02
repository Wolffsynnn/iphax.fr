// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — Logique principale
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
                <label class="checkbox-item">
                  <input type="checkbox" name="niveau" value="peu-importe" checked>
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Peu importe</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="niveau" value="formation">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">En formation</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="niveau" value="confirme">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Confirmé</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="niveau" value="experimente">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Expérimenté</span>
                </label>
              </div>
            </div>

            <div class="pref-block">
              <div class="pref-label">🎂 Âge</div>
              <div class="checkbox-list checkbox-list-inline" data-group="age">
                <label class="checkbox-item">
                  <input type="checkbox" name="age" value="peu-importe" checked>
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Peu importe</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="age" value="jeune">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Jeune (&lt;18)</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="age" value="adulte">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Adulte (18+)</span>
                </label>
              </div>
            </div>

            <div class="pref-block">
              <div class="pref-label">🗣️ Style</div>
              <div class="checkbox-list checkbox-list-inline" data-group="style">
                <label class="checkbox-item">
                  <input type="checkbox" name="style" value="peu-importe" checked>
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Peu importe</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="style" value="doux">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Doux</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="style" value="direct">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Direct</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="style" value="ecoute">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Juste écouter</span>
                </label>
              </div>
            </div>

            <div class="pref-block">
              <div class="pref-label">⚧️ Genre</div>
              <div class="checkbox-list checkbox-list-inline" data-group="genre">
                <label class="checkbox-item">
                  <input type="checkbox" name="genre" value="peu-importe" checked>
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Peu importe</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="genre" value="fille">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Fille</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="genre" value="garcon">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Garçon</span>
                </label>
                <label class="checkbox-item">
                  <input type="checkbox" name="genre" value="non-binaire">
                  <span class="checkbox-box"></span>
                  <span class="checkbox-label">Non-binaire</span>
                </label>
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

    // MOTIF : une seule case
    const motifCheckboxes = overlay.querySelectorAll('input[name="motif"]');
    motifCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          motifCheckboxes.forEach(other => { if (other !== cb) other.checked = false; });
          motif = cb.value;
        } else motif = '';
      });
    });

    // URGENCE
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

    // PRÉFÉRENCES : "Peu importe" exclusif
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

    // MOTS
    const motsInput = overlay.querySelector('#conv-mots');
    motsInput.addEventListener('input', () => { mots = motsInput.value; });

    // FERMETURE
    const close = () => { overlay.remove(); resolve(null); };
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#conv-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // VALIDATION
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
// CONVERSATIONS PARTAGÉES
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

// Bouton "Quitter la conversation" — quitte SANS supprimer
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
// ÉCOUTANT : LISTENERS
// ═══════════════════════════════════════════════════════════════════════════
function initEcoListeners() {
  startEnAttenteListener();
  startMesConvsListener();
}

function startEnAttenteListener() {
  if (ecoEnAttenteUnsubscribe) ecoEnAttenteUnsubscribe();
  const q = query(collection(db, 'conversations'), where('status', '==', 'waiting'));
  ecoEnAttenteUnsubscribe = onSnapshot(q, (snap) => {
    const container = document.getElementById('convs-en-attente');
    const badge = document.getElementById('badge-attente');
    if (!container) return;
    const convs = [];
    snap.forEach(d => convs.push({ id: d.id, ...d.data() }));

    convs.sort((a, b) => {
      const uA = a.urgence || 0, uB = b.urgence || 0;
      if (uB !== uA) return uB - uA;
      return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
    });

    if (badge) {
      if (convs.length > 0) { badge.textContent = convs.length; badge.style.display = 'inline-block'; }
      else badge.style.display = 'none';
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
  }, (err) => console.error('Erreur attente :', err));
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
    const container = document.getElementById('convs-mes');
    if (!container) return;
    const convs = [];
    snap.forEach(d => convs.push({ id: d.id, ...d.data() }));
    convs.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));

    if (convs.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucune conversation.</p>';
      return;
    }
    container.innerHTML = convs.map(c => `
      <div class="conv-card" data-open-conv="${c.id}">
        <div class="conv-info">
          <span class="conv-name">${escapeHtml(c.memberName || 'Membre')} <small style="opacity:0.5;font-weight:400;">@${escapeHtml(c.memberUsername || '')}</small></span>
          <span class="conv-msg">${escapeHtml(c.lastMessage || 'Nouvelle conversation')}</span>
          <span class="conv-msg" style="opacity:0.5;font-size:10px;">${formatTime(c.lastMessageAt)}</span>
        </div>
        <button class="conv-menu">⋯</button>
      </div>
    `).join('');
    container.querySelectorAll('[data-open-conv]').forEach(el => {
      el.addEventListener('click', () => openEcoChat(el.dataset.openConv));
    });
  }, (err) => console.error('Erreur mes convs :', err));
}

async function openEcoChat(convId) {
  ecoConvId = convId;
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
        const urg = c.urgence || 0;
        const urgenceStars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
        infosEl.innerHTML = `
          <div class="conv-infos-banner">
            ${c.motif ? `<span class="conv-infos-item">🎯 <strong>${escapeHtml(c.motif)}</strong></span>` : ''}
            ${urg ? `<span class="conv-infos-item">🚦 <strong>${urgenceStars}</strong> (${urg}/5)</span>` : ''}
            ${c.mots ? `<span class="conv-infos-item" style="font-style:italic;">📝 "${escapeHtml(c.mots)}"</span>` : ''}
            ${c.prefs ? `<span class="conv-infos-item">👥 ${formatPrefsPlain(c.prefs)}</span>` : ''}
          </div>`;
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

document.querySelectorAll('.mini-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.mini;
    document.querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.mini-content').forEach(c => c.classList.remove('active'));
    const content = document.querySelector(`.mini-content[data-mini-content="${target}"]`);
    if (content) content.classList.add('active');
  });
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
            <button type="button" class="journal--privacy-option" data-anon="false"><span class="privacy-icon">👤</span><span class="privacy-label">Avec mon pseudo</span></button>
            </div>
          </div>
          <div class="field"><label>Titre</label><input type="text" id="fil-title" placeholder="Un titre..." maxlength="100"></div>
          <div class="field"><label>Ton message</label><textarea id="fil-content" placeholder="Témoignage, mot gentil, conseil..." style="min-height:140px;"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-ghost" id="fil-cancel">Annuler</button><button class="btn btn-primary" id="fil-send">Envoyer</button></div>
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
// MINI-ONGLETS ÉCOUTANT — Indicateur glissant
// ═══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.mini-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const container = tab.closest('.mini-tabs');
      if (container) container.dataset.active = tab.dataset.mini;
    });
  });
  
// ═══════════════════════════════════════════════════════════════════════════
// FILTRES — Injection de l'indicateur glissant
// ═══════════════════════════════════════════════════════════════════════════
function setupFilterIndicators() {
    document.querySelectorAll('.filters').forEach(container => {
      // Ne pas ajouter 2x
      if (container.querySelector('.filter-indicator')) return;
  
      const filters = container.querySelectorAll('.filter');
      if (filters.length === 0) return;
  
      // Créer l'indicateur
      const indicator = document.createElement('span');
      indicator.className = 'filter-indicator';
      // Positionner selon le nombre de filtres (largeur dynamique)
      const count = filters.length;
      indicator.style.width = `calc(${100 / count}% - ${(8 / count)}px)`;
      container.appendChild(indicator);
  
      // Gérer les clics
      filters.forEach((filter, index) => {
        filter.addEventListener('click', () => {
          filters.forEach(f => f.classList.remove('active'));
          filter.classList.add('active');
          indicator.style.transform = `translateX(calc(100% * ${index}))`;
        });
      });
    });
  }
  
  // Lancer au démarrage
  setupFilterIndicators();
  
  // Relancer après chaque affichage de page qui contient des filtres
  document.querySelectorAll('.mini-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setTimeout(setupFilterIndicators, 100);
    });
  });