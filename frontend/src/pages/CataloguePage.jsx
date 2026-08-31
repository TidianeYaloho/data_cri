import { useMemo, useState } from 'react';
import Hero from '../components/Hero.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import { OFFICIAL_PROVINCES, projectProvinces } from '../utils/projectFields.js';

function normalizedText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function CataloguePage({ projects, loading, dataSource, loadError, onOpenProject }) {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [province, setProvince] = useState('');

  const sectors = useMemo(
    () => [...new Set(projects.map((project) => project.secteur).filter(Boolean))].sort(),
    [projects],
  );

  const provinces = OFFICIAL_PROVINCES;

  const filteredProjects = useMemo(() => {
    const term = normalizedText(search);

    return projects.filter((project) => {
      const matchesSearch = !term || [
        project.titre,
        project.code_projet,
        project.secteur,
        project.filiere,
        ...projectProvinces(project),
        project.description,
      ].some((value) => normalizedText(value).includes(term));

      const matchesSector = !sector || project.secteur === sector;
      const matchesProvince = !province || projectProvinces(project).includes(province);

      return matchesSearch && matchesSector && matchesProvince;
    });
  }, [projects, search, sector, province]);

  function resetFilters() {
    setSearch('');
    setSector('');
    setProvince('');
  }

  return (
    <>
      <Hero totalProjects={projects.length} />

      <section className="catalogue-section" id="catalogue">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow-dark">Opportunités d'investissement</p>
              <h2>Explorez les projets de la région</h2>
              <p>Recherchez et filtrez les opportunités selon vos priorités d'investissement.</p>
            </div>
            <div className="source-badge" title="Source des données actuellement affichées">
              <span className={`source-dot source-${dataSource}`}></span>
              {dataSource === 'directus' ? 'Données Directus' : 'Mode démonstration'}
            </div>
          </div>

          {loadError && <div className="info-banner">{loadError}</div>}

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sector={sector}
            onSectorChange={setSector}
            province={province}
            onProvinceChange={setProvince}
            sectors={sectors}
            provinces={provinces}
            onReset={resetFilters}
          />

          <div className="results-line">
            <strong>{loading ? 'Chargement...' : `${filteredProjects.length} projet${filteredProjects.length > 1 ? 's' : ''}`}</strong>
            <span>Banque régionale de projets</span>
          </div>

          {loading ? (
            <div className="projects-grid" aria-label="Chargement">
              {[1, 2, 3].map((item) => <div key={item} className="project-card skeleton-card"></div>)}
            </div>
          ) : filteredProjects.length ? (
            <div className="projects-grid">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onOpen={onOpenProject} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Aucun projet ne correspond à ces critères.</strong>
              <p>Modifiez la recherche ou réinitialisez les filtres.</p>
              <button type="button" className="button button-secondary" onClick={resetFilters}>Réinitialiser</button>
            </div>
          )}
        </div>
      </section>

      <section className="journey-section">
        <div className="container journey-grid">
          <div>
            <p className="eyebrow eyebrow-dark">Parcours investisseur</p>
            <h2>De l'opportunité au Business Plan</h2>
          </div>
          <ol className="journey-steps">
            <li><span>01</span><div><strong>Explorer</strong><p>Consultez et filtrez les opportunités.</p></div></li>
            <li><span>02</span><div><strong>Choisir</strong><p>Accédez à la fiche détaillée du projet.</p></div></li>
            <li><span>03</span><div><strong>Demander</strong><p>Renseignez vos informations investisseur.</p></div></li>
            <li><span>04</span><div><strong>Accéder</strong><p>Après validation du CRI, recevez le Business Plan.</p></div></li>
          </ol>
        </div>
      </section>
    </>
  );
}
