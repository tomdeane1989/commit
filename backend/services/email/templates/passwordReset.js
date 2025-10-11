// services/email/templates/passwordReset.js

export function passwordResetTemplate(data) {
  const { firstName, resetUrl, expiresIn } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">🔐</span>
              </div>
              <h1 style="margin: 0; color: #333333; font-size: 28px; font-weight: 700;">
                Reset Your Password
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${firstName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We received a request to reset your password for your Commit account. Click the button below to create a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 30px auto;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                This password reset link will expire in <strong>${expiresIn}</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>

              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999; word-break: break-all;">
                ${resetUrl}
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fef3c7; border-top: 1px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #92400e;">
                <strong>🛡️ Security Tip:</strong> Never share your password with anyone. Commit will never ask for your password via email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                © ${new Date().getFullYear()} Commit. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999999;">
                If you have questions, contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
Reset Your Password

Hi ${firstName},

We received a request to reset your password for your Commit account.

Reset your password: ${resetUrl}

This password reset link will expire in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.

Security Tip: Never share your password with anyone. Commit will never ask for your password via email.

© ${new Date().getFullYear()} Commit. All rights reserved.
  `;

  return { html, text };
}
