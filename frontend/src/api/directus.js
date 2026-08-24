const DIRECTUS_URL = (
  import.meta.env.VITE_DIRECTUS_URL || 'http://localhost:8055'
).replace(/\/$/, '');

let investorAccessToken = null;

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function makeApiError(response, payload, fallback) {
  const error = new Error(
    payload?.message || fallback || `La requête a échoué (${response.status})`,
  );

  error.code = payload?.error || 'REQUEST_FAILED';
  error.status = response.status;
  return error;
}

function investorAuthHeaders(extra = {}) {
  return {
    ...extra,
    ...(investorAccessToken
      ? { Authorization: `Bearer ${investorAccessToken}` }
      : {}),
  };
}

async function refreshInvestorToken() {
  const response = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'cookie' }),
  });

  if (response.status === 401 || response.status === 403) {
    investorAccessToken = null;
    return null;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    investorAccessToken = null;
    throw makeApiError(response, payload, 'La session investisseur est indisponible.');
  }

  investorAccessToken = payload?.data?.access_token || null;
  return investorAccessToken;
}

async function ensureInvestorToken() {
  if (investorAccessToken) return investorAccessToken;
  return refreshInvestorToken();
}

export async function fetchPublishedProjects() {
  const response = await fetch(`${DIRECTUS_URL}/projets-publics`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Endpoint projets-publics a répondu ${response.status}`);
  }

  const payload = await response.json();
  const projects = Array.isArray(payload.data) ? payload.data : [];

  return projects.map((project) => ({
    ...project,
    statut_publication: project.status_publication,
  }));
}

export async function fetchPlatformSettings() {
  const response = await fetch(`${DIRECTUS_URL}/parametres-publics`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Endpoint parametres-publics a répondu ${response.status}`);
  }

  const payload = await response.json();

  return {
    comptes_investisseurs:
      payload?.data?.comptes_investisseurs ?? false,
    mode_acces_business_plan:
      payload?.data?.mode_acces_business_plan ?? 'validation',
  };
}

export function projectImageUrl(projectId) {
  if (!projectId) return '';
  return `${DIRECTUS_URL}/projets-publics/${projectId}/image`;
}

export async function createInvestorAndRequest({
  investor,
  projectId,
  useAccount = false,
}) {
  if (useAccount) {
    await ensureInvestorToken();
  }

  const response = await fetch(`${DIRECTUS_URL}/demande-business-plan`, {
    method: 'POST',
    headers: investorAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      projectId,
      ...(investor ? { investor } : {}),
    }),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      `La demande a échoué (${response.status})`,
    );
  }

  return payload;
}

export async function registerInvestorAccount(form) {
  const response = await fetch(`${DIRECTUS_URL}/espace-investisseur/inscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(form),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(response, payload, "L'inscription a échoué.");
  }

  return payload?.data ?? null;
}



export async function verifyInvestorEmail(token) {
  const response = await fetch(
    `${DIRECTUS_URL}/espace-investisseur/verification-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      "La vérification de l'adresse e-mail a échoué.",
    );
  }

  return payload?.data ?? null;
}

export async function resendInvestorVerification(email) {
  const response = await fetch(
    `${DIRECTUS_URL}/espace-investisseur/renvoyer-verification`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      "Le renvoi de l'e-mail de vérification a échoué.",
    );
  }

  return payload?.data ?? null;
}

export async function requestInvestorPasswordReset(email) {
  const response = await fetch(
    `${DIRECTUS_URL}/espace-investisseur/mot-de-passe-oublie`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      'La demande de réinitialisation a échoué.',
    );
  }

  return payload?.data ?? null;
}

export async function resetInvestorPassword(token, password) {
  const response = await fetch(
    `${DIRECTUS_URL}/espace-investisseur/reinitialiser-mot-de-passe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      'La réinitialisation du mot de passe a échoué.',
    );
  }

  return payload?.data ?? null;
}

export async function loginInvestor(email, password) {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      mode: 'cookie',
    }),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    investorAccessToken = null;
    const error = makeApiError(
      response,
      payload,
      'Adresse e-mail ou mot de passe incorrect.',
    );
    error.code = 'LOGIN_FAILED';
    throw error;
  }

  investorAccessToken = payload?.data?.access_token || null;

  if (!investorAccessToken) {
    throw new Error("Directus n'a pas retourné de jeton d'accès.");
  }

  return payload?.data ?? payload;
}

export async function logoutInvestor() {
  try {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'cookie' }),
    });
  } finally {
    investorAccessToken = null;
  }
}

export async function fetchInvestorAccount() {
  const token = await ensureInvestorToken();
  if (!token) return null;

  let response = await fetch(`${DIRECTUS_URL}/espace-investisseur/me`, {
    headers: investorAuthHeaders(),
    cache: 'no-store',
  });

  if (response.status === 401) {
    investorAccessToken = null;
    const refreshed = await refreshInvestorToken();
    if (!refreshed) return null;

    response = await fetch(`${DIRECTUS_URL}/espace-investisseur/me`, {
      headers: investorAuthHeaders(),
      cache: 'no-store',
    });
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      "Impossible de charger l'espace investisseur.",
    );
  }

  return payload?.data ?? null;
}

export async function updateInvestorProfile(profile) {
  const token = await ensureInvestorToken();
  if (!token) {
    const error = new Error('Votre session a expiré.');
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }

  const response = await fetch(`${DIRECTUS_URL}/espace-investisseur/profil`, {
    method: 'PATCH',
    headers: investorAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(profile),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(response, payload, 'La mise à jour du profil a échoué.');
  }

  return payload?.data ?? null;
}

export async function createAccountBusinessPlanAccess(requestId) {
  const token = await ensureInvestorToken();
  if (!token) {
    const error = new Error('Votre session a expiré.');
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }

  const response = await fetch(
    `${DIRECTUS_URL}/espace-investisseur/demandes/${requestId}/acces`,
    {
      method: 'POST',
      headers: investorAuthHeaders(),
    },
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw makeApiError(
      response,
      payload,
      "Impossible de générer l'accès au Business Plan.",
    );
  }

  return payload?.data ?? null;
}
