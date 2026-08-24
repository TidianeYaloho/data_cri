# Extension Directus — projets-publics

Endpoints publics contrôlés :

- `GET /projets-publics`
- `GET /projets-publics/:id/image`

Le catalogue renvoie uniquement les projets de la collection `PROJETS` dont
`status_publication = publie` et qui ne sont pas archivés.

Le champ `business_plan` n'est jamais renvoyé. Le UUID de `image_principale`
n'est pas renvoyé non plus : le catalogue reçoit seulement `has_image`, puis
l'image est diffusée par la seconde route après nouvelle vérification du projet.

Il n'est donc pas nécessaire de rendre toute la collection `directus_files`
lisible publiquement pour afficher les images des projets.
