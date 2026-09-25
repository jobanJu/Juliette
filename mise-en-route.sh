#!/bin/sh
# Mise en route de Juliette — à lancer une fois, depuis le dossier du projet :
#     sh mise-en-route.sh
#
# Installe les dépendances, prépare .env.local et place le projet sous git.
# Ne touche jamais à une clé secrète : la seule ligne à compléter à la main est
# signalée à la fin.

set -e
cd "$(dirname "$0")"

echo "→ 1/3  Installation des dépendances (dont @supabase/supabase-js)…"
npm install

echo "→ 2/3  Fichier d'environnement…"
if [ -f .env.local ]; then
  echo "       .env.local existe déjà, je n'y touche pas."
else
  cp .env.example .env.local
  echo "       .env.local créé à partir de .env.example."
fi

echo "→ 3/3  Suivi de version…"
if [ -d .git ]; then
  echo "       Dépôt git déjà présent."
else
  git init -q
  git add -A
  git -c user.email="jj755403@gmail.com" -c user.name="Jonathan Julliard" \
      commit -qm "Juliette — base du projet, connexion Supabase et migrations"
  echo "       Dépôt créé, premier commit effectué."
fi

echo ""
echo "─────────────────────────────────────────────────────────────"
echo " Il reste UNE chose à faire à la main :"
echo ""
echo "   Ouvre .env.local et colle ta clé service_role en face de"
echo "   SUPABASE_SERVICE_ROLE_KEY="
echo ""
echo "   Elle se trouve dans Supabase → Project Settings → API."
echo "   C'est la seule clé que je ne manipule pas : elle contourne"
echo "   toute la sécurité de ta base."
echo ""
echo " Ensuite :   npm run dev"
echo " Puis ouvre : http://localhost:3000/api/sante-supabase"
echo "─────────────────────────────────────────────────────────────"
