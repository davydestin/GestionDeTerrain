import { useState } from 'react'
import { Link } from 'react-router-dom'
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
    <section className="mx-auto w-full max-w-3xl space-y-5 px-5 py-10">
      <Link className="text-xs font-bold text-[#b6f23a] hover:underline" to="/client/reservations">← Mes réservations</Link>
      <div>
        <p className="text-[11px] font-bold uppercase text-[#b6f23a]">Espace client</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold uppercase text-[#f3f5ef]">Mon profil</h1>
      </div>
      {error && <p className="rounded-xl border border-[#ff6b4a]/30 bg-[#ff6b4a]/10 px-3 py-2 text-sm text-[#ff9b84]" role="alert">{error}</p>}
      {notice && <p className="rounded-xl border border-[#b6f23a]/30 bg-[#b6f23a]/10 px-3 py-2 text-sm text-[#b6f23a]" role="status">{notice}</p>}
      <form className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:grid-cols-2" onSubmit={submit}>
        <label className="grid gap-1.5 text-xs font-semibold text-[#cfd6c9]">
          Prénom
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" autoComplete="given-name" name="prenom" onChange={updateField} required value={values.prenom} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#cfd6c9]">
          Nom
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" autoComplete="family-name" name="nom" onChange={updateField} required value={values.nom} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#cfd6c9]">
          Adresse e-mail
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" autoComplete="email" name="email" onChange={updateField} required type="email" value={values.email} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#cfd6c9]">
          Téléphone
          <input className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-normal" autoComplete="tel" name="telephone" onChange={updateField} value={values.telephone} />
        </label>
        <p className="text-xs text-[#88927f] sm:col-span-2">Le rôle et l’état du compte ne peuvent pas être modifiés depuis votre profil.</p>
        <div className="sm:col-span-2 sm:flex sm:justify-end">
          <button className="rounded-full bg-[#b6f23a] px-6 py-3 text-sm font-bold text-[#0b0f0c] disabled:opacity-60" disabled={saving} type="submit">
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </section>
  )
}