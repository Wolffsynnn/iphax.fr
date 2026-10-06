// ═══════════════════════════════════════════════════════════════════════════
// IPHAX — main.js COMPLET ET PROPRE
// ═══════════════════════════════════════════════════════════════════════════
console.log('🚀 main.js démarré');

// 🛡️ Sécurité anti-reload SPA
document.addEventListener('submit', e => {
  if (e.target.matches('#chat-form, #chat-eco-form')) return;
  e.preventDefault();
});

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
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
function notify(msg, type = 'auto', duration = 3500) {
  let container = document.getElementById('iphax-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'iphax-toast-container';
    document.body.appendChild(container);
  }
  const cleanMsg = String(msg || '').replace(/^[✅❌⚠️ℹ️📧📡⏳🚫🔒💬🎯]\s*/u, '');
  if (type === 'auto') {
    if (/^✅/.test(msg)) type = 'success';
    else if (/^❌/.test(msg)) type = 'error';
    else if (/^⚠️/.test(msg)) type = 'warning';
    else type = 'info';
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const titles = { success: 'Succès', error: 'Erreur', warning: 'Attention', info: 'Info' };
  const toast = document.createElement('div');
  toast.className = `iphax-toast iphax-toast-${type}`;
  toast.innerHTML = `<span class="iphax-toast-icon">${icons[type]}</span><div class="iphax-toast-content"><div class="iphax-toast-title">${titles[type]}</div><div class="iphax-toast-msg">${cleanMsg}</div></div>`;
  toast.addEventListener('click', () => { toast.classList.add('iphax-toast-out'); setTimeout(() => toast.remove(), 250); });
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('iphax-toast-out'); setTimeout(() => toast.remove(), 250); }, duration);
}
window.alert = (msg) => notify(msg, 'auto');

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════════════════════════════════════════
let currentUser = null, currentUserData = null, authReady = false, currentBulle = 'membre';
let memberConvId = null, memberChatUnsub = null;
let ecoConvId = null, ecoChatUnsub = null;
let ecoAttenteCache = [], ecoMesCache = [], ecoResoluesCache = [];
let unsubEcoAttente = null, unsubEcoMes = null, unsubEcoResolues = null;
let unsubAdminNews = null, unsubEcoNews = null, unsubAdminDemandes = null, unsubFilsList = null;
let currentFilId = null, currentFilData = null, unsubFilPosts = null, unsubDemandesPerso = null;
let moodMonth = new Date(), moodData = {};
let journalCache = [], objectifsCache = [];

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const ROLES_PAR_BULLE = { membre:['membre'], ecoutant:['ecoutant','responsable','chef_service'], admin:['admin','moderateur'], dev:['dev','developpeur'], fondateur:['fondateur'] };
const LABELS_ESPACES = { membre:'Membre', ecoutant:'Écoutant', admin:'Admin', dev:'Développeur', fondateur:'Fondateur' };
const LABELS_ROLES = { membre:'Membre', ecoutant:'Écoutant·e', responsable:'Responsable', chef_service:'Chef de service', moderateur:'Modérateur', admin:'Administrateur', dev:'Développeur', developpeur:'Développeur', fondateur:'Fondateur' };
const MOOD_ELEMENTS = [{id:'humeur',label:'😊 Humeur'},{id:'sommeil',label:'😴 Sommeil'},{id:'energie',label:'⚡ Énergie'},{id:'anxiete',label:'😰 Anxiété'},{id:'appetit',label:'🍽️ Appétit'},{id:'sociabilite',label:'👥 Sociabilité'},{id:'depression',label:'🌧️ Dépression'}];
const MOOD_COLORS = [{name:'Excellent',hex:'#0F2551'},{name:'Très bien',hex:'#1B7A4D'},{name:'Bien',hex:'#A8E6CF'},{name:'Moyen',hex:'#FFD93D'},{name:'Bof',hex:'#FF9F45'},{name:'Mal',hex:'#E04A5A'},{name:'Très mal',hex:'#7A1525'}];
const ELEMENT_COLORS = ['#FFD93D','#A78BFA','#FF9F45','#E04A5A','#3DDC97','#00E5FF','#5EB0FF'];
const MOTIFS = ['Anxiété','Solitude','Tristesse','Colère','Harcèlement','Famille','École','Amitié','Amour','Deuil','Autre'];
const AVATARS = ['🌙','⭐','✨','🌌','🌠','🦉','🐱','🐶','🦊','🐰','🐼','🦋','🌸','🌺','🌻','🍀','💙','🎧','🎨','📚'];

const THEMES = [
  { id:'iphax',     label:'Iphax',      colors:['#050E24','#0A1A3D','#00E5FF'] },
  { id:'treegreen', label:'Tree Green', colors:['#0B5D31','#1F8A57','#2BB673'] },
  { id:'fire',      label:'Fire',       colors:['#B23344','#E04A5A','#FF9E62'] },
  { id:'cherry',    label:'Cherry',     colors:['#C4488F','#F472B6','#FADFEE'] },
  { id:'midnight',  label:'Midnight',   colors:['#2B1D52','#7C5CE0','#A78BFA'] },
  { id:'golden',    label:'Golden',     colors:['#B08D00','#E5B800','#F5CC2E'] },
  { id:'autumn',    label:'Autumn',     colors:['#C46228','#F2874A','#FF9E62'] },
  { id:'sea',       label:'Sea',        colors:['#1F8A8A','#2BB6B6','#5ED8D8'] },
  { id:'ocean',     label:'Ocean',      colors:['#0F3F7A','#1F6FBF','#3DA0F0'] },
  { id:'dark',      label:'Dark',       colors:['#000000','#1A1A1A','#333333'] },
  { id:'white',     label:'White',      colors:['#FFFFFF','#F5F5F5','#E0E0E0'] }
];

const REACTIONS_EMOJIS = ['👍','❤️','😢','😂','🔥','🎉','😮','😡'];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); const el = $(id); if (el) el.classList.add('active'); }
function showError(id, msg) { const el = $(id); if (el) el.textContent = msg; }
function clearError(id) { const el = $(id); if (el) el.textContent = ''; }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text == null ? '' : String(text); return div.innerHTML; }
function calculerAge(date) { const auj = new Date(), naiss = new Date(date); let age = auj.getFullYear() - naiss.getFullYear(); const m = auj.getMonth() - naiss.getMonth(); if (m < 0 || (m === 0 && auj.getDate() < naiss.getDate())) age--; return age; }
function toDate(ts) { if (!ts) return null; return ts.toDate ? ts.toDate() : new Date(ts); }
function formatTime(ts) { const d = toDate(ts); return d ? d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : ''; }
function formatDate(ts) { const d = toDate(ts); return d ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : ''; }
function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function getDaysInMonth(d) { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function formatMonthTitle(d) { const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']; return `${mois[d.getMonth()]} ${d.getFullYear()}`; }
function traductError(code, raw) {
  const errors = { 'auth/email-already-in-use':'📧 Email déjà utilisé.','auth/invalid-email':'📧 Email invalide.','auth/weak-password':'🔑 Mot de passe trop faible.','auth/user-not-found':'👤 Aucun compte.','auth/wrong-password':'🔑 Mot de passe incorrect.','auth/invalid-credential':'🔑 Email ou mot de passe incorrect.','auth/too-many-requests':'⏳ Trop de tentatives.','auth/network-request-failed':'📡 Problème de connexion.','auth/popup-closed-by-user':'❌ Connexion annulée.','auth/popup-blocked':'🚫 Popup bloquée.','auth/unauthorized-domain':'🚫 Domaine non autorisé.','permission-denied':'🔒 Pas la permission.' };
  return errors[code] || `⚠️ Erreur : ${code || raw || 'inconnue'}`;
}
function roleCompatibleAvecBulle(r, b) { return (ROLES_PAR_BULLE[b] || ['membre']).includes(r); }
function bulleDepuisRole(r) { for (const [b, roles] of Object.entries(ROLES_PAR_BULLE)) if (roles.includes(r)) return b; return 'membre'; }
function estEcoutant(r) { return ['ecoutant','responsable','chef_service'].includes(r); }
function estAdmin(r) { return ['admin','moderateur'].includes(r); }
function estDev(r) { return ['dev','developpeur'].includes(r); }
function aAccesAdmin(r) { return estAdmin(r) || estDev(r) || r === 'fondateur'; }
function peutCreerFilThera(r) { return estAdmin(r) || estDev(r) || r === 'fondateur' || r === 'responsable' || r === 'chef_service'; }

function openPage(appId, pageName) {
  const app = $(appId); if (!app) return;
  app.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = app.querySelector(`.page[data-page="${pageName}"]`); if (page) page.classList.add('active');
  const content = app.querySelector('.app-content'); if (content) content.scrollTop = 0;
}
function setActiveNav(appId, pageName) {
  const app = $(appId); if (!app) return;
  app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const t = app.querySelector(`.nav-item[data-page="${pageName}"]`); if (t) t.classList.add('active');
}
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
// INTRO + ROUTAGE
// ═══════════════════════════════════════════════════════════════════════════
$('btn-continuer')?.addEventListener('click', async () => {
  let w = 0; while (!authReady && w < 2000) { await new Promise(r => setTimeout(r, 50)); w += 50; }
  const goNext = () => {
    if (currentUser && currentUserData) routeUser(currentUserData);
    else if (currentUser) showScreen('screen-cgu');
    else showScreen('screen-auth');
  };
  if (window.iphaxCredits && typeof window.iphaxCredits.show === 'function') {
    window.iphaxCredits.show(goNext);
  } else {
    goNext();
  }
});
function routeUser(data) {
  if (!data.cguAccepted) { showScreen('screen-cgu'); return; }
  const role = data.role || 'membre';
  if (aAccesAdmin(role)) { showScreen('app-admin'); setTimeout(initAdmin, 100); }
  else if (estEcoutant(role)) { showScreen('app-ecoutant'); setTimeout(initEcoutant, 100); }
  else { showScreen('app-membre'); setTimeout(initMembre, 100); }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════
const tabsContainer = document.querySelector('.auth-tabs');
const formLogin = $('form-login'), formSignup = $('form-signup');
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  const t = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  tab.classList.add('active'); tabsContainer.dataset.active = t;
  formLogin.classList.toggle('active', t === 'login');
  formSignup.classList.toggle('active', t === 'signup');
}));
const roleMessages = { membre:"Ici, quelqu'un t'écoute 💙", admin:'Espace administration 🔧', ecoutant:'Espace écoutant·e — Merci 💚', dev:'Espace développeur 💻', fondateur:'Accès fondateur 👑' };
const roleTitles = { membre:'Bienvenue sur Iphax', admin:'Connexion administration', ecoutant:'Connexion écoutant·e', dev:'Connexion développeur', fondateur:'Connexion fondateur' };
document.querySelectorAll('.role-bubble').forEach(bubble => bubble.addEventListener('click', () => {
  const role = bubble.dataset.role;
  document.querySelectorAll('.role-bubble').forEach(b => b.classList.remove('active'));
  bubble.classList.add('active');
  if ($('auth-subtitle')) $('auth-subtitle').textContent = roleMessages[role] || roleMessages.membre;
  if ($('auth-title')) $('auth-title').textContent = roleTitles[role] || roleTitles.membre;
  if (role === 'membre') tabsContainer.style.display = 'flex';
  else { tabsContainer.style.display = 'none'; formLogin.classList.add('active'); formSignup.classList.remove('active'); }
  currentBulle = role;
  clearError('login-error'); clearError('signup-error');
}));
document.querySelectorAll('.toggle-eye').forEach(btn => btn.addEventListener('click', () => {
  const input = btn.parentElement.querySelector('input');
  const isP = input.type === 'password';
  input.type = isP ? 'text' : 'password';
  btn.style.color = isP ? 'var(--accent)' : 'var(--text-muted)';
}));
formSignup?.addEventListener('submit', async e => {
  e.preventDefault(); clearError('signup-error');
  const email = $('signup-email').value.trim(), username = $('signup-username').value.trim();
  const displayName = $('signup-displayname').value.trim(), birthdate = $('signup-birthdate').value;
  const password = $('signup-password').value;
  const age = calculerAge(birthdate);
  if (age >= 18) return showError('signup-error', '❌ Réservé aux moins de 18 ans.');
  if (age < 8) return showError('signup-error', '❌ Minimum 8 ans.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return showError('signup-error', '🔑 1 lettre + 1 chiffre minimum.');
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(username)) return showError('signup-error', '👤 Nom d\'utilisateur invalide.');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    const userData = { uid: cred.user.uid, email: cred.user.email, username, displayName, birthdate, age, role: 'membre', cguAccepted: false, createdAt: serverTimestamp(), lastUsernameChange: null, lastDisplayNameChange: null };
    await setDoc(doc(db, 'users', cred.user.uid), userData);
    await setDoc(doc(db, 'users-public', cred.user.uid), { username, displayName, avatar: '🌙' });
    currentUser = cred.user; currentUserData = userData;
    showScreen('screen-cgu');
  } catch (error) { showError('signup-error', traductError(error.code, error.message)); }
});
formLogin?.addEventListener('submit', async e => {
  e.preventDefault(); clearError('login-error');
  const email = $('login-email').value.trim(), password = $('login-password').value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists()) { showError('login-error', '⚠️ Profil incomplet.'); await signOut(auth); return; }
    const data = snap.data();
    const role = data.role || 'membre';
    if (!roleCompatibleAvecBulle(role, currentBulle)) {
      await signOut(auth);
      const vrai = LABELS_ESPACES[bulleDepuisRole(role)], rl = LABELS_ROLES[role] || role;
      showError('login-error', `🚫 Mauvais espace ! Compte ${rl}. Utilise la bulle « ${vrai} ».`);
      return;
    }
    currentUser = cred.user; currentUserData = data;
    routeUser(data);
  } catch (error) { showError('login-error', traductError(error.code, error.message)); }
});
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
async function handleGoogleUser(user, bulle) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  let data;
  if (!snap.exists()) {
    data = { uid: user.uid, email: user.email, username: null, displayName: user.displayName || 'Utilisateur', birthdate: null, age: null, role: 'membre', provider: 'google', cguAccepted: false, createdAt: serverTimestamp() };
    await setDoc(ref, data);
    await setDoc(doc(db, 'users-public', user.uid), { username: null, displayName: user.displayName || 'Utilisateur', avatar: '🌙' });
  } else data = snap.data();
  const role = data.role || 'membre';
  if (!roleCompatibleAvecBulle(role, bulle)) {
    await signOut(auth); showScreen('screen-auth');
    setTimeout(() => showError('login-error', `🚫 Mauvais espace. Utilise « ${LABELS_ESPACES[bulleDepuisRole(role)]} ».`), 300);
    return;
  }
  currentUser = user; currentUserData = data;
  routeUser(data);
}
$('btn-google')?.addEventListener('click', async () => {
  clearError('login-error'); clearError('signup-error');
  sessionStorage.setItem('iphax_bulle_choisie', currentBulle);
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await handleGoogleUser(result.user, currentBulle);
  } catch (error) {
    if (['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error.code)) {
      try { await signInWithRedirect(auth, googleProvider); return; } catch (e2) { showError('login-error', traductError(e2.code, e2.message)); return; }
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
  } catch (e) { console.error(e); }
})();

// CGU
const cguText = $('cgu-text'), cguCheckbox = $('cgu-checkbox'), cguCheckLabel = $('cgu-check-label');
const btnAcceptCgu = $('btn-accept-cgu'), btnRefuseCgu = $('btn-refuse-cgu');
let cguUnlocked = false;
cguText?.addEventListener('scroll', () => {
  if (cguText.scrollTop + cguText.clientHeight >= cguText.scrollHeight - 15 && !cguUnlocked) {
    cguUnlocked = true; cguCheckbox.disabled = false; cguCheckLabel.classList.remove('disabled');
  }
});
cguCheckbox?.addEventListener('change', () => { btnAcceptCgu.disabled = !cguCheckbox.checked; });
btnRefuseCgu?.addEventListener('click', () => {
  signOut(auth).then(() => { currentUser = null; currentUserData = null; showScreen('screen-intro'); });
  if (cguCheckbox) { cguCheckbox.checked = false; cguCheckbox.disabled = true; cguCheckLabel.classList.add('disabled'); btnAcceptCgu.disabled = true; cguUnlocked = false; }
});
btnAcceptCgu?.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { cguAccepted: true, cguAcceptedAt: serverTimestamp(), cguVersion: '1.0' });
    currentUserData.cguAccepted = true;
    await logAction('cgu', `<strong>${escapeHtml(currentUserData?.displayName || 'Utilisateur')}</strong> a accepté les CGU v1.0`);
    routeUser(currentUserData);
  } catch (e) { notify('Erreur : ' + e.message, 'error'); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
function setupAppNavigation(appId) {
  const app = $(appId); if (!app) return;
  const navItems = app.querySelectorAll('.nav-item'), pages = app.querySelectorAll('.page');
  navItems.forEach(item => item.addEventListener('click', () => {
    const target = item.dataset.page;
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    const page = app.querySelector(`.page[data-page="${target}"]`);
    if (page) page.classList.add('active');
    const content = app.querySelector('.app-content'); if (content) content.scrollTop = 0;
    if (appId === 'app-membre' && target !== 'chat' && memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
    if (appId === 'app-ecoutant' && target !== 'chat-eco' && ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
    if (!target.startsWith('fil-detail') && unsubFilPosts) { unsubFilPosts(); unsubFilPosts = null; }
  }));
}
setupAppNavigation('app-membre');
setupAppNavigation('app-ecoutant');
setupAppNavigation('app-admin');

function bindBack(btnId, appId, targetPage) {
  const btn = $(btnId);
  if (btn) btn.addEventListener('click', () => { openPage(appId, targetPage); setActiveNav(appId, targetPage); });
}
bindBack('btn-back-perso', 'app-membre', 'perso');
bindBack('btn-back-perso-journal', 'app-membre', 'perso');
bindBack('btn-back-perso-objectifs', 'app-membre', 'perso');
bindBack('btn-back-perso-rappels', 'app-membre', 'perso');
bindBack('btn-back-fil-detail', 'app-membre', 'public');
bindBack('btn-back-chat', 'app-membre', 'ecouter');
bindBack('btn-back-chat-eco', 'app-ecoutant', 'conversations');
bindBack('btn-back-fils-eco', 'app-ecoutant', 'fils');
bindBack('btn-back-fils-admin', 'app-admin', 'admin-fils');

// ═══════════════════════════════════════════════════════════════════════════
// INIT MEMBRE
// ═══════════════════════════════════════════════════════════════════════════
function initMembre() {
  document.querySelectorAll('#app-membre .grid-card[data-target]').forEach(btn => {
    if (btn.dataset.bound) return; btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      openPage('app-membre', target);
      if (target === 'mood-tracker') await initMoodTracker();
      if (target === 'journal') await loadJournal();
      if (target === 'objectifs') await loadObjectifs();
      if (target === 'rappels') await loadRappels();
    });
  });
  startEcoNewsListener('news-dynamic');
  $('btn-fil-general')?.addEventListener('click', () => openFil('general', 'membre'), { once: true });
  loadFilsTheraMembre();
  const bindOnce = (id, evt, fn) => {
    const el = $(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener(evt, fn);
  };
  bindOnce('btn-parler-maintenant', 'click', () => openMemberChat('parler-maintenant'));
  bindOnce('btn-mon-ecoutant', 'click', () => openMemberChat('mon-ecoutant'));
  bindOnce('btn-quit-chat', 'click', quitMemberChat);
  bindOnce('chat-form', 'submit', sendMemberMessage);
  initProfilUI();
}

// MOOD TRACKER
function renderMoodLegend() {
  const legend = $('mood-legend'); if (!legend) return;
  legend.innerHTML = MOOD_COLORS.map(c => `<div class="mood-legend-item"><span class="mood-legend-dot" style="background:${c.hex}"></span><span>${c.name}</span></div>`).join('');
}
function renderMoodTable() {
  const table = $('mood-table'), title = $('mood-month-title'); if (!table || !title) return;
  title.textContent = formatMonthTitle(moodMonth);
  const days = getDaysInMonth(moodMonth), today = new Date();
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
  table.querySelectorAll('.mood-cell').forEach(cell => cell.addEventListener('click', () => openMoodPicker(parseInt(cell.dataset.day, 10), cell.dataset.el)));
}
async function loadMoodData() {
  if (!currentUser) return;
  try { const snap = await getDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodMonth))); moodData = snap.exists() ? (snap.data().cells || {}) : {}; } catch (e) { moodData = {}; }
}
async function saveMoodData() {
  if (!currentUser) return;
  try { await setDoc(doc(db, 'users', currentUser.uid, 'moods', getMonthKey(moodMonth)), { cells: moodData, updatedAt: serverTimestamp() }, { merge: true }); } catch (e) { notify('Impossible d\'enregistrer.', 'error'); }
}
async function initMoodTracker() { renderMoodLegend(); await loadMoodData(); renderMoodTable(); }
function openMoodPicker(day, elementId) {
  const el = MOOD_ELEMENTS.find(e => e.id === elementId);
  const cur = (moodData[day] && moodData[day][elementId] != null) ? moodData[day][elementId] : -1;
  const overlay = openModal(`
    <div class="mood-picker">
      <div class="mood-picker-title">${el ? el.label : elementId}</div>
      <div class="mood-picker-sub">Jour ${day}</div>
      <div class="mood-picker-grid">${MOOD_COLORS.map((c,i) => `<button class="mood-color-btn ${i===cur?'selected':''}" data-idx="${i}" style="background:${c.hex}" title="${c.name}"></button>`).join('')}</div>
      <div class="mood-picker-actions"><button class="mood-btn-clear">Effacer</button><button class="mood-btn-cancel">Annuler</button></div>
    </div>`);
  overlay.className = 'mood-picker-overlay';
  overlay.querySelectorAll('.mood-color-btn').forEach(btn => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.idx, 10);
    if (!moodData[day]) moodData[day] = {};
    moodData[day][elementId] = idx;
    overlay.remove(); renderMoodTable(); await saveMoodData();
  }));
  overlay.querySelector('.mood-btn-clear').addEventListener('click', async () => {
    if (moodData[day]) { delete moodData[day][elementId]; if (Object.keys(moodData[day]).length === 0) delete moodData[day]; }
    overlay.remove(); renderMoodTable(); await saveMoodData();
  });
  overlay.querySelector('.mood-btn-cancel').addEventListener('click', () => overlay.remove());
}
$('mood-prev')?.addEventListener('click', async () => { moodMonth.setMonth(moodMonth.getMonth() - 1); await loadMoodData(); renderMoodTable(); });
$('mood-next')?.addEventListener('click', async () => { moodMonth.setMonth(moodMonth.getMonth() + 1); await loadMoodData(); renderMoodTable(); });

