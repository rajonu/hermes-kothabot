'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Code2, Smartphone, Globe, RefreshCw } from 'lucide-react';
import { VoiceWidget } from '@/components/voice/VoiceWidget';

interface Props {
  shopId: string;
  shopName: string;
  themeColor: string;
  language: string;
  appUrl: string;
  avatar?: string | null;
  systemPrompt?: string;
  greetingMessage?: string;
  enableVoice?: boolean;
  enableChat?: boolean;
  category?: string;
  publicSlug?: string | null;
}

export function EmbedConfigurator({
  shopId, shopName, themeColor, language, appUrl,
  avatar, systemPrompt, greetingMessage,
  enableVoice = true, enableChat = true, category,
  publicSlug,
}: Props) {
  const [color, setColor]       = useState(themeColor);
  const [position, setPosition] = useState<'right' | 'left'>('right');
  const [lang, setLang]         = useState(language);
  const [copied, setCopied]     = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const widgetUrl  = `${appUrl}/widget/${shopId}`;
  // If shop has a public slug, prefer the friendly URL for sharing
  const voiceLinkBase = process.env.NEXT_PUBLIC_VOICE_LINK_URL ?? 'https://call.kothabot.ai.bd';
  const publicUrl  = publicSlug ? `${voiceLinkBase}/${publicSlug}` : null;
  const displayUrl = (publicUrl ?? widgetUrl).replace(/^https?:\/\//, '');

  const modeParam = enableVoice && !enableChat ? '&mode=voice' : !enableVoice && enableChat ? '&mode=chat' : '';
  const widgetSrc = `${widgetUrl}?color=${encodeURIComponent(color)}&lang=${lang}${modeParam}`;

  const embedCode  = `<script src="${appUrl}/embed.js"\n  data-shop="${shopId}"\n  data-color="${color}"\n  data-position="${position}"\n  data-lang="${lang}">\n</script>`;
  // iFrame uses public URL if available, otherwise the raw widget URL
  const iframeSrc = publicUrl ? `${publicUrl}` : widgetSrc;
  const iframeCode = `<iframe\n  src="${iframeSrc}"\n  allow="microphone"\n  width="360" height="580"\n  style="border:none;border-radius:20px;">\n</iframe>`;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">

      {/* ── Website embed ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/15 flex items-center justify-center">
            <Globe size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Website Embed</h2>
            <p className="text-xs text-gray-400">Add a floating voice &amp; chat button to any website</p>
          </div>
          <a href={publicUrl ?? widgetUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            Preview <ExternalLink size={12} />
          </a>
        </div>

        <div className="p-5 space-y-5">
          {/* Customization row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Button Color</label>
              <div className="flex items-center gap-2.5">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-900 cursor-pointer p-0.5" />
                <code className="text-xs text-gray-300 font-mono bg-gray-900 px-2 py-1 rounded">{color}</code>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Position</label>
              <div className="flex gap-2">
                {(['right', 'left'] as const).map(p => (
                  <button key={p} onClick={() => setPosition(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      position === p
                        ? 'bg-emerald-600/15 border-emerald-600/30 text-emerald-500'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
                    }`}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Language</label>
              <select value={lang} onChange={e => setLang(e.target.value)}
                className="w-full py-2 px-3 rounded-lg text-xs text-white bg-gray-700 border border-gray-600 focus:outline-none focus:border-emerald-600/50">
                <option value="auto">Auto-detect</option>
                <option value="bn">Bengali (বাংলা)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Mode indicator (read-only — configured in Settings) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Active modes:</span>
            {enableVoice && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/15 border border-emerald-600/30 text-emerald-400">Voice</span>
            )}
            {enableChat && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-600/15 border border-cyan-600/30 text-cyan-400">Chat</span>
            )}
            <span className="text-xs text-gray-600">· Change in Settings → Widget</span>
          </div>

          {/* Embed code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-400">Embed Code — paste before &lt;/body&gt;</span>
              </div>
              <button onClick={() => copy(embedCode, 'embed')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors">
                {copied === 'embed' ? <><Check size={12} className="text-emerald-500" /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <pre className="text-xs text-emerald-400 bg-gray-900 rounded-lg p-4 overflow-x-auto leading-relaxed font-mono border border-gray-700">
              {embedCode}
            </pre>
          </div>
        </div>
      </div>

      {/* ── Live Preview (phone frame) ───────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
          <div className="w-9 h-9 rounded-lg bg-violet-600/15 flex items-center justify-center">
            <Smartphone size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Live Preview</h2>
            <p className="text-xs text-gray-400">Test voice &amp; chat as your customers see it</p>
          </div>
          <button onClick={() => setPreviewKey(k => k + 1)}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={13} /> Reload
          </button>
        </div>
        <div className="p-5 flex justify-center">
          <div className="relative" style={{ width: 320 }}>
            <div className="rounded-[2rem] overflow-hidden border-4 border-gray-700 shadow-2xl" style={{ height: 580 }}>
              <iframe key={previewKey} src={widgetSrc} allow="microphone"
                className="w-full h-full" style={{ border: 'none', background: '#111827' }}
                title="Widget Preview" />
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-700 rounded-b-xl" />
          </div>
        </div>
      </div>

      {/* ── Direct Link / iFrame ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
          <div className="w-9 h-9 rounded-lg bg-cyan-600/15 flex items-center justify-center">
            <Smartphone size={18} className="text-cyan-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Direct Link / iFrame</h2>
            <p className="text-xs text-gray-400">Embed directly inside your app or web page</p>
          </div>
        </div>
        <div className="p-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">iFrame Code</span>
              <button onClick={() => copy(iframeCode, 'iframe')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors">
                {copied === 'iframe' ? <><Check size={12} className="text-emerald-500" /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <pre className="text-xs text-cyan-400 bg-gray-900 rounded-lg p-4 overflow-x-auto leading-relaxed font-mono border border-gray-700">
              {iframeCode}
            </pre>
          </div>
        </div>
      </div>


      {/* ── Floating widget — same VoiceWidget as sitewide, shows avatar ──────── */}
      <VoiceWidget
        shopId={shopId}
        shopName={shopName}
        systemPrompt={systemPrompt}
        greetingMessage={greetingMessage}
        themeColor={color}
        language={language as any}
        avatar={avatar}
        category={category}
      />
    </div>
  );
}
