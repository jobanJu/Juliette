# Juliette

Nouvelle application de pilotage pour restaurant. Ce dossier est indépendant du site vitrine JulLab.

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir ensuite <http://localhost:3000>.

## Périmètre produit

- **RH** : badgeuse, planning et rédaction du planning, gestion du personnel, demandes d’acompte, congés et absences, statuts des collaborateurs.
- **HACCP** : réception, températures, refroidissement, nettoyage, traçabilité et étiquettes DLC.
- **Stock** : fournisseurs et commandes, inventaires, pertes et niveaux de stock.
- **Ventes** : commandes par table, ruptures, réservations et paiements sans contact via des prestataires à intégrer.
- **Finance** : ventes, pertes et estimations du chiffre d’affaires.
- **Établissement** : paramètres, fiches techniques, messagerie et gestion multi-site.
- **Évènements** : calendrier des évènements autour de chaque établissement.

Les fiches techniques seront reliées aux ingrédients du stock. Exemple : une portion de sauce tomate consomme 3 tomates et 30 g d’huile d’olive ; la vente d’une portion devra déduire ces quantités et recalculer le stock.

## État actuel

La première tranche fournit la structure Next.js, l’identité visuelle de l’espace de travail et un tableau de bord responsive. Les ventes, tâches, contrôles et stocks affichés sont des exemples de démonstration : aucune donnée persistante, authentification, connexion fournisseur ou API de paiement n’est encore branchée.
