#!/usr/bin/env bash
# Lance tous les tests sans réseau de Biblio FR et échoue au moindre problème.
# Utilisé par GitHub Actions (.github/workflows/tests.yml) ; utilisable aussi à la main :
#   SITE_DIR=/home/user/Site-test-A bash dossier-ia/outils-de-test/lancer-tests.sh
# Variables : SITE_DIR (racine du site, servie en HTTP), CHROMIUM (navigateur),
# NODE_PATH_PW (dossier node_modules contenant playwright).
# Les tests sur la vraie base (verify4.py, verif-messages.py) ne sont pas lancés ici.
set -u
SITE_DIR="${SITE_DIR:-/home/user/Site-test-A}"
TESTS_SRC="$SITE_DIR/dossier-ia/outils-de-test"
WORK="$(mktemp -d)"
PORT="${PORT:-8766}"
fail=0

cp "$TESTS_SRC"/*.mjs "$TESTS_SRC"/*.js "$WORK"/
[ -n "${NODE_PATH_PW:-}" ] && ln -s "$NODE_PATH_PW" "$WORK/node_modules"
cd "$WORK" || exit 1

echo "== Syntaxe JavaScript"
for f in "$SITE_DIR"/data.js "$SITE_DIR"/js/*.js "$SITE_DIR"/js/*/*.js "$SITE_DIR"/scripts/*.mjs; do
  node --check "$f" || { echo "ÉCHEC syntaxe : $f"; fail=1; }
done

# Site servi en HTTP pour les tests qui lisent data/*.json.
python3 -m http.server "$PORT" --directory "$SITE_DIR" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

run() {
  local name="$1"; shift
  echo "== $name"
  local out
  out="$(SITE_DIR="$SITE_DIR" BASE="http://localhost:$PORT/" timeout 300 "$@" 2>&1)"
  local code=$?
  echo "$out" | tail -n 40
  # Échec : code de sortie, erreur JavaScript, défilement horizontal ou incohérence signalée.
  if [ $code -ne 0 ] \
    || echo "$out" | grep -qE "errs \[ '|erreurs: \[\"|hscroll: true|défilement horizontal: true|ÉCHEC"; then
    echo ">>> ÉCHEC : $name"
    fail=1
  fi
}

run "Qualité (tq.js)" node tq.js
run "Catalogue (t21)" node t21-catalogue.js
run "Comparaison (t22)" node t22-comparaison-catalogue.js
for t in t14 t15 t16 t17 t18 t19 t20; do run "$t" node "$t.mjs"; done
run "Robot : nouveautés (t26)" node t26-robot-nouveautes.mjs
run "Pages légales et contact (t27)" node t27-legal-contact.mjs
run "Classement (t28)" node t28-classement.mjs

if [ $fail -ne 0 ]; then
  echo "Des tests ont échoué."
  exit 1
fi
echo "Tous les tests sont passés."
