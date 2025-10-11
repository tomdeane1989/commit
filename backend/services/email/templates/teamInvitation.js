// services/email/templates/teamInvitation.js

export function teamInvitationTemplate(data) {
  const { firstName, teamName, invitedByName, companyName, loginUrl } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
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
                <span style="font-size: 32px;">👥</span>
              </div>
              <h1 style="margin: 0; color: #333333; font-size: 28px; font-weight: 700;">
                You've Been Added to a Team!
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
                Great news! <strong>${invitedByName}</strong> has added you to the <strong>${teamName}</strong> team at ${companyName}.
              </p>

              <!-- Team Info Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #667eea;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                      <strong>Team:</strong> ${teamName}
                    </p>
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                      <strong>Company:</strong> ${companyName}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #666666;">
                      <strong>Added by:</strong> ${invitedByName}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                As a team member, you'll be able to:
              </p>

              <ul style="margin: 0 0 30px 0; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #333333;">
                <li>Collaborate with your teammates</li>
                <li>Track team performance and targets</li>
                <li>View team deals and commissions</li>
                <li>Access shared resources and insights</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      View Team →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                Log in to your Commit account to start collaborating with your team!
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
You've Been Added to a Team!

Hi ${firstName},

Great news! ${invitedByName} has added you to the ${teamName} team at ${companyName}.

Team Details:
- Team: ${teamName}
- Company: ${companyName}
- Added by: ${invitedByName}

As a team member, you'll be able to:
- Collaborate with your teammates
- Track team performance and targets
- View team deals and commissions
- Access shared resources and insights

Log in to view your team: ${loginUrl}

© ${new Date().getFullYear()} Commit. All rights reserved.
  `;

  return { html, text };
}
