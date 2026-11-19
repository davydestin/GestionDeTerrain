export const roleLabels = {
  CLIENT: 'Client',
  GESTIONNAIRE: 'Gestionnaire',
  ADMINISTRATEUR: 'Administrateur',
}

// Page d'arrivée après connexion : le client arrive directement sur les terrains à réserver.
export const rolePaths = {
  CLIENT: '/client/terrains',
  GESTIONNAIRE: '/gestionnaire/terrains',
  ADMINISTRATEUR: '/administrateur/utilisateurs',
}

export const roleNavigation = {
  CLIENT: [
    { to: '/client/terrains', label: 'Terrains' },
    { to: '/client/carte', label: 'Carte' },
    { to: '/client/reservations', label: 'Mes réservations' },
    { to: '/client/profil', label: 'Mon profil' },
  ],
  GESTIONNAIRE: [
    { to: '/gestionnaire/reservations', label: 'Demandes' },
    { to: '/gestionnaire/terrains', label: 'Mes terrains' },
  ],
  ADMINISTRATEUR: [
    { to: '/administrateur/utilisateurs', label: 'Utilisateurs' },
    { to: '/administrateur/journal', label: 'Journal d’audit' },
    { to: '/administrateur/logs', label: 'Logs' },
  ],
}
