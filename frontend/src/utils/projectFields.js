export const OFFICIAL_PROVINCES = ['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan'];

const TYPE_LABELS = {
  grand_projet: 'Grand projet',
  tpme: 'TPME',
  porteur_projet: 'Porteur de projet',
};

export function projectTypeLabel(value) {
  return TYPE_LABELS[value] || null;
}

export function normalizeProvince(value) {
  const key = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ({ guelmim: 'Guelmim', 'assa zag': 'Assa-Zag', 'sidi ifni': 'Sidi Ifni', 'tan tan': 'Tan-Tan' })[key] || null;
}

export function projectProvinces(project) {
  if (Array.isArray(project?.provinces) && project.provinces.length) {
    return [...new Set(project.provinces.map(normalizeProvince).filter(Boolean))];
  }
  const legacyProvince = normalizeProvince(project?.province);
  return legacyProvince ? [legacyProvince] : [];
}

export function projectProvinceLabel(project, fallback = 'À préciser') {
  const values = projectProvinces(project);
  return values.length ? values.join(', ') : fallback;
}
