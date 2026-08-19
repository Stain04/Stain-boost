/**
 * AI Chat Widget — drop-in live chat powered by your own backend.
 *
 * USAGE:
 *   <script src="chatbot-widget.js"></script>
 *   <script>
 *     AIChatWidget.init({
 *       apiUrl: "https://your-backend.com/api/chat", // your proxy endpoint, NOT Groq directly
 *       botName: "Assistant",
 *       greeting: "Hi! How can I help you today?",
 *       accentColor: "#5b5bd6"
 *     });
 *   </script>
 *
 * This widget never talks to Groq directly — it POSTs to YOUR backend,
 * which holds the real API key. See server/ for a ready-made proxy.
 */
(function () {
  const AIChatWidget = {
    init(config) {
      const settings = Object.assign(
        {
          apiUrl: "/api/chat",
          botName: "Assistant",
          greeting: "Hi! How can I help you today?",
          accentColor: "#5b5bd6",
          position: "bottom-right", // or "bottom-left"
        },
        config
      );

      injectStyles(settings);
      const root = buildDOM(settings);
      document.body.appendChild(root);
      wireEvents(root, settings);
    },
  };

  function injectStyles(settings) {
    const css = `
      .aicw-bubble {
        position: fixed; ${settings.position === "bottom-left" ? "left: 24px;" : "right: 24px;"}
        bottom: 24px; width: 60px; height: 60px; border-radius: 50%;
        background: ${settings.accentColor}; color: white; border: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        z-index: 999999; transition: transform 0.15s ease;
      }
      .aicw-bubble:hover { transform: scale(1.06); }
      .aicw-bubble svg { width: 26px; height: 26px; }

      .aicw-panel {
        position: fixed; ${settings.position === "bottom-left" ? "left: 24px;" : "right: 24px;"}
        bottom: 96px; width: 360px; max-width: calc(100vw - 48px);
        height: 520px; max-height: calc(100vh - 140px);
        background: #ffffff; border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.22);
        display: none; flex-direction: column; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        z-index: 999999;
      }
      .aicw-panel.aicw-open { display: flex; }

      .aicw-header {
        background: ${settings.accentColor}; color: white;
        padding: 16px 18px; display: flex; align-items: center; justify-content: space-between;
      }
      .aicw-header-title { font-weight: 600; font-size: 15px; }
      .aicw-header-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }
      .aicw-close { background: none; border: none; color: white; cursor: pointer; opacity: 0.85; padding: 4px; }
      .aicw-close:hover { opacity: 1; }

      .aicw-messages {
        flex: 1; overflow-y: auto; padding: 16px; background: #f7f7f9;
        display: flex; flex-direction: column; gap: 10px;
      }
      .aicw-msg { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; }
      .aicw-msg-bot { background: white; color: #1a1a1a; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
      .aicw-msg-user { background: ${settings.accentColor}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
      .aicw-msg-error { background: #fde8e8; color: #a33; align-self: flex-start; border-bottom-left-radius: 4px; }

      .aicw-typing { display: flex; gap: 4px; padding: 10px 13px; align-self: flex-start; }
      .aicw-typing span { width: 6px; height: 6px; border-radius: 50%; background: #b0b0b8; animation: aicw-bounce 1.2s infinite; }
      .aicw-typing span:nth-child(2) { animation-delay: 0.15s; }
      .aicw-typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes aicw-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }

      .aicw-inputbar { display: flex; align-items: flex-end; gap: 8px; padding: 12px; border-top: 1px solid #eaeaec; background: white; }
      .aicw-input {
        flex: 1; resize: none; border: 1px solid #dcdce2; border-radius: 20px;
        padding: 10px 14px; font-size: 14px; font-family: inherit; max-height: 90px;
        outline: none;
      }
      .aicw-input:focus { border-color: ${settings.accentColor}; }
      .aicw-send {
        background: ${settings.accentColor}; border: none; color: white; width: 36px; height: 36px;
        border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .aicw-send:disabled { opacity: 0.5; cursor: default; }
      .aicw-send svg { width: 16px; height: 16px; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildDOM(settings) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button class="aicw-bubble" aria-label="Open chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </button>
      <div class="aicw-panel" role="dialog" aria-label="Chat">
        <div class="aicw-header">
          <div>
            <div class="aicw-header-title">${escapeHtml(settings.botName)}</div>
            <div class="aicw-header-sub">Usually replies instantly</div>
          </div>
          <button class="aicw-close" aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="aicw-messages"></div>
        <div class="aicw-inputbar">
          <textarea class="aicw-input" rows="1" placeholder="Type a message..."></textarea>
          <button class="aicw-send" aria-label="Send">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
    return wrap;
  }

  function wireEvents(root, settings) {
    const bubble = root.querySelector(".aicw-bubble");
    const panel = root.querySelector(".aicw-panel");
    const closeBtn = root.querySelector(".aicw-close");
    const messages = root.querySelector(".aicw-messages");
    const input = root.querySelector(".aicw-input");
    const sendBtn = root.querySelector(".aicw-send");

    let history = []; // { role: "user"|"assistant", content: string }
    let greeted = false;

    bubble.addEventListener("click", () => {
      panel.classList.toggle("aicw-open");
      if (panel.classList.contains("aicw-open")) {
        if (!greeted) {
          addMessage(messages, "bot", settings.greeting);
          greeted = true;
        }
        input.focus();
      }
    });
    closeBtn.addEventListener("click", () => panel.classList.remove("aicw-open"));

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 90) + "px";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener("click", send);

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(messages, "user", text);
      history.push({ role: "user", content: text });
      input.value = "";
      input.style.height = "auto";
      sendBtn.disabled = true;

      const typingEl = addTyping(messages);

      try {
        const res = await fetch(settings.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Server sends a specific, friendly message for rate limits (429) —
          // show that instead of a generic error when available.
          const friendly = data.error || "Something went wrong. Please try again in a moment.";
          typingEl.remove();
          addMessage(messages, "error", friendly);
          return;
        }

        const reply = data.reply || "Sorry, I didn't get a response.";
        typingEl.remove();
        addMessage(messages, "bot", reply);
        history.push({ role: "assistant", content: reply });
      } catch (err) {
        typingEl.remove();
        addMessage(messages, "error", "Something went wrong. Please try again in a moment.");
        console.error("AIChatWidget error:", err);
      } finally {
        sendBtn.disabled = false;
      }
    }
  }

  function addMessage(container, type, text) {
    const el = document.createElement("div");
    el.className = "aicw-msg " + (type === "user" ? "aicw-msg-user" : type === "error" ? "aicw-msg-error" : "aicw-msg-bot");
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function addTyping(container) {
    const el = document.createElement("div");
    el.className = "aicw-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  window.AIChatWidget = AIChatWidget;
})();
