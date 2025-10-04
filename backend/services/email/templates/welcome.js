// services/email/templates/welcome.js

export function welcomeTemplate(data) {
  const { firstName, lastName, companyName, loginUrl } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Commit</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">
                Welcome to Commit! 🎉
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${firstName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Welcome to Commit! We're thrilled to have <strong>${companyName}</strong> on board.
                Your sales commission tracking journey starts here.
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                With Commit, you can:
              </p>

              <ul style="margin: 0 0 30px 0; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #333333;">
                <li>Track deals and commissions in real-time</li>
                <li>Manage your sales team and targets</li>
                <li>Integrate with your CRM (HubSpot, Salesforce, Google Sheets)</li>
                <li>Get insights into your sales pipeline</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Get Started →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                If you have any questions, feel free to reach out to our support team. We're here to help!
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
                <a href="${loginUrl}" style="color: #667eea; text-decoration: none;">Login</a> |
                <a href="https://sales-commission-saas.vercel.app" style="color: #667eea; text-decoration: none;">Visit Website</a>
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
Welcome to Commit!

Hi ${firstName},

Welcome to Commit! We're thrilled to have ${companyName} on board. Your sales commission tracking journey starts here.

With Commit, you can:
- Track deals and commissions in real-time
- Manage your sales team and targets
- Integrate with your CRM (HubSpot, Salesforce, Google Sheets)
- Get insights into your sales pipeline

Get started: ${loginUrl}

If you have any questions, feel free to reach out to our support team. We're here to help!

© ${new Date().getFullYear()} Commit. All rights reserved.
  `;

  return { html, text };
}
