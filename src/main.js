// ═══════════════════════════════════════════════════════════
// IPHAX — Logique principale
// ═══════════════════════════════════════════════════════════

console.log('🚀 main.js démarré');

const auth = window.iphaxAuth;
const db = window.iphaxDb;
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
  signOut
} = window.fbAuthFns;
const {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp,
  collection, addDoc,
  query, orderBy, limit,
  onSnapshot, getDocs
} = window.fbDbFns;

let currentUser = null;
let currentUserData = null;
let authReady = false;
let currentChatType = null;
let chatUnsubscribe = null;

// ═══════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (!el) { console.error('❌ Écran introuvable :', id); return; }
  el.classList.add('active');
}

// ═══════════════════════════════════════════════════════════
document.getElementById('btn-continuer').addEventListener('click', async () => {
  let waited = 0;
  while (!authReady && waited < 2000) {
    await new Promise(r => setTimeout(r, 50));
    waited += 50;
  }
  if (currentUser && currentUserData) {
    routeUser(currentUserData);
  } else if (currentUser) {
    showScreen('screen-cgu');
  } else {
    showScreen('screen-auth');
  }
});

// ═══════════════════════════════════════════════════════════
function routeUser(data) {
  const profilNom = document.getElementById('profil-nom');
  const profilUsername = document.getElementById('profil-username');
  if (profilNom) profilNom.textContent = data.displayName || 'Utilisateur';
  if (profilUsername) profilUsername.textContent = '@' + (data.username || 'inconnu');

  const profilEcoNom = document.getElementById('profil-eco-nom');
  const profilEcoUsername = document.getElementById('profil-eco-username');
  if (profilEcoNom) profilEcoNom.textContent = data.displayName || 'Utilisateur';
  if (profilEcoUsername) profilEcoUsername.textContent = '@' + (data.username || 'inconnu');

  if (!data.cguAccepted) {
    showScreen('screen-cgu');
    return;
  }

  const role = data.role || 'membre';
  if (role === 'ecoutant' || role === 'responsable' || role === 'chef_service') {
    showScreen('app-ecoutant');
  } else {
    showScreen('app-membre');
  }
}

// ═══════════════════════════════════════════════════════════
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
    if (target === 'login') {
      formLogin.classList.add('active');
      formSignup.classList.remove('active');
    } else {
      formSignup.classList.add('active');
      formLogin.classList.remove('active');
    }
  });
});

// ═══════════════════════════════════════════════════════════
const roleBubbles = document.querySelectorAll('.role-bubble');
const authSubtitle = document.getElementById('auth-subtitle');
const authTitle = document.getElementById('auth-title');

const roleMessages = {
  membre: "Ici, quelqu'un t'écoute 💙",
  admin: 'Espace administration 🔧',
  ecoutant: 'Espace écoutant·e — Merci 💚',
  dev: 'Espace développeur 💻',
  fondateur: 'Accès fondateur 👑'
};
const roleTitles = {
  membre: 'Bienvenue sur Iphax',
  admin: 'Connexion administration',
  ecoutant: 'Connexion écoutant·e',
  dev: 'Connexion développeur',
  fondateur: 'Connexion fondateur'
};

roleBubbles.forEach(bubble => {
  bubble.addEventListener('click', () => {
    const role = bubble.dataset.role;
    roleBubbles.forEach(b => b.classList.remove('active'));
    bubble.classList.add('active');

    if (authSubtitle) authSubtitle.textContent = roleMessages[role] || roleMessages.membre;
    if (authTitle) authTitle.textContent = roleTitles[role] || roleTitles.membre;

    if (role === 'membre') {
      tabsContainer.style.display = 'flex';
    } else {
      tabsContainer.style.display = 'none';
      formLogin.classList.add('active');
      formSignup.classList.remove('active');
    }
    window.currentRole = role;
  });
});
window.currentRole = 'membre';

// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.toggle-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.style.color = isPassword ? 'var(--cyan)' : 'var(--text-muted)';
  });
});

