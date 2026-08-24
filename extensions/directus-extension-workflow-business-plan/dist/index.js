import { createHash, randomBytes } from 'node:crypto';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
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
    ttlHours,
  };
}

function buildAccessUrl(env, rawToken) {
  const baseUrl = String(env.PUBLIC_URL || 'http://localhost:8055')
    .replace(/\/$/, '');

  return `${baseUrl}/business-plan-access/${rawToken}`;
}

function fullName(row) {
  return [row.prenom, row.nom].filter(Boolean).join(' ').trim() || 'Investisseur';
}

async function loadRequest(database, requestId) {
  return database('demandes_business_plan as d')
    .leftJoin('investisseurs as i', 'i.id', 'd.investisseur')
    .leftJoin('PROJETS as p', 'p.id', 'd.projet')
    .select([
      'd.id',
      'd.statut',
      'd.access_token_hash',
      'd.access_expires_at',
      'i.prenom',
      'i.nom',
      'i.email',
      'p.id as projet_id',
      'p.titre as projet_titre',
      'p.business_plan',
      'p.status_publication',
      'p.archived',
    ])
    .where('d.id', requestId)
    .first();
}

export default ({ filter, action }, { services, env, logger }) => {
  const { MailService } = services;

  /*
   * Garde-fou AVANT la sauvegarde de l'agent.
   * Une demande ne peut pas être validée si elle ne peut pas réellement
   * déboucher sur un Business Plan téléchargeable.
   */
  filter(
    'demandes_business_plan.items.update',
    async (payload, meta, context) => {
      if (payload?.statut !== 'validee') return payload;

      const keys = asArray(meta?.keys);
      if (!keys.length) return payload;

      const settings = await context.database('parametres_plateforme')
        .select(['mode_acces_business_plan'])
        .first();

      if (settings?.mode_acces_business_plan === 'desactive') {
        throw new Error(
          "Impossible de valider la demande : l'accès aux Business Plans est désactivé dans les paramètres de la plateforme.",
        );
      }

      const rows = await context.database('demandes_business_plan as d')
        .leftJoin('PROJETS as p', 'p.id', 'd.projet')
        .select([
          'd.id',
          'p.business_plan',
          'p.status_publication',
          'p.archived',
        ])
        .whereIn('d.id', keys);

      for (const row of rows) {
        if (!row.business_plan) {
          throw new Error(
            `Impossible de valider la demande ${row.id} : aucun Business Plan n'est associé au projet.`,
          );
        }

        if (row.status_publication !== 'publie' || row.archived === true) {
          throw new Error(
            `Impossible de valider la demande ${row.id} : le projet n'est pas publié ou est archivé.`,
          );
        }
      }

      return payload;
    },
  );

  /*
   * Automatisation APRÈS la décision de l'agent.
   */
  action(
    'demandes_business_plan.items.update',
    async ({ keys, payload }, context) => {
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'statut')) {
        return;
      }

      const requestIds = asArray(keys);
      if (!requestIds.length) return;

      for (const requestId of requestIds) {
        try {
          const demande = await loadRequest(context.database, requestId);
          if (!demande) continue;

          if (payload.statut === 'demandee') {
            await context.database('demandes_business_plan')
              .where('id', requestId)
              .update({
                access_token_hash: null,
                access_expires_at: null,
                date_decision: null,
                date_telechargement: null,
                notification_email_statut: 'non_envoye',
                notification_email_date: null,
                notification_email_erreur: null,
              });

            continue;
          }

          if (payload.statut === 'validee') {
            const access = createAccessToken(env);
            const accessUrl = buildAccessUrl(env, access.rawToken);
            const now = new Date();

            await context.database('demandes_business_plan')
              .where('id', requestId)
              .update({
                access_token_hash: access.tokenHash,
                access_expires_at: access.expiresAt,
                date_decision: now,
                date_telechargement: null,
                notification_email_statut: 'non_envoye',
                notification_email_date: null,
                notification_email_erreur: null,
              });

            const mailService = new MailService({
              schema: context.schema,
              knex: context.database,
            });

            try {
              await mailService.send({
                to: demande.email,
                from: env.EMAIL_FROM || 'no-reply@cri.local',
                subject: `Accès validé au Business Plan - ${demande.projet_titre}`,
                text: [
                  `Bonjour ${fullName(demande)},`,
                  '',
                  `Votre demande d'accès au Business Plan du projet « ${demande.projet_titre} » a été validée par le CRI.`,
                  '',
                  'Vous pouvez télécharger le document à partir du lien sécurisé suivant :',
                  accessUrl,
                  '',
                  `Ce lien est valable pendant ${access.ttlHours} heure(s).`,
                  "Ne transmettez pas ce lien à une autre personne.",
                  '',
                  `Contact CRI : ${env.CRI_CONTACT_EMAIL || 'contact@cri.local'}`,
                ].join('\n'),
              });

              await context.database('demandes_business_plan')
                .where('id', requestId)
                .update({
                  notification_email_statut: 'envoye',
                  notification_email_date: new Date(),
                  notification_email_erreur: null,
                });
            } catch (emailError) {
              logger.error(
                emailError,
                `Échec d'envoi de l'e-mail de validation pour la demande ${requestId}`,
              );

              await context.database('demandes_business_plan')
                .where('id', requestId)
                .update({
                  notification_email_statut: 'erreur',
                  notification_email_date: null,
                  notification_email_erreur: String(emailError?.message || emailError).slice(0, 2000),
                });
            }

            continue;
          }

          if (payload.statut === 'refusee') {
            const now = new Date();

            await context.database('demandes_business_plan')
              .where('id', requestId)
              .update({
                access_token_hash: null,
                access_expires_at: null,
                date_decision: now,
                notification_email_statut: 'non_envoye',
                notification_email_date: null,
                notification_email_erreur: null,
              });

            const mailService = new MailService({
              schema: context.schema,
              knex: context.database,
            });

            try {
              await mailService.send({
                to: demande.email,
                from: env.EMAIL_FROM || 'no-reply@cri.local',
                subject: `Réponse à votre demande de Business Plan - ${demande.projet_titre}`,
                text: [
                  `Bonjour ${fullName(demande)},`,
                  '',
                  `Votre demande d'accès au Business Plan du projet « ${demande.projet_titre} » n'a pas été validée.`,
                  '',
                  'Pour toute précision, vous pouvez contacter le CRI.',
                  `Contact CRI : ${env.CRI_CONTACT_EMAIL || 'contact@cri.local'}`,
                ].join('\n'),
              });

              await context.database('demandes_business_plan')
                .where('id', requestId)
                .update({
                  notification_email_statut: 'envoye',
                  notification_email_date: new Date(),
                  notification_email_erreur: null,
                });
            } catch (emailError) {
              logger.error(
                emailError,
                `Échec d'envoi de l'e-mail de refus pour la demande ${requestId}`,
              );

              await context.database('demandes_business_plan')
                .where('id', requestId)
                .update({
                  notification_email_statut: 'erreur',
                  notification_email_date: null,
                  notification_email_erreur: String(emailError?.message || emailError).slice(0, 2000),
                });
            }

            continue;
          }

          if (payload.statut === 'telechargee') {
            await context.database('demandes_business_plan')
              .where('id', requestId)
              .whereNull('date_telechargement')
              .update({ date_telechargement: new Date() });
          }
        } catch (error) {
          logger.error(
            error,
            `Erreur dans le workflow de la demande Business Plan ${requestId}`,
          );
        }
      }
    },
  );
};
