import "dotenv/config";
import nodemailer from "nodemailer";

// Create Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 // Send Password Reset Email with Pacific ocean theme
 */
export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Pacific Support" <no-reply@pacific.com>',
    to: toEmail,
    subject: "[Pacific] Yêu cầu đặt lại mật khẩu",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b1120; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #1e2a56; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          .header { background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; color: #ffffff; font-weight: 800; letter-spacing: 1px; }
          .content { padding: 32px 28px; text-align: center; }
          .content p { font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 24px; }
          .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #0ea5e9, #06b6d4); color: #ffffff !important; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 15px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.4); margin-bottom: 24px; }
          .note { font-size: 13px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 20px; }
          .footer { background-color: #162044; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌊 PACIFIC</h1>
          </div>
          <div class="content">
            <h2 style="color: #ffffff; margin-top: 0;">Khôi phục mật khẩu</h2>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này. Vui lòng bấm vào nút bên dưới để tạo mật khẩu mới:</p>
            <a href="${resetUrl}" target="_blank" class="btn">Đặt lại mật khẩu</a>
            <p style="font-size: 13px; color: #94a3b8;">Link này sẽ <strong>hết hạn sau 15 phút</strong> vì lý do bảo mật.</p>
            <div class="note">
              Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với đội ngũ hỗ trợ Pacific.
            </div>
          </div>
          <div class="footer">
            &copy; 2026 Pacific Ocean Exploration. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

/**
 // Send Email Verification Email
 */
export async function sendVerificationEmail(toEmail, verifyUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Pacific Support" <no-reply@pacific.com>',
    to: toEmail,
    subject: "[Pacific] Xác nhận địa chỉ Email",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b1120; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #1e2a56; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); }
          .header { background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; color: #ffffff; font-weight: 800; }
          .content { padding: 32px 28px; text-align: center; }
          .content p { font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 24px; }
          .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #0ea5e9, #06b6d4); color: #ffffff !important; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 15px; }
          .footer { background-color: #162044; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌊 PACIFIC</h1>
          </div>
          <div class="content">
            <h2 style="color: #ffffff; margin-top: 0;">Chào mừng bạn đến với Pacific!</h2>
            <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng bấm vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
            <a href="${verifyUrl}" target="_blank" class="btn">Xác nhận Email</a>
          </div>
          <div class="footer">
            &copy; 2026 Pacific Ocean Exploration. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await transporter.sendMail(mailOptions);
}
