const PUBLISHED = 'publie';
const ALLOWED_TYPES = new Set(['grand_projet', 'tpme', 'porteur_projet']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/html']);

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function missingRequiredFields(project) {
  const provinces = asArray(project.provinces);
  if (!provinces.length && project.province) provinces.push(project.province);

  return [
    !project.titre && 'titre',
    !ALLOWED_TYPES.has(project.type_projet) && 'type_projet',
    !project.secteur && 'secteur',
    !provinces.length && 'provinces',
    (project.investissement_mad === null || project.investissement_mad === undefined || project.investissement_mad === '') && 'investissement_mad',
    (project.nombre_postes === null || project.nombre_postes === undefined || project.nombre_postes === '') && 'nombre_postes',
  ].filter(Boolean);
}

export default ({ filter }, { database, exceptions }) => {
  const { InvalidPayloadError } = exceptions;

  async function validatePublication(payload, meta) {
    // La contrainte s'applique au passage explicite à « publié ».
    // Les imports et les fiches historiques déjà publiées restent modifiables.
    if (payload?.status_publication !== PUBLISHED) return payload;

    const keys = Array.isArray(meta?.keys) ? meta.keys : [];
    const existing = keys.length === 1
      ? await database('PROJETS').where('id', keys[0]).first()
      : null;
    const project = { ...(existing || {}), ...(payload || {}) };

    const missing = missingRequiredFields(project);
    if (missing.length) {
      throw new InvalidPayloadError({
        reason: `Publication impossible. Champs métier manquants : ${missing.join(', ')}.`,
      });
    }

    if (project.business_plan) {
      const file = await database('directus_files')
        .select(['type'])
        .where('id', project.business_plan)
        .first();
      if (!file || !ALLOWED_MIME_TYPES.has(file.type)) {
        throw new InvalidPayloadError({
          reason: 'Le Business Plan doit être au format PDF ou HTML.',
        });
      }
    }

    return payload;
  }

  filter('PROJETS.items.create', validatePublication);
  filter('PROJETS.items.update', validatePublication);
};
