# Banque régionale de projets — Frontend v0.1

Première version du frontend du prototype de Banque régionale de projets du CRI Guelmim-Oued Noun.

## Ce que contient cette version

- React + Vite
- charte visuelle inspirée du site guelmiminvest.ma
- page catalogue
- recherche plein texte
- filtres secteur / province
- cartes projet responsives
- fiche détaillée d'un projet
- formulaire visuel de demande du Business Plan
- couche API prête pour Directus
- mode démonstration local pour démarrer avant les permissions Directus
- Dockerfile pour éviter une installation globale de Node.js sur Windows

## Où placer les fichiers

Extraire le contenu de l'archive directement dans :

`D:\ECC\STAGE\stage 2A\FORVIS MAZARS\mission7\CRI_Projets\frontend`

Après extraction, `frontend` doit contenir directement `package.json`, `Dockerfile`, `vite.config.js`, `src`, etc.

## Important

Ne remplacez pas le `compose.yml` existant avec `docker-compose.frontend.snippet.yml`.
Ce dernier est seulement un exemple du bloc `frontend` à intégrer au fichier Compose existant après vérification de sa structure actuelle.

## Premier mode de fonctionnement

Par défaut, l'application est prévue pour démarrer avec `VITE_USE_MOCK_DATA=true`.
Elle affiche donc des projets fictifs afin de valider le design sans dépendre des permissions publiques Directus.

Pour connecter les vrais projets plus tard :

1. configurer les permissions de lecture des projets publiés dans Directus ;
2. créer un fichier `.env` à partir de `.env.example` ;
3. passer `VITE_USE_MOCK_DATA=false` ;
4. vérifier `VITE_DIRECTUS_URL=http://localhost:8055`.

Le frontend lit uniquement les informations publiques de `PROJETS`. Le champ `business_plan` n'est volontairement pas demandé dans l'API publique.

## Workflow Business Plan

Le formulaire est présent pour tester l'interface mais l'écriture est désactivée par défaut avec :

`VITE_ENABLE_REQUESTS=false`

Nous l'activerons uniquement après avoir défini les permissions Directus et la protection du téléchargement.
