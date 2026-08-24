const ALLOWED_ACCESS_MODES = new Set(['desactive', 'direct', 'validation']);

export default {
  id: 'parametres-publics',

  handler: (router, { database, logger }) => {
    router.get('/', async (_req, res, next) => {
      try {
        const parametres = await database('parametres_plateforme')
          .select([
            'comptes_investisseurs',
            'mode_acces_business_plan',
          ])
          .first();

        const rawMode = parametres?.mode_acces_business_plan;
        const mode = ALLOWED_ACCESS_MODES.has(rawMode)
          ? rawMode
          : 'validation';

        res.setHeader('Cache-Control', 'no-store');
        res.json({
          data: {
            comptes_investisseurs: Boolean(
              parametres?.comptes_investisseurs ?? false,
            ),
            mode_acces_business_plan: mode,
          },
        });
      } catch (error) {
        logger.error(error, 'Erreur lors de la lecture des paramètres publics');
        next(error);
      }
    });
  },
};
