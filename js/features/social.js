"use strict";

/* =========================================================================
 *  Fonctions sociales : suivre un lecteur, fil d'actualité des lecteurs
 *  suivis, pastille de nouveautés depuis la dernière visite.
 *
 *  users/{moi}/following/{lecteur}  et  users/{lecteur}/followers/{moi}
 *  sont créés et supprimés ensemble (écriture atomique).
 * ========================================================================= */

const MAX_FOLLOWED_IN_FEED = 30;

const social = {
  async isFollowing(uid) {
    const me = currentUser();
    if (!me) return false;
    return Boolean(await firestore.get(`users/${me.uid}/following/${uid}`).catch(() => null));
  },
  async follow(uid) {
    const me = currentUser();
    if (!me) throw new Error("Connectez-vous pour suivre un lecteur.");
    const now = [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }];
    await firestore.commit([
      { update: { name: firestore.docName(`users/${me.uid}/following/${uid}`), fields: {} }, updateTransforms: now },
      { update: { name: firestore.docName(`users/${uid}/followers/${me.uid}`), fields: {} }, updateTransforms: now },
    ]);
  },
  async unfollow(uid) {
    const me = currentUser();
    if (!me) return;
    await firestore.commit([
      { delete: firestore.docName(`users/${me.uid}/following/${uid}`) },
      { delete: firestore.docName(`users/${uid}/followers/${me.uid}`) },
    ]);
  },
  async counts(uid) {
    const [followers, following] = await Promise.all([
      firestore.list(`users/${uid}/followers`).catch(() => []),
      firestore.list(`users/${uid}/following`).catch(() => []),
    ]);
    return { followers: followers.length, following: following.length };
  },
  async followingIds(uid) {
    return (await firestore.list(`users/${uid}/following`).catch(() => [])).map(d => d.id);
  },
};

/* ---------- Fil d'actualité --------------------------------------------- */

// Derniers avis des lecteurs suivis (les plus récents d'abord).
async function feedItems(user, limit = 60) {
  const ids = (await social.followingIds(user.uid)).slice(0, MAX_FOLLOWED_IN_FEED);
  const lists = await Promise.all(ids.map(id => firestoreReviews.listByUser(id).catch(() => [])));
  return lists.flat()
    .filter(r => !r.hidden)
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
    .slice(0, limit);
}

const feedSeenKey = uid => `bibliofr.feedSeen.${uid}`;
const getFeedSeen = uid => { try { return localStorage.getItem(feedSeenKey(uid)) || ""; } catch { return ""; } };
const setFeedSeen = uid => { try { localStorage.setItem(feedSeenKey(uid), new Date().toISOString()); } catch { /* ignoré */ } };

// Pastille sur le lien « Fil » : nombre d'avis publiés depuis la dernière visite du fil.
let feedBadgeRun = 0;   // seul le dernier calcul lancé met à jour la pastille

async function updateFeedBadge() {
  const run = ++feedBadgeRun;
  const link = document.getElementById("feed-link");
  const user = currentUser();
  if (!link) return;
  link.hidden = !user;
  const badge = link.querySelector(".nav-badge");
  badge.hidden = true;
  if (!user) return;
  const seen = getFeedSeen(user.uid);
  const items = await feedItems(user, 99).catch(() => []);
  const fresh = items.filter(r => (r.updatedAt || r.createdAt || "") > seen).length;
  if (run !== feedBadgeRun) return;
  if (fresh && currentUser() === user) {
    badge.textContent = fresh > 9 ? "9+" : String(fresh);
    badge.hidden = false;
    link.setAttribute("aria-label", `Fil d'actualité, ${fresh} nouveauté${fresh > 1 ? "s" : ""}`);
  } else {
    link.removeAttribute("aria-label");
  }
}

async function viewFeed() {
  document.title = "Fil d'actualité — Biblio FR";
  const user = currentUser();
  if (!user) {
    app.innerHTML = `
      <div class="account-empty">
        <h1 class="page-title">Fil d'actualité</h1>
        <p class="muted">Connectez-vous pour suivre des lecteurs et voir ici leurs derniers avis.</p>
        <div class="account-actions"><button type="button" class="buy-btn" data-auth="login">Se connecter</button></div>
      </div>`;
    return;
  }
  app.innerHTML = `<h1 class="page-title">Fil d'actualité</h1>${skeletonHtml(4)}`;
  const seen = getFeedSeen(user.uid);
  let items;
  try {
    items = await feedItems(user);
  } catch (err) {
    app.innerHTML = `<h1 class="page-title">Fil d'actualité</h1><p class="error">${esc(err.message)}</p>`;
    return;
  }
  if (!location.hash.startsWith("#/fil")) return;
  setFeedSeen(user.uid);
  updateFeedBadge();

  app.innerHTML = `
    <h1 class="page-title">Fil d'actualité</h1>
    <p class="muted">Les derniers avis des lecteurs que vous suivez.</p>
    ${items.length ? `<ul class="feed">${items.map(r => {
      const isNew = (r.updatedAt || r.createdAt || "") > seen;
      return `
        <li class="feed-item${isNew ? " new" : ""}">
          <div class="review-head">
            ${profileLink(r.uid, r.name)}
            <span class="muted">${r.updatedAt ? "a modifié son avis sur" : "a noté"}</span>
            <a href="#/recherche/all/${enc(r.title.split(" — ")[0])}"><strong>${esc(r.title)}</strong></a>
            ${starsHtml(r.rating)}
            ${isNew ? `<span class="badge">Nouveau</span>` : ""}
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
          <p class="muted small">${esc(formatDate(r.updatedAt || r.createdAt))}</p>
        </li>`;
    }).join("")}</ul>`
      : `<p class="empty">Rien pour l'instant. Trouvez des lecteurs à suivre dans <a href="#/lecteurs">Lecteurs</a> :
         leurs nouveaux avis apparaîtront ici.</p>`}`;
}

/* ---------- Bouton « Suivre » sur les profils ------------------------------- */

async function renderFollowBox(uid) {
  const box = document.getElementById("follow-box");
  if (!box) return;
  const me = currentUser();
  const [counts, following] = await Promise.all([social.counts(uid), me && me.uid !== uid ? social.isFollowing(uid) : false]);
  if (!document.body.contains(box)) return;
  box.innerHTML = `
    <span class="muted small"><strong>${counts.followers}</strong> abonné${counts.followers > 1 ? "s" : ""} ·
      <strong>${counts.following}</strong> abonnement${counts.following > 1 ? "s" : ""}</span>
    ${!me ? `<button type="button" class="more-btn" data-auth="login">Suivre</button>`
      : me.uid === uid ? ""
      : `<button type="button" class="${following ? "more-btn" : "buy-btn"}" id="follow-btn" aria-pressed="${following}">${following ? "Abonné ✓" : "Suivre"}</button>`}`;
  const btn = document.getElementById("follow-btn");
  if (btn) btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      if (following) await social.unfollow(uid); else await social.follow(uid);
    } catch (err) {
      btn.textContent = err.message;
      return;
    }
    renderFollowBox(uid);
  });
}

onAuthChange(user => {
  const link = document.getElementById("feed-link");
  if (link) link.hidden = !user;
  setTimeout(updateFeedBadge, 1500);
});
