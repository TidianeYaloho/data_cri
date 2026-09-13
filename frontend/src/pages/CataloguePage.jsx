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

export default function CataloguePage({ projects, loading, loadError, onOpenProject }) {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [province, setProvince] = useState('');
  const [type, setType] = useState('');

  const sectors = useMemo(
    () => [...new Set(projects.map((project) => project.secteur).filter(Boolean))].sort(),
    [projects],
  );

  const types = useMemo(
    () => [...new Set(projects.map((project) => project.type_projet).filter(Boolean))].sort(),
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
      const matchesType = !type || project.type_projet === type;

      return matchesSearch && matchesSector && matchesProvince && matchesType;
    });
  }, [projects, search, sector, province, type]);

  function resetFilters() {
    setSearch('');
    setSector('');
    setProvince('');
    setType('');
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
           type={type}
           onTypeChange={setType}
           types={types}
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
    </>
  );
}
