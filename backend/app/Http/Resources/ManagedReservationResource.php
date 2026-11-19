<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Réservation telle que la voit le gestionnaire du terrain, avec le lien WhatsApp
 * (message pré-rédigé) pour convenir du paiement avec le client.
 */
class ManagedReservationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $whatsapp = $this->whatsappNumber();

        return [
            'id' => $this->id,
            'statut' => $this->statut,
            'date_debut' => $this->date_debut,
            'date_fin' => $this->date_fin,
            'montant_total' => $this->montant_total,
            'commentaire' => $this->commentaire,
            'motif_refus' => $this->motif_refus,
            'created_at' => $this->created_at,
            'terrain' => $this->whenLoaded('terrain', fn () => [
                'id' => $this->terrain->id,
                'nom' => $this->terrain->nom,
            ]),
            'client' => $this->whenLoaded('utilisateur', fn () => [
                'id' => $this->utilisateur->id,
                'nom' => $this->utilisateur->nom,
                'prenom' => $this->utilisateur->prenom,
            ]),
            'telephone_whatsapp' => $whatsapp ? '+'.$whatsapp : null,
            'whatsapp_url' => $whatsapp ? 'https://wa.me/'.$whatsapp.'?text='.rawurlencode($this->whatsappMessage()) : null,
        ];
    }

    private function whatsappMessage(): string
    {
        $client = $this->relationLoaded('utilisateur') ? $this->utilisateur->prenom : '';
        $terrain = $this->relationLoaded('terrain') ? $this->terrain->nom : 'notre terrain';
        $amount = number_format((float) $this->montant_total, 0, ',', ' ');

        $intro = $this->statut === 'CONFIRMEE'
            ? sprintf('votre réservation de « %s » est confirmée', $terrain)
            : sprintf('je vous contacte au sujet de votre demande pour « %s »', $terrain);

        return trim(sprintf(
            "Bonjour %s, %s : %s de %s à %s. Montant : %s FCFA.\nComment souhaitez-vous régler (Wave, Orange Money, espèces sur place…) ?",
            $client,
            $intro,
            $this->date_debut->translatedFormat('l j F'),
            $this->date_debut->format('H:i'),
            $this->date_fin->format('H:i'),
            $amount,
        ));
    }
}
