// server.js - Complete server that handles registration, email verification, and user storage
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Keep the existing Supabase setup for products/orders
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
} else {
  console.log('Supabase not configured - products/orders will be unavailable');
}

const app = express();
app.use(cors());
app.use(express.json());

// File paths and configuration
const USER_FILE = path.join(__dirname, 'user.json');
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '0', 10) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || (SMTP_USER || 'no-reply@example.com');
const PORT = process.env.PORT || 3000;

// Store verification codes in memory (cleared on server restart)
const verificationCodes = new Map();

// Email setup for Gmail (use App Password)
let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  // Verify SMTP configuration at startup (non-sensitive: will not log the password)
  mailer.verify().then(() => {
    console.log('SMTP verification successful — credentials accepted by the SMTP server');
  }).catch(err => {
    console.error('SMTP verification failed:', err && err.message ? err.message : err);
  });
} else {
  console.log('Email not configured - running in development mode');
}

// File storage helpers
async function readUsersFile() {
  try {
    const data = await fs.readFile(USER_FILE, 'utf8');
    // Handle empty file case explicitly
    if (!data || data.trim() === '') {
      return [];
    }
    try {
      const users = JSON.parse(data);
      return Array.isArray(users) ? users : [];
    } catch (parseErr) {
      console.warn('Invalid JSON in users file, returning empty array:', parseErr);
      return [];
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Initialize the file with empty array if it doesn't exist
      await fs.writeFile(USER_FILE, '[]', 'utf8');
      return [];
    }
    throw err;
  }
}

async function writeUsersFile(users) {
  // Ensure we always write an array
  const safeUsers = Array.isArray(users) ? users : [];
  await fs.writeFile(USER_FILE, JSON.stringify(safeUsers, null, 2), 'utf8');
}

