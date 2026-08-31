import { createHash } from 'node:crypto';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function isValidRawToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

const ALLOWED_BUSINESS_PLAN_MIME_TYPES = new Set(['application/pdf', 'text/html']);

export default {
  id: 'business-plan-access',

  handler: (router, { database, logger, services, getSchema }) => {
    const { AssetsService } = services;

    router.get('/:token', async (req, res, next) => {
      try {
        const rawToken = String(req.params.token || '').trim();

        if (!isValidRawToken(rawToken)) {
          return res.status(404).json({
            error: 'INVALID_ACCESS_LINK',
            message: "Ce lien d'accès n'est pas valide.",
          });
        }

        const settings = await database('parametres_plateforme')
          .select(['mode_acces_business_plan'])
          .first();

        if (settings?.mode_acces_business_plan === 'desactive') {
          return res.status(403).json({
            error: 'BUSINESS_PLAN_DISABLED',
            message: "L'accès aux Business Plans est actuellement désactivé.",
          });
        }

        const tokenHash = hashToken(rawToken);

        const demande = await database('demandes_business_plan as d')
          .leftJoin('PROJETS as p', 'p.id', 'd.projet')
          .select([
            'd.id as demande_id',
            'd.statut',
            'd.access_expires_at',
            'p.id as projet_id',
            'p.titre as projet_titre',
            'p.business_plan',
            'p.status_publication',
            'p.archived',
          ])
          .where('d.access_token_hash', tokenHash)
          .first();

        if (!demande) {
          return res.status(404).json({
            error: 'INVALID_ACCESS_LINK',
            message: "Ce lien d'accès n'est pas valide.",
          });
        }

        if (!['validee', 'telechargee'].includes(demande.statut)) {
          return res.status(403).json({
            error: 'REQUEST_NOT_VALIDATED',
            message: "Cette demande n'est pas validée.",
          });
        }

        if (
          !demande.access_expires_at ||
          new Date(demande.access_expires_at).getTime() <= Date.now()
        ) {
          return res.status(410).json({
            error: 'ACCESS_LINK_EXPIRED',
            message: "Ce lien d'accès a expiré. Contactez le CRI pour obtenir un nouvel accès.",
          });
        }

        if (
          demande.status_publication !== 'publie' ||
          demande.archived === true
        ) {
          return res.status(404).json({
            error: 'PROJECT_NOT_AVAILABLE',
            message: "Ce projet n'est plus disponible publiquement.",
          });
        }

        if (!demande.business_plan) {
          return res.status(404).json({
            error: 'BUSINESS_PLAN_NOT_AVAILABLE',
            message: "Le Business Plan n'est pas disponible pour ce projet.",
          });
        }

        const schema = await getSchema();
        const assetsService = new AssetsService({
          schema,
          knex: database,
          accountability: { admin: true },
        });

        const { stream, file, stat } = await assetsService.getAsset(
          demande.business_plan,
          {
            transformationParams: {},
            acceptFormat: undefined,
          },
          undefined,
          true,
        );

        const filename = file.filename_download || `business-plan-${demande.projet_id}`;

        if (!ALLOWED_BUSINESS_PLAN_MIME_TYPES.has(file.type)) {
          return res.status(415).json({
            error: 'BUSINESS_PLAN_FORMAT_NOT_ALLOWED',
            message: "Le Business Plan doit être un fichier PDF ou HTML.",
          });
        }

        res.attachment(filename);
        res.setHeader('Content-Type', file.type || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        res.setHeader('Referrer-Policy', 'no-referrer');

        const sourceStream = await stream();
        let responseFinished = false;

        /*
         * On marque la demande comme téléchargée uniquement lorsque la réponse
         * HTTP a été complètement envoyée, et non dès que le fichier a été lu
         * depuis le stockage.
         */
        res.on('finish', async () => {
          responseFinished = true;

          try {
            await database('demandes_business_plan')
              .where('id', demande.demande_id)
              .update({
                statut: 'telechargee',
                date_telechargement: new Date(),
              });
          } catch (error) {
            logger.error(
              error,
              `Le téléchargement a réussi mais le statut de la demande ${demande.demande_id} n'a pas pu être mis à jour`,
            );
          }
        });

        sourceStream.on('error', (error) => {
          logger.error(
            error,
            `Erreur pendant le téléchargement du Business Plan de la demande ${demande.demande_id}`,
          );

          if (!res.headersSent) {
            next(error);
          } else {
            res.end();
          }
        });

        res.on('close', () => {
          if (!responseFinished && !sourceStream.destroyed) {
            sourceStream.destroy();
          }
        });

        sourceStream.pipe(res);
      } catch (error) {
        logger.error(error, "Erreur lors de l'accès sécurisé à un Business Plan");
        if (!res.headersSent) next(error);
      }
    });
  },
};
