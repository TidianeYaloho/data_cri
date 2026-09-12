import { createHash, randomBytes } from 'node:crypto';
import { renderTemplate, renderEmailBody, renderEmailHtml, buildFromHeader } from '../../shared/template.js';
import { InvalidPayloadError } from '@directus/errors';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function getLinkTtlHours(env, settings) {
  let parsed = null;
  if (settings && settings.duree_validite_lien_heures !== null && settings.duree_validite_lien_heures !== undefined) {
    const fromSettings = Number(settings.duree_validite_lien_heures);
    if (Number.isFinite(fromSettings) && fromSettings > 0) {
      parsed = fromSettings;
    }
  }

  if (parsed === null) {
    const fromEnv = Number(env.BUSINESS_PLAN_LINK_TTL_HOURS ?? 168);
    if (Number.isFinite(fromEnv) && fromEnv > 0) {
      parsed = fromEnv;
    } else {
      parsed = 168;
    }
  }

  return Math.min(parsed, 24 * 30);
}

function createAccessToken(env, settings) {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const ttlHours = getLinkTtlHours(env, settings);
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
   * Sécurisation lors de la création manuelle d'une demande via l'API/UI Directus.
   * Le statut initial doit être obligatoirement "demandee".
   */
  filter(
    'demandes_business_plan.items.create',
    async (payload) => {
      if (payload?.statut && payload.statut !== 'demandee') {
        throw new InvalidPayloadError({
          reason: 'Toute nouvelle demande créée manuellement doit recevoir le statut "Demandée".'
        });
      }
      if (payload) {
        payload.statut = 'demandee';
      }
      return payload;
    }
  );

  /*
   * Garde-fou et sécurisation stricte de la matrice des transitions de statut.
   *
   * RÈGLES DES TRANSITIONS MANELLES (UPDATE) :
   * - Depuis 'demandee'   : 'validee' (autorisé) ou 'refusee' (autorisé).
   * - Depuis 'validee'    : aucune modification manuelle de statut autorisée.
   * - Depuis 'refusee'    : aucune modification manuelle de statut autorisée.
   * - Depuis 'telechargee': aucune modification manuelle de statut autorisée.
   *
   * Les mises à jour d'autres champs sans modification de 'statut' restent autorisées.
   */
  filter(
    'demandes_business_plan.items.update',
    async (payload, meta, context) => {
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'statut')) {
        return payload;
      }

      const targetStatut = payload.statut;

      // 1. Contrôles de la valeur cible
      if (targetStatut === 'telechargee') {
        throw new InvalidPayloadError({
          reason: 'Le statut "Téléchargée" est attribué automatiquement après un téléchargement réel du Business Plan.'
        });
      }

      if (targetStatut === 'demandee') {
        throw new InvalidPayloadError({
          reason: 'Le statut "Demandée" est attribué automatiquement à la création. Seuls les statuts "Validée" et "Refusée" peuvent être sélectionnés.'
        });
      }

      if (!['validee', 'refusee'].includes(targetStatut)) {
        throw new InvalidPayloadError({
          reason: `Statut "${targetStatut}" non autorisé. Seules les décisions "Validée" et "Refusée" sont autorisées.`
        });
      }

      const keys = asArray(meta?.keys);
      if (!keys.length) return payload;

      // 2. Vérification de l'état actuel en base de données et application stricte de la matrice
      const existingDemandes = await context.database('demandes_business_plan as d')
        .leftJoin('PROJETS as p', 'p.id', 'd.projet')
        .select([
          'd.id',
          'd.statut',
          'p.business_plan',
          'p.status_publication',
          'p.archived',
        ])
        .whereIn('d.id', keys);

      for (const row of existingDemandes) {
        const currentStatut = row.statut;

        // Si l'état actuel est déjà validee, refusee ou telechargee -> aucune modification manuelle de statut
        if (currentStatut === 'validee') {
          throw new InvalidPayloadError({
            reason: `La demande #${row.id} a déjà été validée. Son statut ne peut plus être modifié manuellement.`
          });
        }

        if (currentStatut === 'refusee') {
          throw new InvalidPayloadError({
            reason: `La demande #${row.id} a déjà été refusée. Son statut ne peut plus être modifié manuellement.`
          });
        }

        if (currentStatut === 'telechargee') {
          throw new InvalidPayloadError({
            reason: `La demande #${row.id} a déjà été téléchargée. Son statut ne peut plus être modifié.`
          });
        }

        if (currentStatut !== 'demandee') {
          throw new InvalidPayloadError({
            reason: `Le statut actuel ("${currentStatut}") de la demande #${row.id} ne permet pas cette modification.`
          });
        }

        // L'état actuel est 'demandee'. Si passage à 'validee', vérifier les prérequis du projet
        if (targetStatut === 'validee') {
          const settings = await context.database('parametres_plateforme')
            .select(['mode_acces_business_plan'])
            .first();

          if (settings?.mode_acces_business_plan === 'desactive') {
            throw new InvalidPayloadError({
              reason: "Impossible de valider la demande : l'accès aux Business Plans est désactivé dans les paramètres de la plateforme."
            });
          }

          if (!row.business_plan) {
            throw new InvalidPayloadError({
              reason: `Impossible de valider la demande #${row.id} : aucun Business Plan n'est associé au projet.`
            });
          }

          if (row.status_publication !== 'publie' || row.archived === true) {
            throw new InvalidPayloadError({
              reason: `Impossible de valider la demande #${row.id} : le projet n'est pas publié ou est archivé.`
            });
          }
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

      const settings = await context.database('parametres_plateforme').first();

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
            const access = createAccessToken(env, settings);
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

            const templateData = {
              prenom: demande.prenom || '',
              nom: demande.nom || '',
              nom_complet: fullName(demande),
              titre_projet: demande.projet_titre || '',
              projet_titre: demande.projet_titre || '',
              code_projet: demande.projet_id ? String(demande.projet_id) : '',
              lien_telechargement: accessUrl,
              duree_validite_heures: String(access.ttlHours),
              nom_contact: settings?.email_nom_contact || 'Contact CRI',
              email_contact: settings?.email_adresse_contact || env.CRI_CONTACT_EMAIL || 'contact@cri.local',
              email_contact_cri: settings?.email_adresse_contact || env.CRI_CONTACT_EMAIL || 'contact@cri.local',
            };

            const signatureValidation = settings?.email_signature || '';

            const defaultSubject = `Accès validé au Business Plan - ${demande.projet_titre}`;
            // Corps par défaut : renderEmailBody injectera la signature (Cas A si non vide)
            const defaultBodyTemplate = [
              `Bonjour {{nom_complet}},`,
              '',
              `Votre demande d'accès au Business Plan du projet « {{titre_projet}} » a été validée par le CRI.`,
              '',
              'Vous pouvez télécharger le document à partir du lien sécurisé suivant :',
              '{{lien_telechargement}}',
              '',
              `Ce lien est valable pendant {{duree_validite_heures}} heure(s).`,
              "Ne transmettez pas ce lien à une autre personne.",
            ].join('\n');

            const validationSubjectTpl =
              settings?.email_validation_bp_objet?.trim() ||
              settings?.email_bp_validation_objet?.trim();

            const validationBodyTpl =
              settings?.email_validation_bp_message?.trim() ||
              settings?.email_bp_validation_corps?.trim();

            const subject = validationSubjectTpl
              ? renderTemplate(validationSubjectTpl, templateData)
              : defaultSubject;

            const text = validationBodyTpl
              ? renderEmailBody(validationBodyTpl, templateData, signatureValidation)
              : renderEmailBody(defaultBodyTemplate, templateData, signatureValidation);

            const html = renderEmailHtml(text, [
              {
                url: accessUrl,
                label: 'Télécharger le Business Plan',
              },
            ]);

            try {
              await mailService.send({
                to: demande.email,
                from: buildFromHeader(env, settings),
                subject,
                text,
                html,
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

            const templateData = {
              prenom: demande.prenom || '',
              nom: demande.nom || '',
              nom_complet: fullName(demande),
              titre_projet: demande.projet_titre || '',
              projet_titre: demande.projet_titre || '',
              code_projet: demande.projet_id ? String(demande.projet_id) : '',
              nom_contact: settings?.email_nom_contact || 'Contact CRI',
              email_contact: settings?.email_adresse_contact || env.CRI_CONTACT_EMAIL || 'contact@cri.local',
              email_contact_cri: settings?.email_adresse_contact || env.CRI_CONTACT_EMAIL || 'contact@cri.local',
            };

            const signatureRefus = settings?.email_signature || '';

            const defaultSubject = `Réponse à votre demande de Business Plan - ${demande.projet_titre}`;
            // Corps par défaut : renderEmailBody injectera la signature (Cas A si non vide)
            const defaultBodyTemplate = [
              `Bonjour {{nom_complet}},`,
              '',
              `Votre demande d'accès au Business Plan du projet « {{titre_projet}} » n'a pas été validée.`,
              '',
              'Pour toute précision, vous pouvez contacter le CRI.',
            ].join('\n');

            const refusSubjectTpl =
              settings?.email_refus_bp_objet?.trim() ||
              settings?.email_bp_refus_objet?.trim();

            const refusBodyTpl =
              settings?.email_refus_bp_message?.trim() ||
              settings?.email_bp_refus_corps?.trim();

            const subject = refusSubjectTpl
              ? renderTemplate(refusSubjectTpl, templateData)
              : defaultSubject;

            const text = refusBodyTpl
              ? renderEmailBody(refusBodyTpl, templateData, signatureRefus)
              : renderEmailBody(defaultBodyTemplate, templateData, signatureRefus);

            try {
              await mailService.send({
                to: demande.email,
                from: buildFromHeader(env, settings),
                subject,
                text,
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