async function findUserByEmail(email) {
  const users = await readUsersFile();
  return users.find(user => user.email === email);
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

// Health check
app.get('/', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Login endpoint with password verification and welcome back email
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in our JSON file
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Send welcome back email
    if (mailer) {
      try {
        await mailer.sendMail({
          from: EMAIL_FROM,
          to: user.email,
          subject: 'Welcome Back to Lamar Phone & Gadget!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome back, ${user.name}! 🎉</h2>
              <p>You've successfully logged in to your Lamar Phone & Gadget account.</p>
              <p>If you didn't login just now, please contact our support team immediately.</p>
              <p style="color: #666; font-size: 0.9em;">
                Best regards,<br>
                The Lamar Phone & Gadget Team
              </p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send welcome back email:', emailErr);
        // Don't fail the login if email fails
      }
    }

    // Return user info (excluding password hash)
    const { password_hash, ...userInfo } = user;
    res.json({ 
      message: 'Login successful',
      user: userInfo
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send verification code (shared handler for both /api/send-code and /users/send-code)
async function handleSendCode(req, res) {
  try {
    const { email } = req.body;
    // Debugging: log incoming payload to help diagnose 400 errors from the client
    try { console.log('handleSendCode: incoming body:', typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body)); } catch(e) { console.log('handleSendCode: incoming body (raw)', req.body); }
    if (!email) {
      console.warn('handleSendCode: missing email in request body');
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email already registered
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      console.warn('handleSendCode: email already registered:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }

    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store code in memory
    verificationCodes.set(email, { code, expires, used: false });

    if (mailer) {
      try {
        await mailer.sendMail({
          from: EMAIL_FROM,
          to: email,
          subject: 'Your Verification Code',
          text: `Your verification code is: ${code}\nThis code will expire in 15 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Verification Code</h2>
              <p>Your verification code is:</p>
              <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f5f5f5; border-radius: 4px; margin: 10px 0;">
                ${code}
              </div>
              <p>This code will expire in 15 minutes.</p>
            </div>
          `
        });
        return res.json({ success: true, message: 'Verification code sent' });
      } catch (error) {
        console.error('Failed to send email:', error);
        return res.status(200).json({ 
          success: true, 
          message: 'Code generated',
          code: code, // Only in development!
          warning: 'Email sending failed, but code was generated'
        });
      }
    }

    // Development mode - return code in response
    return res.json({ success: true, message: 'Code generated (dev mode)', code: code });
  } catch (error) {
    console.error('Send code error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

app.post('/api/send-code', handleSendCode);
app.post('/users/send-code', handleSendCode);

// Verify code and register user (shared handler for /api/verify-and-register and /users/verify-code)
async function handleVerifyAndRegister(req, res) {
  try {
    // Accept name either as `name` or inside `user_metadata.full_name`
    const { email, code, password, name, user_metadata } = req.body;
    const suppliedName = name || (user_metadata && (user_metadata.full_name || user_metadata.fullName || user_metadata.name));
    if (!email || !code || !password || !suppliedName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify code
    const stored = verificationCodes.get(email);
    if (!stored) {
      return res.status(400).json({ error: 'No verification code found for this email' });
    }
    if (stored.used) {
      return res.status(400).json({ error: 'Code already used' });
    }
    if (stored.expires < new Date()) {
      return res.status(400).json({ error: 'Code expired' });
    }
    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Mark code as used
    stored.used = true;
    verificationCodes.set(email, stored);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const newUser = {
      id: crypto.randomUUID(),
      email,
      name: suppliedName,
      password_hash: hashedPassword,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save to user.json
    const users = await readUsersFile();
    users.push(newUser);
    await writeUsersFile(users);

    // Return user data (without password)
    const { password_hash, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
}

app.post('/api/verify-and-register', handleVerifyAndRegister);
app.post('/users/verify-code', handleVerifyAndRegister);

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return user data (without password)
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// Get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsersFile();
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (without password)
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const users = await readUsersFile();
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update allowed fields
    users[index] = {
      ...users[index],
      name: name || users[index].name,
      email: email || users[index].email,
      updated_at: new Date().toISOString()
    };

    await writeUsersFile(users);

    // Return updated user (without password)
    const { password_hash, ...safeUser } = users[index];
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Change password
app.post('/api/users/:id/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const users = await readUsersFile();
    const index = users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, users[index].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    users[index].password_hash = await bcrypt.hash(newPassword, 10);
    users[index].updated_at = new Date().toISOString();

    await writeUsersFile(users);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /orders (keep existing Supabase orders endpoint)
app.post('/orders', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Orders service unavailable (Supabase not configured)' });
  }
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    const orderRow = {
      user_id: body.user_id || null,
      status: body.status || 'pending',
      total: Number(body.total ?? body.total_amount ?? 0) || 0,
      currency: body.currency || 'NGN',
      shipping: body.shipping || {},
      billing: body.billing || {},
      metadata: body.metadata || {}
    };

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([orderRow])
      .select('id')
      .single();

    if (orderError) {
      console.error('Failed to insert order:', orderError);
      return res.status(500).json({ error: orderError.message });
    }

    if (!items.length) {
      return res.json({ order: orderData });
    }

    // Insert order items
    const orderItems = items.map(item => ({
      order_id: orderData.id,
      product_id: item.product_id,
      name: item.name,
      sku: item.sku,
      price: Number(item.price) || 0,
      quantity: Number(item.qty || item.quantity) || 1,
      metadata: item.metadata || {}
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Failed to insert order items:', itemsError);
      // Best effort: try to delete the parent order
      try {
        await supabase.from('orders').delete().eq('id', orderData.id);
      } catch (e) { /* ignore cleanup errors */ }
      return res.status(500).json({ error: itemsError.message });
    }

    return res.json({ order: orderData });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Email configuration:', mailer ? 'SMTP configured' : 'Running in development mode (no SMTP)');
  console.log('Supabase configuration:', supabase ? 'Connected (orders enabled)' : 'Not configured (orders disabled)');
});