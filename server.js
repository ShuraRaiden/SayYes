const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// Database File Path (JSON-based for robust local usage)
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure db directory and file exist
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ invites: {} }, null, 2));
}

// Database helper functions
function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return { invites: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Helper to generate random short ID
function generateId() {
  return Math.random().toString(36).substring(2, 8) + '-' + Math.random().toString(36).substring(2, 6);
}

// Helper to send emails
async function sendAnswerEmail(invite, answer) {
  console.log('--- CITATION ANSWER SUBMISSION ---');
  console.log(`To: ${invite.owner_email}`);
  console.log(`From: ${invite.from_name}`);
  console.log(`To name: ${invite.to_name}`);
  console.log(`Answer details:`, answer);
  console.log('----------------------------------');

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #DFD2B8; border-radius: 12px; background-color: #FFFCF4;">
      <h1 style="color: #EE5B36; font-size: 24px; text-align: center;">¡Dijo que SÍ! 🥳</h1>
      <p style="font-size: 16px; color: #1C1611;">¡Buenas noticias! <b>${invite.to_name}</b> ha respondido a tu invitación:</p>
      
      <div style="background-color: #F4EBD8; padding: 15px; border-radius: 8px; border: 1.5px solid #1C1611; margin: 20px 0;">
        <p style="margin: 5px 0;"><b>📍 Lugar:</b> ${answer.place || '—'}</p>
        <p style="margin: 5px 0;"><b>🗓️ Cuándo:</b> ${answer.when || '—'}</p>
        ${answer.note ? `<p style="margin: 5px 0;"><b>💬 Mensaje:</b> "${answer.note}"</p>` : ''}
        <p style="margin: 5px 0; font-size: 12px; color: #7B6B5A;">Intentos de pulsar "NO": ${answer.no_escapes || 0}</p>
      </div>
      
      <p style="font-size: 14px; color: #7B6B5A; text-align: center;">¡Prepárate para la cita! 😉</p>
    </div>
  `;

  // === Option A: Resend API (HTTP, port 443 - never blocked on Render) ===
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'YES or YES <onboarding@resend.dev>',
          to: invite.owner_email,
          subject: `💌 ${invite.to_name} dijo que SÍ!`,
          html: htmlContent,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('[Email Info] Email sent successfully via Resend:', data.id);
      } else {
        console.error('[Email Error] Resend API failed:', data);
      }
    } catch (err) {
      console.error('[Email Error] Failed to send email via Resend:', err);
    }
    return;
  }

  // === Option B: Nodemailer SMTP (Fallback) ===
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[Email Info] SMTP not fully configured. Email sending skipped. Output logged above.');
    return;
  }

  try {
    const config = {};
    if (SMTP_HOST.includes('gmail')) {
      config.service = 'gmail';
    } else {
      config.host = SMTP_HOST;
      config.port = parseInt(SMTP_PORT) || 587;
      config.secure = process.env.SMTP_SECURE === 'true';
    }
    config.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS,
    };

    const transporter = nodemailer.createTransport(config);

    const mailOptions = {
      from: `"${SMTP_FROM_NAME || 'YES or YES 💌'}" <${SMTP_USER}>`,
      to: invite.owner_email,
      subject: `💌 ${invite.to_name} dijo que SÍ!`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email Info] Email sent successfully via SMTP:', info.messageId);
  } catch (err) {
    console.error('[Email Error] Failed to send email via SMTP:', err);
  }
}

// === API Routes ===

// Create a new invite
app.post('/api/v1/invites', (req, res) => {
  const { to_name, from_name, question, owner_email, lang, no_phrases } = req.body;
  
  if (!to_name || !from_name || !owner_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = readDb();
  const id = generateId();

  db.invites[id] = {
    id,
    to_name,
    from_name,
    question: question || null,
    owner_email,
    lang: lang || 'en',
    no_phrases: Array.isArray(no_phrases) ? no_phrases : null,
    created_at: new Date().toISOString(),
    answer: null
  };

  writeDb(db);

  return res.status(201).json({
    id,
    url: `${BASE_URL}/d/${id}`
  });
});

// Get invite details
app.get('/api/v1/invites/:id', (req, res) => {
  const db = readDb();
  const invite = db.invites[req.params.id];

  if (!invite) {
    return res.status(404).json({ error: 'Invite not found' });
  }

  return res.json(invite);
});

// Answer an invite
app.post('/api/v1/invites/:id/answer', async (req, res) => {
  const db = readDb();
  const invite = db.invites[req.params.id];

  if (!invite) {
    return res.status(404).json({ error: 'Invite not found' });
  }

  const { say, place, when, note, no_escapes } = req.body;

  const answer = {
    say: say || 'YES',
    place: place || null,
    when: when || null,
    note: note || '',
    no_escapes: no_escapes || 0,
    answered_at: new Date().toISOString()
  };

  invite.answer = answer;
  writeDb(db);

  // Send email asynchronously
  sendAnswerEmail(invite, answer);

  return res.json({ success: true });
});

// === Pages routing ===

// Serve main form page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve invitation page for shortlinks
app.get('/d/:id', (req, res) => {
  const db = readDb();
  const invite = db.invites[req.params.id];
  
  if (!invite) {
    return res.sendFile(path.join(__dirname, 'public', 'invite.html'));
  }

  const filePath = path.join(__dirname, 'public', 'invite.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      return res.sendFile(filePath);
    }
    
    // Customize title and description dynamically for crawler previews
    let customizedHtml = html;
    const titleText = `An important question for you`;
    const descText = invite.question || "Will you go on a date with me?";
    
    customizedHtml = customizedHtml
      .replace(/<title>.*?<\/title>/, `<title>${titleText}</title>`)
      .replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${titleText}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${descText}" />`);
      
    res.send(customizedHtml);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`YES or YES clone running at ${BASE_URL}`);
});
