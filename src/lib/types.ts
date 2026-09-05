export interface Drop {
  id: string;
  type: 'file' | 'text';
  filename: string | null;
  content: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}
