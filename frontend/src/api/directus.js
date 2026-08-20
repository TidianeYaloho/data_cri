const DIRECTUS_URL = (
  import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:8055'
).replace(/\/$/, '');


export async function fetchPublishedProjects() {
  const response = await fetch(`${DIRECTUS_URL}/projets-publics`);

  if (!response.ok) {
    throw new Error(
      `Endpoint projets-publics a répondu ${response.status}`
    );
  }

  const payload = await response.json();

  const projects = Array.isArray(payload.data)
    ? payload.data
    : [];

  return projects.map((project) => ({
    ...project,
    statut_publication: project.status_publication,
  }));
}


export async function fetchPlatformSettings() {
  const response = await fetch(
    `${DIRECTUS_URL}/parametres-publics`
  );

  if (!response.ok) {
    throw new Error(
      `Endpoint parametres-publics a répondu ${response.status}`
    );
  }

  const payload = await response.json();

  return {
    comptes_investisseurs:
      payload?.data?.comptes_investisseurs ?? false,

    mode_acces_business_plan:
      payload?.data?.mode_acces_business_plan ?? 'validation',
  };
}


export function directusAssetUrl(fileId, options = {}) {
  if (!fileId) return '';

  const params = new URLSearchParams();

  if (options.width) {
    params.set('width', String(options.width));
  }

  if (options.height) {
    params.set('height', String(options.height));
  }

  if (options.fit) {
    params.set('fit', options.fit);
  }

  if (options.quality) {
    params.set('quality', String(options.quality));
  }

  const query = params.toString();

  return `${DIRECTUS_URL}/assets/${fileId}${query ? `?${query}` : ''
    }`;
}


export async function createInvestorAndRequest({
  investor,
  projectId,
}) {
  const response = await fetch(
    `${DIRECTUS_URL}/demande-business-plan`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        projectId,
        investor,
      }),
    }
  );

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
      `La demande a échoué (${response.status})`
    );

    error.code =
      payload?.error || 'REQUEST_FAILED';

    throw error;
  }

  return payload;
}