export default {
  id: 'projets-publics',

  handler: (router, { database, logger }) => {
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
            'image_principale',
            'status_publication'
          ])
          .where('status_publication', 'publie')
          .andWhere(function () {
            this.whereNull('archived').orWhere('archived', false);
          })
          .orderBy('date_created', 'desc');

        res.json({ data: projets });
      } catch (error) {
        logger.error(error, 'Erreur lors de la lecture des projets publics');
        next(error);
      }
    });
  }
};
