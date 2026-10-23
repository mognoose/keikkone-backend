-- Genres are curated reference data that the app needs in every environment
-- (event and artist creation validate against them), so they ship as a
-- migration rather than in the dev-only seed. Prisma's @default(uuid()) is
-- applied client-side, so ids are generated here with gen_random_uuid().
-- ON CONFLICT keeps this safe on databases that already have some genres.
INSERT INTO "Genre" ("id", "name", "slug") VALUES
  (gen_random_uuid(), 'Rock', 'rock'),
  (gen_random_uuid(), 'Metal', 'metal'),
  (gen_random_uuid(), 'Heavy Metal', 'heavy-metal'),
  (gen_random_uuid(), 'Death Metal', 'death-metal'),
  (gen_random_uuid(), 'Black Metal', 'black-metal'),
  (gen_random_uuid(), 'Doom Metal', 'doom-metal'),
  (gen_random_uuid(), 'Symphonic Metal', 'symphonic-metal'),
  (gen_random_uuid(), 'Punk', 'punk'),
  (gen_random_uuid(), 'Hardcore', 'hardcore'),
  (gen_random_uuid(), 'Indie', 'indie'),
  (gen_random_uuid(), 'Alternative', 'alternative'),
  (gen_random_uuid(), 'Pop', 'pop'),
  (gen_random_uuid(), 'Suomipop', 'suomipop'),
  (gen_random_uuid(), 'Hip Hop', 'hip-hop'),
  (gen_random_uuid(), 'Electronic', 'electronic'),
  (gen_random_uuid(), 'Techno', 'techno'),
  (gen_random_uuid(), 'Jazz', 'jazz'),
  (gen_random_uuid(), 'Blues', 'blues'),
  (gen_random_uuid(), 'Folk', 'folk'),
  (gen_random_uuid(), 'Classical', 'classical'),
  (gen_random_uuid(), 'Iskelmä', 'iskelma'),
  (gen_random_uuid(), 'Reggae', 'reggae'),
  (gen_random_uuid(), 'Country', 'country'),
  (gen_random_uuid(), 'Soul', 'soul')
ON CONFLICT DO NOTHING;