// JOURNAL
async function loadJournal() {
  const list = $('journal-list'); if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'journal'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    journalCache = []; snap.forEach(d => journalCache.push({ id: d.id, ...d.data() }));
    if (journalCache.length === 0) { list.innerHTML = '<p class="empty-state">Aucune note pour l\'instant. Écris ta première 💙</p>'; return; }
    list.innerHTML = journalCache.map(e => {
      const date = toDate(e.createdAt) || new Date();
      const ds = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const preview = (e.content || '').substring(0, 180);
      return `<div class="journal-entry" data-id="${e.id}"><div class="journal-entry-header"><span class="journal-entry-date">${ds}</span><span class="journal-entry-mood">${e.moodEmoji || ''}</span></div><div class="journal-entry-title">${escapeHtml(e.title || 'Sans titre')}</div><div class="journal-entry-preview">${escapeHtml(preview)}${preview.length>=180?'…':''}</div><span class="journal-entry-badge ${e.shared?'shared':'private'}">${e.shared?'🔓 Partagé':'🔒 Privé'}</span></div>`;
    }).join('');
    list.querySelectorAll('.journal-entry').forEach(el => el.addEventListener('click', () => openJournalEntry(el.dataset.id)));
  } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
}
function openJournalEntry(id) {
  const entry = journalCache.find(e => e.id === id); if (!entry) return;
  const date = toDate(entry.createdAt) || new Date();
  const ds = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header"><div><div class="modal-title">${escapeHtml(entry.title || 'Sans titre')}</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${ds} · ${entry.shared ? '🔓 Partagé' : '🔒 Privé'}</div></div><button class="modal-close">×</button></div>
      <div class="modal-body"><div style="font-size:14px;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(entry.content || '')}</div></div>
      <div class="modal-footer"><button class="btn btn-danger" id="jd">🗑️ Supprimer</button><button class="btn btn-ghost modal-close">Fermer</button></div>
    </div>`);
  overlay.querySelector('#jd').addEventListener('click', async () => {
    if (!confirm('Supprimer cette note ?')) return;
    try { await deleteDoc(doc(db, 'users', currentUser.uid, 'journal', id)); overlay.remove(); await loadJournal(); } catch (e) { notify('Erreur', 'error'); }
  });
}
$('btn-new-journal')?.addEventListener('click', () => {
  let privacy = 'private', mood = '';
  const EMOJIS = ['😢','😔','😐','🙂','😄','😰','😡','😴','🥰','🤔'];
  const overlay = openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">📔 Nouvelle note</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="field"><label>Confidentialité</label><div class="journal-privacy-choice">
          <button type="button" class="journal-privacy-option active" data-privacy="private"><span class="privacy-icon">🔒</span><span class="privacy-label">Privé</span></button>
          <button type="button" class="journal-privacy-option" data-privacy="shared"><span class="privacy-icon">🔓</span><span class="privacy-label">Partagé</span></button>
        </div></div>
        <div class="field"><label>Humeur</label><div style="display:flex;flex-wrap:wrap;gap:8px;">${EMOJIS.map(e => `<button type="button" class="mood-emoji-btn" data-emoji="${e}" style="width:40px;height:40px;border-radius:10px;background:rgba(10,26,61,0.6);border:1.5px solid var(--border);font-size:22px;cursor:pointer;">${e}</button>`).join('')}</div></div>
        <div class="field"><label>Titre</label><input type="text" id="jtitle" placeholder="Un titre..." maxlength="80"></div>
        <div class="field"><label>Ton ressenti</label><textarea id="jcontent" placeholder="Écris librement..."></textarea></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="jsave">💾 Enregistrer</button></div>
    </div>`);
  overlay.querySelectorAll('.journal-privacy-option').forEach(opt => opt.addEventListener('click', () => {
    overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active'); privacy = opt.dataset.privacy;
  }));
  overlay.querySelectorAll('.mood-emoji-btn').forEach(btn => btn.addEventListener('click', () => {
    overlay.querySelectorAll('.mood-emoji-btn').forEach(b => b.style.borderColor = 'var(--border)');
    if (mood === btn.dataset.emoji) mood = ''; else { mood = btn.dataset.emoji; btn.style.borderColor = 'var(--accent)'; }
  }));
  overlay.querySelector('#jsave').addEventListener('click', async () => {
    const title = overlay.querySelector('#jtitle').value.trim(), content = overlay.querySelector('#jcontent').value.trim();
    if (!content) { notify('Écris quelque chose', 'warning'); return; }
    try { await addDoc(collection(db, 'users', currentUser.uid, 'journal'), { title: title || 'Sans titre', content, shared: privacy === 'shared', moodEmoji: mood, createdAt: serverTimestamp() }); overlay.remove(); await loadJournal(); } catch (e) { notify('Erreur', 'error'); }
  });
});

// OBJECTIFS
async function loadObjectifs() {
  const list = $('objectifs-list'); if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'objectifs'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    objectifsCache = []; snap.forEach(d => objectifsCache.push({ id: d.id, ...d.data() }));
    if (objectifsCache.length === 0) { list.innerHTML = '<p class="empty-state">Aucun objectif.</p>'; return; }
    list.innerHTML = objectifsCache.map(o => `<div class="objectif-item ${o.done?'done':''}" data-id="${o.id}"><button class="objectif-check" data-id="${o.id}"></button><span class="objectif-text">${escapeHtml(o.text)}</span><button class="objectif-delete" data-id="${o.id}">🗑️</button></div>`).join('');
    list.querySelectorAll('.objectif-check').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation(); const item = objectifsCache.find(o => o.id === btn.dataset.id); if (!item) return;
      try { await updateDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id), { done: !item.done }); await loadObjectifs(); } catch (e) {}
    }));
    list.querySelectorAll('.objectif-delete').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation(); if (!confirm('Supprimer ?')) return;
      try { await deleteDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id)); await loadObjectifs(); } catch (e) {}
    }));
  } catch (e) { list.innerHTML = '<p class="empty-state">⚠️ Erreur.</p>'; }
}
$('btn-new-objectif')?.addEventListener('click', () => {
  const overlay = openModal(`
    <div class="modal"><div class="modal-header"><div class="modal-title">🎯 Nouvel objectif</div><button class="modal-close">×</button></div>
    <div class="modal-body"><div class="field"><label>Mon objectif</label><input type="text" id="otext" maxlength="120"></div></div>
    <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="osave">Ajouter</button></div></div>`);
  overlay.querySelector('#osave').addEventListener('click', async () => {
    const text = overlay.querySelector('#otext').value.trim();
    if (!text) { notify('Écris ton objectif', 'warning'); return; }
    try { await addDoc(collection(db, 'users', currentUser.uid, 'objectifs'), { text, done: false, createdAt: serverTimestamp() }); overlay.remove(); await loadObjectifs(); } catch (e) { notify('Erreur', 'error'); }
  });
});

