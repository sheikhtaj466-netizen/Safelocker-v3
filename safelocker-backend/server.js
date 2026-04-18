require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const dns = require('dns');

// 🔥 VVIP FIX: Force Node to use IPv4 globally. Render's IPv6 messes with Google SMTP.
dns.setDefaultResultOrder('ipv4first');

const app = express();

// 🔥 SENIOR TIP: Render load balancer use karta hai. Iske bina tera Rate Limiter har user ko same IP manega aur block kar dega.
app.set('trust proxy', 1); 

app.use(helmet()); 
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5, // Thoda limit badha diya development ke liye
  message: { success: false, message: "Too many OTP requests. Please try again after 5 minutes." },
  standardHeaders: true, 
  legacyHeaders: false, 
});

const MY_GMAIL = process.env.EMAIL_USER; 
const APP_PASSWORD = process.env.EMAIL_PASS; 

// 🔥 TRANSPORTER FIX: Enforce host/port explicitly aur self-signed certs bypass
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: { user: MY_GMAIL, pass: APP_PASSWORD },
  tls: { rejectUnauthorized: false } 
});

app.get('/', (req, res) => { res.status(200).send('SafeLocker Ultra-Secure Engine is ALIVE! 🛡️🚀'); });

const otpStore = new Map();

const getEmailTemplateContent = (type, otp) => {
  let title = "Verify Your Email";
  let message = "Use this 6-digit OTP to verify your SafeLocker recovery email. It expires in 5 minutes.";
  let subject = "SafeLocker: Email Verification OTP";
  let themeColor = "#6C5CE7"; 
  let bgBox = "#EEF2FF";

  if (type === 'VAULT_WIPE') {
    title = "⚠️ URGENT: Vault Reset Requested";
    message = "Use this 6-digit OTP to authorize a complete wipe of your SafeLocker data.<br><br><b>WARNING:</b> This will permanently delete all local data.";
    subject = "🚨 ALERT: SafeLocker Reset OTP";
    themeColor = "#DC2626"; 
    bgBox = "#FEF2F2"; 
  } else if (type === 'RESET_MASTER_PIN') {
    title = "Reset Your Vault PIN";
    message = "Use this 6-digit OTP to reset your SafeLocker master PIN.";
    subject = "SafeLocker: Reset Master PIN";
  }

  const html = `
  <div style="font-family: -apple-system, sans-serif; padding: 40px 20px; text-align: center; background: #FAFAFB;">
    <div style="max-width: 90%; margin: auto; background: #FFFFFF; padding: 32px 20px; border-radius: 16px; border: 1px solid #E5E7EB;">
      <h2 style="color: ${themeColor}; margin-top: 0; font-size: 22px;">${title}</h2>
      <p style="color: #6B7280; font-size: 15px; margin-bottom: 24px;">${message}</p>
      <div style="background: ${bgBox}; padding: 14px; border-radius: 12px; margin: 0 auto; max-width: 200px;">
        <h1 style="letter-spacing: 6px; color: ${themeColor}; margin: 0; font-size: 28px;">${otp}</h1>
      </div>
    </div>
  </div>`;

  return { subject, html };
};

// 🔥 X-RAY LOGGING ADDED HERE
app.post('/send-otp', otpLimiter, async (req, res) => {
  const { email, otpType } = req.body; 
  console.log(`\n🚀 [OTP REQUEST] Received for: ${email} | Type: ${otpType}`);

  if (!email) {
    console.log(`❌ [ERROR] Email missing in request.`);
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  
  if (!MY_GMAIL || !APP_PASSWORD) {
    console.log(`❌ [CRITICAL ERROR] Environment Variables missing! Check Render Dashboard.`);
    return res.status(500).json({ success: false, message: 'Server Email Auth not configured.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expires: Date.now() + 5 * 60000 });
  const template = getEmailTemplateContent(otpType, otp);
  
  try {
    console.log(`⏳ [SENDING EMAIL] Connecting to Nodemailer...`);
    await transporter.sendMail({ from: `"SafeLocker Security" <${MY_GMAIL}>`, to: email, subject: template.subject, html: template.html });
    console.log(`✅ [SUCCESS] Email delivered successfully to: ${email}`);
    res.status(200).json({ success: true, message: 'OTP sent successfully!' });
  } catch (error) { 
    console.error(`❌ [NODEMAILER ERROR] Failed to send email:`, error.message);
    res.status(500).json({ success: false, error: error.message }); 
  }
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore.get(email);
  if (!record || Date.now() > record.expires) { 
    return res.status(400).json({ success: false, message: 'OTP expired or invalid.' }); 
  }
  if (record.otp === otp) { 
    otpStore.delete(email); 
    return res.status(200).json({ success: true, message: 'OTP Verified!' }); 
  }
  res.status(400).json({ success: false, message: 'Invalid OTP.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Secure Engine running on port ${PORT}`));
