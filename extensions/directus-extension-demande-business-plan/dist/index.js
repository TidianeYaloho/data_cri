const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value) =>
  normalizeText(value).toLowerCase();

function isDisabledMode(mode) {
  return ['desactive', 'disabled', 'off'].includes(mode);
}

function isImmediateMode(mode) {
  return ['immediat', 'immediate', 'acces_immediat', 'identification'].includes(mode);
}

export default {
  id: 'demande-business-plan',

  handler: (router, { database, logger }) => {
    router.post('/', async (req, res, next) => {
      try {
        const projectId = req.body?.projectId;
        const sourceInvestor = req.body?.investor ?? {};

        const investor = {
          prenom: normalizeText(sourceInvestor.prenom),
          nom: normalizeText(sourceInvestor.nom),
          email: normalizeEmail(sourceInvestor.email),
          telephone: normalizeText(sourceInvestor.telephone) || null,
          entreprise: normalizeText(sourceInvestor.entreprise) || null,
          fonction: normalizeText(sourceInvestor.fonction) || null,
          pays: normalizeText(sourceInvestor.pays),
        };

        if (!projectId) {
          return res.status(400).json({
            error: 'PROJECT_REQUIRED',
            message: 'Le projet est obligatoire.',
          });
        }

        if (!investor.prenom || !investor.nom || !investor.email || !investor.pays) {
          return res.status(400).json({
            error: 'INVESTOR_FIELDS_REQUIRED',
            message: 'Prénom, nom, e-mail et pays sont obligatoires.',
          });
        }

        const settings = await database('parametres_plateforme')
          .select(['mode_acces_business_plan'])
          .first();

        const mode = settings?.mode_acces_business_plan ?? 'validation';

        if (isDisabledMode(mode)) {
          return res.status(403).json({
            error: 'BUSINESS_PLAN_DISABLED',
            message: "L'accès au Business Plan est actuellement désactivé.",
          });
        }

        const project = await database('PROJETS')
          .select(['id', 'titre', 'status_publication', 'archived'])
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

        const result = await database.transaction(async (trx) => {
          const existingInvestor = await trx('investisseurs')
            .select(['id'])
            .whereRaw('LOWER("email") = ?', [investor.email])
            .first();

          let investorId;

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
              .insert(investor)
              .returning(['id']);

            investorId = insertedInvestors[0].id;
          }

          const existingRequest = await trx('demandes_business_plan')
            .select(['id', 'statut'])
            .where({
              projet: projectId,
              investisseur: investorId,
            })
            .whereIn('statut', ['demandee', 'validee'])
            .orderBy('date_created', 'desc')
            .first();

          if (existingRequest) {
            return {
              requestId: existingRequest.id,
              status: existingRequest.statut,
              duplicate: true,
            };
          }

          const requestStatus = isImmediateMode(mode) ? 'validee' : 'demandee';

          const insertedRequests = await trx('demandes_business_plan')
            .insert({
              projet: projectId,
              investisseur: investorId,
              statut: requestStatus,
            })
            .returning(['id', 'statut']);

          return {
            requestId: insertedRequests[0].id,
            status: insertedRequests[0].statut,
            duplicate: false,
          };
        });

        return res.status(result.duplicate ? 200 : 201).json({
          data: {
            demande_id: result.requestId,
            statut: result.status,
            mode_acces_business_plan: mode,
            deja_existante: result.duplicate,
          },
        });
      } catch (error) {
        logger.error(error, "Erreur lors de la création d'une demande de Business Plan");
        next(error);
      }
    });
  },
};
