// user.js
// Express router providing user management endpoints with file-based storage and email verification.
// Endpoints:
//  - POST /users/send-code  -> send verification code via email
//  - POST /users/verify-code -> verify code and create user
//  - POST /users/login      -> login with email/password
//  - GET  /users/:id        -> fetch user by id

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Simple in-memory store for verification codes when running in DEV_MOCK
const mockCodes = new Map();
const nodemailer = require('nodemailer');

// Simple in-memory store for verification codes when running in DEV_MOCK
const mockCodes = new Map();

// SMTP configuration from environment. For Gmail use an App Password and set SMTP_USER to your email
// and SMTP_PASS to the app password. If SMTP_HOST is not provided, sending will fall back to mock.
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '0', 10) || undefined;
const SMTP_SECURE = (process.env.SMTP_SECURE === 'true');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || (SMTP_USER || 'no-reply@example.com');

let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    mailer = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || 587,
      secure: SMTP_SECURE || false,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  } catch (e) {
    console.warn('user.js: failed to create mail transporter', e && e.message ? e.message : e);
    mailer = null;
  }
}

function generateCode(digits = 6) {
  // generate numeric code of length `digits`
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const n = crypto.randomInt(min, max + 1);
  return String(n);
}

// POST /users/send-code --> { email }
// Sends a short-lived verification code to the provided email address.
router.post('/send-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

    if (DEV_MOCK) {
      mockCodes.set(email, { code, expiresAt, used: false });
      console.log('DEV_MOCK send-code for', email, 'code=', code);
      return res.json({ ok: true, mock: true, code });
    }

    // Persist in Supabase table email_verifications
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });

    const insertObj = { email, code, expires_at: expiresAt.toISOString(), used: false };
    const { data, error } = await supabase.from('email_verifications').insert([insertObj]).select().single();
    if (error) {
      console.error('send-code insert error', error);
      return res.status(500).json({ error: String(error) });
    }

    // Send email if transporter configured
    if (mailer) {
      try {
        await mailer.sendMail({
          from: EMAIL_FROM,
          to: email,
          subject: 'Your verification code',
          text: `Your verification code is: ${code}\nIt expires in 15 minutes.`,
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>It expires in 15 minutes.</p>`
        });
      } catch (mailErr) {
        console.error('send-code mail error', mailErr);
        // still return ok so callers can retry, but surface warning
        return res.status(200).json({ ok: true, warning: 'failed to send email, saved code', details: String(mailErr) });
      }
      return res.json({ ok: true });
    }

    // If no mailer available, return with a helpful message (so admins can debug SMTP config)
    return res.status(200).json({ ok: true, warning: 'no SMTP configured on server; code saved' });
  } catch (err) {
    console.error('send-code error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// POST /users/verify-code -> { email, code, password, user_metadata }
// Verifies the code and creates the user account if valid.
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code, password, user_metadata } = req.body || {};
    if (!email || !code || !password) return res.status(400).json({ error: 'email, code and password required' });

    if (DEV_MOCK) {
      const record = mockCodes.get(email);
      if (!record) return res.status(400).json({ error: 'no code sent for this email' });
      if (record.used) return res.status(400).json({ error: 'code already used' });
      if (record.expiresAt < new Date()) return res.status(400).json({ error: 'code expired' });
      if (String(record.code) !== String(code)) return res.status(400).json({ error: 'invalid code' });
      record.used = true; mockCodes.set(email, record);
      // Create user via admin.createUser or signUp fallback
      if (supabase && supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.createUser === 'function') {
        const { data, error } = await supabase.auth.admin.createUser({ email, password, user_metadata: user_metadata || {} });
        if (error) return res.status(500).json({ error: String(error) });
        return res.status(201).json({ user: data, mock: true });
      }
      // Otherwise return success and let frontend attempt client signUp
      return res.status(200).json({ ok: true, mock: true });
    }

    // Lookup in DB
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    const { data: rows, error: selErr } = await supabase.from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', String(code))
      .eq('used', false)
      .lte('expires_at', new Date().toISOString())
      .limit(1);

    if (selErr) {
      console.error('verify-code select error', selErr);
      return res.status(500).json({ error: String(selErr) });
    }

    // Note: the above query may be wrong because of <= check; instead we fetch and validate expires_at in JS
    const { data: foundRows, error: sel2 } = await supabase.from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', String(code))
      .eq('used', false)
      .limit(1);
    if (sel2) {
      console.error('verify-code select2 error', sel2);
      return res.status(500).json({ error: String(sel2) });
    }
    if (!foundRows || !foundRows.length) return res.status(400).json({ error: 'invalid code or code already used' });
    const rec = foundRows[0];
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'code expired' });

    // Mark used
    const { data: upd, error: updErr } = await supabase.from('email_verifications').update({ used: true }).eq('id', rec.id);
    if (updErr) console.warn('verify-code: failed to mark used', updErr);

    // Create user via admin API
    if (supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.createUser === 'function') {
      try {
        const { data, error } = await supabase.auth.admin.createUser({ email, password, user_metadata: user_metadata || {} });
        if (error) return res.status(500).json({ error: String(error) });
        return res.status(201).json({ user: data });
      } catch (err) {
        console.error('verify-code admin.createUser error', err);
        return res.status(500).json({ error: 'Failed to create user via admin API', details: String(err) });
      }
    }

    // Fallback: let frontend sign up the user using anon key
    return res.status(200).json({ ok: true, message: 'code verified; please complete sign-up from client' });
  } catch (err) {
    console.error('verify-code error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Create user (admin)
// Body: { email, password, user_metadata?: {...}, phone?: string }
router.post('/create', async (req, res) => {
  try {
    const { email, password, user_metadata } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // If running in DEV_MOCK mode, simulate user creation locally (no external calls)
    if (DEV_MOCK) {
      try {
        const id = (crypto.randomUUID && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : ('mock-' + Math.random().toString(36).slice(2,10));
  const userObj = { id, email, user_metadata: user_metadata || {} };
  return res.status(201).json({ user: userObj, mock: true });
      } catch (e) {
        console.error('user.create mock error', e);
        return res.status(500).json({ error: 'mock create failed', details: String(e) });
      }
    }

    // Guard: if env contains placeholder values, return a clear error instead of attempting network calls
    if (String(SUPABASE_URL).includes('your-project') || String(SUPABASE_SERVICE_KEY).includes('service_role_key_here')) {
      return res.status(500).json({ error: 'Supabase configuration placeholders detected. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env' });
    }

    // Try to use the Admin API if available
    if (supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.createUser === 'function') {
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          user_metadata: user_metadata || {}
        });
        if (error) return res.status(500).json({ error: error.message || error });
        return res.status(201).json({ user: data });
      } catch (err) {
        console.error('user.create admin.createUser error', err);
        return res.status(500).json({ error: 'Failed to create user via admin API', details: String(err) });
      }
    }

    // Fallback: create via the regular sign-up endpoint (not recommended for server-side)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password }, { data: user_metadata || {} });
      if (error) return res.status(500).json({ error: error.message || error });
      return res.status(201).json({ user: data });
    } catch (err) {
      console.error('user.create signUp error', err);
      return res.status(500).json({ error: 'Failed to sign up user', details: String(err) });
    }
  } catch (err) {
    console.error('user.create error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Get user by id (admin)
router.get('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    if (!uid) return res.status(400).json({ error: 'id required' });
    if (DEV_MOCK) {
      // Return a mocked user object for local dev
      return res.json({ user: { id: uid, email: uid + '@example.test', user_metadata: {} } });
    }

    if (supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.getUserById === 'function') {
      const { data, error } = await supabase.auth.admin.getUserById(uid);
      if (error) return res.status(500).json({ error: error.message || error });
      return res.json({ user: data });
    }
    // Fallback: try user lookup via auth API (may not be permitted)
    const { data, error } = await supabase.auth.getUser(uid);
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ user: data });
  } catch (err) {
    console.error('user.get error', err);
    return res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
