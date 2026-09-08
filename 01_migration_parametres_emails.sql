-- Migration idempotente pour la configuration et la présentation des paramètres de la plateforme dans Directus
-- À exécuter dans la base de données PostgreSQL de Directus

-- 1. Ajout des colonnes physiques dans la table 'parametres_plateforme' (si non existantes)
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_nom_contact varchar(255) DEFAULT 'Contact CRI';
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_adresse_contact varchar(255) DEFAULT 'contact@cri.local';
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_signature text;
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS duree_validite_lien_heures integer DEFAULT 168;
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS duree_validite_verification_compte_heures integer DEFAULT 24;

ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_creation_compte_objet varchar(255);
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_creation_compte_message text;

ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_validation_bp_objet varchar(255);
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_validation_bp_message text;

ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_refus_bp_objet varchar(255);
ALTER TABLE parametres_plateforme ADD COLUMN IF NOT EXISTS email_refus_bp_message text;

-- 2. Nettoyage des séparateurs / dividers précédents pour éviter les doublons
DELETE FROM directus_fields
WHERE collection = 'parametres_plateforme'
  AND (field LIKE 'section_%' OR field LIKE 'divider_%');

-- 3. Insertion des séparateurs de sections (presentation-divider)
INSERT INTO directus_fields (collection, field, special, interface, options, sort, width)
VALUES
('parametres_plateforme', 'section_general', 'alias,no-data', 'presentation-divider', '{"title":"Paramètres généraux","icon":"settings","hr":true}', 10, 'full'),
('parametres_plateforme', 'section_comptes', 'alias,no-data', 'presentation-divider', '{"title":"Compte investisseur","icon":"group","hr":true}', 20, 'full'),
('parametres_plateforme', 'section_acces_bp', 'alias,no-data', 'presentation-divider', '{"title":"Accès Business Plan","icon":"description","hr":true}', 30, 'full'),
('parametres_plateforme', 'section_emails_creation', 'alias,no-data', 'presentation-divider', '{"title":"E-mails – création de compte","icon":"mark_email_read","hr":true}', 40, 'full'),
('parametres_plateforme', 'section_emails_validation', 'alias,no-data', 'presentation-divider', '{"title":"E-mails – validation","icon":"check_circle","hr":true}', 50, 'full'),
('parametres_plateforme', 'section_emails_refus', 'alias,no-data', 'presentation-divider', '{"title":"E-mails – refus","icon":"cancel","hr":true}', 60, 'full');

-- 4. Insertion initiale des champs métier s'ils ne sont pas encore présents dans directus_fields
INSERT INTO directus_fields (collection, field, interface, sort, width)
SELECT 'parametres_plateforme', f, 'input', 99, 'full'
FROM (VALUES
  ('email_nom_contact'),
  ('email_adresse_contact'),
  ('duree_validite_lien_heures'),
  ('duree_validite_verification_compte_heures'),
  ('email_signature'),
  ('email_creation_compte_objet'),
  ('email_creation_compte_message'),
  ('email_validation_bp_objet'),
  ('email_validation_bp_message'),
  ('email_refus_bp_objet'),
  ('email_refus_bp_message')
) AS v(f)
WHERE NOT EXISTS (
  SELECT 1 FROM directus_fields WHERE collection = 'parametres_plateforme' AND field = v.f
);