// ═══════════════════════════════════════════════════════════
function showError(elId, message) {
  const el = document.getElementById(elId);
  if (el) el.textContent = message;
}
function clearError(elId) {
  const el = document.getElementById(elId);
  if (el) el.textContent = '';
}

function traductError(code, rawMessage) {
  console.error('🔍 Code Firebase :', code, '| Message :', rawMessage);
  const errors = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop faible (min. 8 caractères).',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
    'auth/network-request-failed': 'Problème de connexion.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
    'auth/operation-not-allowed': 'Méthode non activée.',
    'permission-denied': 'Règles Firestore bloquent l\'écriture.'
  };
  return errors[code] || `Erreur : ${code || rawMessage || 'inconnue'}`;
}

function calculerAge(dateNaissance) {
  const auj = new Date();
  const naiss = new Date(dateNaissance);
  let age = auj.getFullYear() - naiss.getFullYear();
  const m = auj.getMonth() - naiss.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < naiss.getDate())) age--;
  return age;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
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
    showError('signup-error', '❌ 1 lettre + 1 chiffre minimum.'); return;
  }
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,23}$/.test(username)) {
    showError('signup-error', '❌ Nom d\'utilisateur invalide.'); return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    await updateProfile(user, { displayName: username });

    const userData = {
      uid: user.uid, email: user.email, username, displayName,
      birthdate, age, role: 'membre', cguAccepted: false,
      createdAt: serverTimestamp(),
      lastUsernameChange: null, lastDisplayNameChange: null
    };

    await setDoc(doc(db, 'users', user.uid), userData);
    currentUser = user;
    currentUserData = userData;
    console.log('✅ Inscription réussie');
    showScreen('screen-cgu');
  } catch (error) {
    console.error('❌', error);
    showError('signup-error', '❌ ' + traductError(error.code, error.message));
  }
});

// ═══════════════════════════════════════════════════════════
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    console.log('✅ Connexion réussie');
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      currentUser = user;
      currentUserData = snap.data();
      routeUser(currentUserData);
    } else {
      showScreen('screen-cgu');
    }
  } catch (error) {
    console.error('❌', error);
    showError('login-error', '❌ ' + traductError(error.code, error.message));
  }
});

// ═══════════════════════════════════════════════════════════
const btnGoogle = document.getElementById('btn-google');
const googleProvider = new GoogleAuthProvider();

btnGoogle.addEventListener('click', async () => {
  clearError('login-error');
  clearError('signup-error');
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
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
    } else {
      data = snap.data();
    }

    currentUser = user;
    currentUserData = data;
    console.log('✅ Connexion Google réussie');
    routeUser(data);
  } catch (error) {
    console.error('❌', error);
    showError('login-error', '❌ ' + traductError(error.code, error.message));
  }
});

// ═══════════════════════════════════════════════════════════
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

if (cguCheckbox) {
  cguCheckbox.addEventListener('change', () => {
    btnAcceptCgu.disabled = !cguCheckbox.checked;
  });
}

if (btnRefuseCgu) {
  btnRefuseCgu.addEventListener('click', () => {
    signOut(auth).then(() => {
      currentUser = null;
      currentUserData = null;
      showScreen('screen-intro');
    });
    if (cguCheckbox) {
      cguCheckbox.checked = false;
      cguCheckbox.disabled = true;
      cguCheckLabel.classList.add('disabled');
      btnAcceptCgu.disabled = true;
      cguUnlocked = false;
    }
  });
}

if (btnAcceptCgu) {
  btnAcceptCgu.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        cguAccepted: true,
        cguAcceptedAt: serverTimestamp(),
        cguVersion: '1.0'
      });
      currentUserData.cguAccepted = true;
      console.log('✅ CGU acceptées');
      routeUser(currentUserData);
    } catch (error) {
      console.error('❌ CGU :', error);
      alert('❌ ERREUR CGU :\n' + (error.code || '?') + '\n\n' + (error.message || error));
    }
  });
}

