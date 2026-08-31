import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROVINCES = ['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan'];
const COLUMN_MAPPING = {
  'N° Projet': 'code_projet', 'Intitulé du projet': 'titre', Secteur: 'secteur',
  'Filière': 'filiere', Description: 'description', Localité: 'localite',
  'Montant de l’investissement': 'investissement_mad', "Montant de l'investissement": 'investissement_mad',
  'Nombre d’emplois': 'nombre_postes', "Nombre d'emplois": 'nombre_postes',
};
const IGNORED = new Set(['EXCEL', 'PPT', 'Revue', 'VF / Remarques à impacter', 'Commentaire', 'Catégorie']);

function clean(value) { return typeof value === 'string' ? value.trim() : value; }
export function normalizeProvince(value) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ({ guelmim: 'Guelmim', 'assa zag': 'Assa-Zag', 'sidi ifni': 'Sidi Ifni', 'tan tan': 'Tan-Tan' })[normalized] || null;
}

export function provincesFromRow(row) {
  const found = [];
  for (const province of PROVINCES) {
    const variants = province === 'Sidi Ifni' ? ['Sidi Ifni', 'Sidi-Ifni'] : province === 'Tan-Tan' ? ['Tan-Tan', 'Tan Tan'] : province === 'Assa-Zag' ? ['Assa-Zag', 'Assa Zag'] : [province];
    if (variants.some((key) => /^x$/i.test(String(row[key] || '').trim()))) found.push(province);
  }
  if (!found.length && row.Localité) {
    for (const part of String(row.Localité).split(/[,+;/]/)) {
      const province = normalizeProvince(part);
      if (province) found.push(province);
    }
  }
  return [...new Set(found)];
}

export function mapRow(row) {
  const project = { type_projet: null, investissement_mad: null, nombre_postes: null };
  for (const [header, field] of Object.entries(COLUMN_MAPPING)) {
    if (field !== 'localite' && row[header] !== undefined) {
      const value = clean(row[header]);
      project[field] = value === '' || value === null ? null : value;
    }
  }
  project.provinces = provincesFromRow(row);
  const officialType = String(row.Type || '').trim().toLowerCase();
  project.type_projet = ({ 'grand projet': 'grand_projet', tpme: 'tpme', 'porteur de projet': 'porteur_projet' })[officialType] || null;
  const missing = ['titre', 'secteur', 'type_projet', 'provinces', 'investissement_mad', 'nombre_postes'].filter((field) => field === 'provinces' ? !project.provinces.length : project[field] === null || project[field] === undefined || project[field] === '');
  return { project, missing, complete: missing.length === 0 };
}

async function directus(path, token, options = {}) {
  const base = (process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body?.data;
}

async function main() {
  const file = process.argv.find((arg) => /\.xlsx?$/i.test(arg));
  const apply = process.argv.includes('--apply');
  if (!file) throw new Error('Usage : node import.mjs fichier.xlsx [--apply]');
  if (apply && !process.env.DIRECTUS_ADMIN_TOKEN) throw new Error('DIRECTUS_ADMIN_TOKEN est requis avec --apply.');

  const workbook = XLSX.read(await readFile(file));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
  const report = { total: rows.length, imported: 0, ignored: 0, duplicates: 0, errors: [], complete: 0, incomplete: 0, missingFields: {} };
  const knownCodes = new Set();
  if (apply) {
    const existing = await directus('/items/PROJETS?fields=code_projet&limit=-1', process.env.DIRECTUS_ADMIN_TOKEN);
    existing.forEach((item) => item.code_projet && knownCodes.add(String(item.code_projet)));
  }

  for (const [index, row] of rows.entries()) {
    const { project, missing, complete } = mapRow(row);
    if (!project.titre) { report.ignored += 1; report.errors.push({ line: index + 2, error: 'Titre absent' }); continue; }
    if (project.code_projet && knownCodes.has(String(project.code_projet))) { report.duplicates += 1; continue; }
    complete ? report.complete += 1 : report.incomplete += 1;
    missing.forEach((field) => { report.missingFields[field] = (report.missingFields[field] || 0) + 1; });
    if (apply) {
      try {
        await directus('/items/PROJETS', process.env.DIRECTUS_ADMIN_TOKEN, { method: 'POST', body: JSON.stringify({ ...project, status_publication: 'brouillon' }) });
        report.imported += 1;
        if (project.code_projet) knownCodes.add(String(project.code_projet));
      } catch (error) { report.errors.push({ line: index + 2, error: error.message }); }
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ignoredColumns: [...IGNORED], report }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