-- 5. Mise à jour des métadonnées (libellés, notes avec variables réelles, interfaces et ordre d'affichage)

-- Paramètres généraux
UPDATE directus_fields SET
  sort = 11,
  width = 'half',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Nom du contact"},{"language":"en-US","translation":"Nom du contact"}]'::json,
  note = 'Nom affiché de l''expéditeur ou du contact CRI (ex. Contact CRI).'
WHERE collection = 'parametres_plateforme' AND field = 'email_nom_contact';

UPDATE directus_fields SET
  sort = 12,
  width = 'half',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Adresse e-mail de contact"},{"language":"en-US","translation":"Adresse e-mail de contact"}]'::json,
  note = 'Adresse e-mail affichée pour contacter le CRI (ex. contact@cri.local).'
WHERE collection = 'parametres_plateforme' AND field = 'email_adresse_contact';

UPDATE directus_fields SET
  sort = 13,
  width = 'full',
  interface = 'input-multiline',
  translations = '[{"language":"fr-FR","translation":"Signature des e-mails"},{"language":"en-US","translation":"Signature des e-mails"}]'::json,
  note = 'Signature insérée en bas des e-mails. Variables : {{nom_contact}}, {{email_contact}}'
WHERE collection = 'parametres_plateforme' AND field = 'email_signature';

-- Compte investisseur
UPDATE directus_fields SET
  sort = 21,
  width = 'full',
  interface = 'boolean',
  options = '{"label":"Activer l''espace et les comptes investisseurs"}'::json,
  translations = '[{"language":"fr-FR","translation":"Comptes investisseurs"},{"language":"en-US","translation":"Comptes investisseurs"}]'::json,
  note = 'Active ou désactive la gestion des comptes investisseurs et l''authentification dédiée.'
WHERE collection = 'parametres_plateforme' AND field = 'comptes_investisseurs';

UPDATE directus_fields SET
  sort = 22,
  width = 'half',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Durée de validité du lien de vérification du compte (heures)"},{"language":"en-US","translation":"Durée de validité du lien de vérification du compte (heures)"}]'::json,
  note = 'Durée pendant laquelle le lien envoyé lors de la création d’un compte investisseur reste valide.'
WHERE collection = 'parametres_plateforme' AND field = 'duree_validite_verification_compte_heures';

-- Accès Business Plan
UPDATE directus_fields SET
  sort = 31,
  width = 'half',
  interface = 'select-dropdown',
  options = '{"choices":[{"text":"Désactivé","value":"desactive"},{"text":"Accès immédiat après identification","value":"direct"},{"text":"Validation par un agent","value":"validation"}]}'::json,
  translations = '[{"language":"fr-FR","translation":"Mode d''accès au Business Plan"},{"language":"en-US","translation":"Mode d''accès au Business Plan"}]'::json,
  note = 'Définit si le Business Plan nécessite une validation manuelle, un accès direct ou s''il est désactivé.'
WHERE collection = 'parametres_plateforme' AND field = 'mode_acces_business_plan';

UPDATE directus_fields SET
  sort = 32,
  width = 'half',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Durée de validité du lien (heures)"},{"language":"en-US","translation":"Durée de validité du lien (heures)"}]'::json,
  note = 'Durée de validité des liens de téléchargement sécurisés en heures (ex. 168 pour 7 jours).'
WHERE collection = 'parametres_plateforme' AND field = 'duree_validite_lien_heures';

-- E-mails – création de compte
UPDATE directus_fields SET
  sort = 41,
  width = 'full',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Objet – création du compte"},{"language":"en-US","translation":"Objet – création du compte"}]'::json,
  note = 'Objet de l''e-mail de vérification et d''activation envoyé à l''investisseur.'
WHERE collection = 'parametres_plateforme' AND field = 'email_creation_compte_objet';

UPDATE directus_fields SET
  sort = 42,
  width = 'full',
  interface = 'input-multiline',
  translations = '[{"language":"fr-FR","translation":"Message – création du compte"},{"language":"en-US","translation":"Message – création du compte"}]'::json,
  note = 'Variables disponibles : {{prenom}}, {{nom}}, {{email}}, {{lien_telechargement}}, {{duree_validite_heures}}, {{nom_contact}}, {{email_contact}}, {{signature}}'
WHERE collection = 'parametres_plateforme' AND field = 'email_creation_compte_message';

-- E-mails – validation
UPDATE directus_fields SET
  sort = 51,
  width = 'full',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Objet – demande validée"},{"language":"en-US","translation":"Objet – demande validée"}]'::json,
  note = 'Objet de l''e-mail notifiant la validation de l''accès au Business Plan.'
WHERE collection = 'parametres_plateforme' AND field = 'email_validation_bp_objet';

UPDATE directus_fields SET
  sort = 52,
  width = 'full',
  interface = 'input-multiline',
  translations = '[{"language":"fr-FR","translation":"Message – demande validée"},{"language":"en-US","translation":"Message – demande validée"}]'::json,
  note = 'Variables disponibles : {{prenom}}, {{nom}}, {{nom_complet}}, {{projet_titre}}, {{code_projet}}, {{lien_telechargement}}, {{duree_validite_heures}}, {{nom_contact}}, {{email_contact}}, {{signature}}'
WHERE collection = 'parametres_plateforme' AND field = 'email_validation_bp_message';

-- E-mails – refus
UPDATE directus_fields SET
  sort = 61,
  width = 'full',
  interface = 'input',
  translations = '[{"language":"fr-FR","translation":"Objet – demande refusée"},{"language":"en-US","translation":"Objet – demande refusée"}]'::json,
  note = 'Objet de l''e-mail notifiant le refus d''accès au Business Plan.'
WHERE collection = 'parametres_plateforme' AND field = 'email_refus_bp_objet';

UPDATE directus_fields SET
  sort = 62,
  width = 'full',
  interface = 'input-multiline',
  translations = '[{"language":"fr-FR","translation":"Message – demande refusée"},{"language":"en-US","translation":"Message – demande refusée"}]'::json,
  note = 'Variables disponibles : {{prenom}}, {{nom}}, {{nom_complet}}, {{projet_titre}}, {{code_projet}}, {{nom_contact}}, {{email_contact}}, {{signature}}'
WHERE collection = 'parametres_plateforme' AND field = 'email_refus_bp_message';

-- 6. Champs système en fin de formulaire
UPDATE directus_fields SET sort = 90, width = 'half', readonly = true WHERE collection = 'parametres_plateforme' AND field = 'id';
UPDATE directus_fields SET sort = 91, width = 'half', readonly = true WHERE collection = 'parametres_plateforme' AND field = 'date_created';
UPDATE directus_fields SET sort = 92, width = 'half', readonly = true WHERE collection = 'parametres_plateforme' AND field = 'date_updated';
UPDATE directus_fields SET sort = 93, width = 'half', readonly = true WHERE collection = 'parametres_plateforme' AND field = 'user_created';
UPDATE directus_fields SET sort = 94, width = 'half', readonly = true WHERE collection = 'parametres_plateforme' AND field = 'user_updated';
