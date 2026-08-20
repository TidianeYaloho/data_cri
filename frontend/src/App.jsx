import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import CataloguePage from './pages/CataloguePage.jsx';
import ProjetDetailPage from './pages/ProjetDetailPage.jsx';
import { fetchPublishedProjects } from './api/directus.js';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('directus');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await fetchPublishedProjects();

        if (!active) return;

        setProjects(data);
        setDataSource('directus');
      } catch (error) {
        if (!active) return;

        console.error(
          'Erreur lors du chargement des projets depuis Directus :',
          error,
        );

        setProjects([]);
        setDataSource('directus-error');

        setLoadError(
          "Impossible de charger les projets pour le moment. Vérifiez que Directus est bien démarré.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, []);

  function openProject(project) {
    setSelectedProject(project);
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function closeProject() {
    setSelectedProject(null);
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  return (
    <div className="app-shell">
      <Header onHome={closeProject} />

      <main>
        {selectedProject ? (
          <ProjetDetailPage
            project={selectedProject}
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
    </div>
  );
}