// RAPPELS
async function loadRappels() {
  const list = $('rappels-list'); if (!list || !currentUser) return;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'rappels'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q); const rappels = []; snap.forEach(d => rappels.push({ id: d.id, ...d.data() }));
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
    <div class="modal"><div class="modal-header"><div class="modal-title">💡 Nouveau rappel</div><button class="modal-close">×</button></div>
    <div class="modal-body"><div class="field"><label>Ta phrase bienveillante</label><input type="text" id="rtext" maxlength="200"></div></div>
    <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="rsave">Ajouter</button></div></div>`);
  overlay.querySelector('#rsave').addEventListener('click', async () => {
    const text = overlay.querySelector('#rtext').value.trim();
    if (!text) { notify('Écris ton rappel', 'warning'); return; }
    try { await addDoc(collection(db, 'users', currentUser.uid, 'rappels'), { text, createdAt: serverTimestamp() }); overlay.remove(); await loadRappels(); } catch (e) { notify('Erreur', 'error'); }
  });
});

// FORMULAIRE CONVERSATION
function openConvForm(type) {
  return new Promise(resolve => {
    let motif = '', urgence = 3, mots = '';
    const isRef = type === 'referent';
    const overlay = openModal(`
      <div class="modal" style="max-width:560px;">
        <div class="modal-header"><div><div class="modal-title">${isRef ? '👤 Trouver mon écoutant' : '💬 Nouvelle demande'}</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Aide-nous à comprendre.</div></div><button class="modal-close">×</button></div>
        <div class="modal-body">
          <div class="field"><label>🎯 Motif principal</label><div class="checkbox-list">${MOTIFS.map(m => `<label class="checkbox-item"><input type="checkbox" name="motif" value="${m}"><span class="checkbox-box"></span><span class="checkbox-label">${m}</span></label>`).join('')}</div></div>
          <div class="field"><label>🚦 Urgence</label><div class="urgence-picker">${[1,2,3,4,5].map(n => `<button type="button" class="urgence-btn" data-urg="${n}">${'🔴'.repeat(n)}${'⚪'.repeat(5-n)}</button>`).join('')}</div><p class="field-hint" id="urgh">3/5</p></div>
          <div class="field"><label>📝 Quelques mots</label><textarea id="cvmots" maxlength="500" style="min-height:100px;"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="cvsub">${isRef ? 'Envoyer' : 'Lancer'}</button></div>
      </div>`, ov => { ov.querySelector('.modal-close').addEventListener('click', () => { ov.remove(); resolve(null); }); });
    const mCbs = overlay.querySelectorAll('input[name="motif"]');
    mCbs.forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) { mCbs.forEach(o => { if (o !== cb) o.checked = false; }); motif = cb.value; } else motif = '';
    }));
    const urgLabels = ['', '1/5', '2/5', '3/5', '4/5', '5/5'];
    overlay.querySelectorAll('.urgence-btn').forEach(btn => btn.addEventListener('click', () => {
      urgence = parseInt(btn.dataset.urg, 10);
      overlay.querySelectorAll('.urgence-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      overlay.querySelector('#urgh').textContent = urgLabels[urgence];
    }));
    overlay.querySelector('.urgence-btn[data-urg="3"]')?.classList.add('active');
    overlay.querySelector('#cvmots').addEventListener('input', e => { mots = e.target.value; });
    overlay.querySelector('#cvsub').addEventListener('click', () => {
      if (!motif) { notify('Choisis un motif.', 'warning'); return; }
      overlay.remove();
      resolve({ motif, urgence, mots: mots.trim() });
    });
  });
}

// CONVERSATIONS MEMBRE
async function findExistingConversation(type) {
  if (!currentUser) return null;
  try {
    const q = query(collection(db, 'conversations'), where('memberId', '==', currentUser.uid), where('type', '==', type), where('status', 'in', ['waiting', 'claimed']));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docs = []; snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      return docs[0];
    }
  } catch (e) {}
  return null;
}
async function createConversation(type, fd) {
  if (!currentUser) return null;
  try {
    const nc = { memberId: currentUser.uid, memberName: currentUserData?.displayName || 'Membre', memberUsername: currentUserData?.username || 'membre', status: 'waiting', claimedBy: null, claimedByName: null, type, motif: fd.motif, urgence: fd.urgence, mots: fd.mots || '', createdAt: serverTimestamp(), claimedAt: null, lastMessage: fd.mots ? fd.mots.substring(0, 60) : '(nouvelle demande)', lastMessageAt: serverTimestamp(), lastMessageFrom: currentUser.uid };
    const ref = await addDoc(collection(db, 'conversations'), nc);
    await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Membre')}</strong> a lancé une nouvelle conversation`);
    return { id: ref.id, ...nc };
  } catch (e) { notify('Impossible de créer.', 'error'); return null; }
}
async function openMemberChat(type) {
  const chatType = type === 'mon-ecoutant' ? 'referent' : 'ephemere';
  const existing = await findExistingConversation(chatType);
  const needForm = chatType === 'ephemere' || (chatType === 'referent' && !existing);
  let fd = null;
  if (needForm) { fd = await openConvForm(chatType); if (!fd) return; }
  let conv = existing;
  if (!conv) { conv = await createConversation(chatType, fd); if (!conv) return; }
  const tEl = $('chat-title'), sEl = $('chat-subtitle'), qBtn = $('btn-quit-chat');
  if (type === 'mon-ecoutant') {
    if (tEl) tEl.textContent = '👤 Mon écoutant'; if (sEl) sEl.textContent = 'Écoutant référent permanent'; if (qBtn) qBtn.style.display = 'none';
  } else {
    if (tEl) tEl.textContent = '💬 Parler maintenant'; if (sEl) sEl.textContent = 'En attente…'; if (qBtn) qBtn.style.display = 'inline-flex';
  }
  openPage('app-membre', 'chat');
  memberConvId = conv.id;
  startMemberChatListener(conv.id);
}
function startMemberChatListener(convId) {
  if (memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
  const messagesEl = $('chat-messages'); if (!messagesEl) return;
  messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';
  const unsubConv = onSnapshot(doc(db, 'conversations', convId), snap => {
    if (!snap.exists()) return;
    const data = snap.data(); const sEl = $('chat-subtitle');
    if (data.status === 'waiting') { if (sEl) sEl.textContent = '⏳ En attente…'; }
    else if (data.status === 'claimed') { if (sEl) sEl.textContent = '💚 ' + (data.claimedByName || 'Écoutant') + ' t\'écoute'; }
    else if (data.status === 'resolved') { if (sEl) sEl.textContent = '✅ Terminée'; }
  });
  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  const unsubMsgs = onSnapshot(q, snap => {
    try {
      if (snap.empty) { messagesEl.innerHTML = '<p class="empty-state">Dis bonjour 💙</p>'; return; }
      messagesEl.innerHTML = '';
      snap.forEach(d => {
        const msg = d.data(); const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div'); div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
        div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.createdAt)}</span>`;
        messagesEl.appendChild(div);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (e) {
      console.error('ERREUR rendu messages:', e);
    }
  });
  memberChatUnsub = () => { unsubConv(); unsubMsgs(); };
}
async function sendMemberMessage(e) {
  e.preventDefault();
  const input = $('chat-input'); const text = input.value.trim();
  if (!text || !currentUser || !memberConvId) return;
  input.value = '';
  try {
    await addDoc(collection(db, 'conversations', memberConvId, 'messages'), {
      text,
      senderId: currentUser.uid,
      senderName: currentUserData?.displayName || 'Membre',
      senderRole: 'membre',
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'conversations', memberConvId), {
      lastMessage: text.substring(0, 60),
      lastMessageAt: serverTimestamp(),
      lastMessageFrom: currentUser.uid
    });
  } catch (err) {
    console.error('Erreur sendMessage:', err);
    notify('Erreur : ' + err.message, 'error');
  }
}
async function quitMemberChat() {
  if (!memberConvId) return;
  if (!confirm('Quitter ?')) return;
  const convId = memberConvId;
  if (memberChatUnsub) { memberChatUnsub(); memberChatUnsub = null; }
  try { await updateDoc(doc(db, 'conversations', convId), { status: 'abandoned', abandonedAt: serverTimestamp() }); } catch (e) {}
  memberConvId = null;
  openPage('app-membre', 'ecouter'); setActiveNav('app-membre', 'ecouter');
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT ÉCOUTANT
// ═══════════════════════════════════════════════════════════════════════════
function initEcoutant() {
  initProfilUI();
  startAttenteListener();
  startMesConvsListener();
  startResoluesListener();
  document.querySelectorAll('#app-ecoutant .mini-tab').forEach(tab => {
    if (tab.dataset.bound) return; tab.dataset.bound = '1';
    tab.addEventListener('click', () => {
      const c = tab.closest('.mini-tabs'); if (c) c.dataset.active = tab.dataset.mini;
      tab.closest('.mini-tabs').querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const page = tab.closest('.page');
      page.querySelectorAll('.mini-content').forEach(x => x.classList.remove('active'));
      const content = page.querySelector(`.mini-content[data-mini-content="${tab.dataset.mini}"]`);
      if (content) content.classList.add('active');
    });
  });
  startEcoNewsListener('news-eco-dynamic');
  const bindOnce = (id, evt, fn) => {
    const el = $(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener(evt, fn);
  };
  bindOnce('chat-eco-form', 'submit', sendEcoMessage);
  loadFilsList('eco');
  const bp = $('btn-proposer-post-eco');
  if (bp && !bp.dataset.bound) { bp.dataset.bound = '1'; bp.addEventListener('click', () => openFil('general', 'eco')); }
}

function startAttenteListener() {
  if (unsubEcoAttente) unsubEcoAttente();
  const q = query(collection(db, 'conversations'), where('status', '==', 'waiting'));
  unsubEcoAttente = onSnapshot(q, snap => { ecoAttenteCache = []; snap.forEach(d => ecoAttenteCache.push({ id: d.id, ...d.data() })); renderAttente(); });
}
function renderAttente() {
  const c = $('convs-en-attente'), badge = $('badge-attente'); if (!c) return;
  let convs = [...ecoAttenteCache].sort((a, b) => { const uA = a.urgence || 0, uB = b.urgence || 0; if (uB !== uA) return uB - uA; return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0); });
  if (badge) { if (ecoAttenteCache.length > 0) { badge.textContent = ecoAttenteCache.length; badge.style.display = 'inline-block'; } else badge.style.display = 'none'; }
  if (convs.length === 0) { c.innerHTML = '<p class="empty-state">Aucune conversation en attente ✨</p>'; return; }
  c.innerHTML = convs.map(x => {
    const urg = x.urgence || 0;
    const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
    return `<div class="conv-card conv-urgent" data-conv-id="${x.id}"><div class="conv-info"><div class="conv-header-row"><span class="conv-name">${escapeHtml(x.memberName || 'Membre')}</span><span class="conv-urgency">${stars}</span></div><span class="conv-username">@${escapeHtml(x.memberUsername || '')}</span>${x.motif?`<span class="conv-motif">🎯 ${escapeHtml(x.motif)}</span>`:''}${x.mots?`<span class="conv-msg" style="font-style:italic;">"${escapeHtml(x.mots)}"</span>`:''}</div><button class="conv-action" data-claim-id="${x.id}">Prendre</button></div>`;
  }).join('');
  c.querySelectorAll('[data-claim-id]').forEach(btn => btn.addEventListener('click', async e => { e.stopPropagation(); await claimConversation(btn.dataset.claimId); }));
}
async function claimConversation(convId) {
  if (!currentUser) return;
  try {
    const ref = doc(db, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'waiting' || data.claimedBy) { notify('Déjà prise.', 'warning'); return; }
    await updateDoc(ref, { status: 'claimed', claimedBy: currentUser.uid, claimedByName: currentUserData?.displayName || 'Écoutant', claimedAt: serverTimestamp() });
    await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a pris en charge une conversation`);
    openEcoChat(convId);
  } catch (e) { notify('Impossible de prendre.', 'error'); }
}
function startMesConvsListener() {
  if (unsubEcoMes) unsubEcoMes();
  const q = query(collection(db, 'conversations'), where('claimedBy', '==', currentUser.uid), where('status', '==', 'claimed'));
  unsubEcoMes = onSnapshot(q, snap => { ecoMesCache = []; snap.forEach(d => ecoMesCache.push({ id: d.id, ...d.data() })); renderMesConvs(); });
}
function renderMesConvs() {
  const c = $('convs-mes'); if (!c) return;
  let convs = [...ecoMesCache].sort((a, b) => { if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0); });
  if (convs.length === 0) { c.innerHTML = '<p class="empty-state">Aucune conversation.</p>'; return; }
  c.innerHTML = convs.map(x => {
    const mk = x.marked ? '<span class="conv-marked">⭐</span>' : '';
    const pn = x.pinned ? '📌 ' : '';
    const ur = isUnread(x) ? '<span class="conv-pastille"></span>' : '';
    return `<div class="conv-card ${x.pinned?'conv-pinned':''}" data-open-conv="${x.id}"><div class="conv-info"><span class="conv-name">${pn}${mk} ${escapeHtml(x.memberName || 'Membre')} <small style="opacity:0.5;">@${escapeHtml(x.memberUsername || '')}</small></span><span class="conv-msg">${escapeHtml(x.lastMessage || 'Nouvelle conversation')}</span></div>${ur}<button class="conv-menu">⋯</button></div>`;
  }).join('');
  c.querySelectorAll('[data-open-conv]').forEach(el => el.addEventListener('click', () => openEcoChat(el.dataset.openConv)));
}
function startResoluesListener() {
  if (unsubEcoResolues) unsubEcoResolues();
  const q = query(collection(db, 'conversations'), where('claimedBy', '==', currentUser.uid), where('status', '==', 'resolved'));
  unsubEcoResolues = onSnapshot(q, snap => { ecoResoluesCache = []; snap.forEach(d => ecoResoluesCache.push({ id: d.id, ...d.data() })); renderResolues(); });
}
function renderResolues() {
  const c = $('convs-resolues'); if (!c) return;
  if (ecoResoluesCache.length === 0) { c.innerHTML = '<p class="empty-state">Aucune résolue ✅</p>'; return; }
  const sorted = [...ecoResoluesCache].sort((a, b) => (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0));
  c.innerHTML = sorted.map(x => `<div class="conv-card conv-resolved" data-open-conv="${x.id}"><div class="conv-info"><span class="conv-name">✅ ${escapeHtml(x.memberName || 'Membre')}</span><span class="conv-msg">${escapeHtml(x.lastMessage || 'Aucun message')}</span></div></div>`).join('');
  c.querySelectorAll('[data-open-conv]').forEach(el => el.addEventListener('click', () => openEcoChat(el.dataset.openConv)));
}
async function openEcoChat(convId) {
  ecoConvId = convId;
  markConvAsRead(convId);
  openPage('app-ecoutant', 'chat-eco');
  const tEl = $('chat-eco-title'), sEl = $('chat-eco-subtitle'), iEl = $('chat-eco-infos');

  let convData = null;
  try {
    const snap = await getDoc(doc(db, 'conversations', convId));
    if (snap.exists()) {
      convData = { id: convId, ...snap.data() };
      const x = snap.data();
      if (tEl) tEl.textContent = '💬 ' + (x.memberName || 'Membre');
      if (sEl) sEl.textContent = '@' + (x.memberUsername || 'membre');
      if (iEl) {
        iEl.innerHTML = '';
        const urg = x.urgence || 0;
        const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
        const b = document.createElement('div'); b.className = 'conv-infos-banner';
        b.innerHTML = `${x.motif?`<span class="conv-infos-item">🎯 <strong>${escapeHtml(x.motif)}</strong></span>`:''}${urg?`<span class="conv-infos-item">🚦 <strong>${stars}</strong></span>`:''}${x.mots?`<span class="conv-infos-item" style="font-style:italic;">📝 "${escapeHtml(x.mots)}"</span>`:''}`;
        iEl.appendChild(b);
      }
    }
  } catch (e) {
    console.error('Erreur openEcoChat:', e);
  }

  renderEcoPanel(convData);
  startEcoChatListener(convId);
}
function startEcoChatListener(convId) {
  if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
  const mEl = $('chat-eco-messages'); if (!mEl) return;
  mEl.innerHTML = '<p class="empty-state">Chargement...</p>';
  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'), limit(300));
  ecoChatUnsub = onSnapshot(q, snap => {
    try {
      if (snap.empty) { mEl.innerHTML = '<p class="empty-state">Aucun message.</p>'; return; }
      mEl.innerHTML = '';
      snap.forEach(d => {
        const msg = d.data(); const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div'); div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
        div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.createdAt)}</span>`;
        mEl.appendChild(div);
      });
      mEl.scrollTop = mEl.scrollHeight;
    } catch (e) {
      console.error('ERREUR rendu messages eco:', e);
    }
  });
}
async function sendEcoMessage(e) {
  e.preventDefault();
  const input = $('chat-eco-input'); const text = input.value.trim();
  if (!text || !currentUser || !ecoConvId) return;
  input.value = '';
  try {
    await addDoc(collection(db, 'conversations', ecoConvId, 'messages'), { text, senderId: currentUser.uid, senderName: currentUserData?.displayName || 'Écoutant', senderRole: 'ecoutant', createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'conversations', ecoConvId), { lastMessage: text.substring(0, 60), lastMessageAt: serverTimestamp(), lastMessageFrom: currentUser.uid });
  } catch (err) {
    console.error('Erreur sendEcoMessage:', err);
    notify('Erreur : ' + err.message, 'error');
  }
}
function isUnread(c) {
  if (!c.lastMessageFrom) return false;
  if (c.lastMessageFrom === currentUser.uid) return false;
  if (!c.lastReadAt) return true;
  const lr = c.lastReadAt.toMillis ? c.lastReadAt.toMillis() : 0;
  const lm = c.lastMessageAt?.toMillis?.() || 0;
  return lm > lr;
}
async function markConvAsRead(convId) {
  if (!currentUser) return;
  try { await updateDoc(doc(db, 'conversations', convId), { lastReadAt: serverTimestamp() }); } catch (e) {}
}
document.addEventListener('click', e => {
  const btn = e.target.closest('.conv-menu'); if (!btn) return;
  const card = btn.closest('[data-conv-id], [data-open-conv]'); if (!card) return;
  const convId = card.dataset.convId || card.dataset.openConv;
  if (convId) openConvMenu(convId, btn);
});
function openConvMenu(convId, anchorEl) {
  document.querySelector('.conv-menu-popup')?.remove();
  const conv = [...ecoMesCache, ...ecoAttenteCache, ...ecoResoluesCache].find(c => c.id === convId);
  if (!conv) return;
  const isEph = conv.type === 'ephemere';
  const isRes = conv.status === 'resolved';
  const m = document.createElement('div'); m.className = 'conv-menu-popup';
  m.innerHTML = `
    <button class="conv-menu-item" data-action="urgence"><span class="menu-icon">🎯</span> Urgence perso ${conv.urgenceEco ? '· ' + conv.urgenceEco + '/5' : ''}</button>
    <button class="conv-menu-item" data-action="important"><span class="menu-icon">${conv.marked ? '⭐' : '☆'}</span> ${conv.marked ? 'Retirer' : 'Marquer important'}</button>
    <button class="conv-menu-item" data-action="pin"><span class="menu-icon">📌</span> ${conv.pinned ? 'Désépingler' : 'Épingler'}</button>
    <button class="conv-menu-item" data-action="notes"><span class="menu-icon">📝</span> Notes internes</button>
    <div class="conv-menu-sep"></div>
    ${isEph ? `<button class="conv-menu-item" data-action="${isRes ? 'unresolve' : 'resoudre'}"><span class="menu-icon">${isRes ? '↩️' : '✅'}</span> ${isRes ? 'Rouvrir' : 'Marquer résolu'}</button><div class="conv-menu-sep"></div>` : ''}
    <button class="conv-menu-item danger" data-action="signaler"><span class="menu-icon">🚨</span> Signaler</button>`;
  document.body.appendChild(m);
  const r = anchorEl.getBoundingClientRect();
  let top = r.bottom + 6, left = r.left - 180;
  if (left < 10) left = 10;
  if (top + m.offsetHeight > window.innerHeight) top = r.top - m.offsetHeight - 6;
  m.style.top = Math.max(10, top) + 'px'; m.style.left = left + 'px';
  const close = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 10);
  m.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', async () => { const a = btn.dataset.action; m.remove(); await handleConvAction(conv, a); }));
}
async function handleConvAction(conv, action) {
  const ref = doc(db, 'conversations', conv.id);
  switch (action) {
    case 'urgence': return openUrgenceEcoModal(conv);
    case 'important': return await updateDoc(ref, { marked: !conv.marked });
    case 'pin': return await updateDoc(ref, { pinned: !conv.pinned });
    case 'notes': return openNotesModal(conv);
    case 'resoudre':
      await updateDoc(ref, { status: 'resolved', resolvedAt: serverTimestamp() });
      await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a marqué une conversation comme résolue`);
      if (ecoConvId === conv.id) { if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; } openPage('app-ecoutant', 'conversations'); }
      return;
    case 'unresolve': return await updateDoc(ref, { status: 'claimed', resolvedAt: null });
    case 'signaler': return openSignalerModal(conv);
  }
}
function openUrgenceEcoModal(conv) {
  const cur = conv.urgenceEco || 0;
  const ov = openModal(`<div class="modal" style="max-width:400px;"><div class="modal-header"><div class="modal-title">🎯 Urgence perso</div><button class="modal-close">×</button></div><div class="modal-body"><p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Note personnelle</p><div class="conv-opt-grid">${[1,2,3,4,5].map(n => `<button class="conv-opt-btn ${n===cur?'active':''}" data-urg="${n}">${n}</button>`).join('')}</div><button class="btn btn-ghost btn-full" data-urg="0">Effacer</button></div></div>`);
  ov.querySelectorAll('[data-urg]').forEach(b => b.addEventListener('click', async () => {
    const v = parseInt(b.dataset.urg, 10);
    await updateDoc(doc(db, 'conversations', conv.id), { urgenceEco: v > 0 ? v : null });
    ov.remove();
  }));
}
function openNotesModal(conv) {
  const cur = conv.notesInternes || '';
  const ov = openModal(`<div class="modal" style="max-width:500px;"><div class="modal-header"><div class="modal-title">📝 Notes internes</div><button class="modal-close">×</button></div><div class="modal-body"><p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Visible seulement par toi.</p><textarea id="ntx" style="min-height:180px;">${escapeHtml(cur)}</textarea></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="nsv">💾 Enregistrer</button></div></div>`);
  ov.querySelector('#nsv').addEventListener('click', async () => {
    const t = ov.querySelector('#ntx').value.trim();
    await updateDoc(doc(db, 'conversations', conv.id), { notesInternes: t || null });
    ov.remove(); notify('Notes enregistrées ✅', 'success');
  });
}
function openSignalerModal(conv) {
  const ov = openModal(`<div class="modal" style="max-width:500px;"><div class="modal-header"><div class="modal-title">🚨 Signaler</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>Raison</label><textarea id="sgr" style="min-height:120px;"></textarea></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="sgs">Envoyer</button></div></div>`);
  ov.querySelector('#sgs').addEventListener('click', async () => {
    const r = ov.querySelector('#sgr').value.trim();
    if (!r) { notify('Indique une raison.', 'warning'); return; }
    try {
      await addDoc(collection(db, 'signalements'), { convId: conv.id, memberId: conv.memberId, memberName: conv.memberName, ecoutantId: currentUser.uid, ecoutantName: currentUserData?.displayName || 'Écoutant', raison: r, status: 'pending', createdAt: serverTimestamp() });
      await logAction('signalement', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a signalé une conversation`);
      ov.remove(); notify('Signalement envoyé ✅', 'success');
    } catch (e) { notify('Erreur.', 'error'); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MOOD VIEWER
// ═══════════════════════════════════════════════════════════════════════════
setInterval(() => {
  const btn = $('btn-see-mood-eco'); if (!btn) return;
  if (!ecoConvId) { btn.style.display = 'none'; return; }
  const conv = [...ecoMesCache, ...ecoAttenteCache, ...ecoResoluesCache].find(c => c.id === ecoConvId);
  if (conv && conv.memberId) {
    btn.style.display = 'inline-flex';
    btn.dataset.memberId = conv.memberId;
    btn.dataset.memberName = conv.memberName || 'Membre';
  }
}, 800);
setTimeout(() => {
  const btn = $('btn-see-mood-eco');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const mid = btn.dataset.memberId, mn = btn.dataset.memberName;
      if (mid) openMoodViewerFor(mid, mn);
    });
  }
}, 300);
function openMoodViewerFor(memberId, memberName) {
  let vM = new Date(), vMode = 'line', vPeriod = 30;
  const ov = openModal(`<div class="modal" style="max-width:900px;"><div class="modal-header"><div><div class="modal-title">📊 Mood de ${escapeHtml(memberName)}</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Suivi personnel</div></div><button class="modal-close">×</button></div><div class="modal-body" id="mv-body"><p class="empty-state">Chargement…</p></div></div>`);
  const loadM = async m => { try { const s = await getDoc(doc(db, 'users', memberId, 'moods', getMonthKey(m))); return s.exists() ? (s.data().cells || {}) : {}; } catch (e) { return {}; } };
  const loadR = async days => {
    const today = new Date(), all = {}, set = new Set();
    for (let i = 0; i < days; i++) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); set.add(getMonthKey(d)); }
    for (const mk of set) { try { const s = await getDoc(doc(db, 'users', memberId, 'moods', mk)); if (s.exists()) all[mk] = s.data().cells || {}; } catch (e) {} }
    return all;
  };
  const bTable = cells => {
    const days = getDaysInMonth(vM), today = new Date();
    const isCur = today.getFullYear() === vM.getFullYear() && today.getMonth() === vM.getMonth();
    let h = '<table class="mood-table"><thead><tr><th>Élément</th>';
    for (let d = 1; d <= days; d++) { const dt = new Date(vM.getFullYear(), vM.getMonth(), d); const we = dt.getDay() === 0 || dt.getDay() === 6; const tj = isCur && today.getDate() === d; h += `<th class="${we?'weekend':''} ${tj?'today':''}">${d}</th>`; }
    h += '</tr></thead><tbody>';
    MOOD_ELEMENTS.forEach(el => { h += `<tr><th>${el.label}</th>`; for (let d = 1; d <= days; d++) { const tj = isCur && today.getDate() === d; const idx = cells[d] && cells[d][el.id] != null ? cells[d][el.id] : -1; const bg = idx >= 0 ? MOOD_COLORS[idx].hex : 'transparent'; h += `<td class="mood-cell ${idx>=0?'has-color':''} ${tj?'today':''}" style="background:${bg}"></td>`; } h += '</tr>'; });
    return h + '</tbody></table>';
  };
  const bChart = (all, daysCount, mode) => {
    const Wc = 860, Hc = 320, pL = 30, pR = 20, pT = 20;
    const iW = Wc - pL - pR, iH = Hc - pT - 30;
    const today = new Date(), pts = [];
    for (let i = daysCount - 1; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); const mk = getMonthKey(d), day = d.getDate(); pts.push({ day, cells: (all[mk] && all[mk][day]) || {} }); }
    const maxY = 6;
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" class="mood-chart-svg" preserveAspectRatio="none">`;
    for (let l = 0; l <= maxY; l++) { const y = pT + iH - (l / maxY) * iH; svg += `<line x1="${pL}" y1="${y}" x2="${Wc - pR}" y2="${y}" stroke="rgba(255,255,255,0.06)"/>`; }
    if (mode === 'line') {
      MOOD_ELEMENTS.forEach((el, i) => { const col = ELEMENT_COLORS[i], p = []; pts.forEach((pt, idx) => { const v = pt.cells[el.id]; if (v == null) return; const x = pL + (idx / (pts.length - 1 || 1)) * iW; const y = pT + iH - (v / maxY) * iH; p.push(`${x.toFixed(1)},${y.toFixed(1)}`); }); if (p.length > 1) svg += `<polyline points="${p.join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>`; });
    } else {
      const cw = iW / pts.length, bw = Math.max(0.8, (cw * 0.9) / 7), gap = (cw - bw * 7) / 2;
      pts.forEach((pt, i) => { MOOD_ELEMENTS.forEach((el, ei) => { const v = pt.cells[el.id]; if (v == null) return; const col = ELEMENT_COLORS[ei]; const x = pL + i * cw + gap + ei * bw; const hh = (v / maxY) * iH, y = pT + iH - hh; svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(2)}" height="${hh.toFixed(1)}" fill="${col}" opacity="0.9"/>`; }); });
    }
    return svg + '</svg>';
  };
  const renderAll = async () => {
    const body = ov.querySelector('#mv-body');
    const tc = await loadM(vM), cd = await loadR(vPeriod);
    const mt = formatMonthTitle(vM);
    body.innerHTML = `<div class="section-label">📋 ${mt}</div><div class="mood-table-wrapper" style="max-height:380px;">${bTable(tc)}</div><div class="section-label" style="margin-top:24px;">📈 Graphique</div><div class="mood-viewer-controls"><div class="mood-view-periods">${[7,30,90,180].map(p => `<button class="mood-period-btn ${vPeriod===p?'active':''}" data-period="${p}">${p===7?'7j':p===30?'30j':p===90?'3m':'6m'}</button>`).join('')}</div><div class="mood-view-modes"><button class="mood-mode-btn ${vMode==='line'?'active':''}" data-mode="line">📈</button><button class="mood-mode-btn ${vMode==='bar'?'active':''}" data-mode="bar">📊</button></div></div><div class="mood-view-chart">${bChart(cd, vPeriod, vMode)}</div>`;
    body.querySelectorAll('.mood-period-btn').forEach(b => b.addEventListener('click', () => { vPeriod = parseInt(b.dataset.period, 10); renderAll(); }));
    body.querySelectorAll('.mood-mode-btn').forEach(b => b.addEventListener('click', () => { vMode = b.dataset.mode; renderAll(); }));
  };
  renderAll();
}

// ═══════════════════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════════════════
function startEcoNewsListener(containerId) {
  const c = $(containerId); if (!c) return;
  if (containerId === 'news-eco-dynamic' && unsubEcoNews) unsubEcoNews();
  const q = query(collection(db, 'news'), limit(50));
  const unsub = onSnapshot(q, snap => {
    const news = []; snap.forEach(d => news.push({ id: d.id, ...d.data() }));
    news.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (news.length === 0) { c.innerHTML = ''; return; }
    c.innerHTML = '';
    news.forEach(n => {
      const a = document.createElement('article'); a.className = 'card';
      a.innerHTML = `<span class="card-badge">${escapeHtml(n.type || '📰')}</span><h3>${escapeHtml(n.title || 'Sans titre')}</h3><p>${escapeHtml(n.content || '')}</p><span class="card-meta">Par ${escapeHtml(n.authorName || 'Admin')} • ${formatDate(n.createdAt)}</span>`;
      c.appendChild(a);
    });
  });
  if (containerId === 'news-eco-dynamic') unsubEcoNews = unsub;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILS
// ═══════════════════════════════════════════════════════════════════════════
async function openFil(filId, contexte) {
  currentFilId = filId;
  const pageName = contexte === 'admin' ? 'fil-detail-admin' : contexte === 'eco' ? 'fil-detail-eco' : 'fil-detail';
  const appName = contexte === 'admin' ? 'app-admin' : contexte === 'eco' ? 'app-ecoutant' : 'app-membre';
  openPage(appName, pageName);
  try {
    let snap = await getDoc(doc(db, 'fils', filId));
    if (!snap.exists() && filId === 'general') {
      try {
        await setDoc(doc(db, 'fils', 'general'), { title: 'Fil général Iphax', description: 'Témoignages, mots gentils, conseils…', theme: 'Général', color: '#00E5FF', type: 'general', isSystem: true, footer: 'Ici, quelqu\'un t\'écoute 💙', authorName: 'Équipe Iphax', authorId: 'system', members: [], createdAt: serverTimestamp() });
        snap = await getDoc(doc(db, 'fils', filId));
      } catch (e) {}
    }
    if (!snap.exists()) { notify('Ce fil n\'existe pas encore.', 'info'); currentFilData = { title:'Fil', theme:'' }; }
    else currentFilData = snap.data();

    const tId = pageName === 'fil-detail' ? 'fil-detail-title' : pageName === 'fil-detail-eco' ? 'fil-detail-eco-title' : 'fil-detail-admin-title';
    const sId = pageName === 'fil-detail' ? 'fil-detail-subtitle' : pageName === 'fil-detail-eco' ? 'fil-detail-eco-subtitle' : 'fil-detail-admin-subtitle';
    if ($(tId)) $(tId).textContent = currentFilData.title || 'Fil';
    if ($(sId)) $(sId).textContent = currentFilData.theme || '';

    const btnA = $('btn-add-member-admin');
    if (btnA) {
      btnA.style.display = (aAccesAdmin(currentUserData.role) || peutCreerFilThera(currentUserData.role)) ? 'flex' : 'none';
      if (!btnA.dataset.bound) { btnA.dataset.bound = '1'; btnA.addEventListener('click', () => openAddMemberModal(filId)); }
    }

    bindFilBottomButton(filId, contexte);
    const pId = pageName === 'fil-detail' ? 'fil-posts' : pageName === 'fil-detail-eco' ? 'fil-eco-posts' : 'fil-admin-posts';
    startFilPostsListener(filId, pId);
    setTimeout(() => refreshDemandesEnAttente(filId, pId), 300);
  } catch (e) { notify('Impossible d\'ouvrir.', 'error'); }
}
function bindFilBottomButton(filId, contexte) {
  const ids = { membre:'btn-fil-demande', eco:'btn-fil-eco-demande', admin:'btn-fil-admin-message' };
  const b = $(ids[contexte]); if (!b) return;
  const f = b.cloneNode(true); b.parentNode.replaceChild(f, b);
  if (aAccesAdmin(currentUserData.role)) {
    f.textContent = '✍️ Envoyer un message';
    f.addEventListener('click', () => openAdminEmbedForm(filId));
  } else {
    f.textContent = '✍️ Envoyer une demande';
    f.addEventListener('click', () => openDemandePostModal(filId));
  }
}
function startFilPostsListener(filId, containerId) {
  if (unsubFilPosts) { unsubFilPosts(); unsubFilPosts = null; }
  const c = $(containerId); if (!c) return;
  c.innerHTML = '<p class="empty-state">Chargement…</p>';
  const q = query(collection(db, 'fils', filId, 'posts'), orderBy('createdAt', 'asc'), limit(200));
  unsubFilPosts = onSnapshot(q, snap => {
    if (snap.empty) { c.innerHTML = '<p class="empty-state">Aucun message pour l\'instant.</p>'; return; }
    c.innerHTML = '';
    snap.forEach(d => c.appendChild(buildFilPostEl({ id: d.id, ...d.data() }, filId)));
    c.scrollTop = c.scrollHeight;
  }, err => { c.innerHTML = '<p class="empty-state">⚠️ Impossible de charger.</p>'; });
}
function buildFilPostEl(post, filId) {
  const isOwner = post.authorId === currentUser?.uid;
  const canDel = isOwner || aAccesAdmin(currentUserData?.role);
  const color = post.color || currentFilData?.color || '#00E5FF';
  const date = toDate(post.createdAt) || new Date();
  const ds = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  const reacts = REACTIONS_EMOJIS.map(e => {
    const users = (post.reactions && post.reactions[e]) || {};
    const cnt = Object.keys(users).length;
    const act = !!users[currentUser?.uid];
    return `<button class="fil-react-btn ${act?'active':''}" data-emoji="${e}" type="button">${e}<span class="fil-react-count">${cnt>0?cnt:''}</span></button>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'fil-post';
  el.innerHTML = `
    <div class="fil-post-bar" style="background:${color};"></div>
    <div class="fil-post-content">
      <div class="fil-post-header"><span class="fil-post-author">${escapeHtml(post.authorName || 'Anonyme')}</span><span>${ds}</span></div>
      ${post.title ? `<div class="fil-post-title">${escapeHtml(post.title)}</div>` : ''}
      <div class="fil-post-message">${escapeHtml(post.message || '')}</div>
      ${post.footer ? `<div class="fil-post-footer">${escapeHtml(post.footer)}</div>` : ''}
      <div class="fil-post-actions">${reacts}<button class="fil-react-plus" type="button" title="Réagir">➕</button><button class="fil-comment-btn" type="button" title="Commentaires">💬</button>${canDel ? '<button class="fil-delete-btn" type="button" title="Supprimer">🗑️</button>' : ''}</div>
    </div>`;
  el.querySelectorAll('.fil-react-btn').forEach(b => b.addEventListener('click', () => toggleFilReaction(filId, post.id, b.dataset.emoji)));
  el.querySelector('.fil-react-plus').addEventListener('click', e => { e.stopPropagation(); openReactionPalette(filId, post.id, el.querySelector('.fil-react-plus')); });
  el.querySelector('.fil-comment-btn').addEventListener('click', () => {
    openModal(`<div class="modal" style="max-width:400px;"><div class="modal-header"><div class="modal-title">💬 Commentaires</div><button class="modal-close">×</button></div><div class="modal-body" style="text-align:center;padding:30px 20px;"><svg class="wysp" viewBox="0 0 200 240" style="width:100px;height:120px;"><use href="#wysp-icon"/></svg><p style="margin-top:14px;font-size:14px;color:var(--text-secondary);line-height:1.6;">Wysp code les commentaires 🔨<br>Ça arrive bientôt !</p></div></div>`);
  });
  const del = el.querySelector('.fil-delete-btn');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Supprimer ce message ?')) return;
    try { await deleteDoc(doc(db, 'fils', filId, 'posts', post.id)); } catch (e) { notify('Erreur', 'error'); }
  });
  return el;
}
function openReactionPalette(filId, postId, anchor) {
  document.querySelector('.reaction-palette')?.remove();
  const p = document.createElement('div');
  p.className = 'reaction-palette';
  p.style.cssText = 'position:fixed;z-index:2000;background:linear-gradient(180deg,rgba(15,37,81,0.99),rgba(10,26,61,0.99));border:1.5px solid var(--border-focus);border-radius:14px;padding:8px;display:flex;gap:4px;box-shadow:0 12px 40px rgba(0,0,0,0.6);';
  p.innerHTML = REACTIONS_EMOJIS.map(e => `<button type="button" style="width:38px;height:38px;border-radius:10px;background:transparent;border:none;font-size:20px;cursor:pointer;color:inherit;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">${e}</button>`).join('');
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect();
  p.style.top = Math.max(10, r.top - 56) + 'px';
  p.style.left = Math.min(window.innerWidth - p.offsetWidth - 10, r.left) + 'px';
  p.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', async () => { await toggleFilReaction(filId, postId, REACTIONS_EMOJIS[i]); p.remove(); }));
  const close = e => { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 10);
}
async function toggleFilReaction(filId, postId, emoji) {
  if (!currentUser) return;
  try {
    const ref = doc(db, 'fils', filId, 'posts', postId);
    const snap = await getDoc(ref); if (!snap.exists()) return;
    const reactions = snap.data().reactions || {};
    const users = reactions[emoji] || {};
    if (users[currentUser.uid]) delete users[currentUser.uid];
    else users[currentUser.uid] = true;
    reactions[emoji] = users;
    await updateDoc(ref, { reactions });
  } catch (e) {}
}
function openDemandePostModal(filId) {
  let anonyme = false;
  const ov = openModal(`
    <div class="modal" style="max-width:520px;">
      <div class="modal-header"><div><div class="modal-title">✍️ Envoyer une demande</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Ton message sera validé avant publication.</div></div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="field"><label>Publier en tant que</label><div class="journal-privacy-choice">
          <button type="button" class="journal-privacy-option" data-anon="false"><span class="privacy-icon">👤</span><span class="privacy-label">${escapeHtml(currentUserData?.displayName || 'Moi')}</span></button>
          <button type="button" class="journal-privacy-option active" data-anon="true"><span class="privacy-icon">🎭</span><span class="privacy-label">Anonyme</span></button>
        </div></div>
        <div class="field" style="margin-top:14px;"><label>Titre (facultatif)</label><input type="text" id="dpT" maxlength="80"></div>
        <div class="field" style="margin-top:14px;"><label>Ton message</label><textarea id="dpM" style="min-height:140px;" maxlength="1000"></textarea></div>
        <p class="auth-error" id="dpE" style="margin-top:10px;"></p>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="dpS">📩 Envoyer la demande</button></div>
    </div>`);
  ov.querySelectorAll('.journal-privacy-option').forEach(o => o.addEventListener('click', () => {
    ov.querySelectorAll('.journal-privacy-option').forEach(x => x.classList.remove('active'));
    o.classList.add('active'); anonyme = o.dataset.anon === 'true';
  }));
  ov.querySelector('#dpS').addEventListener('click', async () => {
    const err = ov.querySelector('#dpE'), btn = ov.querySelector('#dpS');
    err.textContent = '';
    const title = ov.querySelector('#dpT').value.trim(), message = ov.querySelector('#dpM').value.trim();
    if (!message) { err.textContent = '⚠️ Écris ton message.'; err.style.color = 'var(--error)'; return; }
    btn.disabled = true; btn.textContent = '⏳ Envoi...';
    try {
      if (!currentUser || !currentUser.uid) throw new Error('Non connecté');
      await addDoc(collection(db, 'demandes-fil'), { filId: filId || 'general', authorId: currentUser.uid, authorName: currentUserData?.displayName || 'Utilisateur', anonyme, title: title || '', message, status: 'pending', createdAt: serverTimestamp() });
      btn.textContent = '✅ Envoyée !';
      err.textContent = '✅ Ta demande a été envoyée ! Un admin va la valider.';
      err.style.color = 'var(--success)';
      notify('Ta demande a été envoyée !', 'success');
      setTimeout(() => { ov.remove(); const pId = filId === 'general' ? ($('fil-posts') ? 'fil-posts' : $('fil-eco-posts') ? 'fil-eco-posts' : 'fil-admin-posts') : null; if (pId) refreshDemandesEnAttente(filId, pId); }, 1000);
    } catch (e) {
      err.textContent = '❌ Erreur : ' + (e.message || 'réessaie.');
      err.style.color = 'var(--error)';
      btn.disabled = false; btn.textContent = '📩 Envoyer la demande';
    }
  });
}
function refreshDemandesEnAttente(filId, containerId) {
  if (unsubDemandesPerso) { unsubDemandesPerso(); unsubDemandesPerso = null; }
  if (!currentUser) return;
  let container = $(containerId);
  if (!container) container = $('fil-posts') || $('fil-eco-posts') || $('fil-admin-posts');
  if (!container) return;
  const old = $('demandes-perso-block'); if (old) old.remove();
  const q = query(collection(db, 'demandes-fil'), where('authorId', '==', currentUser.uid));
  unsubDemandesPerso = onSnapshot(q, snap => {
    const demandes = [];
    snap.forEach(d => { const data = d.data(); if (data.filId === (filId || 'general') && data.status === 'pending') demandes.push({ id: d.id, ...data }); });
    const ex = $('demandes-perso-block'); if (ex) ex.remove();
    if (demandes.length === 0) return;
    const b = document.createElement('div');
    b.id = 'demandes-perso-block';
    b.style.cssText = 'margin-bottom:16px;padding:12px;background:rgba(255,179,71,0.08);border:1.5px dashed rgba(255,179,71,0.5);border-radius:12px;';
    b.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">⏳ Tes demandes en attente</div>${demandes.map(dm => `<div style="padding:10px 12px;background:rgba(10,26,61,0.5);border-radius:8px;margin-bottom:6px;">${dm.title ? `<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${escapeHtml(dm.title)}</div>` : ''}<div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;">${escapeHtml(dm.message)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px;font-style:italic;">Envoyée ${formatDate(dm.createdAt)}</div></div>`).join('')}`;
    container.insertBefore(b, container.firstChild);
  });
}
function openAdminEmbedForm(filId) {
  let selectedColor = currentFilData?.color || '#00E5FF';
  const COLORS = ['#00E5FF','#A78BFA','#F472B6','#3DDC97','#FB923C','#FFD93D','#E04A5A','#8FA6C7','#5EB0FF'];
  const ov = openModal(`
    <div class="modal" style="max-width:560px;">
      <div class="modal-header"><div><div class="modal-title">✍️ Envoyer un message</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Publication directe.</div></div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="field"><label>Titre</label><input type="text" id="efT" maxlength="80"></div>
        <div class="field" style="margin-top:14px;"><label>Message</label><textarea id="efM" maxlength="1000" style="min-height:100px;"></textarea></div>
        <div class="field" style="margin-top:14px;"><label>Mini-texte de fin (facultatif)</label><input type="text" id="efF" maxlength="120"></div>
        <div class="field" style="margin-top:14px;"><label>Couleur</label><div style="display:flex;gap:8px;flex-wrap:wrap;">${COLORS.map(c => `<button type="button" class="color-choice" data-color="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:2px solid ${c===selectedColor?'#fff':'transparent'};cursor:pointer;"></button>`).join('')}</div></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="efS">📩 Publier</button></div>
    </div>`);
  ov.querySelectorAll('.color-choice').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('.color-choice').forEach(x => x.style.borderColor = 'transparent');
    b.style.borderColor = '#fff'; selectedColor = b.dataset.color;
  }));
  ov.querySelector('#efS').addEventListener('click', async () => {
    const title = ov.querySelector('#efT').value.trim(), message = ov.querySelector('#efM').value.trim(), footer = ov.querySelector('#efF').value.trim();
    if (!message) { notify('Écris un message.', 'warning'); return; }
    try {
      await addDoc(collection(db, 'fils', filId, 'posts'), { authorId: currentUser.uid, authorName: currentUserData?.displayName || 'Admin', title: title || '', message, footer: footer || '', color: selectedColor, reactions: {}, isEmbed: true, createdAt: serverTimestamp() });
      ov.remove();
    } catch (e) { notify('Erreur : ' + e.message, 'error'); }
  });
}
function openAddMemberModal(filId) {
  const ov = openModal(`<div class="modal" style="max-width:480px;"><div class="modal-header"><div class="modal-title">➕ Ajouter un membre</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>@pseudo</label><div class="field-input"><span class="field-prefix">@</span><input type="text" id="ami" autocomplete="off"></div><p class="field-hint" id="amh">Tape le pseudo exact.</p></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="ams">Ajouter</button></div></div>`);
  ov.querySelector('#ams').addEventListener('click', async () => {
    const p = ov.querySelector('#ami').value.trim().replace(/^@/, '');
    const h = ov.querySelector('#amh');
    if (!p) { h.textContent = '⚠️ Entre un pseudo.'; h.style.color = 'var(--error)'; return; }
    h.textContent = '🔍...'; h.style.color = 'var(--text-muted)';
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', p)));
      if (snap.empty) { h.textContent = '❌ Aucun utilisateur.'; h.style.color = 'var(--error)'; return; }
      const uid = snap.docs[0].id, data = snap.docs[0].data();
      if (uid === currentUser.uid) { h.textContent = '⚠️ C\'est toi.'; h.style.color = 'var(--error)'; return; }
      const ref = doc(db, 'fils', filId); const fs = await getDoc(ref);
      const mem = fs.data().members || [];
      if (mem.includes(uid)) { h.textContent = '⚠️ Déjà membre.'; h.style.color = 'var(--error)'; return; }
      mem.push(uid); await updateDoc(ref, { members: mem });
      ov.remove(); notify(`@${data.username} ajouté ✅`, 'success');
    } catch (e) { h.textContent = '❌ ' + e.message; h.style.color = 'var(--error)'; }
  });
}
function openCreateFilTheraModal() {
  let selCol = '#00E5FF';
  const COLORS = ['#00E5FF','#A78BFA','#F472B6','#3DDC97','#FB923C','#FFD93D','#E04A5A','#8FA6C7'];
  const ov = openModal(`<div class="modal" style="max-width:560px;"><div class="modal-header"><div class="modal-title">➕ Nouveau fil thérapeutique</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>Titre</label><input type="text" id="ftT" maxlength="80"></div><div class="field" style="margin-top:14px;"><label>Thème</label><input type="text" id="ftTh" maxlength="40"></div><div class="field" style="margin-top:14px;"><label>Description</label><textarea id="ftD" maxlength="500" style="min-height:100px;"></textarea></div><div class="field" style="margin-top:14px;"><label>Mini-texte</label><input type="text" id="ftF" maxlength="120"></div><div class="field" style="margin-top:14px;"><label>Couleur</label><div style="display:flex;gap:8px;flex-wrap:wrap;">${COLORS.map(c => `<button type="button" class="cc" data-color="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:2px solid ${c===selCol?'#fff':'transparent'};cursor:pointer;"></button>`).join('')}</div></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="ftS">✨ Créer</button></div></div>`);
  ov.querySelectorAll('.cc').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('.cc').forEach(x => x.style.borderColor = 'transparent');
    b.style.borderColor = '#fff'; selCol = b.dataset.color;
  }));
  ov.querySelector('#ftS').addEventListener('click', async () => {
    const title = ov.querySelector('#ftT').value.trim(), theme = ov.querySelector('#ftTh').value.trim(), desc = ov.querySelector('#ftD').value.trim(), footer = ov.querySelector('#ftF').value.trim();
    if (!title) { notify('Titre obligatoire', 'warning'); return; }
    try {
      await addDoc(collection(db, 'fils'), { title, theme: theme || 'Thérapie', description: desc, footer, color: selCol, type: 'thera', authorName: currentUserData?.displayName || 'Admin', authorId: currentUser.uid, members: [], isSystem: false, createdAt: serverTimestamp() });
      ov.remove(); notify('Fil créé ✅', 'success');
    } catch (e) { notify('Erreur : ' + e.message, 'error'); }
  });
}
function loadFilsTheraMembre() {
  const c = $('fils-thera-membre-list'); if (!c) return;
  if (unsubFilsList) unsubFilsList();
  const q = query(collection(db, 'fils'), where('type', '==', 'thera'));
  unsubFilsList = onSnapshot(q, snap => {
    const fils = []; snap.forEach(d => { const data = d.data(); if ((data.members || []).includes(currentUser.uid)) fils.push({ id: d.id, ...data }); });
    if (fils.length === 0) { c.innerHTML = '<p class="empty-state">Aucun fil thérapeutique rejoint.</p>'; return; }
    c.innerHTML = fils.map(f => renderFilCard(f)).join('');
    c.querySelectorAll('[data-fil-open]').forEach(el => el.addEventListener('click', () => openFil(el.dataset.filOpen, 'membre')));
  });
}
function renderFilCard(f) {
  return `<div class="fil-embed" data-fil-open="${f.id}" style="--fil-color:${f.color || '#00E5FF'};cursor:pointer;margin-bottom:12px;"><div class="fil-embed-bar"></div><div class="fil-embed-body"><h3 class="fil-embed-title">${escapeHtml(f.title || '')}</h3><div class="fil-embed-meta"><span class="fil-embed-author">@${escapeHtml(f.authorName || 'system')}</span><span class="fil-embed-theme">${escapeHtml(f.theme || '')}</span><span class="fil-embed-date">${formatDate(f.createdAt)}</span></div><p class="fil-embed-desc">${escapeHtml(f.description || '')}</p>${f.footer ? `<p class="fil-embed-footer">${escapeHtml(f.footer)}</p>` : ''}</div></div>`;
}
function loadFilsList(contexte) {
  const id = contexte === 'eco' ? 'fils-thera-eco-list' : 'admin-fils-thera-list';
  const c = $(id); if (!c) return;
  const q = query(collection(db, 'fils'), where('type', '==', 'thera'));
  onSnapshot(q, snap => {
    const fils = []; snap.forEach(d => fils.push({ id: d.id, ...d.data() }));
    if (fils.length === 0) { c.innerHTML = '<p class="empty-state">Aucun fil thérapeutique.</p>'; return; }
    c.innerHTML = fils.map(f => renderFilCard(f)).join('');
    c.querySelectorAll('[data-fil-open]').forEach(el => el.addEventListener('click', () => openFil(el.dataset.filOpen, contexte)));
  });
}
function setupFilsButtons() {
  const bfg = $('btn-fil-general');
  if (bfg && !bfg.dataset.bound) { bfg.dataset.bound = '1'; bfg.addEventListener('click', () => openFil('general', 'membre')); }
  const ec = document.querySelector('#app-ecoutant [data-page="fils"] .card-pinned');
  if (ec && !ec.dataset.bound) { ec.dataset.bound = '1'; ec.style.cursor = 'pointer'; ec.addEventListener('click', () => openFil('general', 'eco')); }
  ['btn-admin-fil-general:general','btn-admin-fil-perso:personnel','btn-admin-fil-staff:staff'].forEach(p => {
    const [id, fId] = p.split(':'); const b = $(id);
    if (b && !b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', () => openFil(fId, 'admin')); }
  });
  const bc = $('btn-admin-create-fil-thera');
  if (bc && !bc.dataset.bound) { bc.dataset.bound = '1'; bc.addEventListener('click', openCreateFilTheraModal); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFIL
// ═══════════════════════════════════════════════════════════════════════════
function applyTheme(t) {
  const theme = t || 'iphax';
  document.body.dataset.theme = theme;
  try { localStorage.setItem('iphax_theme', theme); } catch (e) {}
  if (window.iphaxThemeBg && window.iphaxThemeBg.apply) {
    window.iphaxThemeBg.apply(theme);
  }
}
applyTheme(localStorage.getItem('iphax_theme') || 'iphax');
function joursRestants(ts, jours) { if (!ts) return 0; const l = ts.toMillis ? ts.toMillis() : new Date(ts).getTime(); const d = (jours * 24 * 60 * 60 * 1000) - (Date.now() - l); if (d <= 0) return 0; return Math.ceil(d / (24 * 60 * 60 * 1000)); }
function renderProfilHeader(id, data) {
  const c = $(id); if (!c || !data) return;
  c.innerHTML = `<div class="profil-avatar" id="${id}-av" title="Changer"><span class="profil-avatar-emoji">${data.avatar || '🌙'}</span><span class="profil-avatar-edit">✏️</span></div><div class="profil-infos"><div class="profil-name">${escapeHtml(data.displayName || 'Utilisateur')}</div><div class="profil-username">@${escapeHtml(data.username || 'inconnu')}</div>${data.bio ? `<div class="profil-bio">${escapeHtml(data.bio)}</div>` : ''}</div>`;
  $(`${id}-av`)?.addEventListener('click', () => openAvatarPicker(data));
}
function refreshProfils() {
  if (!currentUserData) return;
  renderProfilHeader('profil-header', currentUserData);
  renderProfilHeader('profil-eco-header', currentUserData);
  renderProfilHeader('profil-admin-header', currentUserData);
}
function initProfilUI() {
  refreshProfils();
  ['btn-gear','btn-gear-eco','btn-gear-admin'].forEach(id => {
    const b = $(id);
    if (b && !b.dataset.bound) {
      b.dataset.bound = '1';
      b.addEventListener('click', (e) => { e.preventDefault(); openSettingsModal(); });
      b.addEventListener('touchstart', (e) => { e.preventDefault(); openSettingsModal(); }, { passive: false });
    }
  });
}
function openAvatarPicker(data) {
  const cur = data.avatar || '🌙';
  const ov = openModal(`<div class="modal" style="max-width:420px;"><div class="modal-header"><div class="modal-title">🖼️ Avatar</div><button class="modal-close">×</button></div><div class="modal-body"><div class="avatar-grid">${AVATARS.map(a => `<button class="avatar-choice ${a===cur?'selected':''}" data-avatar="${a}">${a}</button>`).join('')}</div></div></div>`);
  ov.querySelectorAll('.avatar-choice').forEach(b => b.addEventListener('click', async () => {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { avatar: b.dataset.avatar });
      await updateDoc(doc(db, 'users-public', currentUser.uid), { avatar: b.dataset.avatar });
      currentUserData.avatar = b.dataset.avatar;
      ov.remove();
      refreshProfils();
    } catch (e) { notify('Erreur', 'error'); }
  }));
}
function openEditDisplayName() {
  const cur = currentUserData.displayName || '';
  const j = joursRestants(currentUserData.lastDisplayNameChange, 7);
  if (j > 0) { notify(`Attends encore ${j} jour(s).`, 'warning'); return; }
  const ov = openModal(`<div class="modal" style="max-width:480px;"><div class="modal-header"><div class="modal-title">✏️ Nom d'affichage</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>1x/7j</label><input type="text" id="dn" value="${escapeHtml(cur)}" maxlength="30"></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="dns">💾</button></div></div>`);
  ov.querySelector('#dns').addEventListener('click', async () => {
    const v = ov.querySelector('#dn').value.trim();
    if (!v) { notify('Entre un nom.', 'warning'); return; }
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { displayName: v, lastDisplayNameChange: serverTimestamp() });
      await updateDoc(doc(db, 'users-public', currentUser.uid), { displayName: v });
      currentUserData.displayName = v;
      ov.remove();
      refreshProfils();
      notify('Enregistré ✅', 'success');
    } catch (e) { notify('Erreur', 'error'); }
  });
}
function openEditUsername() {
  const cur = currentUserData.username || '';
  const j = joursRestants(currentUserData.lastUsernameChange, 30);
  if (j > 0) { notify(`Attends encore ${j} jour(s).`, 'warning'); return; }
  const ov = openModal(`<div class="modal" style="max-width:480px;"><div class="modal-header"><div class="modal-title">✏️ Nom d'utilisateur</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>1x/30j</label><div class="field-input"><span class="field-prefix">@</span><input type="text" id="un" value="${escapeHtml(cur)}" autocomplete="off"></div><p class="field-hint" id="unh">3-24 car.</p></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="uns">💾</button></div></div>`);
  ov.querySelector('#uns').addEventListener('click', async () => {
    const v = ov.querySelector('#un').value.trim(); const h = ov.querySelector('#unh');
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(v)) { h.textContent = '⚠️ Invalide.'; h.style.color = 'var(--error)'; return; }
    if (v.toLowerCase() === cur.toLowerCase()) { ov.remove(); return; }
    h.textContent = '🔍...'; h.style.color = 'var(--text-muted)';
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', v)));
      if (snap.docs.some(d => d.id !== currentUser.uid)) { h.textContent = '❌ Déjà pris.'; h.style.color = 'var(--error)'; return; }
      await updateDoc(doc(db, 'users', currentUser.uid), { username: v, lastUsernameChange: serverTimestamp() });
      await updateDoc(doc(db, 'users-public', currentUser.uid), { username: v });
      currentUserData.username = v; ov.remove(); refreshProfils(); notify('Enregistré ✅', 'success');
    } catch (e) { h.textContent = '❌ Erreur.'; h.style.color = 'var(--error)'; }
  });
}
function openEditBio() {
  const cur = currentUserData.bio || '';
  const ov = openModal(`<div class="modal" style="max-width:480px;"><div class="modal-header"><div class="modal-title">📝 Bio</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>150 car. max</label><textarea id="bio" maxlength="150" style="min-height:100px;">${escapeHtml(cur)}</textarea><div class="bio-counter" id="bc">${cur.length}/150</div></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="bs">💾</button></div></div>`);
  const ta = ov.querySelector('#bio'), bc = ov.querySelector('#bc');
  ta.addEventListener('input', () => bc.textContent = `${ta.value.length}/150`);
  ov.querySelector('#bs').addEventListener('click', async () => {
    const v = ta.value.trim();
    try { await updateDoc(doc(db, 'users', currentUser.uid), { bio: v || null }); currentUserData.bio = v; ov.remove(); refreshProfils(); notify('Enregistré ✅', 'success'); } catch (e) { notify('Erreur', 'error'); }
  });
}
function openChangePassword() {
  const ov = openModal(`<div class="modal" style="max-width:480px;"><div class="modal-header"><div class="modal-title">🔑 Mot de passe</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>Actuel</label><div class="field-input"><input type="password" id="pc" autocomplete="current-password"></div></div><div class="field" style="margin-top:14px;"><label>Nouveau</label><div class="field-input"><input type="password" id="pn" autocomplete="new-password"></div></div><div class="field" style="margin-top:14px;"><label>Confirmer</label><div class="field-input"><input type="password" id="pf" autocomplete="new-password"></div></div><p class="auth-error" id="pe" style="margin-top:12px;"></p></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="ps">💾</button></div></div>`);
  ov.querySelector('#ps').addEventListener('click', async () => {
    const c = ov.querySelector('#pc').value, n = ov.querySelector('#pn').value, f = ov.querySelector('#pf').value;
    const e = ov.querySelector('#pe'); e.textContent = '';
    if (!c) { e.textContent = '⚠️ Actuel requis.'; return; }
    if (n.length < 8) { e.textContent = '⚠️ 8 car. min.'; return; }
    if (!/[A-Za-z]/.test(n) || !/[0-9]/.test(n)) { e.textContent = '⚠️ 1 lettre + 1 chiffre.'; return; }
    if (n !== f) { e.textContent = '⚠️ Ne correspondent pas.'; return; }
    try {
      e.textContent = '🔍...'; e.style.color = 'var(--text-muted)';
      const cred = EmailAuthProvider.credential(currentUser.email, c);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, n);
      ov.remove(); notify('Mot de passe changé ✅', 'success');
    } catch (err) {
      e.style.color = 'var(--error)';
      if (['auth/wrong-password','auth/invalid-credential'].includes(err.code)) e.textContent = '❌ Actuel incorrect.';
      else e.textContent = '❌ ' + (err.message || 'Erreur');
    }
  });
}
function openCustomTheme() {
  openModal(`
    <div class="modal" style="max-width:460px;">
      <div class="modal-header">
        <div class="modal-title">🎨 Thème personnalisé</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body" style="text-align:center;padding:30px 20px;">
        <svg class="wysp" viewBox="0 0 200 240" style="width:130px;height:156px;margin:0 auto;">
          <use href="#wysp-icon"/>
        </svg>
        <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-top:18px;letter-spacing:-0.3px;">
          Chut…
        </h3>
        <p style="margin-top:10px;font-size:14px;color:var(--text-secondary);line-height:1.6;">
          Wysp prépare une nouvelle fonctionnalité de personnalisation 🔨
        </p>
        <p style="margin-top:14px;font-size:12.5px;color:var(--text-muted);">
          ⏳ Bientôt disponible
        </p>
      </div>
    </div>
  `);
}

