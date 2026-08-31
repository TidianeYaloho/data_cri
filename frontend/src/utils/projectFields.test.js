import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvince, projectProvinces, projectProvinceLabel, projectTypeLabel } from './projectFields.js';

test('préfère les provinces multi-valeurs', () => {
  const project = { province: 'Tan-Tan', provinces: ['Guelmim', 'Sidi Ifni'] };
  assert.deepEqual(projectProvinces(project), ['Guelmim', 'Sidi Ifni']);
  assert.equal(projectProvinceLabel(project), 'Guelmim, Sidi Ifni');
});

test('reste compatible avec l’ancien champ province', () => {
  assert.deepEqual(projectProvinces({ province: 'assa-zag' }), ['Assa-Zag']);
  assert.equal(normalizeProvince('Sidi-Ifni'), 'Sidi Ifni');
});

test('affiche les types officiels', () => {
  assert.equal(projectTypeLabel('tpme'), 'TPME');
  assert.equal(projectTypeLabel(null), null);
});
