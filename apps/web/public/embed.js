/**
 * KothaBot Embed Script v4 — Dual-bubble launcher + optional booking button
 * Usage: <script src="https://my.kothabot.ai.bd/embed.js"
 *          data-shop="SHOP_ID"
 *          data-color="#10b981"
 *          data-position="right"
 *          data-lang="auto"
 *          data-book="1">    ← add this to show the Book Appointment bubble
 *        </script>
 */
(function () {
  'use strict';

  var script   = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var shopId    = script.getAttribute('data-shop');
  var color     = script.getAttribute('data-color')      || '#10b981';
  var position  = script.getAttribute('data-position')   || 'right';
  var lang      = script.getAttribute('data-lang')       || 'auto';
  var showBook  = script.getAttribute('data-book')       === '1';
  var bookColor = script.getAttribute('data-book-color') || color;
  var bookTheme = script.getAttribute('data-book-theme') || 'dark';
  var baseUrl   = script.src.replace('/embed.js', '');

  if (!shopId) {
    console.warn('[KothaBot] Missing data-shop attribute');
    return;
  }

  if (document.getElementById('kothabot-root')) return;

  // ── SVG icons ────────────────────────────────────────────────────────────────
  var phoneSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12 19.79 19.79 0 0 1 1 3.18 2 2 0 0 1 2.98 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var chatSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var calSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  // ── Styles ───────────────────────────────────────────────────────────────────
  var align = position === 'left' ? 'flex-start' : 'flex-end';
  var side  = position === 'left' ? 'left:20px'  : 'right:20px';

  var style = document.createElement('style');
  style.textContent = [
    '@keyframes kb-enter{0%{opacity:0;transform:scale(0.5) translateY(12px)}100%{opacity:1;transform:scale(1) translateY(0)}}',
    '@keyframes kb-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',

    '#kothabot-root{position:fixed;bottom:20px;' + side + ';z-index:2147483647;display:flex;flex-direction:column;align-items:' + align + ';gap:0;font-family:system-ui,-apple-system,sans-serif;}',

    /* iframe */
    '#kothabot-frame{display:none;width:370px;height:600px;border:none;border-radius:16px;box-shadow:0 16px 64px rgba(0,0,0,0.45);margin-bottom:12px;overflow:hidden;animation:kb-enter 0.25s ease-out;}',
    '#kothabot-frame.open{display:block;}',
    '@media(max-width:420px){#kothabot-frame{width:100vw;height:100dvh;border-radius:0;position:fixed;inset:0;margin:0;}}',

    /* bubble row */
    '.kb-bubbles{display:flex;align-items:center;gap:10px;}',

    /* individual bubble */
    '.kb-bubble{position:relative;width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:0;transition:transform 0.2s,box-shadow 0.2s;animation:kb-enter 0.35s ease-out backwards;}',
    '.kb-bubble:hover{transform:scale(1.1);}',
    '.kb-bubble:active{transform:scale(0.92);}',
    '.kb-bubble svg{width:22px;height:22px;display:block;flex-shrink:0;}',

    /* staggered entry */
    '.kb-bubble-voice{animation-delay:0.1s;}',
    '.kb-bubble-chat{animation-delay:0.25s;}',
    '.kb-bubble-book{animation-delay:0.4s;}',

    /* gentle bounce — runs once after entry */
    '.kb-bounce{animation:kb-bounce 2s ease-in-out 1s 3;}',

    /* close button replaces bubbles */
    '.kb-close{width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;background:#ef4444;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(239,68,68,0.4);transition:transform 0.2s;animation:kb-enter 0.2s ease-out;}',
    '.kb-close:hover{transform:scale(1.1);}',
    '.kb-close:active{transform:scale(0.92);}',
    '.kb-close svg{width:20px;height:20px;}',

    /* tooltip */
    '.kb-tip{position:absolute;bottom:100%;margin-bottom:6px;white-space:nowrap;padding:5px 10px;border-radius:8px;background:#1f2937;color:#e5e7eb;font-size:12px;font-weight:500;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity 0.15s,transform 0.15s;}',
    '.kb-bubble:hover .kb-tip{opacity:1;transform:translateY(0);}',
  ].join('\n');
  document.head.appendChild(style);

  // ── DOM ──────────────────────────────────────────────────────────────────────
  var root = document.createElement('div');
  root.id = 'kothabot-root';

  var frame = document.createElement('iframe');
  frame.id = 'kothabot-frame';
  frame.allow = 'microphone';
  frame.setAttribute('allowfullscreen', '');

  var bubblesRow = document.createElement('div');
  bubblesRow.className = 'kb-bubbles';

  // Chat bubble
  var chatBtn = document.createElement('button');
  chatBtn.className = 'kb-bubble kb-bubble-chat kb-bounce';
  chatBtn.setAttribute('aria-label', 'Chat with AI assistant');
  chatBtn.style.background = '#374151';
  chatBtn.style.boxShadow = '0 4px 16px rgba(55,65,81,0.5)';
  chatBtn.innerHTML = '<span class="kb-tip">Chat</span>' + chatSvg;

  // Voice bubble
  var voiceBtn = document.createElement('button');
  voiceBtn.className = 'kb-bubble kb-bubble-voice kb-bounce';
  voiceBtn.setAttribute('aria-label', 'Call AI assistant');
  voiceBtn.style.background = color;
  voiceBtn.style.boxShadow = '0 4px 20px ' + color + '50';
  voiceBtn.innerHTML = '<span class="kb-tip">Voice Call</span>' + phoneSvg;

  // Close button (hidden initially)
  var closeBtn = document.createElement('button');
  closeBtn.className = 'kb-close';
  closeBtn.setAttribute('aria-label', 'Close widget');
  closeBtn.innerHTML = closeSvg;
  closeBtn.style.display = 'none';

  bubblesRow.appendChild(chatBtn);
  bubblesRow.appendChild(voiceBtn);

  // Book Appointment bubble — only shown when data-book="1"
  var bookBtn = null;
  if (showBook) {
    bookBtn = document.createElement('button');
    bookBtn.className = 'kb-bubble kb-bubble-book kb-bounce';
    bookBtn.setAttribute('aria-label', 'Book appointment');
    bookBtn.style.background = '#7c3aed';
    bookBtn.style.boxShadow = '0 4px 20px rgba(124,58,237,0.5)';
    bookBtn.innerHTML = '<span class="kb-tip">Book Appointment</span>' + calSvg;
    bubblesRow.appendChild(bookBtn);
  }

  root.appendChild(frame);
  root.appendChild(bubblesRow);
  root.appendChild(closeBtn);
  document.body.appendChild(root);

  // ── Interaction ──────────────────────────────────────────────────────────────
  var isOpen = false;
  var currentMode = 'voice';

  function buildSrc(mode) {
    if (mode === 'book') return baseUrl + '/book/' + shopId + '?color=' + encodeURIComponent(bookColor) + '&theme=' + bookTheme;
    return baseUrl + '/widget/' + shopId + '?lang=' + lang + '&color=' + encodeURIComponent(color) + '&mode=' + mode + '&autostart=1';
  }

  function openWidget(mode) {
    currentMode = mode;
    frame.src = buildSrc(mode);
    // Booking page needs more height
    if (mode === 'book') {
      frame.style.height = '750px';
      frame.style.width  = '430px';
    } else {
      frame.style.height = '';
      frame.style.width  = '';
    }
    frame.classList.add('open');
    bubblesRow.style.display = 'none';
    closeBtn.style.display = 'flex';
    isOpen = true;
  }

  function closeWidget() {
    frame.classList.remove('open');
    frame.src = 'about:blank';
    frame.style.height = '';
    frame.style.width  = '';
    bubblesRow.style.display = 'flex';
    closeBtn.style.display = 'none';
    isOpen = false;
  }

  voiceBtn.addEventListener('click', function () { openWidget('voice'); });
  chatBtn.addEventListener('click', function ()  { openWidget('chat');  });
  if (bookBtn) bookBtn.addEventListener('click', function () { openWidget('book'); });
  closeBtn.addEventListener('click', closeWidget);
})();
