const nodemailer = require("nodemailer");

// generate 4-digit OTP
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// send OTP email
async function sendOtpEmail(toEmail, otp) {
  // configure transporter
  const transporter = nodemailer.createTransport({
    service: "gmail", // or "outlook", "yahoo", custom SMTP
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // HTML email theme
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background: #f5f7fa; padding: 15px;">
      <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); padding: 30px;">
        <h2 style="text-align: center; color: #2d89ef;">Sarvam - OTP Verification</h2>
        <p style="font-size: 16px; color: #333;">Hello,</p>
        <p style="font-size: 16px; color: #333;">
          Use the following One Time Password (OTP) to reset your password:
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2d89ef;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #777;">
          This OTP is valid for <strong>10 minutes</strong>. Please do not share it with anyone.
        </p>
        <hr/>
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          © ${new Date().getFullYear()} Sarvam. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Sarvam Support" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Sarvam - Password Reset OTP",
    html: htmlContent,
  });
}

module.exports = { generateOtp, sendOtpEmail };
