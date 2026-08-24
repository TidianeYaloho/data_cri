# Extension Directus — demande-business-plan

Endpoint public contrôlé :

`POST /demande-business-plan`

Il :
- vérifie le mode d'accès défini dans `parametres_plateforme` ;
- refuse les demandes lorsque le mode est `desactive` ;
- vérifie que le projet est publié et non archivé ;
- valide les informations investisseur côté serveur ;
- retrouve l'investisseur par e-mail ou le crée ;
- évite les doublons de demandes actives ;
- crée une demande `demandee` en mode `validation` ;
- crée/actualise une demande `validee` et génère un lien sécurisé en mode `direct` ;
- ne renvoie jamais le UUID Directus du fichier Business Plan.

Le téléchargement est assuré par l'extension `directus-extension-acces-business-plan`.
