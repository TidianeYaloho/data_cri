import { useEffect, useMemo, useState } from 'react';
import { projectImageUrl } from '../api/directus.js';
import RequestModal from '../components/RequestModal.jsx';
import SectorIcon from '../components/SectorIcon.jsx';
import { projectProvinceLabel, projectTypeLabel } from '../utils/projectFields.js';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
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

  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

function getAccessConfiguration(mode, accountsEnabled, investorAccount) {
  if (mode === 'desactive') {
    return {
      disabled: true,
      buttonLabel: 'Business Plan indisponible',
      message: "L'accès au Business Plan en ligne est actuellement désactivé.",
    };
  }

  if (accountsEnabled && !investorAccount?.profil) {
    return {
      disabled: false,
      buttonLabel: 'Se connecter pour continuer',
      message:
        'Connectez-vous ou créez votre espace investisseur pour demander et suivre ce Business Plan.',
    };
  }

  if (mode === 'direct') {
    return {
      disabled: false,
      buttonLabel: 'Accéder au Business Plan',
      message: accountsEnabled
        ? 'Votre compte investisseur permet un accès immédiat et sécurisé au Business Plan.'
        : 'Identifiez-vous pour obtenir immédiatement un accès sécurisé au Business Plan.',
    };
  }

  return {
    disabled: false,
    buttonLabel: 'Demander le Business Plan',
    message: accountsEnabled
      ? 'Votre demande sera rattachée à votre espace investisseur et suivie après validation ou refus du CRI.'
      : 'Soumettez une demande. Le CRI vous informera par e-mail après validation ou refus.',
  };
}

export default function ProjetDetailPage({
  project,
  platformSettings,
  refreshPlatformSettings,
  investorAccount,
  onRequireAccount,
  onAccountExpired,
  onBack,
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [liveSettings, setLiveSettings] = useState(platformSettings);
  const [checkingSettings, setCheckingSettings] = useState(false);
  const [accessNotice, setAccessNotice] = useState('');

  useEffect(() => {
    setLiveSettings(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    if (
      requestOpen &&
      liveSettings?.mode_acces_business_plan === 'desactive'
    ) {
      setRequestOpen(false);
      setAccessNotice(
        "L'accès au Business Plan vient d'être désactivé par le CRI.",
      );
    }
  }, [liveSettings, requestOpen]);

  const imageUrl = project.has_image ? projectImageUrl(project.id) : '';

  const modeAcces = liveSettings?.mode_acces_business_plan ?? null;
  const comptesInvestisseurs = liveSettings?.comptes_investisseurs ?? false;

  const accessConfiguration = useMemo(
    () =>
      getAccessConfiguration(
        modeAcces,
        comptesInvestisseurs,
        investorAccount,
      ),
    [modeAcces, comptesInvestisseurs, investorAccount],
  );

  const settingsReady = liveSettings !== null;

  async function handleBusinessPlanClick() {
    if (checkingSettings) return;

    setCheckingSettings(true);
    setAccessNotice('');

    try {
      const freshSettings = await refreshPlatformSettings();
      setLiveSettings(freshSettings);

      const freshConfiguration = getAccessConfiguration(
        freshSettings.mode_acces_business_plan,
        freshSettings.comptes_investisseurs,
        investorAccount,
      );

      if (freshConfiguration.disabled) {
        setAccessNotice(
          "L'accès au Business Plan vient d'être désactivé par le CRI.",
        );
        return;
      }

      if (
        freshSettings.comptes_investisseurs &&
        !investorAccount?.profil
      ) {
        onRequireAccount();
        return;
      }

      setRequestOpen(true);
    } catch (error) {
      console.error(error);
      setAccessNotice(
        "Impossible de vérifier les modalités d'accès pour le moment. Réessayez dans quelques instants.",
      );
    } finally {
      setCheckingSettings(false);
    }
  }

  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <button className="back-link" type="button" onClick={onBack}>
            ← Retour aux projets
          </button>

          <div className="detail-hero-grid">
            <div className="detail-copy">
              <div className="detail-tags">
                <span>{label(project.secteur)}</span>
                <span>{projectProvinceLabel(project, 'Guelmim-Oued Noun')}</span>
                {projectTypeLabel(project.type_projet) && (
                  <span>{projectTypeLabel(project.type_projet)}</span>
                )}
              </div>

              <p className="project-detail-code">
                {project.code_projet || 'Projet CRI'}
              </p>

              <h1>{project.titre}</h1>

              <p>{project.description || 'Description à compléter.'}</p>
            </div>

            <div className={`detail-visual sector-${project.secteur || 'service'}`}>
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <div className="detail-placeholder">
                  <SectorIcon sector={project.secteur} size={82} />
                  <span>{label(project.secteur)}</span>
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
                'Les informations détaillées du projet seront complétées par le CRI.'}
            </p>

            <div className="detail-info-grid">
              <div>
                <span>Secteur</span>
                <strong>{label(project.secteur)}</strong>
              </div>

              <div>
                <span>Filière</span>
                <strong>{label(project.filiere)}</strong>
              </div>

              <div>
                <span>Province</span>
                <strong>{projectProvinceLabel(project)}</strong>
              </div>

              <div>
                <span>Code projet</span>
                <strong>{project.code_projet || 'À préciser'}</strong>
              </div>
            </div>
          </div>

          <aside className="investment-card">
            <p className="eyebrow eyebrow-dark">Indicateurs clés</p>

            <div className="investment-stat">
              <span>Investissement estimé</span>
              <strong>{formatMoney(project.investissement_mad)}</strong>
            </div>

            <div className="investment-stat">
              <span>Nombre d'emplois</span>
              <strong>{project.nombre_postes ?? 'À préciser'}</strong>
            </div>

            <hr />

            <h3>Intéressé par ce projet ?</h3>

            {!settingsReady ? (
              <p>Chargement des modalités d'accès au Business Plan...</p>
            ) : (
              <p>{accessConfiguration.message}</p>
            )}

            {accessNotice && (
              <div className="form-message form-message-error access-notice">
                {accessNotice}
              </div>
            )}

            <button
              className="button button-primary button-block"
              type="button"
              disabled={
                !settingsReady ||
                checkingSettings ||
                accessConfiguration.disabled
              }
              onClick={handleBusinessPlanClick}
            >
              {checkingSettings
                ? 'Vérification...'
                : settingsReady
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
          comptesInvestisseurs={comptesInvestisseurs}
          investorAccount={investorAccount}
          onAccountExpired={() => {
            onAccountExpired();
            setRequestOpen(false);
            onRequireAccount();
          }}
          onClose={() => setRequestOpen(false)}
        />
      )}
    </>
  );
}
