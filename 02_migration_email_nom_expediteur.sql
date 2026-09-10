-- Migration idempotente : Ajout du champ email_nom_expediteur dans parametres_plateforme
-- Permet de configurer le nom visible de l'expéditeur des e-mails transactionnels (ex. CRI Guelmim-Oued Noun)

-- 1. Ajout de la colonne physique dans la table parametres_plateforme (si non existante)
ALTER TABLE parametres_plateforme
ADD COLUMN IF NOT EXISTS email_nom_expediteur varchar(255) DEFAULT 'CRI Guelmim-Oued Noun';

-- 2. Initialisation de la valeur par défaut pour la ligne existante si nulle
UPDATE parametres_plateforme
SET email_nom_expediteur = 'CRI Guelmim-Oued Noun'
WHERE email_nom_expediteur IS NULL OR TRIM(email_nom_expediteur) = '';

-- 3. Déclaration du champ dans directus_fields s'il n'existe pas encore
INSERT INTO directus_fields (collection, field, interface, sort, width)
SELECT 'parametres_plateforme', 'email_nom_expediteur', 'input', 11, 'half'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'parametres_plateforme' AND field = 'email_nom_expediteur'
);

-- 4. Configuration des métadonnées Directus (interface, libellé, note et tri)
UPDATE directus_fields SET
  sort = 11,
  width = 'half',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Nom de l''expéditeur des e-mails"},{"language":"en-US","translation":"Email Sender Name"}]'::json,
  note = 'Nom affiché comme expéditeur des e-mails envoyés aux investisseurs (ex. CRI Guelmim-Oued Noun). Ne pas confondre avec l''adresse e-mail de contact.'
WHERE collection = 'parametres_plateforme' AND field = 'email_nom_expediteur';
