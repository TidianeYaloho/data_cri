import { useEffect, useState } from 'react';

export default function Header({
  onHome,
  accountsEnabled,
  investorAccount,
  onInvestorAccount,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleHomeClick() {
    setMobileMenuOpen(false);
    onHome();
  }

  function handleInvestorClick() {
    setMobileMenuOpen(false);
    onInvestorAccount();
  }

  return (
    <header className={`site-header ${mobileMenuOpen ? 'menu-open' : ''}`}>
      <div className="container header-inner">
        <button className="brand" type="button" onClick={handleHomeClick} aria-label="Retour à la banque de projets">
          <span className="brand-symbol" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
          <span className="brand-text">
            <strong>CRI Guelmim-Oued Noun</strong>
            <small>Banque régionale de projets</small>
          </span>
        </button>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu de navigation'}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <span className="burger-bar" aria-hidden="true"></span>
          <span className="burger-bar" aria-hidden="true"></span>
          <span className="burger-bar" aria-hidden="true"></span>
        </button>

        <nav
          className={`header-nav ${mobileMenuOpen ? 'is-open' : ''}`}
          aria-label="Navigation du module"
        >


          {accountsEnabled && (
            <button
              className="investor-space-link"
              type="button"
              onClick={handleInvestorClick}
            >
              {investorAccount?.profil
                ? `Mon espace · ${investorAccount.profil.prenom}`
                : "S'inscrire / Se connecter"}
            </button>
          )}


        </nav>
      </div>
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
