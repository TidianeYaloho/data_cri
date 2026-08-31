import { createHash, randomBytes } from 'node:crypto';

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value) =>
  normalizeText(value).toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 10;
const GENERIC_PASSWORD_RESET_MESSAGE =
  "Si un compte actif correspond à cette adresse, un e-mail de réinitialisation a été envoyé.";
const OFFICIAL_PROVINCES = new Set(['Guelmim', 'Assa-Zag', 'Sidi Ifni', 'Tan-Tan']);

function hashToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function getVerificationTtlHours(env) {
  const parsed = Number(env.INVESTOR_EMAIL_VERIFICATION_TTL_HOURS ?? 24);

  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(parsed, 24 * 7);
}

function createVerificationToken(env) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const ttlHours = getVerificationTtlHours(env);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return { rawToken, tokenHash, expiresAt, ttlHours };
}

function frontendBaseUrl(env) {
  const configured = env.FRONTEND_PUBLIC_URL || env.CORS_ORIGIN || 'http://localhost:5173';
  const firstUrl = String(configured).split(',')[0].trim();
  return firstUrl.replace(/\/$/, '');
}

function buildVerificationUrl(env, rawToken) {
  const url = new URL(frontendBaseUrl(env));
  url.searchParams.set('verify_email', rawToken);
  return url.toString();
}

function buildPasswordResetUrl(env) {
  const url = new URL(frontendBaseUrl(env));
  url.searchParams.set('action', 'reset-password');
  return url.toString();
}

