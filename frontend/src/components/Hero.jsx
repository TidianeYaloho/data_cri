export default function Hero({ totalProjects }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-content">
          <p className="eyebrow">Investir à Guelmim-Oued Noun</p>
          <h1>Banque régionale de projets</h1>
          <p className="hero-lead">
            Explorez les opportunités de la région et identifiez rapidement les projets qui correspondent à vos priorités d’investissement.
          </p>
        </div>

        <div className="hero-panel" aria-label="Aperçu du catalogue">
          <span className="hero-panel-label">Opportunités disponibles</span>
          <strong>{totalProjects}</strong>
          <p>Des projets dans plusieurs secteurs stratégiques.</p>
        </div>

        <div className="hero-actions hero-actions-bottom">
          <a className="button button-primary" href="#catalogue">
            Explorer les projets
          </a>

          <a
            className="button button-ghost"
            href="https://guelmiminvest.ma/"
            target="_blank"
            rel="noreferrer"
          >
            Découvrir la région
          </a>
        </div>
      </div>
    </section>
  );
}
