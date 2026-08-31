const baseUrl = (process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
const apply = process.argv.includes('--apply');

if (!token) throw new Error('DIRECTUS_ADMIN_TOKEN est obligatoire.');

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body?.data;
}

async function upsertField(collection, field, definition) {
  const fields = await api(`/fields/${collection}`);
  const exists = Array.isArray(fields) && fields.some((item) => item.field === field);

  const path = exists
    ? `/fields/${collection}/${field}`
    : `/fields/${collection}`;

  const body = exists
    ? definition
    : { field, ...definition };

  if (apply) {
    await api(path, {
      method: exists ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
  }

  console.log(
    `${apply
      ? (exists ? 'Mis à jour' : 'Créé')
      : (exists ? 'À mettre à jour' : 'À créer')} : ${collection}.${field}`
  );

  return exists;
}
const provinces = ['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan'].map((value) => ({ text: value, value }));
function normalizeProvince(value) {
  const key = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ({ guelmim: 'Guelmim', 'assa zag': 'Assa-Zag', 'sidi ifni': 'Sidi Ifni', 'tan tan': 'Tan-Tan' })[key] || null;
}

await upsertField('PROJETS', 'type_projet', {
  type: 'string',
  meta: { interface: 'select-dropdown', required: false, note: 'Type métier officiel du projet.', options: { choices: [
    { text: 'Grand projet', value: 'grand_projet' }, { text: 'TPME', value: 'tpme' }, { text: 'Porteur de projet', value: 'porteur_projet' },
  ] } },
  schema: { is_nullable: true, max_length: 32 },
});

const provincesExisted = await upsertField('PROJETS', 'provinces', {
  type: 'json',
  meta: { interface: 'select-multiple-dropdown', required: false, note: 'Provinces concernées. L’ancien champ province reste disponible pendant la transition.', options: { choices: provinces } },
  schema: { is_nullable: true },
});

await upsertField('investisseurs', 'secteur', {
  type: 'string', meta: { interface: 'input', required: false, note: 'Secteur déclaré par l’investisseur.' }, schema: { is_nullable: true, max_length: 255 },
});
await upsertField('investisseurs', 'province', {
  type: 'string', meta: { interface: 'select-dropdown', required: false, options: { choices: provinces } }, schema: { is_nullable: true, max_length: 32 },
});
await upsertField('investisseurs', 'pays', {
  type: 'string', meta: { required: false }, schema: { is_nullable: true },
});
await upsertField('PROJETS', 'business_plan', {
  type: 'uuid', meta: { options: { allowedMimeTypes: ['application/pdf', 'text/html'] } },
});

// Migration progressive : ne remplace jamais un tableau provinces déjà renseigné.
let page = 1;
let legacyRows = 0;
while (apply || provincesExisted) {
  const rows = await api(`/items/PROJETS?fields=id,province,provinces&limit=100&page=${page}`);
  if (!rows?.length) break;
  for (const row of rows) {
    if ((!Array.isArray(row.provinces) || row.provinces.length === 0) && row.province) {
      legacyRows += 1;
      const normalized = normalizeProvince(row.province);
      if (apply && normalized) await api(`/items/PROJETS/${row.id}`, { method: 'PATCH', body: JSON.stringify({ provinces: [normalized] }) });
    }
  }
  if (rows.length < 100) break;
  page += 1;
}

console.log(`${legacyRows} ancien(s) projet(s) ${apply ? 'migré(s)' : 'à migrer'} vers provinces.`);
console.log(apply ? 'Migration additive terminée. Aucun champ historique n’a été supprimé.' : 'Dry-run terminé. Relancer avec --apply pour appliquer.');
