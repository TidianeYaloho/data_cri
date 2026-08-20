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
  return [
    'immediat',
    'immediate',
    'acces_immediat',
    'identification',
  ].includes(mode);
}

export default function RequestModal({
  project,
  modeAcces,
  onClose,
}) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const immediateMode = isImmediateMode(modeAcces);

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

    try {
      const result =
        await createInvestorAndRequest({
          investor: form,
          projectId: project.id,
        });

      const demande =
        result?.data ?? {};

      setStatus('success');

      if (demande.deja_existante) {
        setMessage(
          "Une demande active existe déjà pour ce projet avec cette adresse e-mail."
        );

        return;
      }

      if (immediateMode) {
        setMessage(
          "Votre identification a bien été enregistrée. L'accès immédiat au Business Plan est autorisé."
        );

        return;
      }

      setMessage(
        "Votre demande a bien été enregistrée. Elle est maintenant en attente de validation par le CRI."
      );
    } catch (error) {
      console.error(error);

      setStatus('error');

      if (error.code === 'BUSINESS_PLAN_DISABLED') {
        setMessage(
          "L'accès au Business Plan est actuellement désactivé."
        );

        return;
      }

      if (error.code === 'PROJECT_NOT_AVAILABLE') {
        setMessage(
          "Ce projet n'est plus disponible pour une demande de Business Plan."
        );

        return;
      }

      setMessage(
        "La demande n'a pas pu être enregistrée pour le moment."
      );
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
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
          {immediateMode
            ? 'Identification'
            : "Demande d'accès"}
        </p>

        <h2 id="request-title">
          {immediateMode
            ? "S'identifier pour accéder au Business Plan"
            : 'Recevoir le Business Plan'}
        </h2>

        <p className="modal-intro">
          Projet : <strong>{project.titre}</strong>
        </p>

        <form
          className="request-form"
          onSubmit={submit}
        >
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
              <input
                required
                name="nom"
                value={form.nom}
                onChange={updateField}
              />
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
              <input
                required
                name="pays"
                value={form.pays}
                onChange={updateField}
              />
            </label>
          </div>

          {message && (
            <div
              className={`form-message form-message-${status}`}
            >
              {message}
            </div>
          )}

          <button
            className="button button-primary form-submit"
            type="submit"
            disabled={
              status === 'loading' ||
              status === 'success'
            }
          >
            {status === 'loading'
              ? 'Envoi...'
              : status === 'success'
                ? 'Demande enregistrée'
                : immediateMode
                  ? "M'identifier"
                  : 'Envoyer ma demande'}
          </button>

          <small className="privacy-note">
            Les informations renseignées sont utilisées
            pour traiter votre demande d'accès au
            Business Plan.
          </small>
        </form>
      </div>
    </div>
  );
}