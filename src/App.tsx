import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, BUCKET_NAME } from '@/lib/supabase';
import type { Drop } from '@/lib/types';
import { formatBytes, formatTimeAgo, formatFullDate } from '@/lib/format';
import { Upload, FileText, Download, Copy, Trash2, Link2, Loader2, CloudUpload, File as FileIcon, Type, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export default function App() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDrops = useCallback(async () => {
    const { data, error } = await supabase
      .from('drops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError('Could not load drops. Please try again.');
    } else {
      setDrops(data as Drop[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`"${file.name}" exceeds the 50 MB limit.`);
          continue;
        }

        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('drops').insert({
          type: 'file',
          filename: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        });

        if (insertError) throw insertError;
      }

      await fetchDrops();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setUploading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('drops').insert({
        type: 'text',
        content: trimmed,
        size_bytes: new Blob([trimmed]).size,
      });

      if (insertError) throw insertError;

      setText('');
      await fetchDrops();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save text. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (drop: Drop) => {
    if (!drop.storage_path) return;
    try {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(drop.storage_path);
      const res = await fetch(data.publicUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = drop.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download this file.');
    }
  };

  const handleCopy = async (drop: Drop) => {
    if (drop.content) {
      await navigator.clipboard.writeText(drop.content);
    }
  };

  const handleDelete = async (drop: Drop) => {
    try {
      if (drop.storage_path) {
        await supabase.storage.from(BUCKET_NAME).remove([drop.storage_path]);
      }
      const { error } = await supabase.from('drops').delete().eq('id', drop.id);
      if (error) throw error;
      setDrops((prev) => prev.filter((d) => d.id !== drop.id));
    } catch {
      setError('Could not delete this drop.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/30">
              <CloudUpload className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Public Dropzone</h1>
              <p className="text-xs text-slate-500">No accounts. No login. Just drop it.</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            {drops.length} {drops.length === 1 ? 'drop' : 'drops'} live
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Upload zone */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* File upload card */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`group relative overflow-hidden rounded-2xl border-2 border-dashed bg-white p-8 transition-all duration-300 ${
              dragOver
                ? 'border-sky-500 bg-sky-50/50 scale-[1.01] shadow-lg shadow-sky-500/10'
                : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
                dragOver ? 'bg-sky-500 text-white scale-110' : 'bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white'
              }`}>
                <Upload className="h-7 w-7" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Drop files here</h2>
              <p className="mt-1 text-sm text-slate-500">
                Drag & drop or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-2 text-xs text-slate-400">Max 50 MB per file</p>
            </div>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                  <span className="text-sm font-medium text-slate-600">Uploading...</span>
                </div>
              </div>
            )}
          </div>

          {/* Text upload card */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Type className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Paste text</h2>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste anything — code, notes, a secret message..."
              className="min-h-[120px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!text.trim() || uploading}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Drop text
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}

        {/* Drops list */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All drops</h2>
            <span className="text-xs text-slate-400">Visible to everyone</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : drops.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 py-20 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-600">No drops yet</p>
              <p className="mt-1 text-xs text-slate-400">Be the first to drop something above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drops.map((drop) => (
                <DropCard
                  key={drop.id}
                  drop={drop}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200/80 py-6 text-center">
        <p className="text-xs text-slate-400">
          Public Dropzone — everything uploaded is visible to everyone. Be kind.
        </p>
      </footer>
    </div>
  );
}

function DropCard({
  drop,
  onDownload,
  onCopy,
  onDelete,
}: {
  drop: Drop;
  onDownload: (d: Drop) => void;
  onCopy: (d: Drop) => void;
  onDelete: (d: Drop) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy(drop);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFile = drop.type === 'file';

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:p-5">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
          isFile ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'
        }`}>
          {isFile ? <FileIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {isFile ? (
            <>
              <h3 className="truncate text-sm font-semibold text-slate-900">{drop.filename}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {drop.mime_type || 'file'} · {formatBytes(drop.size_bytes)}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-slate-900">Text drop</h3>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                {drop.content}
              </p>
            </>
          )}
          <p className="mt-1 text-xs text-slate-400" title={formatFullDate(drop.created_at)}>
            {formatTimeAgo(drop.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {isFile ? (
            <button
              onClick={() => onDownload(drop)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-sky-500 hover:text-white"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          ) : (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-violet-500 hover:text-white"
              title="Copy text"
            >
              {copied ? <Link2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
          <button
            onClick={() => onDelete(drop)}
            className="flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-500 transition hover:bg-red-500 hover:text-white"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
