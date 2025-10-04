// services/email/emailService.js
import Mailjet from 'node-mailjet';
import { PrismaClient } from '@prisma/client';
import { welcomeTemplate } from './templates/welcome.js';
import { passwordResetTemplate } from './templates/passwordReset.js';
import { teamInvitationTemplate } from './templates/teamInvitation.js';

const prisma = new PrismaClient();

class EmailService {
  constructor() {
    this.mailjet = Mailjet.apiConnect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_SECRET_KEY
    );

    this.fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@commitapp.io';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Commit Sales Commission';

    this.templates = {
      welcome: welcomeTemplate,
      password_reset: passwordResetTemplate,
      team_invitation: teamInvitationTemplate
    };
  }

  /**
   * Check if user has opted in to receive this type of email
   */
  async checkPreferences(userId, emailType) {
    if (!userId) return true; // No user context, send anyway

    try {
      const preferences = await prisma.email_preferences.findUnique({
        where: { user_id: userId }
      });

      if (!preferences) return true; // No preferences set, default to true

      const preferenceMap = {
        welcome: 'welcome_emails',
        password_reset: 'password_reset_emails',
        team_invitation: 'team_invitation_emails'
      };

      const field = preferenceMap[emailType];
      return field ? preferences[field] : true;
    } catch (error) {
      console.error('Error checking email preferences:', error);
      return true; // Default to sending on error
    }
  }

  /**
   * Log email to database
   */
  async logEmail({ userId, companyId, emailType, recipientEmail, subject, status, providerId, errorMessage, metadata }) {
    try {
      await prisma.email_logs.create({
        data: {
          user_id: userId,
          company_id: companyId,
          email_type: emailType,
          recipient_email: recipientEmail,
          subject,
          status,
          provider_id: providerId,
          error_message: errorMessage,
          metadata: metadata || {},
          sent_at: status === 'sent' ? new Date() : null
        }
      });
    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  /**
   * Send an email using Mailjet
   */
  async send({ to, subject, template, data, userId, companyId, emailType }) {
    try {
      // Check if Mailjet is configured
      if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
        console.warn('⚠️  Mailjet not configured. Email not sent:', { to, subject, emailType });
        await this.logEmail({
          userId,
          companyId,
          emailType,
          recipientEmail: to,
          subject,
          status: 'failed',
          errorMessage: 'Mailjet API credentials not configured',
          metadata: data
        });
        return { success: false, error: 'Email service not configured' };
      }

      // Check user preferences
      if (userId) {
        const hasOptedIn = await this.checkPreferences(userId, emailType);
        if (!hasOptedIn) {
          console.log(`User ${userId} has opted out of ${emailType} emails`);
          await this.logEmail({
            userId,
            companyId,
            emailType,
            recipientEmail: to,
            subject,
            status: 'skipped',
            errorMessage: 'User opted out',
            metadata: data
          });
          return { success: true, skipped: true };
        }
      }

      // Get template function
      const templateFn = this.templates[template];
      if (!templateFn) {
        throw new Error(`Template "${template}" not found`);
      }

      // Render HTML and text versions
      const { html, text } = templateFn(data);

      // Send via Mailjet
      const request = this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: this.fromEmail,
                Name: this.fromName
              },
              To: [
                {
                  Email: to
                }
              ],
              Subject: subject,
              TextPart: text,
              HTMLPart: html
            }
          ]
        });

      const result = await request;
      const messageId = result.body?.Messages?.[0]?.To?.[0]?.MessageID;

      // Log success
      await this.logEmail({
        userId,
        companyId,
        emailType,
        recipientEmail: to,
        subject,
        status: 'sent',
        providerId: messageId ? String(messageId) : null,
        metadata: data
      });

      console.log(`✅ Email sent to ${to}: ${subject}`);
      return { success: true, messageId };

    } catch (error) {
      console.error('❌ Error sending email:', error);

      // Log failure
      await this.logEmail({
        userId,
        companyId,
        emailType,
        recipientEmail: to,
        subject,
        status: 'failed',
        errorMessage: error.message,
        metadata: data
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail({ user, companyName }) {
    return this.send({
      to: user.email,
      subject: `Welcome to Commit - Your Sales Commission Platform`,
      template: 'welcome',
      data: {
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: companyName,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
      },
      userId: user.id,
      companyId: user.company_id,
      emailType: 'welcome'
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail({ user, resetToken }) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return this.send({
      to: user.email,
      subject: 'Reset Your Commit Password',
      template: 'password_reset',
      data: {
        firstName: user.first_name,
        resetUrl: resetUrl,
        expiresIn: '1 hour'
      },
      userId: user.id,
      companyId: user.company_id,
      emailType: 'password_reset'
    });
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitationEmail({ user, teamName, invitedBy, companyName }) {
    return this.send({
      to: user.email,
      subject: `You've been added to ${teamName}`,
      template: 'team_invitation',
      data: {
        firstName: user.first_name,
        teamName: teamName,
        invitedByName: `${invitedBy.first_name} ${invitedBy.last_name}`,
        companyName: companyName,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
      },
      userId: user.id,
      companyId: user.company_id,
      emailType: 'team_invitation'
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
