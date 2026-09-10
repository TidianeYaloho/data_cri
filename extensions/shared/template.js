/**
 * Rendu d'un gabarit de texte avec remplacement récursif des variables {{variable}}.
 *
 * Fonctionnalités :
 * - Résolution multi-passes (jusqu'à maxPasses, 5 par défaut) pour supporter les variables imbriquées
 *   (ex : {{signature}} contenant {{nom_contact}} et {{email_contact}}).
 * - Arrêt anticipé dès que le texte est stabilisé.
 * - Protection stricte contre les boucles infinies et références circulaires.
 * - Préservation des variables inconnues dans le résultat final, avec avertissement console unique.
 * - Gestion sécurisée des types (chaînes, nombres, valeurs null/undefined, objets inexistants).
 *
 * @param {string} template - Texte ou template contenant les balises {{variable}}.
 * @param {Record<string, unknown>} [data={}] - Dictionnaire des variables de remplacement.
 * @param {number} [maxPasses=5] - Nombre maximal de passes de substitution.
 * @returns {string} - Texte final après substitution des variables.
 */
export function renderTemplate(template, data = {}, maxPasses = 5) {
  if (typeof template !== 'string') return '';
  if (!data || typeof data !== 'object') return template;

  let result = template;
  const warned = new Set();

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let hasReplaced = false;

    const next = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const val = data[key];
        if (val !== undefined && val !== null) {
          hasReplaced = true;
          return String(val);
        }
      }

      if (!warned.has(key)) {
        console.warn(`[renderTemplate] Variable inconnue ou non définie dans le template : {{${key}}}`);
        warned.add(key);
      }

      return match;
    });

    if (!hasReplaced || next === result) {
      break;
    }

    result = next;
  }

  return result;
}

/**
 * Rendu complet d'un corps d'e-mail avec injection automatique de la signature.
 *
 * Comportement :
 * - Si le template contient {{signature}}, la variable est résolue comme toute autre variable
 *   via renderTemplate (résolution multi-passes, variables imbriquées supportées).
 * - Si le template ne contient PAS {{signature}} et qu'une signature non vide est fournie,
 *   elle est automatiquement ajoutée à la fin, séparée par une ligne vide.
 * - Si aucune signature n'est fournie, le corps est rendu tel quel.
 *
 * Exemples :
 *   Cas A (pas de {{signature}} dans le template) :
 *     template = "Bonjour {{prenom}}.\n\nVotre demande a été validée."
 *     signature = "Cordialement,\n{{nom_contact}}\n{{email_contact}}"
 *     → "Bonjour Tidiane.\n\nVotre demande a été validée.\n\nCordialement,\nContact CRI\ncontact@cri.ma"
 *
 *   Cas B ({{signature}} présent dans le template) :
 *     template = "Bonjour {{prenom}}.\n\n{{signature}}"
 *     signature = "Cordialement,\n{{nom_contact}}"
 *     → "Bonjour Tidiane.\n\nCordialement,\nContact CRI"
 *
 *   Cas C (aucune signature configurée) :
 *     template = "Bonjour {{prenom}}.\n\nVotre demande a été validée."
 *     signature = ""
 *     → "Bonjour Tidiane.\n\nVotre demande a été validée."
 *
 * @param {string} template - Corps d'e-mail pouvant contenir des balises {{variable}}.
 * @param {Record<string, unknown>} variables - Variables de remplacement (sans 'signature').
 * @param {string} [signature=''] - Valeur de la signature (peut elle-même contenir des {{variable}}).
 * @returns {string} - Corps final rendu.
 */
export function renderEmailBody(template, variables = {}, signature = '') {
  const sig = typeof signature === 'string' ? signature.trim() : '';
  const hasSignaturePlaceholder = /\{\{\s*signature\s*\}\}/.test(template);

  // On injecte toujours 'signature' dans les variables pour que renderTemplate
  // puisse la résoudre si {{signature}} est présent dans le template ou dans
  // d'autres variables (ex : une valeur qui contiendrait {{signature}}).
  const data = { ...variables, signature: sig };

  if (!hasSignaturePlaceholder && sig) {
    // Cas A : pas de {{signature}} dans le template → on l'ajoute à la fin.
    return renderTemplate(`${template}\n\n{{signature}}`, data);
  }

  // Cas B : {{signature}} est déjà dans le template → résolution normale.
  // Cas C : pas de signature → rien à ajouter.
  return renderTemplate(template, data);
}

/**
 * Construit l'en-tête "From" d'un e-mail transactionnel CRI en combinant le nom d'expéditeur
 * configurable depuis Directus et l'adresse technique issue de l'environnement (EMAIL_FROM).
 *
 * Format attendu : "CRI Guelmim-Oued Noun <tiddomb@gmail.com>"
 *
 * @param {Record<string, any>} [env={}] - Variables d'environnement Directus (EMAIL_FROM).
 * @param {Record<string, any> | null} [settings=null] - Enregistrement de parametres_plateforme.
 * @returns {string} - Chaîne formatée "Nom <email>".
 */
export function buildFromHeader(env = {}, settings = null) {
  const senderName = (settings?.email_nom_expediteur || '').trim() || 'CRI Guelmim-Oued Noun';
  const rawEmail = (env?.EMAIL_FROM || 'no-reply@cri.local').trim();
  const cleanEmail = rawEmail.replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim() || 'no-reply@cri.local';
  const cleanName = senderName.replace(/[<>"\r\n]/g, '').trim() || 'CRI Guelmim-Oued Noun';
  return { name: cleanName, address: cleanEmail };
}

export default { renderTemplate, renderEmailBody, buildFromHeader };
