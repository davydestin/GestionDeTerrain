import { useEffect, useRef, useState } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

let scriptPromise = null

// Charge une seule fois la bibliothèque Google Identity Services.
function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()

  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Impossible de charger la connexion Google. Vérifiez votre connexion internet.'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * Bouton « Continuer avec Google » de l'application.
 * Contrairement au bouton officiel, il n'affiche jamais le nom ni l'e-mail du compte Google
 * ouvert dans le navigateur : au clic, Google ouvre sa fenêtre et la personne choisit son compte.
 * `onToken(jeton)` reçoit le jeton d'accès, à transmettre à l'API (/api/auth/google).
 */
export default function GoogleSignInButton({ onToken, label = 'Continuer avec Google', disabled = false }) {
  const clientRef = useRef(null)
  const callbackRef = useRef(onToken)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    callbackRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined
    let active = true

    loadGoogleScript()
      .then(() => {
        if (!active) return
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: (response) => {
            if (response.error || !response.access_token) {
              setError('Connexion Google annulée ou refusée.')
              return
            }
            setError('')
            callbackRef.current(response.access_token)
          },
          // Fenêtre fermée par l'utilisateur : ce n'est pas une erreur à afficher.
          error_callback: (failure) => {
            if (failure?.type !== 'popup_closed') setError('La fenêtre Google n’a pas pu s’ouvrir. Autorisez les fenêtres pop-up puis réessayez.')
          },
        })
        setReady(true)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

    return () => {
      active = false
    }
  }, [])

  if (!GOOGLE_CLIENT_ID) return null

  function open() {
    setError('')
    // « select_account » : Google demande toujours quel compte utiliser, rien n'est présélectionné.
    clientRef.current?.requestAccessToken({ prompt: 'select_account' })
  }

  return (
    <div className="grid gap-2">
      <button
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white text-sm font-semibold text-[#1f1f1f] transition hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || !ready}
        onClick={open}
        type="button"
      >
        <GoogleLogo />
        {label}
      </button>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </div>
  )
}
