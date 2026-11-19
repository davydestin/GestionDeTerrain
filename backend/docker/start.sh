#!/bin/sh
# Démarrage du conteneur : préparation de Laravel puis lancement d'Apache.
set -e

# Render génère APP_KEY en base64 brut : Laravel attend le préfixe « base64: ».
case "$APP_KEY" in
  base64:*|"") ;;
  *) export APP_KEY="base64:$APP_KEY" ;;
esac

php artisan config:cache
php artisan route:cache
php artisan storage:link 2>/dev/null || true

# Tables à jour, puis données de base (communes, compte administrateur) : rejouable sans doublon.
php artisan migrate --force
php artisan db:seed --force

chown -R www-data:www-data storage bootstrap/cache
exec apache2-foreground
