export default function Header({
  onHome,
  accountsEnabled,
  investorAccount,
  onInvestorAccount,
}) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <button className="brand" type="button" onClick={onHome} aria-label="Retour à la banque de projets">
          <span className="brand-symbol" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
          <span className="brand-text">
            <strong>CRI Guelmim-Oued Noun</strong>
            <small>Banque régionale de projets</small>
          </span>
        </button>

        <nav className="header-nav" aria-label="Navigation du module">
          <button type="button" onClick={onHome}>Projets</button>

          {accountsEnabled && (
            <button
              className="investor-space-link"
              type="button"
              onClick={onInvestorAccount}
            >
              {investorAccount?.profil
                ? `Mon espace · ${investorAccount.profil.prenom}`
                : 'Espace investisseur'}
            </button>
          )}

          <a href="https://guelmiminvest.ma/" target="_blank" rel="noreferrer">Site du CRI</a>
        </nav>
      </div>
    </header>
  );
}
