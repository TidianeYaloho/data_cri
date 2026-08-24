function safeFilename(value, fallback = 'image') {
  return String(value || fallback)
    .replace(/[\r\n"]/g, '')
    .slice(0, 180);
}

export default {
  id: 'projets-publics',

  handler: (router, { database, logger, services, getSchema }) => {
    const { AssetsService } = services;

    router.get('/', async (_req, res, next) => {
      try {
        const projets = await database('PROJETS')
          .select([
            'id',
            'code_projet',
            'titre',
            'secteur',
            'filiere',
            'description',
            'province',
            'investissement_mad',
            'nombre_postes',
            'status_publication',
            'image_principale',
          ])
          .where('status_publication', 'publie')
          .andWhere(function () {
            this.whereNull('archived').orWhere('archived', false);
          })
          .orderBy('date_created', 'desc');

        const publicProjects = projets.map(({ image_principale, ...projet }) => ({
          ...projet,
          has_image: Boolean(image_principale),
        }));

        res.setHeader('Cache-Control', 'no-store');
        res.json({ data: publicProjects });
      } catch (error) {
        logger.error(error, 'Erreur lors de la lecture des projets publics');
        next(error);
      }
    });

    /*
     * Les images de projets passent par cette route publique contrôlée.
     * Le UUID Directus du fichier n'est donc plus exposé dans le catalogue,
     * et il n'est pas nécessaire d'ouvrir la collection directus_files au public.
     */
    router.get('/:id/image', async (req, res, next) => {
      try {
        const projectId = Number(req.params.id);

        if (!Number.isInteger(projectId) || projectId <= 0) {
          return res.status(404).json({
            error: 'PROJECT_NOT_FOUND',
            message: 'Projet introuvable.',
          });
        }

        const projet = await database('PROJETS')
          .select([
            'id',
            'image_principale',
            'status_publication',
            'archived',
          ])
          .where('id', projectId)
          .first();

        if (
          !projet ||
          projet.status_publication !== 'publie' ||
          projet.archived === true ||
          !projet.image_principale
        ) {
          return res.status(404).end();
        }

        const schema = await getSchema();
        const assetsService = new AssetsService({
          schema,
          knex: database,
          accountability: { admin: true },
        });

        const { stream, file, stat } = await assetsService.getAsset(
          projet.image_principale,
          {
            transformationParams: {},
            acceptFormat: undefined,
          },
          undefined,
          true,
        );

        res.setHeader('Content-Type', file.type || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${safeFilename(file.filename_download, 'image')}"`,
        );

        const sourceStream = await stream();
        let responseFinished = false;

        res.on('finish', () => {
          responseFinished = true;
        });

        sourceStream.on('error', (error) => {
          logger.error(error, `Erreur de diffusion de l'image du projet ${projectId}`);
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
        logger.error(error, "Erreur lors de l'accès à une image publique de projet");
        if (!res.headersSent) next(error);
      }
    });
  },
};
