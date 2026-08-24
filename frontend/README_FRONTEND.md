# Banque régionale de projets — Frontend

Frontend public React + Vite de la Banque régionale de projets du CRI Guelmim-Oued Noun.

## Fonctionnement actuel

- catalogue des projets publiés ;
- recherche et filtres secteur / province ;
- fiches projet ;
- images servies par l'endpoint public contrôlé `projets-publics` ;
- lecture des paramètres de la plateforme depuis Directus ;
- demande de Business Plan ;
- mode désactivé, accès direct ou validation par un agent ;
- téléchargement du Business Plan uniquement par un lien serveur sécurisé.

Le frontend ne lit pas directement la collection `PROJETS` et ne reçoit jamais le UUID du champ `business_plan`. Les données publiques passent par les extensions Directus du projet.

## Configuration

La seule variable Vite nécessaire est :

```text
VITE_DIRECTUS_URL=http://localhost:8055
```

Avec Docker Compose, cette valeur est déjà fournie par `compose.yml`.

## Démarrage

Depuis la racine `CRI_Projets` :

```powershell
docker compose up -d --build
```

Puis ouvrir :

```text
http://localhost:5173
```

## Important

Le fichier `src/data/mockProjects.js` est un ancien jeu de démonstration conservé uniquement comme référence ; il n'est plus importé par l'application. Le fonctionnement réel utilise Directus.