function openSettingsModal() {
  const curT = localStorage.getItem('iphax_theme') || 'iphax';
  const ov = openModal(`
    <div class="modal" style="max-width:520px;">
      <div class="modal-header"><div class="modal-title">⚙️ Paramètres</div><button class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="field"><label style="font-size:14px;color:var(--text-primary);font-weight:600;">🎨 Thème</label><div class="theme-grid">${THEMES.map(t => `<div><button class="theme-choice ${t.id===curT?'selected':''}" data-theme="${t.id}" style="background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]},${t.colors[2]});"></button><div class="theme-label">${t.label}</div></div>`).join('')}<div><button class="theme-choice theme-choice-custom" id="theme-custom" style="background:linear-gradient(135deg,#888,#ccc,#fff);display:flex;align-items:center;justify-content:center;font-size:22px;">🎨</button><div class="theme-label">Personnalisé</div></div></div></div>
        <div class="field" style="margin-top:24px;"><label style="font-size:14px;color:var(--text-primary);font-weight:600;">👤 Profil</label>
          <button class="btn btn-ghost btn-full" id="s-dn" style="justify-content:flex-start;">✏️ Nom d'affichage</button>
          <button class="btn btn-ghost btn-full" id="s-un" style="justify-content:flex-start;margin-top:8px;">👤 Nom d'utilisateur</button>
          <button class="btn btn-ghost btn-full" id="s-bio" style="justify-content:flex-start;margin-top:8px;">📝 Bio</button>
        </div>
        <div class="field" style="margin-top:24px;"><label style="font-size:14px;color:var(--text-primary);font-weight:600;">🔐 Sécurité</label>
          <button class="btn btn-ghost btn-full" id="s-pw" style="justify-content:flex-start;">🔑 Changer mot de passe</button>
        </div>
        <div class="field" style="margin-top:24px;"><label style="font-size:14px;color:var(--text-primary);font-weight:600;">🎬 À propos</label>
          <button class="btn btn-ghost btn-full" id="s-credits" style="justify-content:flex-start;">🎬 Voir les crédits</button>
        </div>
        <div class="field" style="margin-top:24px;"><label style="font-size:14px;color:var(--text-primary);font-weight:600;">ℹ️ Infos</label>
          <div style="padding:12px;background:rgba(10,26,61,0.5);border-radius:var(--radius-sm);font-size:13px;color:var(--text-secondary);">📧 ${escapeHtml(currentUserData?.email || '—')}<br>🎂 ${escapeHtml(currentUserData?.birthdate || '—')}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="s-reset" style="flex:1;">🔄 Reset thème</button>
        <button class="btn btn-ghost" id="s-lo" style="flex:1;">🚪 Déconnexion</button>
      </div>
    </div>`);
  ov.querySelectorAll('.theme-choice').forEach(b => {
    if (b.id === 'theme-custom') return;
    b.addEventListener('click', async () => {
      const c = b.dataset.theme; applyTheme(c);
      ov.querySelectorAll('.theme-choice').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: c });
        currentUserData.theme = c;
        notify('Thème enregistré ✅', 'success');
      } catch (e) {
        notify('Erreur sauvegarde : ' + e.message, 'error');
      }
    });
  });
  ov.querySelector('#theme-custom')?.addEventListener('click', () => { ov.remove(); setTimeout(openCustomTheme, 150); });
  ov.querySelector('#s-dn').addEventListener('click', () => { ov.remove(); setTimeout(openEditDisplayName, 150); });
  ov.querySelector('#s-un').addEventListener('click', () => { ov.remove(); setTimeout(openEditUsername, 150); });
  ov.querySelector('#s-bio').addEventListener('click', () => { ov.remove(); setTimeout(openEditBio, 150); });
  ov.querySelector('#s-pw').addEventListener('click', () => { ov.remove(); setTimeout(openChangePassword, 150); });
  ov.querySelector('#s-credits').addEventListener('click', () => {
    ov.remove();
    setTimeout(() => {
      if (window.iphaxCredits && typeof window.iphaxCredits.show === 'function') {
        window.iphaxCredits.show(() => {
          const profilActif = document.querySelector('.screen.active');
          if (profilActif) profilActif.classList.add('active');
        });
      }
    }, 150);
  });
  ov.querySelector('#s-reset').addEventListener('click', () => {
    localStorage.removeItem('iphax_theme');
    notify('Thème réinitialisé ✅', 'success');
    setTimeout(() => location.reload(), 500);
  });
  ov.querySelector('#s-lo').addEventListener('click', () => { ov.remove(); handleLogout(); });
}
function handleLogout() {
  if (!confirm('Se déconnecter ?')) return;
  signOut(auth).then(() => {
    currentUser = null; currentUserData = null;
    [memberChatUnsub, ecoChatUnsub, unsubEcoAttente, unsubEcoMes, unsubEcoResolues, unsubAdminNews, unsubEcoNews, unsubAdminDemandes, unsubFilPosts, unsubFilsList, unsubDemandesPerso].forEach(u => { if (typeof u === 'function') u(); });
    showScreen('screen-intro');
  });
}
$('btn-logout')?.addEventListener('click', handleLogout);
$('btn-logout-eco')?.addEventListener('click', handleLogout);

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════
function initAdmin() {
  initProfilUI(); setupFilsButtons();
  ['admin-panel-tabs','admin-sup-tabs','dev-tabs'].forEach(id => {
    const c = $(id); if (!c || c.dataset.bound) return; c.dataset.bound = '1';
    const tabs = c.querySelectorAll('.mini-tab'), ind = c.querySelector('.mini-tab-indicator');
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active')); t.classList.add('active');
      c.dataset.active = t.dataset.mini;
      if (ind) { const n = tabs.length; ind.style.width = `calc(${100/n}% - ${(8/n)}px)`; ind.style.transform = `translateX(calc(100% * ${i}))`; }
      const p = c.closest('.page');
      if (p) { p.querySelectorAll('.mini-content').forEach(x => x.classList.remove('active')); const cc = p.querySelector(`.mini-content[data-mini-content="${t.dataset.mini}"]`); if (cc) cc.classList.add('active'); }
    }));
  });
  loadAdminNews(); loadAdminDemandes(); loadAdminMembres(''); loadAdminEcoutants(''); loadAdminConvs(); loadAdminSignalements();
  ['admin-search-membres','admin-search-ecoutants','admin-search-users'].forEach(id => {
    const i = $(id); if (!i || i.dataset.bound) return; i.dataset.bound = '1';
    i.addEventListener('input', e => {
      const v = e.target.value;
      if (id === 'admin-search-membres') loadAdminMembres(v);
      if (id === 'admin-search-ecoutants') loadAdminEcoutants(v);
      if (id === 'admin-search-users') loadAdminUsersSearch(v);
    });
  });
  const bn = $('btn-admin-new-news');
  if (bn && !bn.dataset.bound) { bn.dataset.bound = '1'; bn.addEventListener('click', openCreateNewsModal); }
  loadFilsList('admin');

  loadDevStats();
  bindDevTabs();

  const devSearch = $('dev-search-users');
  if (devSearch && !devSearch.dataset.bound) {
    devSearch.dataset.bound = '1';
    devSearch.addEventListener('input', e => loadDevUsers(e.target.value));
  }
}
function openCreateNewsModal() {
  const ov = openModal(`<div class="modal" style="max-width:520px;"><div class="modal-header"><div class="modal-title">📰 Nouvelle news</div><button class="modal-close">×</button></div><div class="modal-body"><div class="field"><label>Type</label><select id="nt" style="width:100%;padding:12px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);font-family:inherit;"><option value="📰 Annonce">📰 Annonce</option><option value="🎉 Événement">🎉 Événement</option><option value="💬 Témoignage">💬 Témoignage</option><option value="🆕 Nouveau contenu">🆕 Nouveau contenu</option><option value="📌 Épinglé">📌 Épinglé</option></select></div><div class="field" style="margin-top:14px;"><label>Titre</label><input type="text" id="nti" maxlength="100"></div><div class="field" style="margin-top:14px;"><label>Contenu</label><textarea id="nc" style="min-height:140px;"></textarea></div></div><div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="ns">Publier</button></div></div>`);
  ov.querySelector('#ns').addEventListener('click', async () => {
    const type = ov.querySelector('#nt').value, title = ov.querySelector('#nti').value.trim(), content = ov.querySelector('#nc').value.trim();
    if (!title || !content) { notify('Titre + contenu obligatoires', 'warning'); return; }
    try { await addDoc(collection(db, 'news'), { type, title, content, authorName: currentUserData?.displayName || 'Admin', createdAt: serverTimestamp() }); ov.remove(); notify('News publiée ✅', 'success'); } catch (e) { notify('Erreur : ' + e.message, 'error'); }
  });
}
function loadAdminNews() {
  const c = $('admin-news-list'); if (!c) return;
  if (unsubAdminNews) unsubAdminNews();
  const q = query(collection(db, 'news'), limit(50));
  unsubAdminNews = onSnapshot(q, snap => {
    const news = []; snap.forEach(d => news.push({ id: d.id, ...d.data() }));
    news.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (news.length === 0) { c.innerHTML = '<p class="empty-state">Aucune news.</p>'; return; }
    c.innerHTML = '';
    news.forEach(n => {
      const a = document.createElement('article'); a.className = 'card';
      a.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><span class="card-badge">${escapeHtml(n.type || '📰')}</span><button class="nd" data-id="${n.id}" style="background:transparent;border:none;color:var(--error);cursor:pointer;font-size:16px;padding:2px 6px;">🗑️</button></div><h3>${escapeHtml(n.title || 'Sans titre')}</h3><p>${escapeHtml(n.content || '')}</p><span class="card-meta">Par ${escapeHtml(n.authorName || 'Admin')} • ${formatDate(n.createdAt)}</span>`;
      c.appendChild(a);
    });
    c.querySelectorAll('.nd').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Supprimer cette news ?')) return;
      try { await deleteDoc(doc(db, 'news', b.dataset.id)); await logAction('delete', `<strong>${escapeHtml(currentUserData?.displayName || 'Admin')}</strong> a supprimé une news`); } catch (e) { notify('Erreur', 'error'); }
    }));
  });
}
function loadAdminDemandes() {
  const c = $('admin-demandes-list'); if (!c) return;
  if (unsubAdminDemandes) unsubAdminDemandes();
  const q = query(collection(db, 'demandes-fil'), orderBy('createdAt', 'desc'));
  unsubAdminDemandes = onSnapshot(q, snap => {
    if (snap.empty) { c.innerHTML = '<p class="empty-state">Aucune demande ✨</p>'; return; }
    c.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `<span class="card-badge">${data.anonyme ? '🎭 Anonyme' : '👤 ' + escapeHtml(data.authorName || 'Membre')}</span>${data.title ? `<h3>${escapeHtml(data.title)}</h3>` : ''}<p>${escapeHtml(data.message || data.content || '')}</p><span class="card-meta">Fil : ${escapeHtml(data.filId || 'general')}</span><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-primary btn-small" data-action="valider" data-id="${d.id}">✅ Publier</button><button class="btn btn-danger btn-small" data-action="refuser" data-id="${d.id}">❌ Refuser</button></div>`;
      c.appendChild(card);
    });
    c.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id, a = b.dataset.action;
      b.disabled = true; b.textContent = '⏳...';
      try {
        if (a === 'valider') {
          const s = await getDoc(doc(db, 'demandes-fil', id));
          if (s.exists()) {
            const data = s.data();
            await addDoc(collection(db, 'fils', data.filId || 'general', 'posts'), { authorId: data.authorId || 'anonymous', authorName: data.anonyme ? 'Anonyme' : (data.authorName || 'Membre'), title: data.title || '', message: data.message || data.content || '', reactions: {}, isEmbed: false, createdAt: serverTimestamp() });
          }
        }
        await deleteDoc(doc(db, 'demandes-fil', id));
        notify(a === 'valider' ? 'Publié ✅' : 'Refusé', a === 'valider' ? 'success' : 'info');
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    }));
  });
}
async function loadAdminMembres(search) {
  const c = $('admin-membres-list'); if (!c) return;
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    const u = []; snap.forEach(d => { const data = d.data(); if (data.role === 'membre') u.push({ id: d.id, ...data }); });
    const f = search ? u.filter(x => (x.username||'').toLowerCase().includes(search.toLowerCase()) || (x.displayName||'').toLowerCase().includes(search.toLowerCase())) : u;
    if (f.length === 0) { c.innerHTML = '<p class="empty-state">Aucun membre.</p>'; return; }
    c.innerHTML = f.map(x => `<div class="admin-user-card" data-uid="${x.id}"><div class="admin-user-avatar">${x.avatar || '👤'}</div><div class="admin-user-infos"><div class="admin-user-name">${escapeHtml(x.displayName || 'Sans nom')}</div><div class="admin-user-meta">@${escapeHtml(x.username || 'inconnu')}</div></div><span class="admin-role-badge">${x.role || 'membre'}</span></div>`).join('');
  } catch (e) { c.innerHTML = '<p class="empty-state">Impossible de charger.</p>'; }
}
async function loadAdminEcoutants(search) {
  const c = $('admin-ecoutants-list'); if (!c) return;
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    const u = []; snap.forEach(d => { const data = d.data(); if (estEcoutant(data.role)) u.push({ id: d.id, ...data }); });
    const f = search ? u.filter(x => (x.username||'').toLowerCase().includes(search.toLowerCase()) || (x.displayName||'').toLowerCase().includes(search.toLowerCase())) : u;
    if (f.length === 0) { c.innerHTML = '<p class="empty-state">Aucun écoutant.</p>'; return; }
    c.innerHTML = f.map(x => `<div class="admin-user-card" data-uid="${x.id}"><div class="admin-user-avatar">${x.avatar || '🧑‍⚕️'}</div><div class="admin-user-infos"><div class="admin-user-name">${escapeHtml(x.displayName || 'Sans nom')}</div><div class="admin-user-meta">@${escapeHtml(x.username || 'inconnu')}</div></div><span class="admin-role-badge">${x.role || 'ecoutant'}</span></div>`).join('');
  } catch (e) { c.innerHTML = '<p class="empty-state">Impossible de charger.</p>'; }
}
async function loadAdminConvs() {
  const c = $('admin-convs-list'); if (!c) return;
  try {
    const q = query(collection(db, 'conversations'), where('status', 'in', ['waiting','claimed']), limit(100));
    const snap = await getDocs(q);
    const convs = []; snap.forEach(d => convs.push({ id: d.id, ...d.data() }));
    convs.sort((a, b) => (b.urgence || 0) - (a.urgence || 0));
    if (convs.length === 0) { c.innerHTML = '<p class="empty-state">Aucune conversation active ✨</p>'; return; }
    c.innerHTML = convs.map(x => {
      const urg = x.urgence || 0;
      const stars = '🔴'.repeat(urg) + '⚪'.repeat(5 - urg);
      const st = x.status === 'waiting' ? '⏳ En attente' : '💚 ' + (x.claimedByName || 'En cours');
      return `<div class="conv-card ${urg >= 4 ? 'conv-urgent' : ''}"><div class="conv-info"><div class="conv-header-row"><span class="conv-name">${escapeHtml(x.memberName || 'Membre')}</span><span class="conv-urgency">${stars}</span></div><span class="conv-username">@${escapeHtml(x.memberUsername || '')} · ${st}</span>${x.motif ? `<span class="conv-motif">🎯 ${escapeHtml(x.motif)}</span>` : ''}</div></div>`;
    }).join('');
  } catch (e) { c.innerHTML = '<p class="empty-state">Impossible de charger.</p>'; }
}
async function loadAdminSignalements() {
  const c = $('admin-signalements-list'); if (!c) return;
  try {
    const q = query(collection(db, 'signalements'), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    if (snap.empty) { c.innerHTML = '<p class="empty-state">Aucun signalement ✨</p>'; return; }
    c.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `<span class="card-badge" style="background:rgba(255,107,122,0.15);color:var(--error);">🚨 Signalement</span><h3>${escapeHtml(data.memberName || 'Membre')}</h3><p><strong>Raison :</strong> ${escapeHtml(data.raison || '')}</p><span class="card-meta">Signalé par ${escapeHtml(data.ecoutantName || 'Écoutant')}</span>`;
      c.appendChild(card);
    });
  } catch (e) { c.innerHTML = '<p class="empty-state">Impossible de charger.</p>'; }
}
async function loadAdminUsersSearch(search) {
  const c = $('admin-users-results'); if (!c) return;
  if (!search || search.length < 2) { c.innerHTML = '<p class="empty-state">Tape au moins 2 lettres</p>'; return; }
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    const r = []; snap.forEach(d => {
      const data = d.data();
      if ((data.username||'').toLowerCase().includes(search.toLowerCase()) || (data.displayName||'').toLowerCase().includes(search.toLowerCase())) r.push({ id: d.id, ...data });
    });
    if (r.length === 0) { c.innerHTML = '<p class="empty-state">Aucun résultat</p>'; return; }
    c.innerHTML = r.map(x => `<div class="admin-user-card" data-uid="${x.id}" data-name="${escapeHtml(x.displayName || x.username || 'User')}"><div class="admin-user-avatar">${x.avatar || '👤'}</div><div class="admin-user-infos"><div class="admin-user-name">${escapeHtml(x.displayName || 'Sans nom')}</div><div class="admin-user-meta">@${escapeHtml(x.username || 'inconnu')}</div></div><span class="admin-role-badge">${x.role || 'membre'}</span></div>`).join('');
    c.querySelectorAll('.admin-user-card').forEach(card => card.addEventListener('click', () => notify('Chat admin ↔ ' + card.dataset.name + ' — à venir.', 'info')));
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
async function loadDevStats() {
  const c = $('dev-stats');
  if (!c) return;
  c.innerHTML = '<p class="empty-state">Chargement…</p>';

  try {
    const [usersSnap, convsSnap, newsSnap, sigSnap, demandesSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(500))),
      getDocs(query(collection(db, 'conversations'), limit(500))),
      getDocs(query(collection(db, 'news'), limit(500))),
      getDocs(query(collection(db, 'signalements'), limit(500))),
      getDocs(query(collection(db, 'demandes-fil'), limit(500)))
    ]);

    let nbEcoutants = 0;
    usersSnap.forEach(d => { if (estEcoutant(d.data().role)) nbEcoutants++; });

    let convWaiting = 0, convResolved = 0;
    convsSnap.forEach(d => {
      const s = d.data().status;
      if (s === 'waiting') convWaiting++;
      else if (s === 'resolved') convResolved++;
    });

    let sigPending = 0;
    sigSnap.forEach(d => { if (d.data().status === 'pending') sigPending++; });

    let demPending = 0;
    demandesSnap.forEach(d => { if (d.data().status === 'pending') demPending++; });

    c.innerHTML = `
      <div class="dev-stat-card"><div class="dev-stat-icon">👥</div><div class="dev-stat-value">${usersSnap.size}</div><div class="dev-stat-label">Utilisateurs</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">💬</div><div class="dev-stat-value">${convsSnap.size}</div><div class="dev-stat-label">Conversations</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">🧑‍⚕️</div><div class="dev-stat-value">${nbEcoutants}</div><div class="dev-stat-label">Écoutants</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">🔥</div><div class="dev-stat-value">${convWaiting}</div><div class="dev-stat-label">En attente</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">🚨</div><div class="dev-stat-value">${sigPending}</div><div class="dev-stat-label">Signalements</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">📥</div><div class="dev-stat-value">${demPending}</div><div class="dev-stat-label">Demandes</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">📰</div><div class="dev-stat-value">${newsSnap.size}</div><div class="dev-stat-label">News publiées</div></div>
      <div class="dev-stat-card"><div class="dev-stat-icon">✅</div><div class="dev-stat-value">${convResolved}</div><div class="dev-stat-label">Convs résolues</div></div>
    `;
  } catch (e) {
    console.error(e);
    c.innerHTML = '<p class="empty-state">⚠️ Impossible de charger les stats.</p>';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — GESTION DES RÔLES
// ═══════════════════════════════════════════════════════════════════════════
const DEV_ROLES_LIST = [
  { id: 'membre',      label: '👤 Membre' },
  { id: 'ecoutant',    label: '🧑‍⚕️ Écoutant' },
  { id: 'responsable', label: '🎓 Responsable' },
  { id: 'chef_service',label: '🏅 Chef de service' },
  { id: 'moderateur',  label: '🛡️ Modérateur' },
  { id: 'admin',       label: '🔧 Admin' },
  { id: 'dev',         label: '💻 Dev' },
  { id: 'fondateur',   label: '👑 Fondateur' }
];

function peutChangerRoles() {
  const r = currentUserData?.role;
  return r === 'fondateur' || estDev(r);
}

async function loadDevUsers(search) {
  const c = $('dev-users-list');
  if (!c) return;

  if (!peutChangerRoles()) {
    c.innerHTML = '<p class="empty-state">🚫 Accès réservé aux Devs / Fondateurs.</p>';
    return;
  }

  if (!search || search.length < 2) {
    c.innerHTML = '<p class="empty-state">Tape au moins 2 lettres</p>';
    return;
  }

  c.innerHTML = '<p class="empty-state">Recherche…</p>';

  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(300)));
    const s = search.toLowerCase();
    const found = [];
    snap.forEach(d => {
      const data = d.data();
      if ((data.username || '').toLowerCase().includes(s) ||
          (data.displayName || '').toLowerCase().includes(s)) {
        found.push({ id: d.id, ...data });
      }
    });

    if (found.length === 0) {
      c.innerHTML = '<p class="empty-state">Aucun résultat</p>';
      return;
    }

    c.innerHTML = found.map(u => {
      const isMe = u.id === currentUser.uid;
      const options = DEV_ROLES_LIST.map(r =>
        `<option value="${r.id}" ${u.role === r.id ? 'selected' : ''}>${r.label}</option>`
      ).join('');

      return `
        <div class="admin-user-card">
          <div class="admin-user-avatar">${u.avatar || '👤'}</div>
          <div class="admin-user-infos">
            <div class="admin-user-name">${escapeHtml(u.displayName || 'Sans nom')}</div>
            <div class="admin-user-meta">@${escapeHtml(u.username || 'inconnu')}</div>
          </div>
          <div class="dev-user-actions">
            <select class="dev-role-select" data-uid="${u.id}" data-old-role="${u.role || 'membre'}" data-uname="${escapeHtml(u.displayName || u.username || 'utilisateur')}" ${isMe ? 'disabled title="Impossible de modifier ton propre rôle"' : ''}>
              ${options}
            </select>
          </div>
        </div>
      `;
    }).join('');

    c.querySelectorAll('.dev-role-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const uid = sel.dataset.uid;
        const oldRole = sel.dataset.oldRole;
        const newRole = sel.value;
        const uname = sel.dataset.uname;

        if (newRole === oldRole) return;

        const ok = confirm(`Changer le rôle de ${uname} ?\n\n${LABELS_ROLES[oldRole] || oldRole} → ${LABELS_ROLES[newRole] || newRole}`);
        if (!ok) { sel.value = oldRole; return; }

        sel.disabled = true;
        try {
          await updateDoc(doc(db, 'users', uid), {
            role: newRole,
            roleChangedAt: serverTimestamp(),
            roleChangedBy: currentUser.uid,
            roleChangedByName: currentUserData?.displayName || 'Dev'
          });

          await logAction('role',
            `<strong>${escapeHtml(currentUserData?.displayName || 'Dev')}</strong> a changé le rôle de <strong>${escapeHtml(uname)}</strong> : ${LABELS_ROLES[oldRole] || oldRole} → <strong>${LABELS_ROLES[newRole] || newRole}</strong>`,
            { targetUid: uid, oldRole, newRole });

          sel.dataset.oldRole = newRole;
          notify(`Rôle mis à jour : ${LABELS_ROLES[newRole] || newRole}`, 'success');
        } catch (e) {
          sel.value = oldRole;
          notify('Erreur : ' + e.message, 'error');
        } finally {
          sel.disabled = false;
        }
      });
    });

  } catch (e) {
    c.innerHTML = '<p class="empty-state">⚠️ Erreur de recherche.</p>';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — LOGS
// ═══════════════════════════════════════════════════════════════════════════
let unsubDevLogs = null;
let devLogsCache = [];
let devLogsFilter = 'all';

const DEV_LOG_ICONS = {
  role: '👥',
  delete: '🗑️',
  signalement: '🚨',
  conversation: '💬',
  cgu: '📜'
};

async function logAction(type, text, extra = {}) {
  try {
    await addDoc(collection(db, 'logs'), {
      type,
      text,
      ...extra,
      authorId: currentUser?.uid || 'system',
      authorName: currentUserData?.displayName || 'Système',
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Impossible d\'écrire le log :', e);
  }
}

function loadDevLogs() {
  const c = $('dev-logs-list');
  if (!c) return;
  if (unsubDevLogs) { unsubDevLogs(); unsubDevLogs = null; }
  c.innerHTML = '<p class="empty-state">Chargement…</p>';
  const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(200));
  unsubDevLogs = onSnapshot(q, snap => {
    devLogsCache = [];
    snap.forEach(d => devLogsCache.push({ id: d.id, ...d.data() }));
    renderDevLogs();
  }, err => {
    c.innerHTML = '<p class="empty-state">⚠️ Impossible de charger les logs.</p>';
  });
}

function renderDevLogs() {
  const c = $('dev-logs-list');
  if (!c) return;
  const filtered = devLogsFilter === 'all' ? devLogsCache : devLogsCache.filter(l => l.type === devLogsFilter);
  if (filtered.length === 0) {
    c.innerHTML = '<p class="empty-state">Aucun log pour l\'instant.</p>';
    return;
  }
  c.innerHTML = filtered.map(l => {
    const icon = DEV_LOG_ICONS[l.type] || '📝';
    const date = toDate(l.createdAt);
    const ds = date ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    return `
      <div class="dev-log">
        <div class="dev-log-icon">${icon}</div>
        <div class="dev-log-body">
          <div class="dev-log-text">${l.text || ''}</div>
          <div class="dev-log-meta">${escapeHtml(l.authorName || 'Système')} • ${ds}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — BINDING
// ═══════════════════════════════════════════════════════════════════════════
function bindDevTabs() {
  const tabs = document.querySelectorAll('#dev-tabs .mini-tab');
  tabs.forEach(tab => {
    if (tab.dataset.boundDev) return;
    tab.dataset.boundDev = '1';
    tab.addEventListener('click', () => {
      const target = tab.dataset.mini;
      if (target === 'dashboard')    loadDevStats();
      if (target === 'logs')         loadDevLogs();
      if (target === 'signalements') loadDevSignalements();
      if (target === 'outils')       initDevTools();
      if (target === 'roles') {
        const c = $('dev-users-list');
        if (c && !c.querySelector('.admin-user-card')) {
          c.innerHTML = '<p class="empty-state">Tape un pseudo pour commencer</p>';
        }
      }
    });
  });

  const filtersBox = $('dev-log-filters');
  if (filtersBox && !filtersBox.dataset.bound) {
    filtersBox.dataset.bound = '1';
    filtersBox.querySelectorAll('.filter').forEach(f => {
      f.addEventListener('click', () => {
        filtersBox.querySelectorAll('.filter').forEach(x => x.classList.remove('active'));
        f.classList.add('active');
        devLogsFilter = f.dataset.logFilter || 'all';
        renderDevLogs();
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — SIGNALEMENTS
// ═══════════════════════════════════════════════════════════════════════════
async function loadDevSignalements() {
  const c = $('dev-signalements-list');
  if (!c) return;
  c.innerHTML = '<p class="empty-state">Chargement…</p>';
  try {
    const q = query(collection(db, 'signalements'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    if (snap.empty) { c.innerHTML = '<p class="empty-state">Aucun signalement ✨</p>'; return; }
    c.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const date = toDate(data.createdAt);
      const ds = date ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
      const badge = data.status === 'pending'
        ? '<span class="card-badge" style="background:rgba(255,107,122,0.15);color:var(--error);">⏳ En attente</span>'
        : '<span class="card-badge" style="background:rgba(61,220,151,0.15);color:var(--success);">✅ Traité</span>';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        ${badge}
        <h3>${escapeHtml(data.memberName || 'Membre')}</h3>
        <p><strong>Raison :</strong> ${escapeHtml(data.raison || '')}</p>
        <span class="card-meta">Signalé par ${escapeHtml(data.ecoutantName || 'Écoutant')} • ${ds}</span>
        ${data.status === 'pending' ? `
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-primary btn-small" data-sig-action="ok" data-sig-id="${d.id}">✅ Traité</button>
            <button class="btn btn-danger btn-small" data-sig-action="delete" data-sig-id="${d.id}">🗑️ Supprimer</button>
          </div>
        ` : ''}
      `;
      c.appendChild(card);
    });
    c.querySelectorAll('[data-sig-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.sigId;
        const action = btn.dataset.sigAction;
        btn.disabled = true;
        btn.textContent = '⏳...';
        try {
          if (action === 'ok') {
            await updateDoc(doc(db, 'signalements', id), {
              status: 'handled', handledAt: serverTimestamp(),
              handledBy: currentUser.uid, handledByName: currentUserData?.displayName || 'Dev'
            });
            await logAction('signalement', `<strong>${escapeHtml(currentUserData?.displayName || 'Dev')}</strong> a marqué un signalement comme traité`, { signalementId: id });
          } else {
            await deleteDoc(doc(db, 'signalements', id));
            await logAction('signalement', `<strong>${escapeHtml(currentUserData?.displayName || 'Dev')}</strong> a supprimé un signalement`, { signalementId: id });
          }
          notify('Fait ✅', 'success');
          loadDevSignalements();
        } catch (e) {
          notify('Erreur : ' + e.message, 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    c.innerHTML = '<p class="empty-state">⚠️ Impossible de charger les signalements.</p>';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALEMENT — FORMULAIRE
// ═══════════════════════════════════════════════════════════════════════════
const SIGNAL_CATEGORIES = [
  '🚨 Comportement d\'un écoutant',
  '💬 Contenu choquant dans un fil',
  '📢 Spam / publicité',
  '🎭 Faux profil / usurpation',
  '😰 Contenu inquiétant',
  '🔒 Problème de confidentialité',
  '❓ Autre'
];

function openSignalForm() {
  let categorie = '';
  const ov = openModal(`
    <div class="modal" style="max-width:520px;">
      <div class="modal-header">
        <div><div class="modal-title">🚨 Signaler</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Ton signalement sera traité en privé.</div></div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Titre du signalement</label><input type="text" id="sig-titre" maxlength="100" placeholder="Ex : Propos inquiétants dans un fil"></div>
        <div class="field" style="margin-top:14px;"><label>Catégorie</label><div class="signal-cats">${SIGNAL_CATEGORIES.map(c => `<button type="button" class="signal-cat" data-cat="${c}">${c}</button>`).join('')}</div></div>
        <div class="field" style="margin-top:14px;"><label>Description</label><textarea id="sig-desc" maxlength="1000" style="min-height:120px;" placeholder="Explique ce qui s'est passé..."></textarea></div>
        <p class="auth-error" id="sig-error" style="margin-top:10px;"></p>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost modal-close">Annuler</button><button class="btn btn-primary" id="sig-send">📩 Envoyer</button></div>
    </div>
  `);
  ov.querySelectorAll('.signal-cat').forEach(btn => btn.addEventListener('click', () => {
    ov.querySelectorAll('.signal-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); categorie = btn.dataset.cat;
  }));
  ov.querySelector('#sig-send').addEventListener('click', async () => {
    const err = ov.querySelector('#sig-error');
    const titre = ov.querySelector('#sig-titre').value.trim();
    const desc = ov.querySelector('#sig-desc').value.trim();
    err.textContent = '';
    if (!titre) { err.textContent = '⚠️ Ajoute un titre.'; return; }
    if (!categorie) { err.textContent = '⚠️ Choisis une catégorie.'; return; }
    if (!desc) { err.textContent = '⚠️ Ajoute une description.'; return; }
    const btn = ov.querySelector('#sig-send');
    btn.disabled = true; btn.textContent = '⏳ Envoi...';
    try {
      await addDoc(collection(db, 'signalements'), {
        titre, categorie, raison: desc,
        memberId: currentUser.uid,
        memberName: currentUserData?.displayName || 'Utilisateur',
        ecoutantId: currentUser.uid,
        ecoutantName: currentUserData?.displayName || 'Utilisateur',
        status: 'pending', createdAt: serverTimestamp()
      });
      await logAction('signalement', `<strong>${escapeHtml(currentUserData?.displayName || 'Utilisateur')}</strong> a créé un signalement : <strong>${escapeHtml(titre)}</strong>`, { categorie });
      ov.remove(); notify('Signalement envoyé ✅', 'success');
    } catch (e) {
      err.textContent = '❌ ' + e.message;
      btn.disabled = false; btn.textContent = '📩 Envoyer';
    }
  });
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#btn-signaler-membre, #btn-signaler-eco, #btn-signaler-admin');
  if (!btn) return;
  e.preventDefault();
  openSignalForm();
});

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DEV — OUTILS
// ═══════════════════════════════════════════════════════════════════════════
function initDevTools() {
  const ver = $('dev-version-text');
  if (ver) ver.textContent = 'v1.0.0 — Bêta';

  const fb = $('dev-firebase-status');
  if (fb) {
    if (window.iphaxAuth && window.iphaxDb) {
      fb.textContent = '✅ Connecté (' + (window.iphaxAuth.currentUser?.email || 'inconnu') + ')';
    } else {
      fb.textContent = '❌ Non connecté';
    }
  }

  const clearBtn = $('dev-clear-cache');
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', () => {
      if (!confirm('Vider le cache local (thème, préférences) ?')) return;
      try {
        localStorage.removeItem('iphax_theme');
        notify('Cache vidé ✅', 'success');
        setTimeout(() => location.reload(), 800);
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  const reloadBtn = $('dev-reload');
  if (reloadBtn && !reloadBtn.dataset.bound) {
    reloadBtn.dataset.bound = '1';
    reloadBtn.addEventListener('click', () => {
      if (!confirm('Recharger l\'application ?')) return;
      location.reload();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async user => {
  authReady = true;
  if (user) {
    currentUser = user;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        currentUserData = snap.data();
        if (currentUserData.theme) applyTheme(currentUserData.theme);
      }
    } catch (e) {}
  } else {
    currentUser = null;
    currentUserData = null;
    [
      memberChatUnsub, ecoChatUnsub,
      unsubEcoAttente, unsubEcoMes, unsubEcoResolues,
      unsubAdminNews, unsubEcoNews, unsubAdminDemandes,
      unsubFilPosts, unsubFilsList, unsubDemandesPerso,
      unsubDevLogs
    ].forEach(u => {
      if (typeof u === 'function') {
        try { u(); } catch (e) {}
      }
    });
    memberChatUnsub = null;
    ecoChatUnsub = null;
    unsubEcoAttente = null;
    unsubEcoMes = null;
    unsubEcoResolues = null;
    unsubAdminNews = null;
    unsubEcoNews = null;
    unsubAdminDemandes = null;
    unsubFilPosts = null;
    unsubFilsList = null;
    unsubDemandesPerso = null;
    unsubDevLogs = null;
    memberConvId = null;
    ecoConvId = null;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PANEL ÉCOUTANT — RENDU
// ═══════════════════════════════════════════════════════════════════════════
function renderEcoPanel(conv) {
  const body = $('chat-eco-panel-body');
  if (!body) return;

  if (!conv) {
    body.innerHTML = '<p class="empty-state">Aucune conversation.</p>';
    return;
  }

  const dateDebut = toDate(conv.createdAt);
  const dateDebutStr = dateDebut ? dateDebut.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

  const derniereActivite = toDate(conv.lastMessageAt);
  let tempsEcoule = '—';
  if (derniereActivite) {
    const diff = Math.floor((Date.now() - derniereActivite.getTime()) / 1000);
    if (diff < 60) tempsEcoule = 'à l\'instant';
    else if (diff < 3600) tempsEcoule = `il y a ${Math.floor(diff/60)} min`;
    else if (diff < 86400) tempsEcoule = `il y a ${Math.floor(diff/3600)} h`;
    else tempsEcoule = `il y a ${Math.floor(diff/86400)} j`;
  }

  const statusLabel = conv.status === 'waiting' ? '⏳ En attente'
                    : conv.status === 'claimed' ? '💚 En cours'
                    : conv.status === 'resolved' ? '✅ Résolue'
                    : conv.status === 'abandoned' ? '🚪 Abandonnée'
                    : conv.status || '—';

  const typeLabel = conv.type === 'referent' ? '👤 Référent' : '💬 Éphémère';

  body.innerHTML = `
    <!-- Bloc infos conversation -->
    <div class="panel-block panel-infos">
      <div class="panel-block-title">📋 Infos conversation</div>
      <div class="panel-info-row"><span class="panel-info-label">Statut</span><span class="panel-info-value">${statusLabel}</span></div>
      <div class="panel-info-row"><span class="panel-info-label">Type</span><span class="panel-info-value">${typeLabel}</span></div>
      <div class="panel-info-row"><span class="panel-info-label">Début</span><span class="panel-info-value">${dateDebutStr}</span></div>
      <div class="panel-info-row"><span class="panel-info-label">Dernier msg</span><span class="panel-info-value">${tempsEcoule}</span></div>
    </div>

    <!-- Actions rapides -->
    <div class="panel-block panel-actions">
      <button class="panel-btn panel-btn-danger" id="panel-quit">
        <span class="panel-btn-icon">🚪</span>
        <span>Quitter la conversation</span>
      </button>
      <button class="panel-btn" id="panel-transfer">
        <span class="panel-btn-icon">🔄</span>
        <span>Transférer à un écoutant</span>
      </button>
      <button class="panel-btn panel-btn-success" id="panel-resolve">
        <span class="panel-btn-icon">✅</span>
        <span>Marquer résolu</span>
      </button>
    </div>

    <!-- Marqueurs -->
    <div class="panel-block">
      <div class="panel-block-title">🏷️ Marqueurs</div>
      <div class="panel-toggles">
        <button class="panel-toggle ${conv.marked ? 'active' : ''}" id="panel-marked">
          <span>⭐</span> Important
        </button>
        <button class="panel-toggle ${conv.pinned ? 'active' : ''}" id="panel-pinned">
          <span>📌</span> Épingler
        </button>
      </div>
    </div>

    <!-- Urgence perso -->
    <div class="panel-block">
      <div class="panel-block-title">🎯 Urgence perso</div>
      <div class="panel-urgence">
        ${[1,2,3,4,5].map(n => `<button class="panel-urgence-btn ${conv.urgenceEco === n ? 'active' : ''}" data-urg="${n}">${n}</button>`).join('')}
      </div>
      <p class="panel-hint">Ton évaluation personnelle</p>
    </div>

    <!-- Notes internes -->
    <div class="panel-block panel-notes">
      <div class="panel-block-title">📝 Notes internes</div>
      <textarea id="panel-notes-textarea" placeholder="Note ce que tu veux ici (visible par toi uniquement)…">${escapeHtml(conv.notesInternes || '')}</textarea>
      <button class="panel-btn panel-btn-primary" id="panel-notes-save">💾 Enregistrer les notes</button>
    </div>

    <!-- Signaler -->
    <div class="panel-block">
      <button class="panel-btn panel-btn-danger" id="panel-signaler">
        <span class="panel-btn-icon">🚨</span>
        <span>Signaler</span>
      </button>
    </div>
  `;
  bindEcoPanelEvents(conv);
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL ÉCOUTANT — BINDING DES ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════
function bindEcoPanelEvents(conv) {
  if (!conv) return;
  const ref = doc(db, 'conversations', conv.id);

  // ─── ⭐ Important (toggle) ───
  const btnMarked = $('panel-marked');
  if (btnMarked) {
    btnMarked.addEventListener('click', async () => {
      const newVal = !conv.marked;
      try {
        await updateDoc(ref, { marked: newVal });
        conv.marked = newVal;
        btnMarked.classList.toggle('active', newVal);
        const c = ecoMesCache.find(x => x.id === conv.id);
        if (c) c.marked = newVal;
        renderMesConvs();
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  // ─── 📌 Épingler (toggle) ───
  const btnPinned = $('panel-pinned');
  if (btnPinned) {
    btnPinned.addEventListener('click', async () => {
      const newVal = !conv.pinned;
      try {
        await updateDoc(ref, { pinned: newVal });
        conv.pinned = newVal;
        btnPinned.classList.toggle('active', newVal);
        const c = ecoMesCache.find(x => x.id === conv.id);
        if (c) c.pinned = newVal;
        renderMesConvs();
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  // ─── 🎯 Urgence perso (1-5) ───
  document.querySelectorAll('.panel-urgence-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = parseInt(btn.dataset.urg, 10);
      const newVal = (conv.urgenceEco === v) ? null : v;
      try {
        await updateDoc(ref, { urgenceEco: newVal });
        conv.urgenceEco = newVal;
        document.querySelectorAll('.panel-urgence-btn').forEach(b => {
          b.classList.toggle('active', parseInt(b.dataset.urg, 10) === newVal);
        });
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  });

  // ─── 📝 Enregistrer notes ───
  const btnNotesSave = $('panel-notes-save');
  if (btnNotesSave) {
    btnNotesSave.addEventListener('click', async () => {
      const ta = $('panel-notes-textarea');
      if (!ta) return;
      const t = ta.value.trim();
      try {
        await updateDoc(ref, { notesInternes: t || null });
        conv.notesInternes = t || null;
        notify('Notes enregistrées ✅', 'success');
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  // ─── ✅ Marquer résolu ───
  const btnResolve = $('panel-resolve');
  if (btnResolve) {
    btnResolve.addEventListener('click', async () => {
      if (!confirm('Marquer cette conversation comme résolue ?')) return;
      try {
        await updateDoc(ref, { status: 'resolved', resolvedAt: serverTimestamp() });
        await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a marqué une conversation comme résolue`);
        notify('Conversation résolue ✅', 'success');
        if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
        ecoConvId = null;
        openPage('app-ecoutant', 'conversations');
        setActiveNav('app-ecoutant', 'conversations');
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  // ─── 🚪 Quitter ───
  const btnQuit = $('panel-quit');
  if (btnQuit) {
    btnQuit.addEventListener('click', async () => {
      if (!confirm('Quitter cette conversation ? Elle repassera en attente pour un autre écoutant.')) return;
      try {
        await updateDoc(ref, {
          status: 'waiting',
          claimedBy: null,
          claimedByName: null,
          claimedAt: null
        });
        await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a quitté une conversation`);
        notify('Conversation remise en attente ✅', 'success');
        if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
        ecoConvId = null;
        openPage('app-ecoutant', 'conversations');
        setActiveNav('app-ecoutant', 'conversations');
      } catch (e) { notify('Erreur : ' + e.message, 'error'); }
    });
  }

  // ─── 🚨 Signaler ───
  const btnSig = $('panel-signaler');
  if (btnSig) {
    btnSig.addEventListener('click', () => openSignalerModal(conv));
  }

  // ─── 🔄 Transférer ───
  const btnTr = $('panel-transfer');
  if (btnTr) {
    btnTr.addEventListener('click', () => openTransferModal(conv));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL ÉCOUTANT — TRANSFERT
// ═══════════════════════════════════════════════════════════════════════════
async function openTransferModal(conv) {
  let ecoutants = [];
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    snap.forEach(d => {
      const u = d.data();
      if (estEcoutant(u.role) && d.id !== currentUser.uid) {
        ecoutants.push({ id: d.id, ...u });
      }
    });
  } catch (e) {
    notify('Impossible de charger les écoutants.', 'error');
    return;
  }

  if (ecoutants.length === 0) {
    notify('Aucun autre écoutant disponible.', 'warning');
    return;
  }

  let selectedId = null;

  const ov = openModal(`
    <div class="modal" style="max-width:520px;">
      <div class="modal-header">
        <div><div class="modal-title">🔄 Transférer la conversation</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Choisis l'écoutant qui reprendra.</div></div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Écoutant</label>
          <div class="transfer-list">
            ${ecoutants.map(e => `<button type="button" class="transfer-item" data-uid="${e.id}"><span class="transfer-avatar">${e.avatar || '🧑‍⚕️'}</span><span class="transfer-name">${escapeHtml(e.displayName || 'Écoutant')}<br><small>@${escapeHtml(e.username || '')}</small></span></button>`).join('')}
          </div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Note pour l'autre écoutant (facultatif)</label>
          <textarea id="transfer-note" maxlength="300" style="min-height:80px;" placeholder="Ex : je dois partir, je te laisse la suite…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-close">Annuler</button>
        <button class="btn btn-primary" id="transfer-confirm" disabled>🔄 Transférer</button>
      </div>
    </div>
  `);

  ov.querySelectorAll('.transfer-item').forEach(item => {
    item.addEventListener('click', () => {
      ov.querySelectorAll('.transfer-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      selectedId = item.dataset.uid;
      ov.querySelector('#transfer-confirm').disabled = false;
    });
  });

  ov.querySelector('#transfer-confirm').addEventListener('click', async () => {
    if (!selectedId) return;
    const newEco = ecoutants.find(e => e.id === selectedId);
    const note = ov.querySelector('#transfer-note').value.trim();
    const btn = ov.querySelector('#transfer-confirm');
    btn.disabled = true;
    btn.textContent = '⏳ Transfert…';
    try {
      await updateDoc(doc(db, 'conversations', conv.id), {
        claimedBy: newEco.id,
        claimedByName: newEco.displayName || 'Écoutant',
        claimedAt: serverTimestamp(),
        transferNote: note || null,
        transferredFrom: currentUser.uid,
        transferredFromName: currentUserData?.displayName || 'Écoutant',
        transferredAt: serverTimestamp()
      });
      await logAction('conversation', `<strong>${escapeHtml(currentUserData?.displayName || 'Écoutant')}</strong> a transféré une conversation à <strong>${escapeHtml(newEco.displayName || 'Écoutant')}</strong>`);
      ov.remove();
      notify(`Transférée à ${newEco.displayName || 'Écoutant'} ✅`, 'success');
      if (ecoChatUnsub) { ecoChatUnsub(); ecoChatUnsub = null; }
      ecoConvId = null;
      openPage('app-ecoutant', 'conversations');
      setActiveNav('app-ecoutant', 'conversations');
    } catch (e) {
      notify('Erreur : ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = '🔄 Transférer';
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT GLOBAL
// ═══════════════════════════════════════════════════════════════════════════
setupFilsButtons();
console.log('✅ main.js chargé et prêt');