"use strict";

/* =========================================================================
 *  Comptes utilisateurs (Firebase Authentication)
 *  Inscription par e-mail + mot de passe ou avec un compte Google,
 *  connexion, mot de passe oublié et page « Mon compte ».
 * ========================================================================= */

const authEnabled = Boolean(FIREBASE_PROJECT_ID && window.firebase);
let fbAuth = null;
let authReady = !authEnabled;
const authListeners = [];

if (authEnabled) {
  firebase.initializeApp({
    apiKey: FIREBASE_API_KEY || GOOGLE_API_KEY,
    authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: FIREBASE_PROJECT_ID,
  });
  fbAuth = firebase.auth();
  fbAuth.languageCode = "fr";
  fbAuth.onAuthStateChanged(() => {
    authReady = true;
    renderAccountButton();
    authListeners.forEach(fn => fn(currentUser()));
  });
  // Termine une connexion Google commencée par redirection (fenêtre surgissante bloquée).
  fbAuth.getRedirectResult().catch(err => console.warn("Connexion Google :", err.code));
}

function currentUser() {
  return fbAuth ? fbAuth.currentUser : null;
}

function onAuthChange(fn) {
  authListeners.push(fn);
}

async function getIdToken() {
  const user = currentUser();
  return user ? user.getIdToken() : null;
}

function displayName(user) {
  if (!user) return "";
  return user.displayName || (user.email || "").split("@")[0] || "Lecteur";
}

const AUTH_ERRORS = {
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou réinitialisez votre mot de passe.",
  "auth/invalid-email": "L'adresse e-mail n'est pas valide.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/missing-password": "Saisissez votre mot de passe.",
  "auth/invalid-credential": "Adresse e-mail ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "Adresse e-mail ou mot de passe incorrect.",
  "auth/wrong-password": "Adresse e-mail ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte ne correspond à cette adresse e-mail.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  "auth/network-request-failed": "Connexion impossible. Vérifiez votre accès à Internet.",
  "auth/popup-closed-by-user": "La fenêtre de connexion Google a été fermée avant la fin.",
  "auth/cancelled-popup-request": "La fenêtre de connexion Google a été fermée avant la fin.",
  "auth/requires-recent-login": "Pour des raisons de sécurité, déconnectez-vous puis reconnectez-vous avant cette action.",
  "auth/operation-not-allowed": "Ce mode de connexion n'est pas encore activé sur le site.",
  "auth/unauthorized-domain": "Ce site n'est pas autorisé à utiliser la connexion. Ajoutez son domaine dans Firebase.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "La clé API n'autorise pas la connexion. Vérifiez ses restrictions.",
};

function authErrorMessage(err) {
  return AUTH_ERRORS[err && err.code] || `Une erreur est survenue (${(err && err.code) || "inconnue"}). Réessayez.`;
}

/* ---------- Bouton de compte dans l'en-tête ------------------------------ */

function initials(name) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
}

function renderAccountButton() {
  const el = document.getElementById("account-area");
  if (!el) return;
  if (!authEnabled) { el.hidden = true; return; }
  const user = currentUser();
  el.innerHTML = user
    ? `<a href="#/compte" class="account-chip" title="Mon compte">
         <span class="avatar">${user.photoURL
           ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
           : esc(initials(displayName(user)))}</span>
         <span class="account-name">${esc(displayName(user))}</span>
       </a>`
    : `<button type="button" class="login-btn" data-auth="login">Se connecter</button>`;
}

/* ---------- Fenêtre de connexion / inscription --------------------------- */

const authDialog = document.getElementById("auth-dialog");

function openAuth(mode = "login") {
  if (!authEnabled) return;
  renderAuth(mode);
  if (!authDialog.open) authDialog.showModal();
}

