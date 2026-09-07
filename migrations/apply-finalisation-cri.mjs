const baseUrl = (process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
const apply = process.argv.includes('--apply');
if (!token) throw new Error('DIRECTUS_ADMIN_TOKEN est obligatoire.');

const SECTORS = [
  { text: 'Agriculture', value: 'agriculture' },
  { text: 'Énergie', value: 'énergie' },
  { text: 'Industrie', value: 'industrie' },
  { text: 'Environnement', value: 'environnement' },
  { text: 'Tourisme', value: 'tourisme' },
  { text: 'Service', value: 'service' },
];
const PROVINCES = ['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan'];

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body?.data;
}

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function canonicalSector(value) {
  return ({
    agriculture: 'agriculture',
    energie: '\u00e9nergie',
    industrie: 'industrie',
    environnement: 'environnement',
    environnemnt: 'environnement',
    tourisme: 'tourisme',
    service: 'service',
    services: 'service'
  })[norm(value)] || null;
}
async function fields(collection) { return await api(`/fields/${collection}`); }
async function patchField(collection, field, body) {
  if (apply) await api(`/fields/${collection}/${field}`, { method: 'PATCH', body: JSON.stringify(body) });
  console.log(`${apply ? 'Mis à jour' : 'À mettre à jour'} : ${collection}.${field}`);
}

const projectFields = await fields('PROJETS');
const investorFields = await fields('investisseurs');
for (const required of ['provinces', 'type_projet']) {
  if (!projectFields.some((f) => f.field === required)) throw new Error(`Champ requis absent : PROJETS.${required}`);
}
if (!investorFields.some((f) => f.field === 'secteur')) throw new Error('Champ requis absent : investisseurs.secteur');

await patchField('PROJETS', 'provinces', {
  meta: { interface: 'select-multiple-dropdown', required: false, note: 'Provinces concernées par le projet.', options: { choices: PROVINCES.map((value) => ({ text: value, value })) } },
});
await patchField('PROJETS', 'secteur', {
  meta: { interface: 'select-dropdown', required: false, options: { choices: SECTORS, placeholder: 'Sélectionner le secteur' } },
});

for (const field of ['titre', 'filiere', 'description', 'investissement_mad', 'nombre_postes', 'type_projet']) {
  await patchField('PROJETS', field, { meta: { required: false } });
}
await patchField('investisseurs', 'secteur', {
  meta: { interface: 'select-dropdown', required: true, note: 'Secteur sélectionné par l’investisseur.', options: { choices: SECTORS, placeholder: 'Sélectionner le secteur' } },
  schema: { is_nullable: true, max_length: 255 },
});

await patchField('demandes_business_plan', 'statut', {
  meta: {
    options: {
      choices: [
        { text: 'Demandée', value: 'demandee' },
        { text: 'Validée', value: 'validee' },
        { text: 'Refusée', value: 'refusee' }
      ]
    }
  }
});

let page = 1;
let projectSectorChanges = 0;
while (true) {
  const rows = await api(`/items/PROJETS?fields=id,secteur&limit=100&page=${page}`);
  if (!rows?.length) break;
  for (const row of rows) {
    const canonical = canonicalSector(row.secteur);
    if (canonical && row.secteur !== canonical) {
      projectSectorChanges++;
      if (apply) await api(`/items/PROJETS/${row.id}`, { method: 'PATCH', body: JSON.stringify({ secteur: canonical }) });
    }
  }
  if (rows.length < 100) break;
  page++;
}

page = 1;
let investorSectorChanges = 0;
let investorInvalidSectors = 0;
while (true) {
  const rows = await api(`/items/investisseurs?fields=id,secteur&limit=100&page=${page}`);
  if (!rows?.length) break;
  for (const row of rows) {
    if (!row.secteur) continue;
    const canonical = canonicalSector(row.secteur);
    if (canonical && row.secteur !== canonical) {
      investorSectorChanges++;
      if (apply) await api(`/items/investisseurs/${row.id}`, { method: 'PATCH', body: JSON.stringify({ secteur: canonical }) });
    }
    else if (!canonical) {
      investorInvalidSectors++;
      if (apply) await api(`/items/investisseurs/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ secteur: null })
      });
    }
  }
  if (rows.length < 100) break;
  page++;
}
console.log(`${projectSectorChanges} secteur(s) projet à normaliser.`);
console.log(`${investorSectorChanges} secteur(s) investisseur a normaliser.`);
console.log(`${investorInvalidSectors} secteur(s) investisseur invalide(s) a remettre a null.`);

const legacyExists = projectFields.some((f) => f.field === 'province');
if (legacyExists) {
  console.log(`${apply ? 'Suppression' : 'À supprimer'} : PROJETS.province`);
  if (apply) await api('/fields/PROJETS/province', { method: 'DELETE' });
} else {
  console.log('PROJETS.province est déjà absent.');
}

console.log(apply ? 'Finalisation CRI appliquée.' : 'Dry-run terminé. Relancer avec --apply uniquement après sauvegarde et validation.');
