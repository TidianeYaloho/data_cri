BANQUE DE PROJETS CRI — ENVIRONNEMENT LOCAL
============================================

CONTENU
-------
- PostgreSQL : base de données
- Directus   : interface d'administration + API
- React/Vite : interface publique
- Mailpit    : boîte e-mail locale de test
- extensions/: logique serveur personnalisée
- schema/    : snapshots de structure Directus
- uploads/   : fichiers gérés par Directus

PRÉREQUIS
---------
Docker Desktop doit être lancé et afficher "Engine running".

DÉMARRAGE
---------
Depuis la racine du projet :

   docker compose up -d

VÉRIFIER
--------

   docker compose ps

Services attendus :
- database
- directus
- frontend
- mailpit

ACCÈS
-----
Directus :
   http://localhost:8055

Frontend :
   http://localhost:5173

Mailpit (e-mails de test) :
   http://localhost:8025

ARRÊTER
-------

   docker compose stop

RELANCER
--------

   docker compose start

ARRÊTER ET SUPPRIMER LES CONTENEURS, SANS SUPPRIMER LA BASE
------------------------------------------------------------

   docker compose down

ATTENTION
---------
Ne lance PAS :

   docker compose down -v

sauf si tu veux supprimer également le volume PostgreSQL.

Le fichier .env contient des secrets et ne doit jamais être envoyé sur GitHub,
dans un ZIP partagé ou dans un e-mail. Le fichier .env.example contient uniquement
les noms des variables et des valeurs d'exemple.

WORKFLOW BUSINESS PLAN
----------------------
En mode "Validation par un agent" :
1. L'investisseur remplit le formulaire public.
2. Une demande est créée avec le statut "Demandée".
3. L'agent ouvre la demande dans Directus.
4. Il change le statut en "Validée" ou "Refusée" puis enregistre.
5. Le hook serveur envoie automatiquement l'e-mail correspondant.
6. En cas de validation, l'e-mail contient un lien sécurisé et temporaire.
7. Après téléchargement, le statut devient automatiquement "Téléchargée".

En mode "Accès immédiat après identification", le lien sécurisé est généré dès
l'envoi du formulaire.
