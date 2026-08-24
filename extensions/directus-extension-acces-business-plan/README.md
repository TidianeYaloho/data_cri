# Accès sécurisé aux Business Plans

Endpoint Directus interne au projet CRI.

- Route : `GET /business-plan-access/:token`
- Le token brut n'est jamais stocké dans PostgreSQL : seul son hash SHA-256 est enregistré.
- Le lien doit être valide, non expiré et associé à une demande validée/téléchargée.
- Le Business Plan est diffusé via `AssetsService`, sans rendre `directus_files` public.
- Après un téléchargement terminé, la demande passe automatiquement à `telechargee`.
