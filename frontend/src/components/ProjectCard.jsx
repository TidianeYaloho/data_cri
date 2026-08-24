import { projectImageUrl } from '../api/directus.js';
import SectorIcon from './SectorIcon.jsx';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'À préciser';
  const amount = Number(value);
  if (Number.isNaN(amount)) return 'À préciser';

  if (amount >= 1_000_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} M MAD`;
  }

  return `${new Intl.NumberFormat('fr-FR').format(amount)} MAD`;
}

function label(value) {
  if (!value) return 'Non renseigné';
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

export default function ProjectCard({ project, onOpen }) {
  const imageUrl = project.has_image ? projectImageUrl(project.id) : '';

  return (
    <article className="project-card">
      <div className={`project-visual sector-${project.secteur || 'service'}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="project-visual-placeholder">
            <SectorIcon sector={project.secteur} size={52} />
            <span>{label(project.secteur)}</span>
          </div>
        )}
        <span className="project-code">{project.code_projet || 'Projet CRI'}</span>
      </div>

      <div className="project-card-body">
        <div className="project-meta-line">
          <span className="sector-pill">{label(project.secteur)}</span>
          <span>{project.province || 'Guelmim-Oued Noun'}</span>
        </div>

        <h3>{project.titre}</h3>
        <p className="project-description">
          {project.description || 'Description à compléter.'}
        </p>

        <div className="project-kpis">
          <div>
            <span>Investissement</span>
            <strong>{formatMoney(project.investissement_mad)}</strong>
          </div>
          <div>
            <span>Postes</span>
            <strong>{project.nombre_postes ?? '—'}</strong>
          </div>
        </div>

        <button className="project-link" type="button" onClick={() => onOpen(project)}>
          Voir la fiche projet <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}
