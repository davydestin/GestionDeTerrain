import { Link, useNavigate } from 'react-router-dom'
import TerrainForm from './TerrainForm.jsx'
import Icon from '../../components/Icon.jsx'

export default function NouveauTerrainPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#88927f] hover:text-[#b6f23a]" to="/gestionnaire/terrains"><Icon className="size-3.5" name="arrow-left" />Mes terrains</Link>
      <div>
        <p className="eyebrow">Nouveau terrain</p>
        <h1 className="font-display text-3xl font-semibold uppercase text-[#f3f5ef] sm:text-4xl">Ajouter un terrain</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#88927f]">
          Renseignez l’essentiel et placez le terrain sur la carte. Vous ajouterez ensuite les photos et les horaires d’ouverture.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <TerrainForm
          onCancel={() => navigate('/gestionnaire/terrains')}
          onSaved={(terrain) => navigate(`/gestionnaire/terrains/${terrain.id}?onglet=photos`, {
            state: { notice: 'Terrain créé ! Ajoutez maintenant des photos, puis les horaires d’ouverture pour qu’il soit réservable.' },
          })}
          submitLabel="Créer le terrain et continuer"
        />
      </div>
    </div>
  )
}