// ═══════════════════════════════════════════════════════════
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
    });
  });
}
setupAppNavigation('app-membre');
setupAppNavigation('app-ecoutant');

function openPage(appId, pageName) {
  const app = document.getElementById(appId);
  if (!app) return;
  const pages = app.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));
  const page = app.querySelector(`.page[data-page="${pageName}"]`);
  if (page) page.classList.add('active');
  const content = app.querySelector('.app-content');
  if (content) content.scrollTop = 0;
}

// ═══════════════════════════════════════════════════════════
['btn-back-perso', 'btn-back-perso-journal', 'btn-back-perso-objectifs', 'btn-back-perso-rappels'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => {
      openPage('app-membre', 'perso');
      const app = document.getElementById('app-membre');
      app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const persoTab = app.querySelector('.nav-item[data-page="perso"]');
      if (persoTab) persoTab.classList.add('active');
    });
  }
});

const btnBackChat = document.getElementById('btn-back-chat');
if (btnBackChat) {
  btnBackChat.addEventListener('click', () => {
    if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
    openPage('app-membre', 'ecouter');
    const app = document.getElementById('app-membre');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const ecouterTab = app.querySelector('.nav-item[data-page="ecouter"]');
    if (ecouterTab) ecouterTab.classList.add('active');
  });
}

const btnBackFil = document.getElementById('btn-back-fil');
if (btnBackFil) {
  btnBackFil.addEventListener('click', () => {
    openPage('app-membre', 'public');
    const app = document.getElementById('app-membre');
    app.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const publicTab = app.querySelector('.nav-item[data-page="public"]');
    if (publicTab) publicTab.classList.add('active');
  });
}

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

// ═══════════════════════════════════════════════════════════
const MOOD_ELEMENTS = [
  { id: 'humeur',      label: '😊 Humeur' },
  { id: 'sommeil',     label: '😴 Sommeil' },
  { id: 'energie',     label: '⚡ Énergie' },
  { id: 'anxiete',     label: '😰 Anxiété' },
  { id: 'appetit',     label: '🍽️ Appétit' },
  { id: 'sociabilite', label: '👥 Sociabilité' },
  { id: 'depression',  label: '🌧️ Dépression' }
];

const MOOD_COLORS = [
  { name: 'Excellent',  hex: '#0F2551' },
  { name: 'Très bien',  hex: '#1B7A4D' },
  { name: 'Bien',       hex: '#A8E6CF' },
  { name: 'Moyen',      hex: '#FFD93D' },
  { name: 'Bof',        hex: '#FF9F45' },
  { name: 'Mal',        hex: '#E04A5A' },
  { name: 'Très mal',   hex: '#7A1525' }
];

