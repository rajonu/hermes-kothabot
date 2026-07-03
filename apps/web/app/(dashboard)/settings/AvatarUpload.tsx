'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, Loader2, Check } from 'lucide-react';

interface Props {
  currentAvatar: string | null;
  shopName: string;
}

export function AvatarUpload({ currentAvatar, shopName }: Props) {
  const router              = useRouter();
  const fileRef             = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');
  const [pending, start]    = useTransition();

  const initials = shopName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) { setError('Image must be under 1MB.'); return; }
    if (!file.type.startsWith('image/')) { setError('Only image files allowed.'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      // Auto-save immediately
      start(async () => {
        const res = await fetch('/api/settings/update-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: dataUrl }),
        });
        if (res.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          router.refresh();
        } else {
          setError('Failed to save avatar');
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    start(async () => {
      await fetch('/api/settings/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: null }),
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-5">
      {/* Avatar circle */}
      <div className="relative group">
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#1e3d2c]"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border-2 border-[#1e3d2c] flex items-center justify-center">
            <span className="text-xl font-bold text-emerald-400">{initials || '?'}</span>
          </div>
        )}
        {/* Overlay on hover */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {pending ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <div>
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#162b20] border border-[#1e3d2c] text-[#7a9e88] hover:text-white hover:border-[#00e676]/50 transition-colors flex items-center gap-1.5"
          >
            <Camera size={12} /> Change photo
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
          {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
        </div>
        <p className="text-[11px] text-[#3a5e48]">JPG, PNG · Max 1MB · Shown in widget & account</p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    </div>
  );
}
