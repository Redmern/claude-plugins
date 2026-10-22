#!/usr/bin/env node
// teachxl bridge.
//
// Run from the TEACHING WORKSPACE ROOT (the dir holding MISSION.md, ./lessons,
// ./assets, ./learning-records):
//
//     node bridge/server.mjs
//
// It serves the workspace over http://127.0.0.1:<port> so lessons load
// same-origin and can fetch, and proxies POST /chat to Claude via the Agent
// SDK, grounded in this workspace.

import http from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

const ROOT = process.cwd();                       // = teaching workspace root
const PORT = Number(process.env.TEACHXL_PORT || 4317);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const SYSTEM = `You are the user's teacher inside a teachxl workspace, answering
a question the user raised from a specific lesson by clicking "Discuss". The
topic's grounding context is provided alongside the question.

Rules:
- Ground every answer in THIS workspace (cwd). Read MISSION.md, the relevant
  files under ./lessons, ./reference, and ./learning-records, and honor the
  glossary and ./NOTES.md preferences before answering. Do not rely on
  parametric knowledge when the workspace has the answer.
- Be concise, tied to the user's mission, and cite the sources you used.
- When the exchange reveals a durable, non-obvious insight the user has now
  understood, or corrects a misconception, append a learning record under
  ./learning-records/ using the existing numbering and format.
- You may ONLY write files under ./learning-records/ or ./NOTES.md. Never modify
  lessons, reference docs, assets, or anything else.`;

const OVERVIEW_SYSTEM = `You are the user's teacher inside a teachxl workspace.
The user just finished a test, and you are building their "what to study next"
overview from the recorded results.

Rules:
- Read ./study-log.jsonl and consider only the latest test attempt referenced in
  the request. Each line is a JSON event (quiz answers: correct/incorrect, per
  topic). Ground analysis in MISSION.md, ./lessons, ./reference, and existing
  ./learning-records.
- Identify the topics the user got wrong or is weak on, and rank what needs
  further study by priority, tied to the mission. For each weak topic, point to
  the relevant lesson/reference and a primary high-trust source.
- You may write ./reference/study-overview.html (beautiful and printable, in the
  teach reference style) and append one learning record under ./learning-records/
  capturing the gaps. Do not modify lessons or other files.`;

function cors(res, extra = {}) {
  res.writeHead(res.statusCode || 200, {
    'Access-Control-Allow-Origin': '*',
    ...extra,
  });
}

function send(res, code, body, headers = {}) {
  res.statusCode = code;
  cors(res, headers);
  res.end(body);
}

async function serveStatic(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) return send(res, 403, 'forbidden');
  try {
    const s = await stat(full);
    if (s.isDirectory()) return send(res, 403, 'directory listing disabled');
    const buf = await readFile(full);
    send(res, 200, buf, {
      'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
    });
  } catch {
    send(res, 404, 'not found');
  }
}

function openSSE(res) {
  res.statusCode = 200;
  cors(res, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  return (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

// Run one Claude turn and stream it to the page over SSE.
async function streamQuery(res, { prompt, system, sessionId }) {
  const emit = openSSE(res);
  let session = sessionId || undefined;
  try {
    const stream = query({
      prompt,
      options: {
        cwd: ROOT,
        resume: session,
        appendSystemPrompt: system,
        allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
        maxTurns: 16,
      },
    });
    for await (const msg of stream) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        session = msg.session_id;
        emit('session', { sessionId: session });
      } else if (msg.type === 'stream_event') {
        const ev = msg.event;
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          emit('delta', { text: ev.delta.text });
        }
      } else if (msg.type === 'assistant') {
        // Fallback for non-partial builds: emit full text blocks once.
        const blocks = msg.message?.content || [];
        for (const b of blocks) if (b.type === 'text') emit('delta', { text: b.text });
      } else if (msg.type === 'result') {
        session = msg.session_id || session;
        emit('done', { sessionId: session });
      }
    }
  } catch (e) {
    emit('error', { message: String(e?.message || e) });
  }
  res.end();
}

async function handleChat(req, res) {
  let p;
  try { p = await body(req); } catch { return send(res, 400, 'invalid json'); }
  if (!p.question) return send(res, 400, 'missing question');
  const prompt = [
    p.context
      ? `# Topic context\n${typeof p.context === 'string' ? p.context : JSON.stringify(p.context, null, 2)}`
      : '',
    `# Question\n${p.question}`,
  ].filter(Boolean).join('\n\n');
  await streamQuery(res, { prompt, system: SYSTEM, sessionId: p.sessionId });
}

// Append one study event (a quiz answer, a flagged weakness) to study-log.jsonl.
async function handleRecord(req, res) {
  let p;
  try { p = await body(req); } catch { return send(res, 400, 'invalid json'); }
  const event = { ts: new Date().toISOString(), ...p };
  try {
    await appendFile(join(ROOT, 'study-log.jsonl'), JSON.stringify(event) + '\n');
    send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
  } catch (e) {
    send(res, 500, JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      'Content-Type': 'application/json',
    });
  }
}

// Synthesize a "what to study next" overview from the recorded test results.
async function handleOverview(req, res) {
  let p;
  try { p = await body(req); } catch { return send(res, 400, 'invalid json'); }
  const prompt = `The user just finished a test.
Lesson: ${p.lesson || '(unknown)'}
Test id: ${p.testId || '(unspecified)'}
Local score (from the page): ${p.score != null ? `${p.score.correct}/${p.score.total}` : '(not provided)'}

Build their "what to study next" overview from ./study-log.jsonl as described in
your instructions: identify weak topics from the latest attempt, rank them by
priority tied to the mission, and give each a pointer to the relevant
lesson/reference plus a primary source. Save ./reference/study-overview.html and
append a learning record. Then reply with the prioritized overview itself.`;
  await streamQuery(res, { prompt, system: OVERVIEW_SYSTEM });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', {
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  }
  if (req.method === 'POST' && (req.url || '').startsWith('/chat')) {
    return handleChat(req, res);
  }
  if (req.method === 'POST' && (req.url || '').startsWith('/record')) {
    return handleRecord(req, res);
  }
  if (req.method === 'POST' && (req.url || '').startsWith('/overview')) {
    return handleOverview(req, res);
  }
  if (req.method === 'GET') return serveStatic(req, res);
  send(res, 405, 'method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`teachxl bridge  →  http://${HOST}:${PORT}`);
  console.log(`workspace root  →  ${ROOT}`);
  console.log(`open a lesson, e.g. http://${HOST}:${PORT}/lessons/0001-....html`);
});
