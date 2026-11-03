import { useState } from 'react'
import { useAuth } from '../../contextes/useAuth.js'

export default function ClientProfilePage() {
  const { user, updateProfile } = useAuth()
  const [values, setValues] = useState({
    nom: user.nom || '',
    prenom: user.prenom || '',
    email: user.email || '',
    telephone: user.telephone || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await updateProfile(values)
      setNotice('Profil mis à jour.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase text-[#2f7259]">Espace client</p>
        <h1 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-[#202b25]">Mon profil</h1>
      </div>
      {error && <p className="rounded border border-[#f0c5b3] bg-[#fff5f0] px-3 py-2 text-sm text-[#984b32]" role="alert">{error}</p>}
      {notice && <p className="rounded border border-[#c6dfcc] bg-[#edf6ef] px-3 py-2 text-sm text-[#286348]" role="status">{notice}</p>}
      <form className="grid gap-4 border-y border-[#dfe3db] bg-[#fffefa] py-5 sm:grid-cols-2" onSubmit={submit}>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
          Prénom
          <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" autoComplete="given-name" name="prenom" onChange={updateField} required value={values.prenom} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
          Nom
          <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" autoComplete="family-name" name="nom" onChange={updateField} required value={values.nom} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
          Adresse e-mail
          <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" autoComplete="email" name="email" onChange={updateField} required type="email" value={values.email} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3a463f]">
          Téléphone
          <input className="h-10 rounded border border-[#dce1d9] bg-white px-3 text-sm font-normal" autoComplete="tel" name="telephone" onChange={updateField} value={values.telephone} />
        </label>
        <p className="text-xs text-[#77817a] sm:col-span-2">Le rôle et l’état du compte ne peuvent pas être modifiés depuis votre profil.</p>
        <div className="sm:col-span-2 sm:flex sm:justify-end">
          <button className="rounded bg-[#2f7259] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </section>
  )
}