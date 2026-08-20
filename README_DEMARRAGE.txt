PROTOTYPE LOCAL — BANQUE DE PROJETS CRI
==========================================

CONTENU
-------
- PostgreSQL : base de données
- Directus   : interface d'administration + API
- uploads/   : futurs Business Plans / fichiers
- frontend/  : future interface publique

PRÉREQUIS
---------
Docker Desktop doit être lancé et afficher "Engine running".

DÉMARRAGE
---------
1. Décompresser ce dossier.
2. Ouvrir PowerShell dans ce dossier.
   Astuce Windows : dans l'Explorateur, clique dans la barre d'adresse,
   tape powershell puis Entrée.
3. Exécuter :
      docker compose up -d
4. Au premier lancement, Docker télécharge PostgreSQL et Directus.
   Cela peut prendre quelques minutes selon la connexion.
5. Ouvrir dans le navigateur :
      http://localhost:8055
6. Directus affichera son écran d'onboarding.
   Crée ton compte administrateur local.

VÉRIFIER
--------
Dans PowerShell :
   docker compose ps

Tu dois voir les services database et directus en cours d'exécution.

ARRÊTER
-------
   docker compose stop

RELANCER
--------
   docker compose start

ARRÊTER ET SUPPRIMER LES CONTENEURS (les données restent dans le volume)
------------------------------------------------------------------------
   docker compose down

ATTENTION
---------
Ne lance PAS :
   docker compose down -v
sauf si tu veux supprimer également la base PostgreSQL du prototype.

Le fichier .env contient des identifiants générés pour ce prototype local.
Ne le publie pas sur GitHub et ne l'utilise pas tel quel en production.

ÉTAPE SUIVANTE
--------------
Après connexion à Directus, créer les premières collections :
- projets
- investisseurs
- demandes_business_plan

Puis définir leurs champs et relations.
