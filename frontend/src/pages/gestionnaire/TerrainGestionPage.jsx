import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { deleteTerrain, getManagedTerrain } from '../../services/api.js'
import AvailabilityDialog from './AvailabilityDialog.jsx'
import { formatPrice, primaryImage, readinessChecklist, readResponse } from './helpers.js'
import TerrainForm from './TerrainForm.jsx'
import HorairesSection from './sections/HorairesSection.jsx'
import IndisponibilitesSection from './sections/IndisponibilitesSection.jsx'
import PhotosSection from './sections/PhotosSection.jsx'
import { AvailabilityBadge, ConfirmButton, Notice, TerrainPhotoPlaceholder } from './ui.jsx'
import Icon from '../../components/Icon.jsx'

const TABS = [
  { key: 'informations', label: 'Informations' },
  { key: 'photos', label: 'Photos' },
  { key: 'horaires', label: 'Horaires' },
  { key: 'indisponibilites', label: 'Fermetures' },
]

export default function TerrainGestionPage() {
  const { terrainId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [terrain, setTerrain] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [busy, setBusy] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const activeTab = TABS.some((tab) => tab.key === searchParams.get('onglet')) ? searchParams.get('onglet') : 'informations'

  const reload = useCallback(async () => {
    const payload = await readResponse(await getManagedTerrain(terrainId))
    setTerrain(payload.data)
    return payload.data
  }, [terrainId])

  useEffect(() => {
    let active = true

    getManagedTerrain(terrainId)
      .then(readResponse)
      .then((payload) => {
        if (active) setTerrain(payload.data)
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.status === 403 || requestError.status === 404 ? 'Ce terrain est introuvable ou ne vous appartient pas.' : requestError.message)
      })

    return () => {
      active = false
    }
  }, [terrainId])

  function selectTab(key) {
    setSearchParams(key === 'informations' ? {} : { onglet: key }, { replace: true })
  }

  async function availabilitySaved(message) {
    await reload()
    setError('')
    setNotice(message)
  }

  async function remove() {
    setBusy(true)
    setError('')

    try {
      await readResponse(await deleteTerrain(terrain.id))
      navigate('/gestionnaire/terrains', { state: { notice: `« ${terrain.nom} » a été supprimé.` } })
    } catch (requestError) {
      setError(requestError.message)
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#88927f] hover:text-[#b6f23a]" to="/gestionnaire/terrains"><Icon className="size-3.5" name="arrow-left" />Mes terrains</Link>
        <Notice tone="error">{loadError}</Notice>
      </div>
    )
  }

  if (!terrain) {
    return <div className="h-64 skeleton" aria-busy="true" />
  }

  const photo = primaryImage(terrain)
  const checklist = readinessChecklist(terrain)
  const missing = checklist.filter((item) => !item.done)

  return (
    <div className="space-y-6">
      <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#88927f] hover:text-[#b6f23a]" to="/gestionnaire/terrains"><Icon className="size-3.5" name="arrow-left" />Mes terrains</Link>

      <header className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[12rem_1fr] sm:p-5">
        <div className="aspect-[4/3] overflow-hidden rounded-xl">
          {photo
            ? <img alt="" className="h-full w-full object-cover" src={photo.url} />
            : <TerrainPhotoPlaceholder className="h-full w-full" terrain={terrain} />}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityBadge terrain={terrain} />
            <span className="text-[11px] text-[#88927f]">{terrain.type} · {terrain.capacite} joueurs · {formatPrice(terrain.tarif_horaire)} / h</span>
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-[#f3f5ef]">{terrain.nom}</h1>
            <p className="text-xs text-[#88927f]">{[terrain.adresse, terrain.quartier, terrain.commune?.nom, 'Dakar'].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-[#cfd6c9]">
            <span><strong className="text-[#f3f5ef]">{terrain.reservations_a_venir_count ?? 0}</strong> réservation(s) à venir</span>
            <span><strong className="text-[#f3f5ef]">{terrain.reservations_en_attente_count ?? 0}</strong> en attente</span>
            <span><strong className="text-[#f3f5ef]">{terrain.reservations_count ?? 0}</strong> au total</span>
          </div>
          {terrain.disponibilite?.motif && (
            <p className="text-[11px] text-[#ffb59f]">Motif affiché aux clients : {terrain.disponibilite.motif}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button className="rounded-full bg-[#b6f23a] px-3.5 py-1.5 text-[11px] font-bold text-[#0b0f0c] hover:bg-[#9ad92a] disabled:opacity-60" disabled={busy} onClick={() => setAvailabilityOpen(true)} type="button">
              Gérer la disponibilité
            </button>
            {terrain.reservations_en_attente_count > 0 && (
              <Link className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b4a]/40 px-3.5 py-1.5 text-[11px] font-semibold text-[#ffb59f] hover:bg-[#ff6b4a]/10" to="/gestionnaire/reservations?vue=en_attente">
                {terrain.reservations_en_attente_count} demande{terrain.reservations_en_attente_count > 1 ? 's' : ''} à valider <Icon className="size-3.5" name="arrow-right" />
              </Link>
            )}
            {terrain.statut === 'ACTIF' && (
              <Link className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10" target="_blank" to={`/terrains/${terrain.id}`}>
                Voir la fiche publique <Icon className="size-3.5" name="arrow-up-right" />
              </Link>
            )}
            <span className="ml-auto">
              <ConfirmButton busy={busy} confirmLabel="Supprimer définitivement" onConfirm={remove}>Supprimer le terrain</ConfirmButton>
            </span>
          </div>
        </div>
      </header>

      {missing.length > 0 && (
        <section className="rounded-2xl border border-[#ff6b4a]/25 bg-[#ff6b4a]/[0.06] p-4" aria-label="Avant d’être réservable">
          <p className="text-sm font-semibold text-[#ffb59f]">Pour que les clients puissent réserver ce terrain :</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {checklist.map((item) => (
              <li className="flex items-center gap-2 text-xs" key={item.key}>
                <span aria-hidden="true" className={`grid size-4 place-items-center rounded-full text-[10px] font-bold ${item.done ? 'bg-[#b6f23a] text-[#0b0f0c]' : 'border border-[#ffb59f]/60 text-[#ffb59f]'}`}>
                  {item.done && <Icon className="size-3" name="check" strokeWidth={3} />}
                </span>
                {item.done || !item.tab ? (
                  <span className={item.done ? 'text-[#88927f] line-through' : 'text-[#f3f5ef]'}>{item.label}</span>
                ) : (
                  <button className="text-left font-semibold text-[#f3f5ef] underline decoration-[#ffb59f]/50 underline-offset-2 hover:text-[#ffb59f]" onClick={() => selectTab(item.tab)} type="button">
                    {item.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <Notice tone="error">{error}</Notice>

      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist" aria-label="Gestion du terrain">
          {TABS.map((tab) => {
            const count = tab.key === 'photos' ? terrain.images?.length : tab.key === 'horaires' ? terrain.horaires_actifs_count : null

            return (
              <button
                aria-selected={activeTab === tab.key}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${activeTab === tab.key ? 'border-[#b6f23a] text-[#f3f5ef]' : 'border-transparent text-[#88927f] hover:text-[#cfd6c9]'}`}
                key={tab.key}
                onClick={() => selectTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
                {count != null && <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="pt-5" role="tabpanel">
          {activeTab === 'informations' && (
            <TerrainForm
              key={`${terrain.id}-${terrain.updated_at}`}
              onSaved={async () => {
                await reload()
                setNotice('Modifications enregistrées.')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              terrain={terrain}
            />
          )}
          {activeTab === 'photos' && <PhotosSection onChanged={reload} terrain={terrain} />}
          {activeTab === 'horaires' && <HorairesSection onChanged={reload} terrainId={terrain.id} />}
          {activeTab === 'indisponibilites' && <IndisponibilitesSection onChanged={reload} terrainId={terrain.id} />}
        </div>
      </div>

      {availabilityOpen && (
        <AvailabilityDialog
          onClose={() => setAvailabilityOpen(false)}
          onSaved={(_terrain, message) => availabilitySaved(message)}
          terrain={terrain}
        />
      )}
    </div>
  )
}
