# Extension Directus — demande-business-plan

Ajoute l'endpoint :

POST /demande-business-plan

Il :
- vérifie le mode d'accès défini dans `parametres_plateforme`
- refuse si l'accès Business Plan est désactivé
- vérifie que le projet est publié
- retrouve l'investisseur par e-mail ou le crée
- évite les doublons de demandes actives
- crée une demande `demandee` en mode validation
- crée une demande `validee` en mode accès immédiat

La livraison sécurisée du fichier en mode immédiat sera ajoutée ensuite.
