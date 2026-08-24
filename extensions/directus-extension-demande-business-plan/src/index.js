import { createHash, randomBytes } from 'node:crypto';

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value) =>
  normalizeText(value).toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVESTOR_FIELD_MAX_LENGTH = 255;

function findOversizedInvestorField(investor) {
  for (const [field, value] of Object.entries(investor)) {
    if (typeof value === 'string' && value.length > INVESTOR_FIELD_MAX_LENGTH) {
      return field;
    }
  }

  return null;
}

function isDisabledMode(mode) {
  return mode === 'desactive';
}

function isImmediateMode(mode) {
  return mode === 'direct';
}

function getLinkTtlHours(env) {
  const parsed = Number(env.BUSINESS_PLAN_LINK_TTL_HOURS ?? 168);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 168;
  }

  return Math.min(parsed, 24 * 30);
}

function createAccessToken(env) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const ttlHours = getLinkTtlHours(env);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

function buildAccessUrl(env, rawToken) {
  const baseUrl = String(env.PUBLIC_URL || 'http://localhost:8055')
    .replace(/\/$/, '');

  return `${baseUrl}/business-plan-access/${rawToken}`;
}

export default {
  id: 'demande-business-plan',

  handler: (router, { database, logger, env }) => {
    router.post('/', async (req, res, next) => {
      try {
        const projectId = Number(req.body?.projectId);
        const sourceInvestor = req.body?.investor ?? {};

        if (!Number.isInteger(projectId) || projectId <= 0) {
          return res.status(400).json({
            error: 'PROJECT_REQUIRED',
            message: 'Le projet est obligatoire.',
          });
        }

        const settings = await database('parametres_plateforme')
          .select(['mode_acces_business_plan', 'comptes_investisseurs'])
          .first();

        const mode = settings?.mode_acces_business_plan ?? 'validation';
        const accountsEnabled = settings?.comptes_investisseurs === true;

        if (isDisabledMode(mode)) {
          return res.status(403).json({
            error: 'BUSINESS_PLAN_DISABLED',
            message: "L'accès au Business Plan est actuellement désactivé.",
          });
        }

        let investor = null;
        let accountInvestorId = null;

        if (accountsEnabled) {
          const userId =
            typeof req.accountability?.user === 'string'
              ? req.accountability.user
              : null;

          if (!userId) {
            return res.status(401).json({
              error: 'INVESTOR_ACCOUNT_REQUIRED',
              message: 'Connectez-vous à votre espace investisseur pour continuer.',
            });
          }

          const accountInvestor = await database('investisseurs')
            .select([
              'id',
              'prenom',
              'nom',
              'email',
              'telephone',
              'entreprise',
              'fonction',
              'pays',
            ])
            .where('directus_user', userId)
            .first();

          if (!accountInvestor) {
            return res.status(403).json({
              error: 'INVESTOR_ACCOUNT_NOT_LINKED',
              message: "Ce compte n'est pas associé à un profil investisseur.",
            });
          }

          investor = accountInvestor;
          accountInvestorId = accountInvestor.id;
        } else {
          investor = {
            prenom: normalizeText(sourceInvestor.prenom),
            nom: normalizeText(sourceInvestor.nom),
            email: normalizeEmail(sourceInvestor.email),
            telephone: normalizeText(sourceInvestor.telephone) || null,
            entreprise: normalizeText(sourceInvestor.entreprise) || null,
            fonction: normalizeText(sourceInvestor.fonction) || null,
            pays: normalizeText(sourceInvestor.pays),
          };

          if (!investor.prenom || !investor.nom || !investor.email || !investor.pays) {
            return res.status(400).json({
              error: 'INVESTOR_FIELDS_REQUIRED',
              message: 'Prénom, nom, e-mail et pays sont obligatoires.',
            });
          }

          const oversizedField = findOversizedInvestorField(investor);

          if (oversizedField) {
            return res.status(400).json({
              error: 'FIELD_TOO_LONG',
              message: `Le champ ${oversizedField} dépasse ${INVESTOR_FIELD_MAX_LENGTH} caractères.`,
            });
          }

          if (!EMAIL_PATTERN.test(investor.email)) {
            return res.status(400).json({
              error: 'INVALID_EMAIL',
              message: "L'adresse e-mail n'est pas valide.",
            });
          }
        }

        const project = await database('PROJETS')
          .select([
            'id',
            'titre',
            'status_publication',
            'archived',
            'business_plan',
          ])
          .where('id', projectId)
          .first();

        if (
          !project ||
          project.status_publication !== 'publie' ||
          project.archived === true
        ) {
          return res.status(404).json({
            error: 'PROJECT_NOT_AVAILABLE',
            message: "Ce projet n'est pas disponible publiquement.",
          });
        }

        if (isImmediateMode(mode) && !project.business_plan) {
          return res.status(409).json({
            error: 'BUSINESS_PLAN_NOT_AVAILABLE',
            message: "Le Business Plan de ce projet n'est pas encore disponible.",
          });
        }

        const now = new Date();

        const result = await database.transaction(async (trx) => {
          let investorId = accountInvestorId;

          if (!accountsEnabled) {
            const existingInvestor = await trx('investisseurs')
              .select(['id'])
              .whereRaw('LOWER("email") = ?', [investor.email])
              .first();

            if (existingInvestor) {
              investorId = existingInvestor.id;

              await trx('investisseurs')
                .where('id', investorId)
                .update({
                  prenom: investor.prenom,
                  nom: investor.nom,
                  telephone: investor.telephone,
                  entreprise: investor.entreprise,
                  fonction: investor.fonction,
                  pays: investor.pays,
                });
            } else {
              const insertedInvestors = await trx('investisseurs')
                .insert({
                  ...investor,
                  date_created: now,
                })
                .returning(['id']);

              investorId = insertedInvestors[0].id;
            }
          }

          const existingRequest = await trx('demandes_business_plan')
            .select(['id', 'statut', 'access_token_hash', 'access_expires_at'])
            .where({
              projet: projectId,
              investisseur: investorId,
            })
            .whereIn('statut', ['demandee', 'validee'])
            .orderBy('id', 'desc')
            .first();

          /*
           * En mode accès direct, une ancienne demande en attente ou validée
           * peut être réutilisée : on génère simplement un nouveau lien sûr.
           */
          if (existingRequest && isImmediateMode(mode)) {
            const access = createAccessToken(env);

            await trx('demandes_business_plan')
              .where('id', existingRequest.id)
              .update({
                statut: 'validee',
                access_token_hash: access.tokenHash,
                access_expires_at: access.expiresAt,
                date_decision: now,
                notification_email_statut: 'non_requis',
                notification_email_date: null,
                notification_email_erreur: null,
              });

            return {
              requestId: existingRequest.id,
              status: 'validee',
              duplicate: true,
              accessUrl: buildAccessUrl(env, access.rawToken),
              accessExpiresAt: access.expiresAt,
            };
          }

          const existingValidatedAccessIsActive =
            existingRequest?.statut === 'validee' &&
            Boolean(existingRequest.access_token_hash) &&
            Boolean(existingRequest.access_expires_at) &&
            new Date(existingRequest.access_expires_at).getTime() > Date.now();

          if (
            existingRequest?.statut === 'demandee' ||
            existingValidatedAccessIsActive
          ) {
            return {
              requestId: existingRequest.id,
              status: existingRequest.statut,
              duplicate: true,
              accessUrl: null,
              accessExpiresAt: existingRequest.access_expires_at ?? null,
            };
          }

          /*
           * Une ancienne demande validée dont le lien a expiré (ou qui a été
           * créée avant l'ajout des liens sécurisés) n'empêche pas une nouvelle
           * demande en mode validation.
           */

          if (isImmediateMode(mode)) {
            const access = createAccessToken(env);

            const insertedRequests = await trx('demandes_business_plan')
              .insert({
                projet: projectId,
                investisseur: investorId,
                statut: 'validee',
                date_created: now,
                date_decision: now,
                access_token_hash: access.tokenHash,
                access_expires_at: access.expiresAt,
                notification_email_statut: 'non_requis',
              })
              .returning(['id', 'statut']);

            return {
              requestId: insertedRequests[0].id,
              status: insertedRequests[0].statut,
              duplicate: false,
              accessUrl: buildAccessUrl(env, access.rawToken),
              accessExpiresAt: access.expiresAt,
            };
          }

          const insertedRequests = await trx('demandes_business_plan')
            .insert({
              projet: projectId,
              investisseur: investorId,
              statut: 'demandee',
              date_created: now,
              notification_email_statut: 'non_envoye',
            })
            .returning(['id', 'statut']);

          return {
            requestId: insertedRequests[0].id,
            status: insertedRequests[0].statut,
            duplicate: false,
            accessUrl: null,
            accessExpiresAt: null,
          };
        });

        return res.status(result.duplicate ? 200 : 201).json({
          data: {
            demande_id: result.requestId,
            statut: result.status,
            mode_acces_business_plan: mode,
            deja_existante: result.duplicate,
            acces_url: result.accessUrl,
            acces_expire_le: result.accessExpiresAt,
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors de la création d'une demande de Business Plan");
        next(error);
      }
    });
  },
};