let moodCurrentMonth = new Date();
let moodData = {};

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function formatMonthTitle(date) {
  const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${mois[date.getMonth()]} ${date.getFullYear()}`;
}

function renderMoodLegend() {
  const legend = document.getElementById('mood-legend');
  if (!legend) return;
  legend.innerHTML = MOOD_COLORS.map(c => `
    <div class="mood-legend-item">
      <span class="mood-legend-dot" style="background:${c.hex}"></span>
      <span>${c.name}</span>
    </div>
  `).join('');
}

function renderMoodTable() {
  const table = document.getElementById('mood-table');
  const title = document.getElementById('mood-month-title');
  if (!table || !title) return;

  title.textContent = formatMonthTitle(moodCurrentMonth);

  const days = getDaysInMonth(moodCurrentMonth);
  const today = new Date();
  const isCurrentMonth = (
    today.getFullYear() === moodCurrentMonth.getFullYear() &&
    today.getMonth() === moodCurrentMonth.getMonth()
  );

  let thead = '<thead><tr><th>Élément</th>';
  for (let d = 1; d <= days; d++) {
    const date = new Date(moodCurrentMonth.getFullYear(), moodCurrentMonth.getMonth(), d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = isCurrentMonth && today.getDate() === d;
    const classes = [isWeekend ? 'weekend' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    thead += `<th class="${classes}">${d}</th>`;
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  MOOD_ELEMENTS.forEach(el => {
    tbody += `<tr><th>${el.label}</th>`;
    for (let d = 1; d <= days; d++) {
      const date = new Date(moodCurrentMonth.getFullYear(), moodCurrentMonth.getMonth(), d);
      const isToday = isCurrentMonth && today.getDate() === d;
      const colorIdx = moodData[d] && moodData[d][el.id] != null ? moodData[d][el.id] : -1;
      const bgColor = colorIdx >= 0 ? MOOD_COLORS[colorIdx].hex : 'transparent';
      const cls = ['mood-cell', colorIdx >= 0 ? 'has-color' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
      tbody += `<td class="${cls}" data-day="${d}" data-el="${el.id}" style="background:${bgColor}"></td>`;
    }
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;

  table.querySelectorAll('.mood-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      openMoodPicker(parseInt(cell.dataset.day, 10), cell.dataset.el);
    });
  });
}

async function loadMoodData() {
  if (!currentUser) return;
  const monthKey = getMonthKey(moodCurrentMonth);
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'moods', monthKey));
    moodData = snap.exists() ? (snap.data().cells || {}) : {};
  } catch (e) {
    console.warn('Erreur chargement moods :', e);
    moodData = {};
  }
}

async function saveMoodData() {
  if (!currentUser) return;
  const monthKey = getMonthKey(moodCurrentMonth);
  try {
    await setDoc(
      doc(db, 'users', currentUser.uid, 'moods', monthKey),
      { cells: moodData, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.error('Erreur save moods :', e);
    alert('❌ ERREUR MOOD :\n' + (e.code || '?') + '\n\n' + (e.message || e));
  }
}

async function changeMonth(delta) {
  moodCurrentMonth.setMonth(moodCurrentMonth.getMonth() + delta);
  await loadMoodData();
  renderMoodTable();
}

async function initMoodTracker() {
  renderMoodLegend();
  await loadMoodData();
  renderMoodTable();
}

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
        ${MOOD_COLORS.map((c, i) => `
          <button class="mood-color-btn ${i === currentColor ? 'selected' : ''}"
                  data-idx="${i}" style="background:${c.hex}" title="${c.name}"></button>
        `).join('')}
      </div>
      <div class="mood-picker-actions">
        <button class="mood-btn-clear">Effacer</button>
        <button class="mood-btn-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.mood-color-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (!moodData[day]) moodData[day] = {};
      moodData[day][elementId] = idx;
      overlay.remove();
      renderMoodTable();
      await saveMoodData();
    });
  });

  overlay.querySelector('.mood-btn-clear').addEventListener('click', async () => {
    if (moodData[day]) {
      delete moodData[day][elementId];
      if (Object.keys(moodData[day]).length === 0) delete moodData[day];
    }
    overlay.remove();
    renderMoodTable();
    await saveMoodData();
  });

  overlay.querySelector('.mood-btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const btnMoodPrev = document.getElementById('mood-prev');
const btnMoodNext = document.getElementById('mood-next');
if (btnMoodPrev) btnMoodPrev.addEventListener('click', () => changeMonth(-1));
if (btnMoodNext) btnMoodNext.addEventListener('click', () => changeMonth(+1));

// ═══════════════════════════════════════════════════════════
let journalCache = [];

async function loadJournal() {
  const list = document.getElementById('journal-list');
  const empty = document.getElementById('journal-empty');
  if (!list || !currentUser) return;

  try {
    const colRef = collection(db, 'users', currentUser.uid, 'journal');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);

    journalCache = [];
    snap.forEach(docSnap => {
      journalCache.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (journalCache.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucune note pour l\'instant. Écris ta première 💙</p>';
      return;
    }

    list.innerHTML = journalCache.map(entry => {
      const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date();
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      const preview = (entry.content || '').substring(0, 180);
      const moodEmoji = entry.moodEmoji || '';
      const shared = entry.shared ? 'shared' : 'private';
      const sharedLabel = entry.shared ? '🔓 Partagé' : '🔒 Privé';

      return `
        <div class="journal-entry" data-id="${entry.id}">
          <div class="journal-entry-header">
            <span class="journal-entry-date">${dateStr}</span>
            <span class="journal-entry-mood">${moodEmoji}</span>
          </div>
          <div class="journal-entry-title">${escapeHtml(entry.title || 'Sans titre')}</div>
          <div class="journal-entry-preview">${escapeHtml(preview)}${preview.length >= 180 ? '…' : ''}</div>
          <span class="journal-entry-badge ${shared}">${sharedLabel}</span>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.journal-entry').forEach(el => {
      el.addEventListener('click', () => openJournalEntry(el.dataset.id));
    });
  } catch (e) {
    console.error('Erreur chargement journal :', e);
    list.innerHTML = '<p class="empty-state">Erreur : ' + (e.code || e.message) + '</p>';
  }
}

