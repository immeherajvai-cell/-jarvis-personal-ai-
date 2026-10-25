require('dotenv').config();
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Gemini client (set GEMINI_API_KEY in .env locally and in Render's environment).
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Set ENABLE_PC_ACTIONS=true in .env ONLY on your own PC.
// On a hosted server (e.g. Render) leave it unset so no action can ever run.
const PC_ACTIONS_ON = process.env.ENABLE_PC_ACTIONS === 'true';

// CORS is open to every origin, so the hosted frontend never gets a 403.
// This list is ONLY used to decide which pages may trigger PC actions
// (opening Notepad, Calculator, Chrome). Other origins still get normal AI chat.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,https://jarvis-personal-ai.onrender.com').split(',');

const systemPrompt = [
  "You are Jarvis, a highly professional AI assistant.",
  "Communicate primarily in standard, polished English, remaining professional and concise.",
  "Only use Bengali when explicitly instructed to do so.",
  "You possess comprehensive expertise in digital marketing, SEO, web development, and content strategy.",
  "Always format your responses clearly without using markdown symbols like asterisks or hashes."
].join("\n");

const MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];

async function generateWithRetry(prompt) {
  for (const name of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          systemInstruction: systemPrompt
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (error.status === 404) break;
        if (error.status === 503 || error.status === 429) {
          await new Promise(function (r) { setTimeout(r, 1500 * attempt); });
          continue;
        }
        throw error;
      }
    }
  }
  throw new Error('All models busy');
}

/* ---------------------------------------------------------
   PC ACTIONS (allowlist only: nothing outside this table runs)
   Each action uses a fixed program and fixed arguments.
   Voice text is only used to PICK an action, never executed.
   Written for Windows; add macOS/Linux equivalents as needed.
--------------------------------------------------------- */
const ACTIONS = [
  {
    keys: ['open notepad', 'নোটপ্যাড'],
    reply: 'Opening Notepad.',
    run: function () { return launch('notepad.exe', []); }
  },
  {
    keys: ['open calculator', 'ক্যালকুলেটর'],
    reply: 'Opening Calculator.',
    run: function () { return launch('calc.exe', []); }
  },
  {
    keys: ['open chrome', 'ক্রোম খোলো'],
    reply: 'Opening Chrome.',
    run: function () { return launch('cmd', ['/c', 'start', '', 'chrome']); }
  }
];

function launch(program, args) {
  if (process.platform !== 'win32') {
    throw new Error('PC actions are configured for Windows only.');
  }
  const child = spawn(program, args, { detached: true, stdio: 'ignore', shell: false });
  child.on('error', function (e) { console.error('Action failed:', e.message); });
  child.unref();
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[।,.!?]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findAction(command) {
  const t = normalize(command);
  if (!t) return null;
  return ACTIONS.find(function (a) {
    return a.keys.some(function (k) { return t.includes(k); });
  }) || null;
}

/* ---------------------------------------------------------
   MIDDLEWARE
--------------------------------------------------------- */
app.use(express.json({ limit: '20mb' }));

// CORS: any origin may call this server (no more 403s from the hosted frontend).
app.use(function (req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Lets an https page (e.g. the Render-hosted app) reach http://localhost
    'Access-Control-Allow-Private-Network': 'true'
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ---------------------------------------------------------
   ROUTES
--------------------------------------------------------- */
async function handleChat(prompt, res) {
  try {
    const reply = await generateWithRetry(prompt);
    res.json({ reply: reply });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'The AI is busy right now. Please try again shortly.' });
  }
}

// Used by the JARVIS app: runs an allowlisted PC action, otherwise asks the AI.
app.post('/command', async function (req, res) {
  const command = (req.body.command || '').trim();
  const prompt = req.body.prompt || command;
  if (!prompt) {
    return res.status(400).json({ error: 'command is required' });
  }

  // PC actions only run when enabled AND the request comes from a trusted page.
  // Requests from any other website fall through to normal AI chat.
  const origin = req.headers.origin;
  const trusted = !origin || ALLOWED_ORIGINS.includes(origin);

  if (PC_ACTIONS_ON && trusted && command) {
    const action = findAction(command);
    if (action) {
      try {
        action.run();
        return res.json({ reply: action.reply, action: true });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
      }
    }
  }

  // Attachments are accepted by the app but not forwarded to the model here.
  await handleChat(prompt, res);
});

// Used by the Render fallback and the old app version.
app.post('/api/chat', async function (req, res) {
  const prompt = req.body.prompt;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  await handleChat(prompt, res);
});

// Local-only binding when PC actions are on; normal binding when hosted.
const PORT = process.env.PORT || 3000;
const HOST = PC_ACTIONS_ON ? '127.0.0.1' : '0.0.0.0';
app.listen(PORT, HOST, function () {
  console.log('Server is running on ' + HOST + ':' + PORT +
    (PC_ACTIONS_ON ? ' (PC actions ON)' : ' (PC actions OFF)'));
});
