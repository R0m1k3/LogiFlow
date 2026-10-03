// Conservé pour compatibilité : délègue au hook unifié (même cache React Query
// partagé, un seul GET /api/user pour toute l'application)
export { useAuthUnified as useAuth } from './useAuthUnified';
