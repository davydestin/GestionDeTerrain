import { useRef, useState } from 'react'
import { deleteTerrainImage, setPrimaryTerrainImage, uploadTerrainImages } from '../../../services/api.js'
import { readResponse } from '../helpers.js'
import { ConfirmButton, Notice } from '../ui.jsx'

// Mêmes limites que StoreTerrainImagesRequest côté API.
const MAX_FILES = 10
const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function PhotosSection({ terrain, onChanged }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [busyImageId, setBusyImageId] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const images = terrain.images || []

  async function upload(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    const invalidType = files.find((file) => !ACCEPTED_TYPES.includes(file.type))
    const tooBig = files.find((file) => file.size > MAX_SIZE_MB * 1024 * 1024)
    if (files.length > MAX_FILES) return setError(`Ajoutez au plus ${MAX_FILES} photos à la fois.`)
    if (invalidType) return setError(`« ${invalidType.name} » n’est pas une image JPG, PNG ou WebP.`)
    if (tooBig) return setError(`« ${tooBig.name} » dépasse ${MAX_SIZE_MB} Mo.`)

    setUploading(true)
    setError('')
    setNotice('')

    try {
      await readResponse(await uploadTerrainImages(terrain.id, files))
      // Le message n'apparaît qu'une fois la galerie rechargée, pour ne jamais décrire un état pas encore affiché.
      await onChanged()
      setNotice(`${files.length} photo${files.length > 1 ? 's ajoutées' : ' ajoutée'}.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function runImageAction(image, action, successMessage) {
    setBusyImageId(image.id)
    setError('')
    setNotice('')

    try {
      await readResponse(await action())
      await onChanged()
      setNotice(successMessage)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyImageId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? 'border-[#b6f23a] bg-[#b6f23a]/10' : 'border-white/15 bg-white/[0.03]'}`}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload(event.dataTransfer.files)
        }}
      >
        <p className="text-sm font-semibold text-[#f3f5ef]">Glissez vos photos ici</p>
        <p className="text-[11px] text-[#88927f]">JPG, PNG ou WebP · {MAX_SIZE_MB} Mo max par photo · {MAX_FILES} à la fois</p>
        <button
          className="mt-2 rounded-full bg-[#b6f23a] px-4 py-2 text-xs font-bold text-[#0b0f0c] disabled:opacity-60"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {uploading ? 'Envoi en cours…' : 'Choisir des photos'}
        </button>
        <input
          accept={ACCEPTED_TYPES.join(',')}
          aria-label="Ajouter des photos"
          className="sr-only"
          multiple
          onChange={(event) => upload(event.target.files)}
          ref={inputRef}
          type="file"
        />
      </div>

      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <Notice tone="error">{error}</Notice>

      {images.length === 0 ? (
        <p className="text-sm text-[#88927f]">
          Aucune photo pour l’instant. Les terrains avec photos sont bien plus consultés par les clients.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]" key={image.id}>
              <div className="relative aspect-[4/3]">
                <img alt="" className="h-full w-full object-cover" loading="lazy" src={image.url} />
                {image.est_principale && (
                  <span className="absolute left-3 top-3 rounded-full bg-[#b6f23a] px-2.5 py-1 text-[10px] font-bold uppercase text-[#0b0f0c]">
                    Photo principale
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3">
                {!image.est_principale && (
                  <button
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#cfd6c9] hover:bg-white/10 disabled:opacity-60"
                    disabled={busyImageId === image.id}
                    onClick={() => runImageAction(image, () => setPrimaryTerrainImage(terrain.id, image.id), 'Photo principale mise à jour.')}
                    type="button"
                  >
                    Mettre en principale
                  </button>
                )}
                <span className="ml-auto">
                  <ConfirmButton
                    busy={busyImageId === image.id}
                    confirmLabel="Supprimer"
                    onConfirm={() => runImageAction(image, () => deleteTerrainImage(terrain.id, image.id), 'Photo supprimée.')}
                  >
                    Supprimer
                  </ConfirmButton>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