function renderAuth(mode, notice = "") {
  const box = document.getElementById("auth-content");
  const googleBtn = `
    <div class="auth-sep"><span>ou</span></div>
    <button type="button" class="google-btn" id="auth-google">
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      Continuer avec Google
    </button>`;

  if (mode === "signup") {
    box.innerHTML = `
      <h2>Créer un compte</h2>
      <p class="muted small">Un compte vous permet de noter les livres et de publier des commentaires.</p>
      <form id="auth-form" novalidate>
        <label class="field">Pseudo
          <input id="auth-name" autocomplete="nickname" maxlength="30" required placeholder="Le nom affiché avec vos avis">
        </label>
        <label class="field">Adresse e-mail
          <input id="auth-email" type="email" autocomplete="email" required>
        </label>
        <label class="field">Mot de passe
          <input id="auth-password" type="password" autocomplete="new-password" minlength="8" required>
          <small class="muted">8 caractères minimum.</small>
        </label>
        <label class="field">Confirmer le mot de passe
          <input id="auth-password2" type="password" autocomplete="new-password" required>
        </label>
        <p class="form-error error" hidden></p>
        <button type="submit" class="buy-btn wide">Créer mon compte</button>
      </form>
      ${googleBtn}
      <p class="auth-switch">Déjà inscrit ? <button type="button" class="link-btn" data-auth="login">Se connecter</button></p>`;
  } else if (mode === "reset") {
    box.innerHTML = `
      <h2>Mot de passe oublié</h2>
      <p class="muted small">Saisissez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
      <form id="auth-form" novalidate>
        <label class="field">Adresse e-mail
          <input id="auth-email" type="email" autocomplete="email" required>
        </label>
        <p class="form-error error" hidden></p>
        <button type="submit" class="buy-btn wide">Envoyer le lien</button>
      </form>
      <p class="auth-switch"><button type="button" class="link-btn" data-auth="login">Retour à la connexion</button></p>`;
  } else {
    box.innerHTML = `
      <h2>Se connecter</h2>
      ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
      <form id="auth-form" novalidate>
        <label class="field">Adresse e-mail
          <input id="auth-email" type="email" autocomplete="email" required>
        </label>
        <label class="field">Mot de passe
          <input id="auth-password" type="password" autocomplete="current-password" required>
        </label>
        <p class="auth-forgot"><button type="button" class="link-btn" data-auth="reset">Mot de passe oublié ?</button></p>
        <p class="form-error error" hidden></p>
        <button type="submit" class="buy-btn wide">Se connecter</button>
      </form>
      ${googleBtn}
      <p class="auth-switch">Pas encore de compte ? <button type="button" class="link-btn" data-auth="signup">Créer un compte</button></p>`;
  }

  const form = document.getElementById("auth-form");
  const errorEl = form.querySelector(".form-error");
  const showError = msg => { errorEl.textContent = msg; errorEl.hidden = false; };
  const val = id => (document.getElementById(id) || {}).value || "";

  form.addEventListener("submit", async e => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = val("auth-email").trim();
    const submit = form.querySelector("button[type=submit]");
    const label = submit.textContent;

    if (mode === "signup") {
      const name = val("auth-name").trim();
      if (name.length < 2) return showError("Choisissez un pseudo d'au moins 2 caractères.");
      if (val("auth-password").length < 8) return showError("Le mot de passe doit contenir au moins 8 caractères.");
      if (val("auth-password") !== val("auth-password2")) return showError("Les deux mots de passe ne sont pas identiques.");
    }

    submit.disabled = true;
    submit.textContent = "Veuillez patienter…";
    try {
      if (mode === "signup") {
        const cred = await fbAuth.createUserWithEmailAndPassword(email, val("auth-password"));
        await cred.user.updateProfile({ displayName: val("auth-name").trim() });
        cred.user.sendEmailVerification().catch(() => {});
        renderAccountButton();
        authListeners.forEach(fn => fn(currentUser()));
        authDialog.close();
      } else if (mode === "reset") {
        await fbAuth.sendPasswordResetEmail(email);
        renderAuth("login", `Si un compte existe pour ${email}, un e-mail de réinitialisation vient d'être envoyé.`);
        return;
      } else {
        await fbAuth.signInWithEmailAndPassword(email, val("auth-password"));
        authDialog.close();
      }
    } catch (err) {
      showError(authErrorMessage(err));
    }
    submit.disabled = false;
    submit.textContent = label;
  });

  const google = document.getElementById("auth-google");
  if (google) google.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await fbAuth.signInWithPopup(provider);
      authDialog.close();
    } catch (err) {
      if (err.code === "auth/popup-blocked") return fbAuth.signInWithRedirect(provider);
      showError(authErrorMessage(err));
    }
  });

  const first = box.querySelector("input");
  if (first) first.focus();
}

