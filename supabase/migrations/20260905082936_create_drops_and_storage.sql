/*
# Create drops table and public storage bucket

1. New Tables
- `drops`
  - `id` (uuid, primary key)
  - `type` (text, not null) — 'file' or 'text'
  - `filename` (text, nullable) — original filename for file uploads
  - `content` (text, nullable) — text content for text drops
  - `storage_path` (text, nullable) — path in the dropzone storage bucket
  - `mime_type` (text, nullable) — MIME type of the upload
  - `size_bytes` (bigint, nullable) — size in bytes for file uploads
  - `created_at` (timestamptz, default now())

2. Storage
- Create a public bucket `dropzone` for file uploads.
- Storage policies: allow anon + authenticated to read and write objects in the bucket.

3. Security
- Enable RLS on `drops`.
- Allow anon + authenticated full CRUD (intentionally public/shared data, no login).
- Storage bucket policies for public read/write.
*/

CREATE TABLE IF NOT EXISTS drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('file', 'text')),
  filename text,
  content text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_drops" ON drops;
CREATE POLICY "anon_select_drops" ON drops FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_drops" ON drops;
CREATE POLICY "anon_insert_drops" ON drops FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_drops" ON drops;
CREATE POLICY "anon_update_drops" ON drops FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_drops" ON drops;
CREATE POLICY "anon_delete_drops" ON drops FOR DELETE
  TO anon, authenticated USING (true);

-- Create public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('dropzone', 'dropzone', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow anon + authenticated to read and upload
DROP POLICY IF EXISTS "anon_read_dropzone" ON storage.objects;
CREATE POLICY "anon_read_dropzone" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'dropzone');

DROP POLICY IF EXISTS "anon_insert_dropzone" ON storage.objects;
CREATE POLICY "anon_insert_dropzone" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'dropzone');

DROP POLICY IF EXISTS "anon_delete_dropzone" ON storage.objects;
CREATE POLICY "anon_delete_dropzone" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'dropzone');

-- Index for listing drops by newest first
CREATE INDEX IF NOT EXISTS drops_created_at_idx ON drops (created_at DESC);