function openJournalEntry(id) {
  const entry = journalCache.find(e => e.id === id);
  if (!entry) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date();
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#journal-close-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#journal-delete-btn').addEventListener('click', async () => {
    if (!confirm('Supprimer cette note ? Cette action est irréversible.')) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'journal', id));
      overlay.remove();
      await loadJournal();
    } catch (e) {
      console.error('Erreur suppression :', e);
      alert('❌ ERREUR SUPPRESSION :\n' + (e.code || '?') + '\n\n' + (e.message || e));
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const btnNewJournal = document.getElementById('btn-new-journal');
if (btnNewJournal) {
  btnNewJournal.addEventListener('click', () => openJournalForm());
}

function openJournalForm() {
  let selectedPrivacy = 'private';
  let selectedMood = '';
  const MOOD_EMOJIS = ['😢', '😔', '😐', '🙂', '😄', '😰', '😡', '😴', '🥰', '🤔'];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📔 Nouvelle note</div>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Confidentialité</label>
          <div class="journal-privacy-choice">
            <button type="button" class="journal-privacy-option active" data-privacy="private">
              <span class="privacy-icon">🔒</span>
              <span class="privacy-label">Privé</span>
            </button>
            <button type="button" class="journal-privacy-option" data-privacy="shared">
              <span class="privacy-icon">🔓</span>
              <span class="privacy-label">Partagé avec mes écoutants</span>
            </button>
          </div>
        </div>
        <div class="field">
          <label>Humeur du moment (facultatif)</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${MOOD_EMOJIS.map(e => `<button type="button" class="mood-emoji-btn" data-emoji="${e}" style="width:40px;height:40px;border-radius:10px;background:rgba(10,26,61,0.6);border:1.5px solid var(--border);font-size:22px;cursor:pointer;transition:all 0.2s;">${e}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>Titre</label>
          <input type="text" id="journal-title" placeholder="Un titre court..." maxlength="80">
        </div>
        <div class="field">
          <label>Ton ressenti</label>
          <textarea id="journal-content" placeholder="Écris librement..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="journal-cancel">Annuler</button>
        <button class="btn btn-primary" id="journal-save">💾 Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.journal-privacy-option').forEach(opt => {
    opt.addEventListener('click', () => {
      overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedPrivacy = opt.dataset.privacy;
    });
  });

  overlay.querySelectorAll('.mood-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.mood-emoji-btn').forEach(b => b.style.borderColor = 'var(--border)');
      if (selectedMood === btn.dataset.emoji) {
        selectedMood = '';
        btn.style.borderColor = 'var(--border)';
      } else {
        selectedMood = btn.dataset.emoji;
        btn.style.borderColor = 'var(--cyan)';
      }
    });
  });

  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#journal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#journal-save').addEventListener('click', async () => {
    const title = overlay.querySelector('#journal-title').value.trim();
    const content = overlay.querySelector('#journal-content').value.trim();
    if (!content) { alert('Écris quelque chose 💙'); return; }

    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'journal'), {
        title: title || 'Sans titre',
        content,
        shared: selectedPrivacy === 'shared',
        moodEmoji: selectedMood,
        createdAt: serverTimestamp()
      });
      overlay.remove();
      await loadJournal();
      console.log('✅ Note enregistrée');
    } catch (e) {
      console.error('Erreur save note :', e);
      alert('❌ ERREUR JOURNAL :\n' + (e.code || '?') + '\n\n' + (e.message || e));
    }
  });
}

// ═══════════════════════════════════════════════════════════
let objectifsCache = [];

async function loadObjectifs() {
  const list = document.getElementById('objectifs-list');
  if (!list || !currentUser) return;

  try {
    const colRef = collection(db, 'users', currentUser.uid, 'objectifs');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);

    objectifsCache = [];
    snap.forEach(d => objectifsCache.push({ id: d.id, ...d.data() }));

    if (objectifsCache.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucun objectif pour l\'instant.</p>';
      return;
    }

    list.innerHTML = objectifsCache.map(o => `
      <div class="objectif-item ${o.done ? 'done' : ''}" data-id="${o.id}">
        <button class="objectif-check" data-id="${o.id}"></button>
        <span class="objectif-text">${escapeHtml(o.text)}</span>
        <button class="objectif-delete" data-id="${o.id}">🗑️</button>
      </div>
    `).join('');

    list.querySelectorAll('.objectif-check').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const item = objectifsCache.find(o => o.id === id);
        if (!item) return;
        try {
          await updateDoc(doc(db, 'users', currentUser.uid, 'objectifs', id), { done: !item.done });
          await loadObjectifs();
        } catch (e) { console.error(e); alert('❌ ' + (e.code || e.message)); }
      });
    });

    list.querySelectorAll('.objectif-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Supprimer cet objectif ?')) return;
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'objectifs', btn.dataset.id));
          await loadObjectifs();
        } catch (e) { console.error(e); alert('❌ ' + (e.code || e.message)); }
      });
    });
  } catch (e) {
    console.error('Erreur objectifs :', e);
    list.innerHTML = '<p class="empty-state">Erreur : ' + (e.code || e.message) + '</p>';
  }
}

const btnNewObjectif = document.getElementById('btn-new-objectif');
if (btnNewObjectif) {
  btnNewObjectif.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">🎯 Nouvel objectif</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Mon objectif</label>
            <input type="text" id="objectif-text" placeholder="Ex: Boire plus d'eau..." maxlength="120">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="obj-cancel">Annuler</button>
          <button class="btn btn-primary" id="obj-save">Ajouter</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#obj-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#obj-save').addEventListener('click', async () => {
      const text = overlay.querySelector('#objectif-text').value.trim();
      if (!text) { alert('Écris ton objectif !'); return; }
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'objectifs'), {
          text, done: false, createdAt: serverTimestamp()
        });
        overlay.remove();
        await loadObjectifs();
      } catch (e) { console.error(e); alert('❌ ' + (e.code || e.message)); }
    });
  });
}

// ═══════════════════════════════════════════════════════════
let rappelsCache = [];

async function loadRappels() {
  const list = document.getElementById('rappels-list');
  if (!list || !currentUser) return;

  try {
    const colRef = collection(db, 'users', currentUser.uid, 'rappels');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);

    rappelsCache = [];
    snap.forEach(d => rappelsCache.push({ id: d.id, ...d.data() }));

    if (rappelsCache.length === 0) {
      list.innerHTML = '<p class="empty-state">Aucun rappel pour l\'instant.</p>';
      return;
    }

    list.innerHTML = rappelsCache.map(r => `
      <div class="rappel-item">
        <div class="rappel-text">« ${escapeHtml(r.text)} »</div>
        <button class="rappel-delete" data-id="${r.id}">🗑️</button>
      </div>
    `).join('');

    list.querySelectorAll('.rappel-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer ce rappel ?')) return;
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'rappels', btn.dataset.id));
          await loadRappels();
        } catch (e) { console.error(e); alert('❌ ' + (e.code || e.message)); }
      });
    });
  } catch (e) {
    console.error('Erreur rappels :', e);
    list.innerHTML = '<p class="empty-state">Erreur : ' + (e.code || e.message) + '</p>';
  }
}

const btnNewRappel = document.getElementById('btn-new-rappel');
if (btnNewRappel) {
  btnNewRappel.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">💡 Nouveau rappel positif</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Ta phrase bienveillante</label>
            <input type="text" id="rappel-text" placeholder="Ex: Je mérite d'être heureux·se..." maxlength="200">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="rap-cancel">Annuler</button>
          <button class="btn btn-primary" id="rap-save">Ajouter</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#rap-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#rap-save').addEventListener('click', async () => {
      const text = overlay.querySelector('#rappel-text').value.trim();
      if (!text) { alert('Écris ton rappel !'); return; }
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'rappels'), {
          text, createdAt: serverTimestamp()
        });
        overlay.remove();
        await loadRappels();
      } catch (e) { console.error(e); alert('❌ ' + (e.code || e.message)); }
    });
  });
}

// ═══════════════════════════════════════════════════════════
function openChat(type) {
  currentChatType = type;
  openPage('app-membre', 'chat');

  const chatTitle = document.getElementById('chat-title');
  const chatSubtitle = document.getElementById('chat-subtitle');

  if (type === 'mon-ecoutant') {
    if (chatTitle) chatTitle.textContent = '👤 Mon écoutant';
    if (chatSubtitle) chatSubtitle.textContent = 'Écoutant référent permanent';
  } else {
    if (chatTitle) chatTitle.textContent = '💬 Parler maintenant';
    if (chatSubtitle) chatSubtitle.textContent = 'Écoutant disponible';
  }

  startChatListener(type);
}

function startChatListener(type) {
  if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
  if (!currentUser) return;

  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = '<p class="empty-state">Chargement...</p>';

  const chatId = `${currentUser.uid}_${type}`;
  const colRef = collection(db, 'chats', chatId, 'messages');
  const q = query(colRef, orderBy('createdAt', 'asc'), limit(200));

  chatUnsubscribe = onSnapshot(q, (snap) => {
    if (snap.empty) {
      messagesEl.innerHTML = '<p class="empty-state">Aucun message pour l\'instant. Dis bonjour 💙</p>';
      return;
    }

    messagesEl.innerHTML = '';
    snap.forEach(docSnap => {
      const msg = docSnap.data();
      const isMe = msg.senderId === currentUser.uid;
      const time = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isMe ? 'me' : 'them');
      div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${time}</span>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, (err) => {
    console.error('Erreur chat listener :', err);
    messagesEl.innerHTML = '<p class="empty-state">Erreur : ' + (err.code || err.message) + '</p>';
  });
}

const chatForm = document.getElementById('chat-form');
if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentUser || !currentChatType) return;

    input.value = '';

    try {
      const chatId = `${currentUser.uid}_${currentChatType}`;
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text,
        senderId: currentUser.uid,
        senderName: currentUserData?.displayName || 'Utilisateur',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('❌ Erreur envoi message :', err);
      alert('❌ ERREUR ENVOI :\n\n' +
            'Code : ' + (err.code || '?') + '\n\n' +
            'Message : ' + (err.message || err) + '\n\n' +
            'Chat ID : ' + currentUser.uid + '_' + currentChatType);
    }
  });
}

const btnParlerMaintenant = document.getElementById('btn-parler-maintenant');
if (btnParlerMaintenant) {
  btnParlerMaintenant.addEventListener('click', () => openChat('parler-maintenant'));
}

const btnMonEcoutant = document.getElementById('btn-mon-ecoutant');
if (btnMonEcoutant) {
  btnMonEcoutant.addEventListener('click', () => openChat('mon-ecoutant'));
}

// ═══════════════════════════════════════════════════════════
const btnFilGeneral = document.getElementById('btn-fil-general');
if (btnFilGeneral) {
  btnFilGeneral.addEventListener('click', async () => {
    openPage('app-membre', 'fil-general');
    await loadFilGeneral();
  });
}

async function loadFilGeneral() {
  const feed = document.getElementById('fil-general-feed');
  if (!feed) return;

  try {
    const colRef = collection(db, 'fil-general');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);

    if (snap.empty) {
      feed.innerHTML = '<p class="empty-state">Aucun post pour l\'instant.</p>';
      return;
    }

    feed.innerHTML = '';
    snap.forEach(docSnap => {
      const post = docSnap.data();
      const date = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <span class="card-badge">${post.anonyme ? '🎭 Anonyme' : '👤 ' + escapeHtml(post.authorName || 'Membre')}</span>
        <h3>${escapeHtml(post.title || 'Sans titre')}</h3>
        <p>${escapeHtml(post.content || '')}</p>
        <span class="card-meta">${dateStr}</span>
      `;
      feed.appendChild(article);
    });
  } catch (e) {
    console.error('Erreur fil général :', e);
    feed.innerHTML = '<p class="empty-state">Erreur : ' + (e.code || e.message) + '</p>';
  }
}

