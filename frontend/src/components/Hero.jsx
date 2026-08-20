export default function Hero({ totalProjects }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-content">
          <p className="eyebrow">Investir dans la région</p>
          <h1>Banque régionale de projets</h1>
          <p className="hero-lead">
            Explorez les opportunités d'investissement de la région Guelmim-Oued Noun
            et identifiez les projets correspondant à vos objectifs.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#catalogue">Explorer les projets</a>
            <a className="button button-ghost" href="https://guelmiminvest.ma/" target="_blank" rel="noreferrer">
              Découvrir la région
            </a>
          </div>
        </div>

        <div className="hero-panel" aria-label="Aperçu du catalogue">
          <span className="hero-panel-label">Opportunités disponibles</span>
          <strong>{totalProjects}</strong>
          <p>Agriculture · Industrie · Énergie · Environnement · Tourisme · Services</p>
        </div>
      </div>
    </section>
  );
}
