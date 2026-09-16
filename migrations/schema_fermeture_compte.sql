ALTER TABLE investisseurs ADD COLUMN IF NOT EXISTS statut_compte VARCHAR(50) NOT NULL DEFAULT 'actif';
ALTER TABLE investisseurs ADD COLUMN IF NOT EXISTS date_fermeture_compte TIMESTAMPTZ NULL;
ALTER TABLE investisseurs ADD COLUMN IF NOT EXISTS raison_fermeture VARCHAR(255) NULL;

INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width)
SELECT 'investisseurs', 'statut_compte', NULL, 'select-dropdown', '{"choices":[{"text":"Actif","value":"actif"},{"text":"Fermé","value":"ferme"}]}', 'raw', false, false, 15, 'half'
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection='investisseurs' AND field='statut_compte');

INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width)
SELECT 'investisseurs', 'date_fermeture_compte', NULL, 'datetime', NULL, 'datetime', true, false, 16, 'half'
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection='investisseurs' AND field='date_fermeture_compte');

INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width)
SELECT 'investisseurs', 'raison_fermeture', NULL, 'input', NULL, 'raw', true, false, 17, 'full'
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection='investisseurs' AND field='raison_fermeture');
