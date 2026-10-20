# Pages légales, contact et sauvegarde — 20/10

## Choix du propriétaire
- **Aucun nom affiché.** L'éditeur est un particulier non professionnel ; l'article 6, III, 2 de la LCEN lui permet de ne pas publier son identité si l'hébergeur la connaît.
- **Contact par formulaire.** Aucune adresse e-mail n'est publiée.

## Ce qui a été ajouté
- `js/views/legal.js` : trois pages.
  - `#/mentions-legales` : éditeur, hébergeurs (GitHub Pages, Firebase), contenus, responsabilité.
  - `#/confidentialite` : tableau des données, finalités, bases légales et durées ; stockage local sans consentement ; services tiers ; sous-traitants et transferts ; droits ; CNIL ; mineurs de moins de 15 ans ; sécurité.
  - `#/contact` : formulaire avec sujet, message de 10 à 3 000 caractères, moyen de réponse facultatif et champ piège anti-robots.
  - La date de mise à jour est dans `LEGAL_UPDATED`.
- **Firestore, collection `messages`** :
  - création par n'importe quel visiteur, avec champs et tailles contrôlés, `uid` vide ou celui du compte connecté, date serveur ;
  - lecture et suppression par les modérateurs seulement.
  - Les messages s'affichent dans la page **Modération** (« Messages reçus »), avec un bouton « Traité : supprimer le message ». La politique annonce leur suppression après traitement.
- **« Mon compte » → « Télécharger mes données »** : un fichier JSON avec le compte, le profil, les avis, la bibliothèque, les listes et les abonnements (droit à la portabilité).
- **Polices hébergées sur le site** (`assets/fonts`, licence OFL) au lieu de Google Fonts : l'adresse IP des visiteurs n'est plus envoyée à Google pour les polices.
- **Pied de page** du site et des pages `livres/` : liens vers Mentions légales, Confidentialité et Contact.
- **Sauvegarde hebdomadaire** : tâche `sauvegarde` du workflow, script `scripts/sauvegarde-avis.mjs`.
  - Elle lit, comme un visiteur, les données publiques : avis, pseudos, profils, abonnements et listes publiques.
  - Le fichier est compressé, chiffré (AES-256, `openssl -pbkdf2`) avec le secret `BACKUP_PASSWORD`, puis gardé 90 jours comme *artifact* GitHub. Il n'est jamais ajouté au dépôt, qui est public.
  - **Ne s'exécute pas tant que le secret n'existe pas.**
  - Non sauvegardés, car illisibles sans compte : bibliothèques privées, listes privées, signalements et messages.
  - Déchiffrement : `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in sauvegarde-AAAA-MM-JJ.json.gz.enc -out s.json.gz -pass pass:LE_MOT_DE_PASSE && gunzip s.json.gz`. Le contenu est au format REST Firestore (`documents` avec `fields`).

## À faire par le propriétaire
1. Publier les règles `firestore.rules` à jour dans Firebase (Firestore → Règles → Publier), puis les faire vérifier sur la vraie base avec des comptes temporaires.
2. Créer le secret `BACKUP_PASSWORD` (Settings → Secrets and variables → Actions) et garder ce mot de passe en lieu sûr.
3. Créer une alerte de budget dans Google Cloud (Facturation → Budgets et alertes) pour les deux projets.
4. Consulter régulièrement la page Modération. Une demande RGPD doit recevoir une réponse sous un mois.

## Limites
- Les pages légales ne remplacent pas l'avis d'un juriste.
- Le formulaire peut recevoir du spam : le champ piège arrête les robots simples. Firebase App Check reste une option si cela devient gênant.