const btnDemandeFil = document.getElementById('btn-demande-fil');
if (btnDemandeFil) {
  btnDemandeFil.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">✍️ Demander à publier</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Anonyme ou non ?</label>
            <div class="journal-privacy-choice">
              <button type="button" class="journal-privacy-option active" data-anon="true">
                <span class="privacy-icon">🎭</span>
                <span class="privacy-label">Anonyme</span>
              </button>
              <button type="button" class="journal-privacy-option" data-anon="false">
                <span class="privacy-icon">👤</span>
                <span class="privacy-label">Avec mon pseudo</span>
              </button>
            </div>
          </div>
          <div class="field">
            <label>Titre</label>
            <input type="text" id="fil-title" placeholder="Un titre..." maxlength="100">
          </div>
          <div class="field">
            <label>Ton message</label>
            <textarea id="fil-content" placeholder="Témoignage, mot gentil, conseil..." style="min-height:140px;"></textarea>
          </div>
          <p class="field-hint">📩 Ta demande sera envoyée à un admin/modérateur pour validation.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="fil-cancel">Annuler</button>
          <button class="btn btn-primary" id="fil-send">Envoyer la demande</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let anonyme = true;
    overlay.querySelectorAll('.journal-privacy-option').forEach(opt => {
      opt.addEventListener('click', () => {
        overlay.querySelectorAll('.journal-privacy-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        anonyme = opt.dataset.anon === 'true';
      });
    });

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#fil-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#fil-send').addEventListener('click', async () => {
      const title = overlay.querySelector('#fil-title').value.trim();
      const content = overlay.querySelector('#fil-content').value.trim();
      if (!content) { alert('Écris ton message 💙'); return; }

      try {
        await addDoc(collection(db, 'demandes-fil'), {
          authorId: currentUser.uid,
          authorName: currentUserData?.displayName || 'Utilisateur',
          anonyme,
          title: title || 'Sans titre',
          content,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        overlay.remove();
        alert('✅ Ta demande a été envoyée !');
      } catch (e) {
        console.error(e);
        alert('❌ ERREUR DEMANDE :\n' + (e.code || '?') + '\n\n' + (e.message || e));
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
function handleLogout() {
  if (!confirm('Se déconnecter d\'Iphax ?')) return;
  signOut(auth).then(() => {
    currentUser = null;
    currentUserData = null;
    if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
    showScreen('screen-intro');
  });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) btnLogout.addEventListener('click', handleLogout);

const btnLogoutEco = document.getElementById('btn-logout-eco');
if (btnLogoutEco) btnLogoutEco.addEventListener('click', handleLogout);

// ═══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  authReady = true;

  if (user) {
    currentUser = user;
    console.log('👤 Utilisateur connecté :', user.uid);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        currentUserData = snap.data();
        console.log('📋 Profil chargé');
      }
    } catch (e) {
      console.warn('Impossible de charger le profil :', e);
    }
  } else {
    currentUser = null;
    currentUserData = null;
    console.log('👋 Non connecté');
  }
});

console.log('✅ main.js entièrement chargé');