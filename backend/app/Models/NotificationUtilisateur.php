<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationUtilisateur extends Model
{
    protected $table = 'notifications';

    public $timestamps = false;

    protected $fillable = [
        'utilisateur_id',
        'titre',
        'message',
        'lu',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'lu' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'utilisateur_id');
    }
}