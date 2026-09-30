// Chat with Stain's assistant (AI answers via /api/chat, which keeps the key server-side).
// Loaded on demand the first time someone opens the chat.
import { track } from './analytics.js';

const GREETING = "Hey! Ask me anything about ELO boosting, pricing, or how it works.";
let panel, list, input, sendBtn, history = [], opened = false, lastFocus = null;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function build() {
  panel = el('div', 'sbchat');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', "Chat with Stain's assistant");
  panel.innerHTML = `
    <div class="sbchat-head">
      <div><p class="sbchat-title">Stain's Assistant</p><p class="sbchat-sub">Instant answers · Stain himself is on Discord</p></div>
      <button type="button" class="sbchat-close" aria-label="Close chat">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sbchat-list" aria-live="polite"></div>
    <form class="sbchat-form">
      <label class="visually-hidden" for="sbchat-input">Your message</label>
      <textarea id="sbchat-input" rows="1" maxlength="600" placeholder="Type a message…"></textarea>
      <button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 21 23 12 2 3v7l15 2-15 2z"/></svg></button>
    </form>`;
  document.body.appendChild(panel);
  list = panel.querySelector('.sbchat-list');
  input = panel.querySelector('textarea');
  sendBtn = panel.querySelector('button[type=submit]');
  panel.querySelector('.sbchat-close').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); send(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
}

function add(kind, text) {
  const m = el('div', 'sbchat-msg ' + kind, text);
  list.appendChild(m);
  list.scrollTop = list.scrollHeight;
  return m;
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  add('me', text);
  history.push({ role: 'user', content: text });
  input.value = ''; input.style.height = 'auto';
  sendBtn.disabled = true;
  const typing = add('bot typing', '');
  typing.innerHTML = '<span></span><span></span><span></span>';
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok) { add('err', data.error || 'Something went wrong. Please try again in a moment.'); return; }
    const reply = data.reply || "Sorry, I didn't get a response.";
    add('bot', reply);
    history.push({ role: 'assistant', content: reply });
  } catch {
    typing.remove();
    add('err', 'Something went wrong. Please try again in a moment.');
  } finally {
    sendBtn.disabled = false;
  }
}

export function openChat() {
  if (!panel) build();
  lastFocus = document.activeElement;
  panel.classList.add('open');
  document.body.classList.add('chat-open');
  if (!opened) { add('bot', GREETING); opened = true; track('chat_open'); }
  input.focus();
}

function close() {
  panel.classList.remove('open');
  document.body.classList.remove('chat-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

const css = `
.sbchat{position:fixed;z-index:70;inset-inline-end:18px;inset-block-end:18px;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100dvh - 110px));display:none;flex-direction:column;border-radius:20px;overflow:hidden;background:#0b0820;border:1px solid rgba(139,92,246,.35);box-shadow:0 30px 80px -20px rgba(0,0,0,.8),0 0 0 1px rgba(124,58,237,.2);font-family:var(--font-body)}
.sbchat.open{display:flex}
.sbchat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(135deg,rgba(124,58,237,.35),rgba(6,214,242,.08));border-block-end:1px solid rgba(139,92,246,.25)}
.sbchat-title{font-family:var(--font-display);font-weight:900;font-size:.95rem;color:#fff;letter-spacing:.04em}
.sbchat-sub{font-size:.78rem;color:rgba(255,255,255,.62)}
.sbchat-close{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#fff;display:grid;place-items:center}
.sbchat-list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.sbchat-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:.93rem;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.sbchat-msg.bot{align-self:flex-start;background:rgba(6,214,242,.08);border:1px solid rgba(6,214,242,.22);color:var(--text);border-end-start-radius:4px}
.sbchat-msg.me{align-self:flex-end;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-end-end-radius:4px}
.sbchat-msg.err{align-self:flex-start;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#fecaca}
.sbchat-msg.typing{display:flex;gap:4px}
.sbchat-msg.typing span{width:6px;height:6px;border-radius:50%;background:var(--cyan);animation:sbdot 1.2s infinite}
.sbchat-msg.typing span:nth-child(2){animation-delay:.15s}.sbchat-msg.typing span:nth-child(3){animation-delay:.3s}
@keyframes sbdot{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-3px)}}
.sbchat-form{display:flex;gap:8px;align-items:flex-end;padding:12px;border-block-start:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
.sbchat-form textarea{flex:1;resize:none;max-height:110px;padding:10px 14px;border-radius:14px;border:1px solid var(--border-strong);background:rgba(255,255,255,.04);color:var(--text);font-size:1rem}
.sbchat-form textarea:focus{outline:none;border-color:var(--purple-light);box-shadow:0 0 0 3px rgba(124,58,237,.25)}
.sbchat-form button{width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7c3aed,#6d28d9)}
.sbchat-form button:disabled{opacity:.5}
@media (max-width:760px){.sbchat{inset-inline:8px;inset-block-end:8px;width:auto;height:min(78dvh,620px)}}
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
