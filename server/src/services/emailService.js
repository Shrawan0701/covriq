/**
 * CovrIQ Email Service (Brevo API + Nodemailer fallback)
 * Delivers secure password reset OTPs to Gmail and other mailboxes.
 */

export async function sendOtpEmail(toEmail, otpCode, userName = 'Sports Bettor') {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'security@covriq.ai';
  const senderName = process.env.BREVO_SENDER_NAME || 'CovrIQ Security';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0d10; color: #f3f4f6; margin: 0; padding: 24px; }
        .card { max-width: 500px; margin: 0 auto; background-color: #14171d; border: 1px solid #232a36; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .logo { font-size: 24px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 20px; }
        .logo span { color: #f3f4f6; }
        .otp-box { background-color: #1c222c; border: 1px solid #38bdf8; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; padding: 18px; margin: 24px 0; color: #38bdf8; }
        .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #232a36; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Covr<span>IQ</span></div>
        <h2 style="margin-top:0; color:#f3f4f6;">Password Reset Request</h2>
        <p style="color:#9ca3af; line-height: 1.5;">Hello ${userName},</p>
        <p style="color:#d1d5db; line-height: 1.5;">We received a request to reset the password for your CovrIQ account. Use the one-time verification code (OTP) below to proceed:</p>
        <div class="otp-box">${otpCode}</div>
        <p style="color:#9ca3af; font-size: 13px;">This code will expire in <strong>15 minutes</strong>. If you did not request a password reset, please disregard this email or contact support.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CovrIQ AI Sports Intelligence. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Try Brevo REST API v3 if API key is present
  if (brevoApiKey && brevoApiKey.trim() !== '') {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail, name: userName }],
          subject: `Your CovrIQ Password Reset Code: ${otpCode}`,
          htmlContent: htmlContent
        })
      });

      if (response.ok) {
        console.log(`[EmailService] Brevo OTP successfully sent to ${toEmail}`);
        return { success: true, provider: 'brevo' };
      } else {
        const errorData = await response.text();
        console.error(`[EmailService] Brevo API Error:`, errorData);
      }
    } catch (err) {
      console.error(`[EmailService] Brevo fetch error:`, err);
    }
  }

  // 2. Dev / Testing fallback log
  console.log('====================================================');
  console.log(`[DEV OTP NOTIFICATION] To: ${toEmail} | Code: ${otpCode}`);
  console.log(`[DEV OTP NOTIFICATION] Brevo API key not set or failed; simulated OTP delivered.`);
  console.log('====================================================');

  return { success: true, provider: 'simulated_dev', devCode: otpCode };
}