/* ---------- Page « Mon compte » ----------------------------------------- */

function viewAccount() {
  document.title = "Mon compte — Biblio FR";
  if (!authEnabled) {
    app.innerHTML = `<p class="empty">Les comptes ne sont pas activés sur ce site.</p>`;
    return;
  }
  if (!authReady) {
    app.innerHTML = loadingHtml;
    return;
  }
  const user = currentUser();
  if (!user) {
    app.innerHTML = `
      <div class="account-empty">
        <h1 class="page-title">Mon compte</h1>
        <p class="muted">Connectez-vous pour retrouver vos avis et gérer votre profil.</p>
        <div class="account-actions">
          <button type="button" class="buy-btn" data-auth="login">Se connecter</button>
          <button type="button" class="more-btn" data-auth="signup">Créer un compte</button>
        </div>
      </div>`;
    return;
  }

  const isPassword = user.providerData.some(p => p.providerId === "password");
  app.innerHTML = `
    <h1 class="page-title">Mon compte</h1>
    <p><a href="#/lecteur/${enc(user.uid)}">Voir mon profil public →</a></p>
    <div class="account-grid">
      <section class="account-card">
        <h2>Profil</h2>
        <form id="profile-form" novalidate>
          <label class="field">Pseudo
            <input id="profile-name" maxlength="30" value="${esc(displayName(user))}">
          </label>
          <p class="field-static"><span class="muted">Adresse e-mail</span><br>${esc(user.email || "")}
            ${user.emailVerified
              ? `<span class="badge ok">Vérifiée</span>`
              : `<span class="badge">Non vérifiée</span> <button type="button" class="link-btn" id="resend-verif">Renvoyer l'e-mail de vérification</button>`}
          </p>
          <p class="form-msg small" hidden></p>
          <p class="muted small">Votre pseudo et vos avis sont visibles par tous sur votre profil public. Votre e-mail reste privé.</p>
          <button type="submit" class="buy-btn">Enregistrer</button>
        </form>
      </section>

      <section class="account-card">
        <h2>Sécurité</h2>
        ${isPassword
          ? `<p class="muted small">Recevez un lien par e-mail pour choisir un nouveau mot de passe.</p>
             <button type="button" class="more-btn" id="change-password">Changer de mot de passe</button>`
          : `<p class="muted small">Vous vous connectez avec votre compte Google.</p>`}
        <p class="security-msg small" hidden></p>
        <hr>
        <button type="button" class="more-btn" id="logout">Se déconnecter</button>
        <hr>
        <p class="muted small">La suppression du compte efface aussi tous vos avis. Elle est définitive.</p>
        <button type="button" class="link-btn danger" id="delete-account">Supprimer mon compte</button>
      </section>
    </div>

    <section class="account-card">
      <h2>Mes avis</h2>
      <div id="my-reviews">${loadingHtml}</div>
    </section>`;

  // Profil
  const profileForm = document.getElementById("profile-form");
  const profileMsg = profileForm.querySelector(".form-msg");
  profileForm.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("profile-name").value.trim();
    if (name.length < 2) {
      profileMsg.className = "form-msg small error";
      profileMsg.textContent = "Le pseudo doit contenir au moins 2 caractères.";
      profileMsg.hidden = false;
      return;
    }
    try {
      await user.updateProfile({ displayName: name });
      onProfileRenamed(user).catch(() => {});
      renderAccountButton();
      profileMsg.className = "form-msg small success";
      profileMsg.textContent = "Pseudo enregistré. Il apparaît sur votre profil et vos avis.";
    } catch (err) {
      profileMsg.className = "form-msg small error";
      profileMsg.textContent = authErrorMessage(err);
    }
    profileMsg.hidden = false;
  });

  const resend = document.getElementById("resend-verif");
  if (resend) resend.addEventListener("click", async () => {
    try {
      await user.sendEmailVerification();
      resend.textContent = "E-mail envoyé. Pensez à vérifier vos courriers indésirables.";
    } catch (err) {
      resend.textContent = authErrorMessage(err);
    }
    resend.disabled = true;
  });

  // Sécurité
  const securityMsg = app.querySelector(".security-msg");
  const changePwd = document.getElementById("change-password");
  if (changePwd) changePwd.addEventListener("click", async () => {
    try {
      await fbAuth.sendPasswordResetEmail(user.email);
      securityMsg.className = "security-msg small success";
      securityMsg.textContent = `Un lien a été envoyé à ${user.email}.`;
    } catch (err) {
      securityMsg.className = "security-msg small error";
      securityMsg.textContent = authErrorMessage(err);
    }
    securityMsg.hidden = false;
  });

  document.getElementById("logout").addEventListener("click", () => fbAuth.signOut());

  const del = document.getElementById("delete-account");
  del.addEventListener("click", async () => {
    if (del.dataset.confirm !== "1") {
      del.dataset.confirm = "1";
      del.textContent = "Cliquez à nouveau pour confirmer la suppression définitive";
      return;
    }
    del.disabled = true;
    del.textContent = "Suppression…";
    try {
      const mine = await firestoreReviews.listByUser(user.uid);
      for (const r of mine) await firestoreReviews.remove(r.bookKey, r);
      await deleteProfile(user.uid);
      await user.delete();
      location.hash = "#/";
    } catch (err) {
      del.disabled = false;
      del.dataset.confirm = "";
      del.textContent = "Supprimer mon compte";
      securityMsg.className = "security-msg small error";
      securityMsg.textContent = err.code ? authErrorMessage(err) : err.message;
      securityMsg.hidden = false;
    }
  });

  renderMyReviews(user);
}

async function renderMyReviews(user) {
  const box = document.getElementById("my-reviews");
  let reviews;
  try {
    reviews = await firestoreReviews.listByUser(user.uid);
  } catch (err) {
    if (document.body.contains(box)) box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }
  if (!document.body.contains(box)) return;
  reviews.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  if (!reviews.length) {
    box.innerHTML = `<p class="muted">Vous n'avez pas encore donné d'avis. Ouvrez la fiche d'un livre pour le noter.</p>`;
    return;
  }
  box.innerHTML = `<ul class="review-list">${reviews.map((r, i) => `
    <li>
      <div class="review-head">
        ${starsHtml(r.rating)}
        <a href="#/recherche/title/${enc(r.title.split(" — ")[0])}"><strong>${esc(r.title)}</strong></a>
        <span class="muted small">${esc(formatDate(r.createdAt))}</span>
        <button type="button" class="link-btn danger" data-my-delete="${i}">Supprimer</button>
      </div>
      ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
    </li>`).join("")}</ul>`;
  box.querySelectorAll("[data-my-delete]").forEach(btn => btn.addEventListener("click", async () => {
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "Confirmer la suppression";
      return;
    }
    btn.disabled = true;
    try {
      const r = reviews[Number(btn.dataset.myDelete)];
      await firestoreReviews.remove(r.bookKey, r);
      renderMyReviews(user);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = err.message;
    }
  }));
}

/* ---------- Événements --------------------------------------------------- */

document.addEventListener("click", e => {
  const trigger = e.target.closest("[data-auth]");
  if (trigger) openAuth(trigger.dataset.auth);
});

// Réaffiche la page « Mon compte » quand l'état de connexion change.
onAuthChange(() => {
  if (location.hash.startsWith("#/compte")) viewAccount();
});

renderAccountButton();
