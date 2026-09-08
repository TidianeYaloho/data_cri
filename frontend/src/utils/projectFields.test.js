import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProvince,
  projectProvinces,
  projectProvinceLabel,
  projectTypeLabel
} from './projectFields.js';

test('préfère les provinces multi-valeurs', () => {
  const project = {
    provinces: ['Guelmim', 'Sidi Ifni']
  };

  assert.deepEqual(
    projectProvinces(project),
    ['Guelmim', 'Sidi Ifni']
  );

  assert.equal(
    projectProvinceLabel(project),
    'Guelmim, Sidi Ifni'
  );
});

test('ignore définitivement l’ancien champ province', () => {
  assert.deepEqual(
    projectProvinces({ province: 'assa-zag' }),
    []
  );

  assert.equal(
    projectProvinceLabel({ province: 'assa-zag' }),
    'À préciser'
  );
});

test('normalise les provinces officielles', () => {
  assert.equal(normalizeProvince('Sidi-Ifni'), 'Sidi Ifni');
  assert.equal(normalizeProvince('tan tan'), 'Tan-Tan');
  assert.equal(normalizeProvince('assa_zag'), 'Assa-Zag');
});

test('affiche les types officiels', () => {
  assert.equal(projectTypeLabel('tpme'), 'TPME');
  assert.equal(projectTypeLabel(null), null);
});
