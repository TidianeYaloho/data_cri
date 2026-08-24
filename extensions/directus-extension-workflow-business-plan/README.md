# Workflow agent - Business Plans

Hook Directus déclenché lorsque l'agent change le champ `statut` d'une demande.

- `validee` : génère un token sécurisé, fixe une date d'expiration et envoie un e-mail avec le lien de téléchargement.
- `refusee` : invalide tout ancien lien et envoie un e-mail de refus.
- `demandee` : réinitialise les données de décision.
- La validation est bloquée si le projet est indisponible ou ne possède pas de Business Plan.

En local, les e-mails sont capturés par Mailpit : http://localhost:8025
