import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contextes/useAuth.js'

const roleHome = {
  CLIENT: '/client/reservations',
  GESTIONNAIRE: '/gestionnaire/terrains',
  ADMINISTRATEUR: '/administrateur/utilisateurs',
}

export default function AuthenticationPage({ mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const isRegistration = mode === 'register'
  const [values, setValues] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const user = isRegistration
        ? await register(values)
        : await login({ email: values.email, password: values.password })

      navigate(roleHome[user.role] || '/', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-context" aria-label="Gestion de terrain">
        <div className="brand-lockup brand-lockup-light">
          <span className="brand-mark brand-mark-light" aria-hidden="true">GT</span>
          <span>Gestion de terrain</span>
        </div>
        <div className="court-art" aria-hidden="true">
          <span className="court-center" />
          <span className="court-box court-box-left" />
          <span className="court-box court-box-right" />
        </div>
        <div className="context-copy">
          <p className="eyebrow eyebrow-light">Réservations & gestion</p>
          <h1>Le terrain,<br />bien organisé.</h1>
          <p>Un accès simple à votre espace de gestion.</p>
        </div>
        <span className="context-index">01 / ESPACE SÉCURISÉ</span>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-top">
          <span className="eyebrow">Bienvenue</span>
          <span className="secure-indicator"><span /> Session sécurisée</span>
        </div>
        <div className="auth-tabs" aria-label="Authentification">
          <Link className={!isRegistration ? 'auth-tab active' : 'auth-tab'} to="/connexion">
            Connexion
          </Link>
          <Link className={isRegistration ? 'auth-tab active' : 'auth-tab'} to="/inscription">
            Inscription
          </Link>
        </div>

        <div className="form-heading">
          <h2>{isRegistration ? 'Créer un compte' : 'Connectez-vous'}</h2>
          <p>{isRegistration ? 'Votre compte sera créé en tant que client.' : 'Accédez à votre espace.'}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {isRegistration && (
            <>
              <div className="field-pair">
                <label>
                  Prénom
                  <input autoComplete="given-name" name="prenom" onChange={updateField} required value={values.prenom} />
                </label>
                <label>
                  Nom
                  <input autoComplete="family-name" name="nom" onChange={updateField} required value={values.nom} />
                </label>
              </div>
              <label>
                Téléphone <span className="optional">Facultatif</span>
                <input autoComplete="tel" name="telephone" onChange={updateField} value={values.telephone} />
              </label>
            </>
          )}

          <label>
            Adresse e-mail
            <input autoComplete="email" name="email" onChange={updateField} required type="email" value={values.email} />
          </label>
          <label>
            Mot de passe
            <input
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              minLength={isRegistration ? 8 : undefined}
              name="password"
              onChange={updateField}
              required
              type="password"
              value={values.password}
            />
          </label>
          {isRegistration && (
            <label>
              Confirmer le mot de passe
              <input
                autoComplete="new-password"
                name="password_confirmation"
                onChange={updateField}
                required
                type="password"
                value={values.password_confirmation}
              />
            </label>
          )}

          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button className="button button-primary submit-button" disabled={busy} type="submit">
            {busy ? 'Traitement…' : isRegistration ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
      </section>
    </main>
  )
}