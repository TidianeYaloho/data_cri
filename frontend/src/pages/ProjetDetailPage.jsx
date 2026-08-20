import { useState } from 'react';
import { directusAssetUrl } from '../api/directus.js';
import RequestModal from '../components/RequestModal.jsx';
import SectorIcon from '../components/SectorIcon.jsx';

function formatMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'À préciser';
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return 'À préciser';
  }

  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(amount / 1_000_000)} M MAD`;
}

function label(value) {
  if (!value) return 'Non renseigné';

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1).replaceAll('_', ' ')
  );
}

function getAccessConfiguration(mode) {
  /*
   * MODE 1 :
   * accès au Business Plan désactivé
   */
  if (
    mode === 'desactive' ||
    mode === 'disabled' ||
    mode === 'off'
  ) {
    return {
      disabled: true,
      buttonLabel: 'Business Plan indisponible',
      message:
        "L'accès au Business Plan en ligne est actuellement désactivé.",
    };
  }

  /*
   * MODE 2 :
   * accès immédiat après identification
   */
  if (
    mode === 'immediat' ||
    mode === 'immediate' ||
    mode === 'acces_immediat' ||
    mode === 'identification'
  ) {
    return {
      disabled: false,
      buttonLabel: 'Accéder au Business Plan',
      message:
        'Identifiez-vous pour accéder au Business Plan.',
    };
  }

  /*
   * MODE 3 :
   * validation par un agent.
   *
   * C'est aussi le comportement de sécurité
   * par défaut si une valeur inconnue est reçue.
   */
  return {
    disabled: false,
    buttonLabel: 'Demander le Business Plan',
    message:
      'Soumettez une demande pour accéder au Business Plan après validation par le CRI.',
  };
}

export default function ProjetDetailPage({
  project,
  platformSettings,
  onBack,
}) {
  const [requestOpen, setRequestOpen] = useState(false);

  const imageUrl = directusAssetUrl(
    project.image_principale,
    {
      width: 1400,
      height: 760,
      fit: 'cover',
      quality: 86,
    },
  );

  const modeAcces =
    platformSettings?.mode_acces_business_plan ?? null;

  const comptesInvestisseurs =
    platformSettings?.comptes_investisseurs ?? false;

  const accessConfiguration =
    getAccessConfiguration(modeAcces);

  const settingsReady = platformSettings !== null;

  function handleBusinessPlanClick() {
    if (!settingsReady) return;
    if (accessConfiguration.disabled) return;

    setRequestOpen(true);
  }

  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <button
            className="back-link"
            type="button"
            onClick={onBack}
          >
            ← Retour aux projets
          </button>

          <div className="detail-hero-grid">
            <div className="detail-copy">
              <div className="detail-tags">
                <span>{label(project.secteur)}</span>

                <span>
                  {project.province ||
                    'Guelmim-Oued Noun'}
                </span>
              </div>

              <p className="project-detail-code">
                {project.code_projet || 'Projet CRI'}
              </p>

              <h1>{project.titre}</h1>

              <p>
                {project.description ||
                  'Description à compléter.'}
              </p>
            </div>

            <div
              className={`detail-visual sector-${project.secteur || 'service'
                }`}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <div className="detail-placeholder">
                  <SectorIcon
                    sector={project.secteur}
                    size={82}
                  />

                  <span>
                    {label(project.secteur)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="detail-body">
        <div className="container detail-layout">
          <div className="detail-main">
            <h2>Présentation du projet</h2>

            <p>
              {project.description ||
                'Les informations détaillées du projet seront complétées dans Directus.'}
            </p>

            <div className="detail-info-grid">
              <div>
                <span>Secteur</span>
                <strong>
                  {label(project.secteur)}
                </strong>
              </div>

              <div>
                <span>Filière</span>
                <strong>
                  {label(project.filiere)}
                </strong>
              </div>

              <div>
                <span>Province</span>
                <strong>
                  {project.province ||
                    'À préciser'}
                </strong>
              </div>

              <div>
                <span>Code projet</span>
                <strong>
                  {project.code_projet ||
                    'À préciser'}
                </strong>
              </div>
            </div>

            <div className="prototype-note">
              <strong>Prototype évolutif</strong>

              <p>
                Cette zone pourra recevoir les futurs
                champs demandés par le CRI : maturité,
                foncier, capacité, calendrier, besoins
                en ressources, partenaires, indicateurs
                financiers, etc.
              </p>
            </div>
          </div>

          <aside className="investment-card">
            <p className="eyebrow eyebrow-dark">
              Indicateurs clés
            </p>

            <div className="investment-stat">
              <span>Investissement estimé</span>

              <strong>
                {formatMoney(
                  project.investissement_mad,
                )}
              </strong>
            </div>

            <div className="investment-stat">
              <span>Nombre de postes</span>

              <strong>
                {project.nombre_postes ??
                  'À préciser'}
              </strong>
            </div>

            <hr />

            <h3>Intéressé par ce projet ?</h3>

            {!settingsReady ? (
              <p>
                Chargement des modalités d'accès au
                Business Plan...
              </p>
            ) : (
              <p>
                {accessConfiguration.message}
              </p>
            )}

            <button
              className="button button-primary button-block"
              type="button"
              disabled={
                !settingsReady ||
                accessConfiguration.disabled
              }
              onClick={handleBusinessPlanClick}
            >
              {settingsReady
                ? accessConfiguration.buttonLabel
                : 'Chargement...'}
            </button>
          </aside>
        </div>
      </section>

      {requestOpen && (
        <RequestModal
          project={project}
          modeAcces={modeAcces}
          comptesInvestisseurs={
            comptesInvestisseurs
          }
          onClose={() =>
            setRequestOpen(false)
          }
        />
      )}
    </>
  );
}