export default {
  id: 'parametres-publics',

  handler: (router, { database, logger }) => {
    router.get('/', async (_req, res, next) => {
      try {
        const parametres = await database('parametres_plateforme')
          .select([
            'comptes_investisseurs',
            'mode_acces_business_plan'
          ])
          .first();

        res.json({
          data: parametres || {
            comptes_investisseurs: false,
            mode_acces_business_plan: 'validation'
          }
        });
      } catch (error) {
        logger.error(error, 'Erreur lors de la lecture des paramètres publics');
        next(error);
      }
    });
  }
};
