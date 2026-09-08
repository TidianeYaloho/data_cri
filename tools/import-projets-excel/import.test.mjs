import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRow, normalizeProvince, provincesFromRow } from './import.mjs';

test('normalise les quatre provinces', () => {
  assert.equal(normalizeProvince('Tan Tan'), 'Tan-Tan');
  assert.equal(normalizeProvince('Sidi-Ifni'), 'Sidi Ifni');
  assert.equal(normalizeProvince('Assa Zag'), 'Assa-Zag');
});

test('conserve plusieurs provinces cochées', () => {
  assert.deepEqual(provincesFromRow({ Guelmim: 'X', 'Sidi-Ifni': 'x' }), ['Guelmim', 'Sidi Ifni']);
});

test('n’invente pas le type depuis Catégorie et garde le brouillon incomplet', () => {
  const result = mapRow({ 'N° Projet': 'T-01', 'Intitulé du projet': 'Projet fictif', Secteur: 'Agriculture', Catégorie: 'Mega', Localité: 'Guelmim' });
  assert.equal(result.project.type_projet, null);
  assert.deepEqual(result.project.provinces, ['Guelmim']);
  assert.equal(result.complete, false);
});
