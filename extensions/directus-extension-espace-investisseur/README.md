# directus-extension-espace-investisseur

Extension endpoint du portail investisseur CRI.

Fonctions principales :
- création d'un compte investisseur lié à `directus_users` ;
- vérification obligatoire de l'adresse e-mail pour les nouvelles inscriptions ;
- renvoi d'un e-mail de vérification ;
- connexion via l'authentification Directus ;
- demande et réinitialisation de mot de passe ;
- lecture et mise à jour du profil investisseur ;
- suivi des demandes de Business Plan ;
- génération d'un accès sécurisé au Business Plan depuis l'espace investisseur.

La vérification d'e-mail utilise un jeton aléatoire dont seule l'empreinte SHA-256 est stockée dans la table `investisseurs`.
La récupération de mot de passe s'appuie sur le mécanisme natif `UsersService.requestPasswordReset/resetPassword` de Directus.
