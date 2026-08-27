/**
 * Le foyer historique et son identifiant de compatibilité sont posés par
 * migration. C'est aussi la valeur par défaut de `User.householdId`, ce qui
 * laisse la version précédente de l'API créer des Comptes pendant une fenêtre
 * de déploiement (ADR 0024).
 */
export const ID_FOYER = '11111111-1111-4111-8111-111111111111';

/** L'Espace du Foyer, posé par la même migration. */
export const ID_ESPACE_FOYER = '22222222-2222-4222-8222-222222222222';
