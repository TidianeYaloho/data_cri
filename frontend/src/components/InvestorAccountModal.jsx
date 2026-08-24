import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createAccountBusinessPlanAccess,
  fetchInvestorAccount,
  loginInvestor,
  logoutInvestor,
  registerInvestorAccount,
  requestInvestorPasswordReset,
  resendInvestorVerification,
  resetInvestorPassword,
  updateInvestorProfile,
  verifyInvestorEmail,
} from '../api/directus.js';

const initialRegisterForm = {
  prenom: '',
  nom: '',
  email: '',
  password: '',
  telephone: '',
  entreprise: '',
  fonction: '',
  pays: 'Maroc',
};

const statusLabels = {
  demandee: 'Demandée',
  validee: 'Validée',
  refusee: 'Refusée',
  telechargee: 'Téléchargée',
};

function requestStatusLabel(status) {
  return statusLabels[status] || status || 'Inconnu';
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function titleForView(view) {
  if (view === 'register') return 'Créer un compte';
  if (view === 'forgot') return 'Mot de passe oublié';
  if (view === 'reset') return 'Choisir un nouveau mot de passe';
  return 'Se connecter';
}

export default function InvestorAccountModal({
  account,
  onAccountChange,
  onClose,
  initialVerificationToken = null,
  initialResetToken = null,
}) {
  const [view, setView] = useState(initialResetToken ? 'reset' : 'login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' });
  const [profileForm, setProfileForm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [verificationFlowActive, setVerificationFlowActive] = useState(
    Boolean(initialVerificationToken),
  );
  const [resetFlowActive, setResetFlowActive] = useState(Boolean(initialResetToken));
  const verificationRequestRef = useRef({ token: null, promise: null });

  useEffect(() => {
    if (account?.profil) {
      setProfileForm({
        prenom: account.profil.prenom || '',
        nom: account.profil.nom || '',
        telephone: account.profil.telephone || '',
        entreprise: account.profil.entreprise || '',
        fonction: account.profil.fonction || '',
        pays: account.profil.pays || '',
      });
    }
  }, [account]);

  useEffect(() => {
    if (!initialVerificationToken) return;

    let active = true;

    setView('login');
    setStatus('loading');
    setMessage("Vérification de votre adresse e-mail...");
    setVerificationFlowActive(true);

    if (verificationRequestRef.current.token !== initialVerificationToken) {
      verificationRequestRef.current = {
        token: initialVerificationToken,
        promise: verifyInvestorEmail(initialVerificationToken),
      };
    }

    verificationRequestRef.current.promise
      .then(() => {
        if (!active) return;

        setVerificationFlowActive(false);
        setStatus('success');
        setMessage(
          'Votre adresse e-mail est vérifiée. Vous pouvez maintenant vous connecter.',
        );
      })
      .catch((error) => {
        console.error(error);
        if (!active) return;

        setVerificationFlowActive(false);
        setStatus('error');
        setMessage(
          error.code === 'VERIFICATION_TOKEN_INVALID'
            ? 'Ce lien de vérification est invalide ou a expiré.'
            : "La vérification de l'adresse e-mail n'a pas pu être effectuée.",
        );
      });

    return () => {
      active = false;
    };
  }, [initialVerificationToken]);

  useEffect(() => {
    if (initialResetToken) {
      setResetFlowActive(true);
      setView('reset');
      setMessage('');
      setStatus('idle');
    }
  }, [initialResetToken]);

  const demandes = useMemo(
    () => (Array.isArray(account?.demandes) ? account.demandes : []),
    [account],
  );

  const forceAuthFlow = verificationFlowActive || resetFlowActive;

  function updateLogin(event) {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  }

  function updateRegister(event) {
    const { name, value } = event.target;
    setRegisterForm((current) => ({ ...current, [name]: value }));
  }

  function updateProfile(event) {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  }

  async function refreshAccount() {
    const fresh = await fetchInvestorAccount();
    onAccountChange(fresh);
    return fresh;
  }

  async function submitLogin(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      await loginInvestor(loginForm.email.trim().toLowerCase(), loginForm.password);
      await refreshAccount();
      setStatus('success');
      setMessage('Connexion réussie.');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setPendingVerificationEmail(loginForm.email.trim().toLowerCase());
      setMessage(
        'Adresse e-mail ou mot de passe incorrect, ou adresse e-mail non encore vérifiée.',
      );
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    if (registerForm.password !== registerPasswordConfirm) {
      setStatus('error');
      setMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      const result = await registerInvestorAccount(registerForm);
      const email = registerForm.email.trim().toLowerCase();

      setLoginForm({ email, password: '' });
      setPendingVerificationEmail(email);
      setView('login');
      setStatus('success');
      setMessage(
        result?.email_envoye === false
          ? "Votre compte a été créé, mais l'e-mail de vérification n'a pas pu être envoyé. Utilisez le bouton de renvoi ci-dessous."
          : "Votre compte a été créé. Consultez votre e-mail et cliquez sur le lien de vérification avant de vous connecter.",
      );
    } catch (error) {
      console.error(error);
      setStatus('error');

      if (error.code === 'EMAIL_NOT_VERIFIED') {
        const email = registerForm.email.trim().toLowerCase();
        setLoginForm({ email, password: '' });
        setPendingVerificationEmail(email);
        setView('login');
        setMessage(
          "Ce compte existe déjà mais l'adresse e-mail n'a pas encore été vérifiée.",
        );
        return;
      }

      if (error.code === 'ACCOUNT_EXISTS') {
        setMessage('Un compte existe déjà avec cette adresse e-mail. Connectez-vous.');
        return;
      }

      if (error.code === 'PASSWORD_TOO_SHORT') {
        setMessage('Le mot de passe doit contenir au moins 10 caractères.');
        return;
      }

      if (error.code === 'INVALID_EMAIL') {
        setMessage('Veuillez renseigner une adresse e-mail valide.');
        return;
      }

      setMessage("Le compte n'a pas pu être créé pour le moment.");
    }
  }

  async function resendVerification() {
    const email = (pendingVerificationEmail || loginForm.email).trim().toLowerCase();

    if (!email) {
      setStatus('error');
      setMessage("Renseignez d'abord votre adresse e-mail.");
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      await resendInvestorVerification(email);
      setStatus('success');
      setMessage(
        "Si ce compte attend une vérification, un nouvel e-mail vient d'être envoyé.",
      );
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage("L'e-mail de vérification n'a pas pu être renvoyé.");
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const result = await requestInvestorPasswordReset(
        forgotEmail.trim().toLowerCase(),
      );
      setStatus('success');
      setMessage(
        result?.message ||
          'Si un compte actif correspond à cette adresse, un e-mail de réinitialisation a été envoyé.',
      );
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage(
        error.code === 'INVALID_EMAIL'
          ? 'Veuillez renseigner une adresse e-mail valide.'
          : "La demande de réinitialisation n'a pas pu être envoyée.",
      );
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    if (resetForm.password.length < 10) {
      setStatus('error');
      setMessage('Le mot de passe doit contenir au moins 10 caractères.');
      return;
    }

    if (resetForm.password !== resetForm.confirm) {
      setStatus('error');
      setMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      await resetInvestorPassword(initialResetToken, resetForm.password);
      setResetForm({ password: '', confirm: '' });
      setResetFlowActive(false);
      setView('login');
      setStatus('success');
      setMessage(
        'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.',
      );
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage(
        error.code === 'RESET_TOKEN_INVALID'
          ? 'Ce lien de réinitialisation est invalide ou a expiré.'
          : "Le mot de passe n'a pas pu être réinitialisé.",
      );
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      await updateInvestorProfile(profileForm);
      await refreshAccount();
      setEditingProfile(false);
      setStatus('success');
      setMessage('Profil mis à jour.');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage("Le profil n'a pas pu être mis à jour.");
    }
  }

  async function handleLogout() {
    setStatus('loading');
    setMessage('');

    try {
      await logoutInvestor();
    } catch (error) {
      console.error(error);
    } finally {
      onAccountChange(null);
      setStatus('idle');
      setMessage('');
      setView('login');
    }
  }

  async function downloadFromRequest(requestId) {
    setStatus('loading');
    setMessage('');

    try {
      const access = await createAccountBusinessPlanAccess(requestId);

      if (!access?.acces_url) {
        throw new Error('URL de téléchargement absente.');
      }

      window.open(access.acces_url, '_blank', 'noopener,noreferrer');
      setStatus('success');
      setMessage('Le téléchargement sécurisé a été ouvert dans un nouvel onglet.');

      window.setTimeout(() => {
        refreshAccount().catch((error) => console.error(error));
      }, 1500);
    } catch (error) {
      console.error(error);
      setStatus('error');

      if (error.code === 'BUSINESS_PLAN_DISABLED') {
        setMessage("L'accès aux Business Plans est actuellement désactivé.");
        return;
      }

      if (error.code === 'REQUEST_NOT_VALIDATED') {
        setMessage("Cette demande n'est pas encore validée.");
        return;
      }

      setMessage("Le téléchargement n'est pas disponible pour le moment.");
    }
  }

  const showAccount = account?.profil && !forceAuthFlow;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal investor-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investor-account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>

        {showAccount ? (
          <>
            <p className="eyebrow">Espace investisseur</p>
            <h2 id="investor-account-title">Bonjour {account.profil.prenom}</h2>
            <p className="modal-intro">
              Suivez vos demandes de Business Plan et gérez vos informations.
            </p>

            <div className="account-summary">
              <div>
                <span>Compte</span>
                <strong>{account.profil.email}</strong>
              </div>
              <div>
                <span>Demandes</span>
                <strong>{demandes.length}</strong>
              </div>
            </div>

            <div className="account-section-heading">
              <h3>Mes demandes</h3>
              <button
                className="text-button"
                type="button"
                onClick={() => refreshAccount().catch(console.error)}
              >
                Actualiser
              </button>
            </div>

            <div className="account-requests">
              {demandes.length === 0 ? (
                <div className="account-empty">
                  Vous n'avez encore demandé aucun Business Plan.
                </div>
              ) : (
                demandes.map((demande) => (
                  <article className="account-request" key={demande.id}>
                    <div>
                      <span className={`request-status request-status-${demande.statut}`}>
                        {requestStatusLabel(demande.statut)}
                      </span>
                      <h4>{demande.projet_titre || 'Projet CRI'}</h4>
                      <p>
                        {demande.code_projet || 'Projet'} · demande du{' '}
                        {formatDate(demande.date_created)}
                      </p>
                    </div>

                    {['validee', 'telechargee'].includes(demande.statut) && (
                      <button
                        className="button button-secondary account-download"
                        type="button"
                        disabled={status === 'loading'}
                        onClick={() => downloadFromRequest(demande.id)}
                      >
                        {demande.statut === 'telechargee'
                          ? 'Télécharger à nouveau'
                          : 'Télécharger'}
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>

            <div className="account-section-heading account-profile-heading">
              <h3>Mon profil</h3>
              <button
                className="text-button"
                type="button"
                onClick={() => setEditingProfile((current) => !current)}
              >
                {editingProfile ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {editingProfile && profileForm && (
              <form className="request-form" onSubmit={saveProfile}>
                <div className="form-grid">
                  <label>
                    Prénom
                    <input required name="prenom" value={profileForm.prenom} onChange={updateProfile} />
                  </label>
                  <label>
                    Nom
                    <input required name="nom" value={profileForm.nom} onChange={updateProfile} />
                  </label>
                  <label>
                    Téléphone
                    <input name="telephone" value={profileForm.telephone} onChange={updateProfile} />
                  </label>
                  <label>
                    Entreprise
                    <input name="entreprise" value={profileForm.entreprise} onChange={updateProfile} />
                  </label>
                  <label>
                    Fonction
                    <input name="fonction" value={profileForm.fonction} onChange={updateProfile} />
                  </label>
                  <label>
                    Pays
                    <input required name="pays" value={profileForm.pays} onChange={updateProfile} />
                  </label>
                </div>
                <button
                  className="button button-primary form-submit"
                  type="submit"
                  disabled={status === 'loading'}
                >
                  Enregistrer le profil
                </button>
              </form>
            )}

            {message && (
              <div className={`form-message form-message-${status}`}>{message}</div>
            )}

            <button
              className="button button-ghost account-logout"
              type="button"
              disabled={status === 'loading'}
              onClick={handleLogout}
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Espace investisseur</p>
            <h2 id="investor-account-title">{titleForView(view)}</h2>
            <p className="modal-intro">
              {view === 'forgot'
                ? 'Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.'
                : view === 'reset'
                  ? 'Choisissez un nouveau mot de passe pour votre compte investisseur.'
                  : 'Votre espace permet de suivre vos demandes de Business Plan.'}
            </p>

            {['login', 'register'].includes(view) && (
              <div className="account-tabs">
                <button
                  className={view === 'login' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setView('login');
                    setMessage('');
                  }}
                >
                  Connexion
                </button>
                <button
                  className={view === 'register' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setView('register');
                    setMessage('');
                  }}
                >
                  Créer un compte
                </button>
              </div>
            )}

            {view === 'login' && (
              <form className="request-form" onSubmit={submitLogin}>
                <div className="form-grid account-login-grid">
                  <label className="form-full">
                    E-mail
                    <input
                      required
                      type="email"
                      name="email"
                      value={loginForm.email}
                      onChange={updateLogin}
                    />
                  </label>
                  <label className="form-full">
                    Mot de passe
                    <input
                      required
                      type="password"
                      name="password"
                      value={loginForm.password}
                      onChange={updateLogin}
                    />
                  </label>
                </div>

                <button
                  className="account-inline-link"
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginForm.email);
                    setView('forgot');
                    setMessage('');
                  }}
                >
                  Mot de passe oublié ?
                </button>

                <button
                  className="button button-primary form-submit"
                  type="submit"
                  disabled={status === 'loading'}
                >
                  {status === 'loading'
                    ? verificationFlowActive
                      ? 'Vérification...'
                      : 'Connexion...'
                    : 'Se connecter'}
                </button>

                {(pendingVerificationEmail || loginForm.email) && (
                  <button
                    className="account-inline-link account-resend-link"
                    type="button"
                    disabled={status === 'loading'}
                    onClick={resendVerification}
                  >
                    Renvoyer l'e-mail de vérification
                  </button>
                )}
              </form>
            )}

            {view === 'register' && (
              <form className="request-form" onSubmit={submitRegister}>
                <div className="form-grid">
                  <label>
                    Prénom
                    <input required name="prenom" value={registerForm.prenom} onChange={updateRegister} />
                  </label>
                  <label>
                    Nom
                    <input required name="nom" value={registerForm.nom} onChange={updateRegister} />
                  </label>
                  <label>
                    E-mail
                    <input required type="email" name="email" value={registerForm.email} onChange={updateRegister} />
                  </label>
                  <label>
                    Mot de passe
                    <input required minLength="10" type="password" name="password" value={registerForm.password} onChange={updateRegister} />
                  </label>
                  <label className="form-full">
                    Confirmer le mot de passe
                    <input
                      required
                      minLength="10"
                      type="password"
                      value={registerPasswordConfirm}
                      onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
                    />
                  </label>
                  <label>
                    Téléphone
                    <input name="telephone" value={registerForm.telephone} onChange={updateRegister} />
                  </label>
                  <label>
                    Entreprise
                    <input name="entreprise" value={registerForm.entreprise} onChange={updateRegister} />
                  </label>
                  <label>
                    Fonction
                    <input name="fonction" value={registerForm.fonction} onChange={updateRegister} />
                  </label>
                  <label>
                    Pays
                    <input required name="pays" value={registerForm.pays} onChange={updateRegister} />
                  </label>
                </div>
                <button
                  className="button button-primary form-submit"
                  type="submit"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Création...' : 'Créer mon compte'}
                </button>
                <small className="privacy-note">
                  Le mot de passe doit contenir au moins 10 caractères. Votre adresse e-mail devra être vérifiée avant la première connexion.
                </small>
              </form>
            )}

            {view === 'forgot' && (
              <form className="request-form" onSubmit={submitForgotPassword}>
                <div className="form-grid account-login-grid">
                  <label className="form-full">
                    E-mail
                    <input
                      required
                      type="email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="button button-primary form-submit"
                  type="submit"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </button>
                <button
                  className="account-inline-link account-back-link"
                  type="button"
                  onClick={() => {
                    setView('login');
                    setMessage('');
                  }}
                >
                  Retour à la connexion
                </button>
              </form>
            )}

            {view === 'reset' && (
              <form className="request-form" onSubmit={submitResetPassword}>
                <div className="form-grid account-login-grid">
                  <label className="form-full">
                    Nouveau mot de passe
                    <input
                      required
                      minLength="10"
                      type="password"
                      value={resetForm.password}
                      onChange={(event) =>
                        setResetForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-full">
                    Confirmer le nouveau mot de passe
                    <input
                      required
                      minLength="10"
                      type="password"
                      value={resetForm.confirm}
                      onChange={(event) =>
                        setResetForm((current) => ({
                          ...current,
                          confirm: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  className="button button-primary form-submit"
                  type="submit"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Modification...' : 'Modifier mon mot de passe'}
                </button>
              </form>
            )}

            {message && (
              <div className={`form-message form-message-${status}`}>{message}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
