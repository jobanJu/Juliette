-- ============================================================================
-- 006 — Photo de profil (Mon profil, sidebar).
-- ============================================================================

alter table comptes add column avatar_url text;
comment on column comptes.avatar_url is
  'Photo de profil — data URL redimensionnée côté client (voir fileToResizedDataUrl dans src/lib/profil.ts). Pas de bucket Storage pour l''instant, même principe que fiches_techniques.images / messages.attachments.';