function fullName(profile) {
  return [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim();
}

async function sendVerificationEmail({
  MailService,
  schema,
  database,
  env,
  profile,
  rawToken,
  ttlHours,
}) {
  const mailService = new MailService({
    schema,
    knex: database,
  });

  await mailService.send({
    to: profile.email,
    from: env.EMAIL_FROM || 'no-reply@cri.local',
    subject: 'Vérifiez votre adresse e-mail - Espace investisseur CRI',
    text: [
      `Bonjour ${fullName(profile) || 'Investisseur'},`,
      '',
      "Votre compte investisseur a été créé sur la Banque régionale de projets du CRI.",
      '',
      "Pour activer votre compte, cliquez sur le lien suivant :",
      buildVerificationUrl(env, rawToken),
      '',
      `Ce lien est valable pendant ${ttlHours} heure(s).`,
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.",
      '',
      `Contact CRI : ${env.CRI_CONTACT_EMAIL || 'contact@cri.local'}`,
    ].join('\n'),
  });
}

function safeUserId(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getLinkTtlHours(env) {
  const parsed = Number(env.BUSINESS_PLAN_LINK_TTL_HOURS ?? 168);

  if (!Number.isFinite(parsed) || parsed <= 0) return 168;
  return Math.min(parsed, 24 * 30);
}

function createAccessToken(env) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const ttlHours = getLinkTtlHours(env);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return { rawToken, tokenHash, expiresAt };
}

function buildAccessUrl(env, rawToken) {
  const baseUrl = String(env.PUBLIC_URL || 'http://localhost:8055')
    .replace(/\/$/, '');

  return `${baseUrl}/business-plan-access/${rawToken}`;
}

async function readSettings(database) {
  const settings = await database('parametres_plateforme')
    .select(['comptes_investisseurs', 'mode_acces_business_plan'])
    .first();

  return {
    comptes_investisseurs: settings?.comptes_investisseurs === true,
    mode_acces_business_plan:
      settings?.mode_acces_business_plan ?? 'validation',
  };
}

function ensureAccountsEnabled(settings, res) {
  if (settings.comptes_investisseurs) return true;

  res.status(403).json({
    error: 'INVESTOR_ACCOUNTS_DISABLED',
    message: "Les comptes investisseurs sont actuellement désactivés.",
  });

  return false;
}

function normalizeRegistration(body) {
  return {
    prenom: normalizeText(body?.prenom),
    nom: normalizeText(body?.nom),
    email: normalizeEmail(body?.email),
    password: typeof body?.password === 'string' ? body.password : '',
    telephone: normalizeText(body?.telephone) || null,
    entreprise: normalizeText(body?.entreprise) || null,
    fonction: normalizeText(body?.fonction) || null,
    pays: normalizeText(body?.pays) || null,
    secteur: normalizeText(body?.secteur),
    province: normalizeText(body?.province),
  };
}

function validateProfile(profile) {
  if (!profile.prenom || !profile.nom || !profile.email || !profile.secteur || !profile.province) {
    return {
      error: 'FIELDS_REQUIRED',
      message: 'Prénom, nom, e-mail, secteur et province sont obligatoires.',
    };
  }

  if (!EMAIL_PATTERN.test(profile.email)) {
    return {
      error: 'INVALID_EMAIL',
      message: "L'adresse e-mail n'est pas valide.",
    };
  }

  if (!OFFICIAL_PROVINCES.has(profile.province)) {
    return { error: 'INVALID_PROVINCE', message: 'La province sélectionnée n’est pas valide.' };
  }

  for (const [field, value] of Object.entries(profile)) {
    if (
      field !== 'password' &&
      typeof value === 'string' &&
      value.length > MAX_TEXT_LENGTH
    ) {
      return {
        error: 'FIELD_TOO_LONG',
        message: `Le champ ${field} dépasse ${MAX_TEXT_LENGTH} caractères.`,
      };
    }
  }

  return null;
}

async function ensureInvestorRole({ RolesService, schema, env }) {
  const roleName = normalizeText(env.INVESTOR_ROLE_NAME) || 'Investisseur';
  const rolesService = new RolesService({
    schema,
    accountability: { admin: true },
  });

  const existingRoles = await rolesService.readByQuery({
    fields: ['id', 'name'],
    filter: { name: { _eq: roleName } },
    limit: 1,
  });

  if (existingRoles?.[0]?.id) return existingRoles[0].id;

  const createdRole = await rolesService.createOne({
    name: roleName,
    icon: 'account_circle',
    description:
      "Compte investisseur du portail public. Aucune politique d'accès Directus n'est attribuée.",
  });

  return typeof createdRole === 'string'
    ? createdRole
    : createdRole?.id ?? createdRole;
}

async function loadInvestorByUser(database, userId) {
  return database('investisseurs')
    .select([
      'id',
      'prenom',
      'nom',
      'email',
      'telephone',
      'entreprise',
      'fonction',
      'pays',
      'secteur',
      'province',
      'date_created',
      'directus_user',
      'email_verifie_at',
    ])
    .where('directus_user', userId)
    .first();
}

async function loadInvestorRequests(database, investorId) {
  return database('demandes_business_plan as d')
    .leftJoin('PROJETS as p', 'p.id', 'd.projet')
    .select([
      'd.id',
      'd.statut',
      'd.date_created',
      'd.date_decision',
      'd.date_telechargement',
      'd.access_expires_at',
      'p.id as projet_id',
      'p.code_projet',
      'p.titre as projet_titre',
    ])
    .where('d.investisseur', investorId)
    .orderBy('d.id', 'desc');
}

export default {
  id: 'espace-investisseur',

  handler: (router, { database, logger, services, getSchema, env }) => {
    const { UsersService, RolesService, MailService } = services;

    router.post('/inscription', async (req, res, next) => {
      let createdUserId = null;
      let usersService = null;

      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const profile = normalizeRegistration(req.body);
        const validationError = validateProfile(profile);

        if (validationError) {
          return res.status(400).json(validationError);
        }

        if (profile.password.length < MIN_PASSWORD_LENGTH) {
          return res.status(400).json({
            error: 'PASSWORD_TOO_SHORT',
            message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
          });
        }

        const schema = await getSchema();
        usersService = new UsersService({
          schema,
          accountability: { admin: true },
          knex: database,
        });

        const existingUsers = await usersService.readByQuery({
          fields: ['id', 'email', 'status'],
          filter: { email: { _eq: profile.email } },
          limit: 1,
        });

        const existingUser = existingUsers?.[0] ?? null;
        const existingInvestor = await database('investisseurs')
          .select(['id', 'directus_user'])
          .whereRaw('LOWER("email") = ?', [profile.email])
          .orderBy('id', 'desc')
          .first();

        if (existingUser) {
          if (
            existingUser.status === 'unverified' &&
            existingInvestor?.directus_user === existingUser.id
          ) {
            return res.status(409).json({
              error: 'EMAIL_NOT_VERIFIED',
              message:
                "Ce compte existe déjà mais l'adresse e-mail n'a pas encore été vérifiée.",
            });
          }

          return res.status(409).json({
            error: 'ACCOUNT_EXISTS',
            message: 'Un compte existe déjà avec cette adresse e-mail.',
          });
        }

        if (existingInvestor?.directus_user) {
          return res.status(409).json({
            error: 'ACCOUNT_EXISTS',
            message: 'Un compte existe déjà avec cette adresse e-mail.',
          });
        }

        const roleId = await ensureInvestorRole({
          RolesService,
          schema,
          env,
        });

        const created = await usersService.createOne({
          email: profile.email,
          password: profile.password,
          first_name: profile.prenom,
          last_name: profile.nom,
          status: 'unverified',
          role: roleId,
        });

        createdUserId =
          typeof created === 'string' ? created : created?.id ?? created;

        if (!createdUserId) {
          throw new Error("Directus n'a pas retourné l'identifiant du compte créé.");
        }

        const verification = createVerificationToken(env);
        const now = new Date();
        let investorId;

        if (existingInvestor) {
          investorId = existingInvestor.id;

          await database('investisseurs')
            .where('id', investorId)
            .update({
              prenom: profile.prenom,
              nom: profile.nom,
              email: profile.email,
              telephone: profile.telephone,
              entreprise: profile.entreprise,
              secteur: profile.secteur,
              province: profile.province,
              directus_user: createdUserId,
              email_verification_token_hash: verification.tokenHash,
              email_verification_expires_at: verification.expiresAt,
              email_verifie_at: null,
            });
        } else {
          const inserted = await database('investisseurs')
            .insert({
              prenom: profile.prenom,
              nom: profile.nom,
              email: profile.email,
              telephone: profile.telephone,
              entreprise: profile.entreprise,
              fonction: profile.fonction,
              pays: profile.pays,
              secteur: profile.secteur,
              province: profile.province,
              directus_user: createdUserId,
              date_created: now,
              email_verification_token_hash: verification.tokenHash,
              email_verification_expires_at: verification.expiresAt,
              email_verifie_at: null,
            })
            .returning(['id']);

          investorId = inserted[0].id;
        }

        let emailEnvoye = true;

        try {
          await sendVerificationEmail({
            MailService,
            schema,
            database,
            env,
            profile,
            rawToken: verification.rawToken,
            ttlHours: verification.ttlHours,
          });
        } catch (emailError) {
          emailEnvoye = false;
          logger.error(
            emailError,
            `Impossible d'envoyer l'e-mail de vérification pour ${profile.email}`,
          );
        }

        return res.status(201).json({
          data: {
            investisseur_id: investorId,
            prenom: profile.prenom,
            nom: profile.nom,
            email: profile.email,
            verification_requise: true,
            email_envoye: emailEnvoye,
          },
        });
      } catch (error) {
        if (createdUserId && usersService) {
          try {
            await usersService.deleteOne(createdUserId);
          } catch (cleanupError) {
            logger.error(
              cleanupError,
              `Impossible de supprimer le compte Directus ${createdUserId} après échec d'inscription`,
            );
          }
        }

        logger.error(error, "Erreur lors de l'inscription investisseur");
        next(error);
      }
    });

    router.post('/renvoyer-verification', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const email = normalizeEmail(req.body?.email);

        if (!EMAIL_PATTERN.test(email)) {
          return res.status(400).json({
            error: 'INVALID_EMAIL',
            message: "L'adresse e-mail n'est pas valide.",
          });
        }

        const investor = await database('investisseurs')
          .select(['id', 'prenom', 'nom', 'email', 'directus_user'])
          .whereRaw('LOWER("email") = ?', [email])
          .orderBy('id', 'desc')
          .first();

        if (investor?.directus_user) {
          const user = await database('directus_users')
            .select(['id', 'status'])
            .where('id', investor.directus_user)
            .first();

          if (user?.status === 'unverified') {
            const schema = await getSchema();
            const verification = createVerificationToken(env);

            await database('investisseurs')
              .where('id', investor.id)
              .update({
                email_verification_token_hash: verification.tokenHash,
                email_verification_expires_at: verification.expiresAt,
                email_verifie_at: null,
              });

            try {
              await sendVerificationEmail({
                MailService,
                schema,
                database,
                env,
                profile: investor,
                rawToken: verification.rawToken,
                ttlHours: verification.ttlHours,
              });
            } catch (emailError) {
              logger.error(
                emailError,
                `Impossible de renvoyer l'e-mail de vérification pour ${email}`,
              );
            }
          }
        }

        return res.json({
          data: {
            message:
              "Si ce compte attend une vérification, un nouvel e-mail vient d'être envoyé.",
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors du renvoi de l'e-mail de vérification");
        next(error);
      }
    });

    router.post('/verification-email', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const rawToken = normalizeText(req.body?.token);

        if (!rawToken) {
          return res.status(400).json({
            error: 'VERIFICATION_TOKEN_REQUIRED',
            message: 'Lien de vérification incomplet.',
          });
        }

        const tokenHash = hashToken(rawToken);
        const investor = await database('investisseurs')
          .select(['id', 'directus_user', 'email_verification_expires_at'])
          .where('email_verification_token_hash', tokenHash)
          .first();

        if (
          !investor?.directus_user ||
          !investor.email_verification_expires_at ||
          new Date(investor.email_verification_expires_at).getTime() <= Date.now()
        ) {
          return res.status(400).json({
            error: 'VERIFICATION_TOKEN_INVALID',
            message: 'Ce lien de vérification est invalide ou a expiré.',
          });
        }

        const user = await database('directus_users')
          .select(['id', 'status'])
          .where('id', investor.directus_user)
          .first();

        if (!user || user.status !== 'unverified') {
          return res.status(400).json({
            error: 'VERIFICATION_TOKEN_INVALID',
            message: 'Ce lien de vérification est invalide ou a déjà été utilisé.',
          });
        }

        const schema = await getSchema();
        const usersService = new UsersService({
          schema,
          accountability: { admin: true },
          knex: database,
        });

        await usersService.updateOne(user.id, { status: 'active' });

        await database('investisseurs')
          .where('id', investor.id)
          .update({
            email_verification_token_hash: null,
            email_verification_expires_at: null,
            email_verifie_at: new Date(),
          });

        return res.json({
          data: {
            verifie: true,
            message: 'Votre adresse e-mail est vérifiée. Vous pouvez maintenant vous connecter.',
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors de la vérification de l'adresse e-mail");
        next(error);
      }
    });

    router.post('/mot-de-passe-oublie', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const email = normalizeEmail(req.body?.email);

        if (!EMAIL_PATTERN.test(email)) {
          return res.status(400).json({
            error: 'INVALID_EMAIL',
            message: "L'adresse e-mail n'est pas valide.",
          });
        }

        const schema = await getSchema();
        const usersService = new UsersService({
          schema,
          accountability: { admin: true },
          knex: database,
        });

        try {
          await usersService.requestPasswordReset(
            email,
            buildPasswordResetUrl(env),
            'Réinitialisation de votre mot de passe - Espace investisseur CRI',
          );
        } catch (resetError) {
          // Réponse volontairement identique pour éviter de révéler
          // si une adresse possède ou non un compte actif.
          logger.debug?.(
            resetError,
            `Demande de réinitialisation non envoyée pour ${email}`,
          );
        }

        return res.json({
          data: { message: GENERIC_PASSWORD_RESET_MESSAGE },
        });
      } catch (error) {
        logger.error(error, 'Erreur lors de la demande de réinitialisation du mot de passe');
        next(error);
      }
    });

    router.post('/reinitialiser-mot-de-passe', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const token = normalizeText(req.body?.token);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!token) {
          return res.status(400).json({
            error: 'RESET_TOKEN_REQUIRED',
            message: 'Lien de réinitialisation incomplet.',
          });
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          return res.status(400).json({
            error: 'PASSWORD_TOO_SHORT',
            message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
          });
        }

        const schema = await getSchema();
        const usersService = new UsersService({
          schema,
          accountability: { admin: true },
          knex: database,
        });

        try {
          await usersService.resetPassword(token, password);
        } catch (resetError) {
          return res.status(400).json({
            error: 'RESET_TOKEN_INVALID',
            message: 'Ce lien de réinitialisation est invalide ou a expiré.',
          });
        }

        return res.json({
          data: {
            reinitialise: true,
            message: 'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.',
          },
        });
      } catch (error) {
        logger.error(error, 'Erreur lors de la réinitialisation du mot de passe');
        next(error);
      }
    });

    router.get('/me', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const userId = safeUserId(req.accountability?.user);

        if (!userId) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Connectez-vous à votre espace investisseur.',
          });
        }

        const investor = await loadInvestorByUser(database, userId);

        if (!investor) {
          return res.status(403).json({
            error: 'NOT_INVESTOR_ACCOUNT',
            message: "Ce compte n'est pas associé à un profil investisseur.",
          });
        }

        const demandes = await loadInvestorRequests(database, investor.id);

        return res.json({
          data: {
            profil: {
              id: investor.id,
              prenom: investor.prenom,
              nom: investor.nom,
              email: investor.email,
              telephone: investor.telephone,
              entreprise: investor.entreprise,
              fonction: investor.fonction,
              pays: investor.pays,
              secteur: investor.secteur,
              province: investor.province,
              email_verifie_at: investor.email_verifie_at,
            },
            demandes,
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors de la lecture de l'espace investisseur");
        next(error);
      }
    });

    router.patch('/profil', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        const userId = safeUserId(req.accountability?.user);

        if (!userId) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Connectez-vous à votre espace investisseur.',
          });
        }

        const investor = await loadInvestorByUser(database, userId);

        if (!investor) {
          return res.status(403).json({
            error: 'NOT_INVESTOR_ACCOUNT',
            message: "Ce compte n'est pas associé à un profil investisseur.",
          });
        }

        const updates = {
          prenom: normalizeText(req.body?.prenom),
          nom: normalizeText(req.body?.nom),
          telephone: normalizeText(req.body?.telephone) || null,
          entreprise: normalizeText(req.body?.entreprise) || null,
          secteur: normalizeText(req.body?.secteur),
          province: normalizeText(req.body?.province),
        };

        if (!updates.prenom || !updates.nom || !updates.secteur || !updates.province) {
          return res.status(400).json({
            error: 'FIELDS_REQUIRED',
            message: 'Prénom, nom, secteur et province sont obligatoires.',
          });
        }

        if (!OFFICIAL_PROVINCES.has(updates.province)) {
          return res.status(400).json({
            error: 'INVALID_PROVINCE',
            message: 'La province sélectionnée n’est pas valide.',
          });
        }

        for (const [field, value] of Object.entries(updates)) {
          if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
            return res.status(400).json({
              error: 'FIELD_TOO_LONG',
              message: `Le champ ${field} dépasse ${MAX_TEXT_LENGTH} caractères.`,
            });
          }
        }

        await database('investisseurs')
          .where('id', investor.id)
          .update(updates);

        const schema = await getSchema();
        const usersService = new UsersService({
          schema,
          accountability: { admin: true },
        });

        await usersService.updateOne(userId, {
          first_name: updates.prenom,
          last_name: updates.nom,
        });

        return res.json({ data: { ...investor, ...updates } });
      } catch (error) {
        logger.error(error, 'Erreur lors de la mise à jour du profil investisseur');
        next(error);
      }
    });

    router.post('/demandes/:id/acces', async (req, res, next) => {
      try {
        const settings = await readSettings(database);
        if (!ensureAccountsEnabled(settings, res)) return;

        if (settings.mode_acces_business_plan === 'desactive') {
          return res.status(403).json({
            error: 'BUSINESS_PLAN_DISABLED',
            message: "L'accès aux Business Plans est actuellement désactivé.",
          });
        }

        const userId = safeUserId(req.accountability?.user);

        if (!userId) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Connectez-vous à votre espace investisseur.',
          });
        }

        const investor = await loadInvestorByUser(database, userId);

        if (!investor) {
          return res.status(403).json({
            error: 'NOT_INVESTOR_ACCOUNT',
            message: "Ce compte n'est pas associé à un profil investisseur.",
          });
        }

        const requestId = Number(req.params.id);

        if (!Number.isInteger(requestId) || requestId <= 0) {
          return res.status(400).json({
            error: 'INVALID_REQUEST_ID',
            message: 'Demande invalide.',
          });
        }

        const demande = await database('demandes_business_plan as d')
          .leftJoin('PROJETS as p', 'p.id', 'd.projet')
          .select([
            'd.id',
            'd.statut',
            'p.id as projet_id',
            'p.business_plan',
            'p.status_publication',
            'p.archived',
          ])
          .where('d.id', requestId)
          .andWhere('d.investisseur', investor.id)
          .first();

        if (!demande) {
          return res.status(404).json({
            error: 'REQUEST_NOT_FOUND',
            message: 'Cette demande est introuvable.',
          });
        }

        if (!['validee', 'telechargee'].includes(demande.statut)) {
          return res.status(403).json({
            error: 'REQUEST_NOT_VALIDATED',
            message: "Cette demande n'est pas encore autorisée au téléchargement.",
          });
        }

        if (
          demande.status_publication !== 'publie' ||
          demande.archived === true ||
          !demande.business_plan
        ) {
          return res.status(409).json({
            error: 'BUSINESS_PLAN_NOT_AVAILABLE',
            message: "Le Business Plan de ce projet n'est pas disponible.",
          });
        }

        const access = createAccessToken(env);

        await database('demandes_business_plan')
          .where('id', demande.id)
          .update({
            access_token_hash: access.tokenHash,
            access_expires_at: access.expiresAt,
          });

        return res.json({
          data: {
            acces_url: buildAccessUrl(env, access.rawToken),
            acces_expire_le: access.expiresAt,
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors de la génération d'un accès depuis l'espace investisseur");
        next(error);
      }
    });
  },
};
