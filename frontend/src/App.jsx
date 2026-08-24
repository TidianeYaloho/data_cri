import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import InvestorAccountModal from './components/InvestorAccountModal.jsx';
import CataloguePage from './pages/CataloguePage.jsx';
import ProjetDetailPage from './pages/ProjetDetailPage.jsx';
import {
  fetchInvestorAccount,
  fetchPlatformSettings,
  fetchPublishedProjects,
} from './api/directus.js';


function readInitialAccountAction() {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const verificationToken = url.searchParams.get('verify_email');
  const resetAction = url.searchParams.get('action');
  const resetToken = url.searchParams.get('token');

  if (verificationToken) {
    return { type: 'verify-email', token: verificationToken };
  }

  if (resetAction === 'reset-password' && resetToken) {
    return { type: 'reset-password', token: resetToken };
  }

  return null;
}

function removeAccountActionFromUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('verify_email');
  url.searchParams.delete('action');
  url.searchParams.delete('token');

  const query = url.searchParams.toString();
  const cleanUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
  window.history.replaceState({}, '', cleanUrl);
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [investorAccount, setInvestorAccount] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountAction, setAccountAction] = useState(() => readInitialAccountAction());
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('directus');
  const [loadError, setLoadError] = useState('');

  const refreshInvestorAccount = useCallback(async () => {
    try {
      const account = await fetchInvestorAccount();
      setInvestorAccount(account);
      return account;
    } catch (error) {
      if (error.code === 'INVESTOR_ACCOUNTS_DISABLED') {
        setInvestorAccount(null);
        return null;
      }

      throw error;
    }
  }, []);

  const refreshPlatformSettings = useCallback(async () => {
    const settings = await fetchPlatformSettings();
    setPlatformSettings(settings);

    if (!settings.comptes_investisseurs) {
      setInvestorAccount(null);
      setAccountOpen(false);
    }

    return settings;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadApplicationData() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await fetchPublishedProjects();

        if (!active) return;

        setProjects(data);
        setDataSource('directus');
      } catch (error) {
        if (!active) return;

        console.error('Erreur lors du chargement des projets :', error);
        setProjects([]);
        setDataSource('directus-error');
        setLoadError(
          "Impossible de charger les projets pour le moment. Vérifiez que Directus est bien démarré.",
        );
      }

      try {
        const settings = await fetchPlatformSettings();
        if (!active) return;

        setPlatformSettings(settings);

        if (settings.comptes_investisseurs && !accountAction) {
          try {
            const account = await fetchInvestorAccount();
            if (active) setInvestorAccount(account);
          } catch (error) {
            if (error.status !== 401) {
              console.error('Lecture de la session investisseur impossible :', error);
            }
          }
        }
      } catch (error) {
        if (!active) return;

        console.error(
          'Erreur lors du chargement des paramètres de la plateforme :',
          error,
        );

        setPlatformSettings(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplicationData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountAction) return;

    setInvestorAccount(null);
    setAccountOpen(true);
    removeAccountActionFromUrl();
  }, [accountAction]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshPlatformSettings().catch((error) => {
        console.error('Actualisation des paramètres impossible :', error);
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [refreshPlatformSettings]);

  function openProject(project) {
    setSelectedProject(project);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeProject() {
    setSelectedProject(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const accountsEnabled =
    platformSettings?.comptes_investisseurs === true;

  return (
    <div className="app-shell">
      <Header
        onHome={closeProject}
        accountsEnabled={accountsEnabled}
        investorAccount={investorAccount}
        onInvestorAccount={() => setAccountOpen(true)}
      />

      <main>
        {selectedProject ? (
          <ProjetDetailPage
            project={selectedProject}
            platformSettings={platformSettings}
            refreshPlatformSettings={refreshPlatformSettings}
            investorAccount={investorAccount}
            onRequireAccount={() => setAccountOpen(true)}
            onAccountExpired={() => setInvestorAccount(null)}
            onBack={closeProject}
          />
        ) : (
          <CataloguePage
            projects={projects}
            loading={loading}
            dataSource={dataSource}
            loadError={loadError}
            onOpenProject={openProject}
          />
        )}
      </main>

      <Footer />

      {accountsEnabled && accountOpen && (
        <InvestorAccountModal
          account={investorAccount}
          onAccountChange={setInvestorAccount}
          initialVerificationToken={
            accountAction?.type === 'verify-email' ? accountAction.token : null
          }
          initialResetToken={
            accountAction?.type === 'reset-password' ? accountAction.token : null
          }
          onClose={() => {
            setAccountOpen(false);
            setAccountAction(null);
          }}
          refreshAccount={refreshInvestorAccount}
        />
      )}
    </div>
  );
}
