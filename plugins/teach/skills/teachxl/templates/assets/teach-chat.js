// teachxl chat + study-tracking widget.
//
// Link in every lesson <head>:
//   <link rel="stylesheet" href="/assets/teach-chat.css">
//   <script src="/assets/teach-chat.js" defer></script>
//
// Discussable topic (chat) — see LESSON-CHAT-FORMAT.md:
//   <div data-teach-topic="stable-id">
//     <h3>Question?</h3>
//     <script type="application/teach-context">{ "title": "...", "answer": "..." }</script>
//   </div>
//
// Quiz + test (study tracking) — see TEST-FORMAT.md:
//   <div data-teach-test="ch1-test">
//     <div data-teach-quiz="topic-id" data-question="What is X?">
//       <button data-correct>Right</button>
//       <button>Wrong</button>
//     </div>
//     <button data-teach-finish>Finish test</button>
//   </div>
//
// Custom quiz code can instead call window.teachxl.record({...}) and
// window.teachxl.finishTest(testId) directly.
//
// Requires serving via the bridge (http://localhost…), not file://.

(() => {
  const ORIGIN = location.origin;
  const FILE_PROTO = location.protocol === 'file:';
  const LESSON_KEY = location.pathname;

  const store = {
    load(id) {
      try { return JSON.parse(localStorage.getItem(`teachxl:${LESSON_KEY}:${id}`)) || null; }
      catch { return null; }
    },
    save(id, data) {
      try { localStorage.setItem(`teachxl:${LESSON_KEY}:${id}`, JSON.stringify(data)); } catch {}
    },
  };

  // ---- tiny markdown renderer (offline, no deps) ---------------------------
  function esc(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function md(src) {
    const blocks = String(src).split(/```/);
    let out = '';
    blocks.forEach((blk, i) => {
      if (i % 2 === 1) { out += `<pre><code>${esc(blk.replace(/^\w*\n/, ''))}</code></pre>`; return; }
      let t = esc(blk)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      out += t.split(/\n{2,}/).map(p => {
        if (/^\s*[-*] /.test(p)) {
          const items = p.split(/\n/).map(l => l.replace(/^\s*[-*] /, '')).filter(Boolean);
          return `<ul>${items.map(li => `<li>${li}</li>`).join('')}</ul>`;
        }
        if (/^#{1,4} /.test(p)) return `<strong>${p.replace(/^#{1,4} /, '')}</strong>`;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
      }).join('');
    });
    return out;
  }

  // ---- persist a study event to the workspace (via the bridge) -------------
  async function record(evt) {
    if (FILE_PROTO) return;
    try {
      await fetch(`${ORIGIN}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: LESSON_KEY, ...evt }),
      });
    } catch {}
  }

  // ---- shared SSE-over-POST reader: streams Claude into `target` -----------
  // Returns the full text. Calls hooks for session id / errors.
  async function streamInto(url, payload, target, hooks = {}) {
    target.classList.add('tx-blink');
    let answer = '';
    try {
      const res = await fetch(`${ORIGIN}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop();
        for (const frame of frames) {
          const ev = (frame.match(/^event: (.*)$/m) || [])[1];
          const dataLine = (frame.match(/^data: (.*)$/m) || [])[1];
          if (!dataLine) continue;
          const data = JSON.parse(dataLine);
          if (ev === 'session') hooks.onSession && hooks.onSession(data.sessionId);
          else if (ev === 'delta') {
            answer += data.text;
            target.classList.remove('tx-blink');
            target.innerHTML = md(answer);
            scrollLog();
          } else if (ev === 'error') {
            target.classList.remove('tx-blink');
            target.classList.add('tx-err');
            target.textContent = data.message;
          }
        }
      }
    } catch (e) {
      target.classList.remove('tx-blink');
      target.classList.add('tx-err');
      target.textContent = String(e.message || e);
    }
    target.classList.remove('tx-blink');
    return answer;
  }

  // ---- drawer (shared by chat + overview) ----------------------------------
  let drawer, headTitle, headMeta, log, form, input, sendBtn;
  let active = null; // chat: { id, context, thread }

  function scrollLog() { if (log) log.scrollTop = log.scrollHeight; }

  function buildDrawer() {
    drawer = document.createElement('aside');
    drawer.className = 'tx-drawer';
    drawer.innerHTML = `
      <div class="tx-head">
        <h4 class="tx-title">Discuss</h4>
        <small class="tx-meta"></small>
        <button class="tx-close" title="Close">×</button>
      </div>
      <div class="tx-log"></div>
      <form class="tx-form">
        <textarea placeholder="Ask your teacher…" rows="1"></textarea>
        <button type="submit">Send</button>
      </form>`;
    document.body.appendChild(drawer);
    headTitle = drawer.querySelector('.tx-title');
    headMeta = drawer.querySelector('.tx-meta');
    log = drawer.querySelector('.tx-log');
    form = drawer.querySelector('.tx-form');
    input = drawer.querySelector('textarea');
    sendBtn = drawer.querySelector('button[type=submit]');
    drawer.querySelector('.tx-close').onclick = () => drawer.classList.remove('tx-open');
    form.onsubmit = e => { e.preventDefault(); send(); };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 144) + 'px';
    });
  }

  function addMsg(cls, html) {
    const el = document.createElement('div');
    el.className = `tx-msg ${cls}`;
    el.innerHTML = html;
    log.appendChild(el);
    scrollLog();
    return el;
  }

  // ---- chat ----------------------------------------------------------------
  function openTopic(id, context) {
    if (!drawer) buildDrawer();
    form.style.display = '';
    active = { id, context, thread: store.load(id) || { sessionId: null, messages: [] } };
    headTitle.textContent = (context && context.title) || 'Discuss';
    headMeta.textContent = active.thread.sessionId ? 'resumed thread' : 'new thread';
    log.innerHTML = '';
    if (context && (context.statement || context.answer)) {
      addMsg('tx-ctx', esc(context.statement || context.answer));
    }
    active.thread.messages.forEach(m =>
      addMsg(m.role === 'user' ? 'tx-user' : 'tx-bot', m.role === 'user' ? esc(m.text) : md(m.text)));
    drawer.classList.add('tx-open');
    input.focus();
  }

  async function send() {
    const question = input.value.trim();
    if (!question || !active) return;
    if (FILE_PROTO) { addMsg('tx-err', 'Open this lesson via the bridge URL (http://localhost…), not file://.'); return; }
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    addMsg('tx-user', esc(question));
    active.thread.messages.push({ role: 'user', text: question });
    const botEl = addMsg('tx-bot', '');
    const answer = await streamInto('/chat', {
      question, context: active.context, sessionId: active.thread.sessionId,
    }, botEl, { onSession: sid => { active.thread.sessionId = sid; headMeta.textContent = 'resumed thread'; } });
    if (answer) {
      active.thread.messages.push({ role: 'bot', text: answer });
      store.save(active.id, active.thread);
    }
    sendBtn.disabled = false;
    input.focus();
  }

  // ---- study overview ------------------------------------------------------
  async function finishTest(testId, score) {
    if (!drawer) buildDrawer();
    active = null;
    form.style.display = 'none'; // overview is read-only
    headTitle.textContent = 'Study overview';
    headMeta.textContent = score ? `${score.correct}/${score.total} correct` : 'analyzing…';
    log.innerHTML = '';
    drawer.classList.add('tx-open');
    if (FILE_PROTO) { addMsg('tx-err', 'Open this lesson via the bridge URL to build a study overview.'); return; }
    const botEl = addMsg('tx-bot', '');
    await streamInto('/overview', { lesson: LESSON_KEY, testId, score }, botEl);
    headMeta.textContent = 'saved to ./reference/study-overview.html';
  }

  // ---- built-in quiz convention --------------------------------------------
  function wireQuiz(quiz) {
    const topicId = quiz.getAttribute('data-teach-quiz');
    const question = quiz.getAttribute('data-question') || quiz.querySelector('.tx-q, h1,h2,h3,h4,p')?.textContent || topicId;
    const buttons = [...quiz.querySelectorAll('button')].filter(b => !b.hasAttribute('data-teach-finish'));
    let answered = false;
    buttons.forEach(btn => {
      btn.classList.add('tx-opt');
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = btn.hasAttribute('data-correct');
        quiz.dataset.txCorrect = correct ? '1' : '0';
        buttons.forEach(b => {
          b.disabled = true;
          if (b.hasAttribute('data-correct')) b.classList.add('tx-correct');
        });
        if (!correct) btn.classList.add('tx-incorrect');
        record({ kind: 'quiz', testId: quiz.closest('[data-teach-test]')?.getAttribute('data-teach-test') || null,
          topicId, question, chosen: btn.textContent.trim(), correct });
      });
    });
  }

  function wireTest(test) {
    const testId = test.getAttribute('data-teach-test');
    let finishBtn = test.querySelector('[data-teach-finish]');
    if (!finishBtn) {
      finishBtn = document.createElement('button');
      finishBtn.setAttribute('data-teach-finish', '');
      finishBtn.textContent = 'Finish test → what to study next';
      test.appendChild(finishBtn);
    }
    finishBtn.classList.add('tx-finish');
    finishBtn.addEventListener('click', () => {
      const quizzes = [...test.querySelectorAll('[data-teach-quiz]')];
      const answered = quizzes.filter(q => q.dataset.txCorrect != null);
      const score = { total: quizzes.length, correct: answered.filter(q => q.dataset.txCorrect === '1').length };
      finishTest(testId, score);
    });
  }

  // ---- wire up everything --------------------------------------------------
  function init() {
    if (FILE_PROTO) {
      const w = document.createElement('div');
      w.className = 'tx-warn';
      w.textContent = 'teachxl is off: open this lesson through the bridge (http://localhost…), not file://.';
      document.body.appendChild(w);
    }
    document.querySelectorAll('[data-teach-topic]').forEach(topic => {
      const id = topic.getAttribute('data-teach-topic');
      let context = null;
      const ctxEl = topic.querySelector('script[type="application/teach-context"]');
      if (ctxEl) { try { context = JSON.parse(ctxEl.textContent); } catch {} }
      const btn = document.createElement('button');
      btn.className = 'tx-discuss';
      btn.type = 'button';
      btn.innerHTML = '💬 Discuss';
      btn.onclick = () => openTopic(id, context);
      (topic.querySelector('h1,h2,h3,h4,p') || topic).appendChild(btn);
    });
    document.querySelectorAll('[data-teach-quiz]').forEach(wireQuiz);
    document.querySelectorAll('[data-teach-test]').forEach(wireTest);
  }

  // ---- public API for custom quiz code ------------------------------------
  window.teachxl = { record, finishTest, openTopic };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
