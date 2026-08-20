# Extension Directus — projets-publics

Cette extension ajoute l'endpoint public :

GET /projets-publics

Il renvoie uniquement les projets de la collection `PROJETS` dont
`statut_publication = publie`, et seulement les champs nécessaires au frontend.

Le champ `business_plan` n'est jamais renvoyé.

## Installation locale

Copier le dossier `directus-extension-projets-publics` directement dans :

CRI_Projets/extensions/

Puis redémarrer Directus :

docker compose restart directus

Test dans le navigateur :

http://localhost:8055/projets-publics
