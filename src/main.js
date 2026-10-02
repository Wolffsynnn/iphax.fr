// ============================================
// IPHAX — Logique principale (version CDN)
// ============================================

const auth = window.iphaxAuth;
const db = window.iphaxDb;

const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
} = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js');

const { doc, setDoc, getDoc, serverTimestamp } = await import(
  'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js'
);

// ============================================
// 1. GESTION DES ÉCRANS
// ============================================
function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.getElementById('btn-continuer').addEventListener('click', () => {
  showScreen('screen-auth');
});

// ============================================
// 2. ONGLETS Connexion / Inscription
// ============================================
const tabs = document.querySelectorAll('.tab');
const tabsContainer = document.querySelector('.auth-tabs');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.remove('active'));
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

// ============================================
// 2bis. BULLES DE RÔLE
// ============================================
const roleBubbles = document.querySelectorAll('.role-bubble');
const authSubtitle = document.getElementById('auth-subtitle');
const authTitle = document.querySelector('.auth-title');

const roleMessages = {
  membre: "Ici, quelqu'un t'écoute 💙",
  ecoutant: "Espace écoutant·e — Merci d'être là 💚",
  admin: 'Accès administration 🔧',
};

const roleTitles = {
  membre: 'Bienvenue sur Iphax',
  ecoutant: 'Connexion écoutant·e',
  admin: 'Connexion administration',
};

roleBubbles.forEach((bubble) => {
  bubble.addEventListener('click', () => {
    const role = bubble.dataset.role;

    roleBubbles.forEach((b) => b.classList.remove('active'));
    bubble.classList.add('active');

    authSubtitle.textContent = roleMessages[role] || roleMessages.membre;
    authTitle.textContent = roleTitles[role] || roleTitles.membre;

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

// ============================================
// 3. ŒIL : afficher / masquer le mot de passe
// ============================================
document.querySelectorAll('.toggle-eye').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.style.color = isPassword ? 'var(--cyan)' : 'var(--text-muted)';
  });
});

// ============================================
// 4. HELPERS
// ============================================
function showError(elId, message) {
  document.getElementById(elId).textContent = message;
}
function clearError(elId) {
  document.getElementById(elId).textContent = '';
}

function traductError(code) {
  const errors = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop faible (min. 8 caractères).',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
    'auth/network-request-failed': 'Problème de connexion. Vérifie ton réseau.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
    'auth/operation-not-allowed':
      "Cette méthode de connexion n'est pas activée.",
  };
  return errors[code] || 'Une erreur est survenue. Réessaie.';
}

// ============================================
// 5. CALCUL DE L'ÂGE
// ============================================
function calculerAge(dateNaissance) {
  const aujourdhui = new Date();
  const naissance = new Date(dateNaissance);
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const mois = aujourdhui.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && aujourdhui.getDate() < naissance.getDate())) {
    age--;
  }
  return age;
}

// ============================================
// 6. INSCRIPTION
// ============================================
formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('signup-error');

  const email = document.getElementById('signup-email').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const displayName = document
    .getElementById('signup-displayname')
    .value.trim();
  const birthdate = document.getElementById('signup-birthdate').value;
  const password = document.getElementById('signup-password').value;

  const age = calculerAge(birthdate);
  if (age >= 18) {
    showError('signup-error', '❌ Iphax est réservé aux moins de 18 ans.');
    return;
  }
  if (age < 8) {
    showError(
      'signup-error',
      "❌ Tu dois avoir au moins 8 ans pour t'inscrire."
    );
    return;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    showError(
      'signup-error',
      '❌ Le mot de passe doit contenir au moins 1 lettre et 1 chiffre.'
    );
    return;
  }
  const usernameRegex = /^[A-Za-z][A-Za-z0-9._-]{2,23}$/;
  if (!usernameRegex.test(username)) {
    showError(
      'signup-error',
      "❌ Nom d'utilisateur invalide (3-24 car., commence par une lettre)."
    );
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    await updateProfile(user, { displayName: username });

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      username: username,
      displayName: displayName,
      birthdate: birthdate,
      age: age,
      role: 'membre',
      createdAt: serverTimestamp(),
      lastUsernameChange: null,
      lastDisplayNameChange: null,
    });

    console.log('✅ Inscription réussie :', username);
  } catch (error) {
    console.error('Erreur inscription :', error);
    showError('signup-error', '❌ ' + traductError(error.code));
  }
});

// ============================================
// 7. CONNEXION
// ============================================
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('login-error');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Connexion réussie');
  } catch (error) {
    console.error('Erreur connexion :', error);
    showError('login-error', '❌ ' + traductError(error.code));
  }
});

// ============================================
// 8. CONNEXION GOOGLE
// ============================================
const btnGoogle = document.getElementById('btn-google');
const googleProvider = new GoogleAuthProvider();

btnGoogle.addEventListener('click', async () => {
  clearError('login-error');
  clearError('signup-error');

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        username: null,
        displayName: user.displayName || 'Utilisateur',
        birthdate: null,
        age: null,
        role: 'membre',
        provider: 'google',
        createdAt: serverTimestamp(),
      });
      console.log('🆕 Nouveau compte Google créé');
    }

    console.log('✅ Connexion Google réussie');
  } catch (error) {
    console.error('Erreur Google :', error);
    showError('login-error', '❌ ' + traductError(error.code));
  }
});

// ============================================
// 9. SURVEILLER LA CONNEXION
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('👤 Utilisateur connecté :', user.uid);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        console.log('📋 Profil :', userDoc.data());
      }
    } catch (error) {
      console.error('Erreur lecture profil :', error);
    }
  } else {
    console.log('👋 Aucun utilisateur connecté');
  }
});
