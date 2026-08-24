import { useState } from 'react';
import { createInvestorAndRequest } from '../api/directus.js';

const initialForm = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  entreprise: '',
  fonction: '',
  pays: 'Maroc',
};

function isImmediateMode(mode) {
  return mode === 'direct';
}

export default function RequestModal({
  project,
  modeAcces,
  comptesInvestisseurs,
  investorAccount,
  onAccountExpired,
  onClose,
}) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [accessUrl, setAccessUrl] = useState('');

  const immediateMode = isImmediateMode(modeAcces);
  const accountMode = comptesInvestisseurs === true;

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    setStatus('loading');
    setMessage('');
    setAccessUrl('');

    try {
      const result = await createInvestorAndRequest({
        investor: accountMode ? null : form,
        projectId: project.id,
        useAccount: accountMode,
      });

      const demande = result?.data ?? {};
      setStatus('success');

      if (demande.acces_url) {
        setAccessUrl(demande.acces_url);
        setMessage(
          accountMode
            ? 'Votre demande est enregistrée dans votre espace. Votre accès sécurisé au Business Plan est prêt.'
            : 'Votre identification a bien été enregistrée. Votre accès sécurisé au Business Plan est prêt.',
        );
        return;
      }

      if (demande.deja_existante) {
        if (demande.statut === 'validee') {
          setMessage(
            accountMode
              ? 'Une demande validée existe déjà pour ce projet. Retrouvez-la dans votre espace investisseur.'
              : "Une demande validée existe déjà pour ce projet. Consultez l'e-mail de validation reçu du CRI.",
          );
        } else {
          setMessage(
            accountMode
              ? 'Une demande est déjà en cours de traitement pour ce projet dans votre espace investisseur.'
              : "Une demande est déjà en cours de traitement pour ce projet avec cette adresse e-mail.",
          );
        }

        return;
      }

      setMessage(
        accountMode
          ? 'Votre demande a bien été enregistrée dans votre espace investisseur. Elle est en attente de validation par le CRI.'
          : 'Votre demande a bien été enregistrée. Elle est maintenant en attente de validation par le CRI. Vous recevrez la réponse par e-mail.',
      );
    } catch (error) {
      console.error(error);
      setStatus('error');

      if (
        error.code === 'INVESTOR_ACCOUNT_REQUIRED' ||
        error.code === 'INVESTOR_ACCOUNT_NOT_LINKED'
      ) {
        setMessage('Votre session investisseur a expiré. Reconnectez-vous.');
        window.setTimeout(() => onAccountExpired?.(), 900);
        return;
      }

      if (error.code === 'BUSINESS_PLAN_DISABLED') {
        setMessage("L'accès au Business Plan est actuellement désactivé.");
        return;
      }

      if (error.code === 'PROJECT_NOT_AVAILABLE') {
        setMessage(
          "Ce projet n'est plus disponible pour une demande de Business Plan.",
        );
        return;
      }

      if (error.code === 'BUSINESS_PLAN_NOT_AVAILABLE') {
        setMessage(
          "Le Business Plan de ce projet n'est pas encore disponible.",
        );
        return;
      }

      if (error.code === 'INVALID_EMAIL') {
        setMessage('Veuillez renseigner une adresse e-mail valide.');
        return;
      }

      if (error.code === 'FIELD_TOO_LONG') {
        setMessage(
          "L'un des champs renseignés est trop long. Vérifiez les informations saisies.",
        );
        return;
      }

      setMessage("La demande n'a pas pu être enregistrée pour le moment.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
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

        <p className="eyebrow">
          {accountMode
            ? 'Espace investisseur'
            : immediateMode
              ? 'Identification'
              : "Demande d'accès"}
        </p>

        <h2 id="request-title">
          {immediateMode
            ? 'Accéder au Business Plan'
            : 'Demander le Business Plan'}
        </h2>

        <p className="modal-intro">
          Projet : <strong>{project.titre}</strong>
        </p>

        <form className="request-form" onSubmit={submit}>
          {accountMode ? (
            <div className="account-request-confirmation">
              <span>Demande au nom de</span>
              <strong>
                {investorAccount?.profil?.prenom} {investorAccount?.profil?.nom}
              </strong>
              <small>{investorAccount?.profil?.email}</small>
              <p>
                Cette demande et son statut seront visibles dans votre espace investisseur.
              </p>
            </div>
          ) : (
            <div className="form-grid">
              <label>
                Prénom
                <input
                  required
                  name="prenom"
                  value={form.prenom}
                  onChange={updateField}
                />
              </label>

              <label>
                Nom
                <input required name="nom" value={form.nom} onChange={updateField} />
              </label>

              <label>
                E-mail
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                />
              </label>

              <label>
                Téléphone
                <input
                  name="telephone"
                  value={form.telephone}
                  onChange={updateField}
                />
              </label>

              <label>
                Entreprise
                <input
                  name="entreprise"
                  value={form.entreprise}
                  onChange={updateField}
                />
              </label>

              <label>
                Fonction
                <input
                  name="fonction"
                  value={form.fonction}
                  onChange={updateField}
                />
              </label>

              <label className="form-full">
                Pays
                <input required name="pays" value={form.pays} onChange={updateField} />
              </label>
            </div>
          )}

          {message && (
            <div className={`form-message form-message-${status}`}>
              {message}
            </div>
          )}

          {accessUrl && (
            <a
              className="button button-primary business-plan-download"
              href={accessUrl}
              target="_blank"
              rel="noreferrer"
            >
              Télécharger le Business Plan
            </a>
          )}

          <button
            className="button button-primary form-submit"
            type="submit"
            disabled={status === 'loading' || status === 'success'}
          >
            {status === 'loading'
              ? 'Envoi...'
              : status === 'success'
                ? 'Demande enregistrée'
                : immediateMode
                  ? 'Obtenir mon accès'
                  : 'Envoyer ma demande'}
          </button>

          <small className="privacy-note">
            {accountMode
              ? 'La demande est rattachée à votre compte investisseur.'
              : "Les informations renseignées sont utilisées pour traiter votre demande d'accès au Business Plan."}
          </small>
        </form>
      </div>
    </div>
  );
}
