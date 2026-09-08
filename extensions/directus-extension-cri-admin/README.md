# Outils internes CRI

Endpoint Directus interne : `http://localhost:8055/cri-admin/`

La page fournit deux fonctions dans un même back-office technique :

1. **Tableau de bord CRI** : filtres communs période / province / secteur / projet, KPI, projets les plus demandés, secteurs et provinces les plus sollicités, investisseurs distincts, évolution temporelle et détail par projet.
2. **Import Excel projets** : lecture locale du `.xlsx` dans le navigateur, choix de la feuille, mapping interactif des colonnes, gestion des colonnes à ignorer, provinces multi-colonnes, dry-run, doublons et import en brouillon.

Les appels de données exigent un token administrateur Directus. Le token saisi dans la page reste seulement en mémoire de l'onglet ; il n'est ni stocké ni envoyé ailleurs qu'à Directus.

Pour les statistiques province, une demande concernant un projet multi-province compte dans chacune des provinces du projet.
