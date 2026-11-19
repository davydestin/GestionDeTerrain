<?php

namespace App\Services;

use RuntimeException;

/**
 * Le fournisseur de géocodage a répondu en erreur (refus, quota, panne) :
 * ce n'est pas une faute de saisie, l'API répond donc 503 et non 422.
 */
class GeocodingUnavailableException extends RuntimeException
{
}
