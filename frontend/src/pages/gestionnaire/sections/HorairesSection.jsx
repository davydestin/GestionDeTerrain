import { useEffect, useState } from 'react'
import {
  createTerrainHoraire,
  deleteTerrainHoraire,
  getTerrainHoraires,
  updateTerrainHoraire,
} from '../../../services/api.js'
import { JOURS, readResponse } from '../helpers.js'
import { Notice } from '../ui.jsx'

const DEFAULT_OPEN = '08:00'
const DEFAULT_CLOSE = '22:00'

// Une ligne par jour (1 = lundi … 7 = dimanche), qu'un horaire existe ou non.
function weekFromHoraires(horaires) {
  return JOURS.map((label, index) => {
    const jour = index + 1
    const horaire = horaires.find((item) => item.jour_semaine === jour)

    return {
      jour,
      label,
      id: horaire?.id ?? null,
      ouvert: Boolean(horaire?.actif),
      ouverture: horaire?.heure_ouverture?.slice(0, 5) || DEFAULT_OPEN,
      fermeture: horaire?.heure_fermeture?.slice(0, 5) || DEFAULT_CLOSE,
    }
  })
}

function sameDay(a, b) {
  return a.ouvert === b.ouvert && (!a.ouvert || (a.ouverture === b.ouverture && a.fermeture === b.fermeture))
}

export default function HorairesSection({ terrainId, onChanged }) {
  const [saved, setSaved] = useState(null)
  const [week, setWeek] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    getTerrainHoraires(terrainId)
      .then(readResponse)
      .then((payload) => {
        if (!active) return
        const loaded = weekFromHoraires(payload.horaires || [])
        setSaved(loaded)
        setWeek(loaded)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [terrainId, reloadToken])

  if (!week) return error ? <Notice tone="error">{error}</Notice> : <p className="text-sm text-[#88927f]">Chargement des horaires…</p>

  const invalidDays = week.filter((day) => day.ouvert && day.fermeture <= day.ouverture)
  const dirty = week.some((day, index) => !sameDay(day, saved[index]))
  const openDays = week.filter((day) => day.ouvert).length

  function updateDay(jour, changes) {
    setWeek((current) => current.map((day) => (day.jour === jour ? { ...day, ...changes } : day)))
    setNotice('')
  }

  function copyToAllDays(source) {
    setWeek((current) => current.map((day) => ({
      ...day,
      ouvert: source.ouvert,
      ouverture: source.ouverture,
      fermeture: source.fermeture,
    })))
    setNotice('')
  }

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    const failures = []

    // Un jour fermé est supprimé ; un jour ouvert est créé ou mis à jour.
    for (const [index, day] of week.entries()) {
      if (sameDay(day, saved[index]) && (day.id || !day.ouvert)) continue

      try {
        if (!day.ouvert && day.id) {
          await readResponse(await deleteTerrainHoraire(terrainId, day.id))
        } else if (day.ouvert && day.id) {
          await readResponse(await updateTerrainHoraire(terrainId, day.id, {
            heure_ouverture: day.ouverture,
            heure_fermeture: day.fermeture,
            actif: true,
          }))
        } else if (day.ouvert) {
          await readResponse(await createTerrainHoraire(terrainId, {
            jour_semaine: day.jour,
            heure_ouverture: day.ouverture,
            heure_fermeture: day.fermeture,
          }))
        }
      } catch (requestError) {
        failures.push(`${day.label} : ${requestError.message}`)
      }
    }

    setSaving(false)
    setReloadToken((token) => token + 1)
    await onChanged()

    if (failures.length) setError(failures.join(' · '))
    else setNotice('Horaires enregistrés. Les clients voient désormais ces créneaux.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#cfd6c9]">
          {openDays === 0
            ? 'Le terrain est fermé toute la semaine : il ne peut pas être réservé.'
            : `Ouvert ${openDays} jour${openDays > 1 ? 's' : ''} sur 7.`}
        </p>
        <button
          className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10"
          onClick={() => copyToAllDays(week[0])}
          type="button"
        >
          Appliquer les horaires du lundi à toute la semaine
        </button>
      </div>

      <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {week.map((day) => {
          const invalid = day.ouvert && day.fermeture <= day.ouverture

          return (
            <li className={`grid items-center gap-3 px-4 py-3 sm:grid-cols-[8rem_7rem_1fr] ${day.ouvert ? 'bg-white/[0.04]' : 'bg-transparent'}`} key={day.jour}>
              <span className="text-sm font-semibold text-[#f3f5ef]">{day.label}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#cfd6c9]">
                <input
                  checked={day.ouvert}
                  className="peer sr-only"
                  onChange={(event) => updateDay(day.jour, { ouvert: event.target.checked })}
                  type="checkbox"
                />
                <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-white/15 transition after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:bg-[#b6f23a] peer-checked:after:translate-x-4 peer-checked:after:bg-[#0b0f0c] peer-focus-visible:ring-2 peer-focus-visible:ring-[#b6f23a]/60" />
                {day.ouvert ? 'Ouvert' : 'Fermé'}
              </label>
              {day.ouvert ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#88927f]">
                  <input
                    aria-label={`${day.label} : ouverture`}
                    className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm text-white"
                    onChange={(event) => updateDay(day.jour, { ouverture: event.target.value })}
                    type="time"
                    value={day.ouverture}
                  />
                  <span>à</span>
                  <input
                    aria-label={`${day.label} : fermeture`}
                    className={`h-9 rounded-lg border bg-white/[0.06] px-2 text-sm text-white ${invalid ? 'border-[#ff6b4a]' : 'border-white/10'}`}
                    onChange={(event) => updateDay(day.jour, { fermeture: event.target.value })}
                    type="time"
                    value={day.fermeture}
                  />
                  {invalid && <span className="text-[11px] font-semibold text-[#ff9b84]">La fermeture doit suivre l’ouverture</span>}
                </div>
              ) : (
                <span className="text-xs text-[#88927f]">Pas de réservation possible ce jour-là</span>
              )}
            </li>
          )
        })}
      </ul>

      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <Notice tone="error">{error}</Notice>

      <div className="flex flex-wrap justify-end gap-2">
        {dirty && (
          <button className="rounded-full px-4 py-2.5 text-xs font-semibold text-[#cfd6c9] hover:bg-white/10" onClick={() => setWeek(saved)} type="button">
            Annuler les changements
          </button>
        )}
        <button
          className="rounded-full bg-[#b6f23a] px-5 py-2.5 text-xs font-bold text-[#0b0f0c] hover:bg-[#9ad92a] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!dirty || saving || invalidDays.length > 0}
          onClick={save}
          type="button"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les horaires'}
        </button>
      </div>
    </div>
  )
}
