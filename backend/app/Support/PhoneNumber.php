<?php

namespace App\Support;

/**
 * Numéros de téléphone pour WhatsApp (liens wa.me : indicatif pays + numéro, chiffres uniquement).
 *
 *   « 77 123 45 67 »       → « 221771234567 »  (numéro sénégalais à 9 chiffres)
 *   « +221 77 123 45 67 »  → « 221771234567 »
 *   « 00 33 6 12 34 56 78 »→ « 33612345678 »    (numéro étranger avec indicatif)
 */
class PhoneNumber
{
    private const SENEGAL_PREFIX = '221';

    public static function toWhatsApp(?string $number): ?string
    {
        if ($number === null) {
            return null;
        }

        $hasInternationalPrefix = str_starts_with(trim($number), '+');
        $digits = preg_replace('/\D+/', '', $number);

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
            $hasInternationalPrefix = true;
        }

        // Numéro sénégalais local : 9 chiffres commençant par 7 (mobiles) ou 3 (fixes).
        if (! $hasInternationalPrefix && preg_match('/^[37]\d{8}$/', $digits)) {
            return self::SENEGAL_PREFIX.$digits;
        }

        if (str_starts_with($digits, self::SENEGAL_PREFIX)) {
            return preg_match('/^221[37]\d{8}$/', $digits) ? $digits : null;
        }

        // Autre pays : indicatif + numéro, 8 à 15 chiffres (norme E.164).
        return $hasInternationalPrefix && preg_match('/^[1-9]\d{7,14}$/', $digits) ? $digits : null;
    }

    public static function isValid(?string $number): bool
    {
        return self::toWhatsApp($number) !== null;
    }
}
