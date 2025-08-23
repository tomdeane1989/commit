// routes/gdpr.js - GDPR compliance endpoints for data export and deletion
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateTokenEnhanced } from '../middleware/auth-enhanced.js';
import { dataExportRateLimit } from '../middleware/rate-limiter.js';
import { validate, schemas } from '../middleware/input-validation.js';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all GDPR endpoints
router.use(authenticateTokenEnhanced);

// Data export endpoint - Get all user data
router.post('/export', 
  dataExportRateLimit,
  validate(schemas.dataExport),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        format = 'json',
        include_deals = true,
        include_commissions = true,
        include_targets = true,
        include_team = false,
        date_from,
        date_to
      } = req.body;

      // Build date filter
      const dateFilter = {};
      if (date_from) {
        dateFilter.gte = new Date(date_from);
      }
      if (date_to) {
        dateFilter.lte = new Date(date_to);
      }

      // Collect user data
      const userData = {
        profile: await prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            is_manager: true,
            is_admin: true,
            territory: true,
            hire_date: true,
            created_at: true,
            employee_id: true,
            is_active: true
          }
        })
      };

      // Include deals if requested
      if (include_deals) {
        userData.deals = await prisma.deals.findMany({
          where: {
            user_id: userId,
            ...(Object.keys(dateFilter).length > 0 && {
              created_at: dateFilter
            })
          },
          select: {
            id: true,
            deal_name: true,
            account_name: true,
            amount: true,
            status: true,
            stage: true,
            close_date: true,
            created_date: true,
            commission_amount: true,
            commission_calculated_at: true,
            crm_id: true,
            created_at: true,
            updated_at: true
          }
        });
      }

      // Include commissions if requested (from deals table)
      if (include_commissions) {
        userData.commissions = await prisma.deals.findMany({
          where: {
            user_id: userId,
            status: 'closed_won',
            commission_amount: { not: null },
            ...(Object.keys(dateFilter).length > 0 && {
              commission_calculated_at: dateFilter
            })
          },
          select: {
            id: true,
            deal_name: true,
            account_name: true,
            amount: true,
            commission_amount: true,
            commission_calculated_at: true,
            close_date: true,
            created_at: true
          }
        });
      }

      // Include targets if requested
      if (include_targets) {
        userData.targets = await prisma.targets.findMany({
          where: {
            user_id: userId,
            ...(Object.keys(dateFilter).length > 0 && {
              created_at: dateFilter
            })
          },
          select: {
            id: true,
            period_type: true,
            period_start: true,
            period_end: true,
            quota_amount: true,
            commission_rate: true,
            is_active: true,
            created_at: true
          }
        });
      }

      // Include team members if requested and user is a manager
      if (include_team && (req.user.is_manager || req.user.is_admin)) {
        userData.team_members = await prisma.users.findMany({
          where: {
            company_id: req.user.company_id,
            id: { not: userId } // Exclude self
          },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            is_manager: true,
            is_admin: true,
            territory: true,
            is_active: true,
            created_at: true
          }
        });
      }

      // Activity log
      userData.activity_log = await prisma.activity_log.findMany({
        where: {
          user_id: userId,
          ...(Object.keys(dateFilter).length > 0 && {
            created_at: dateFilter
          })
        },
        select: {
          action: true,
          entity_type: true,
          entity_id: true,
          created_at: true,
          context: true,
          success: true
        },
        orderBy: { created_at: 'desc' },
        take: 1000 // Limit to last 1000 activities
      });

      // Format response based on requested format
      let response;
      let filename = `data-export-${userId}-${Date.now()}`;

      switch (format) {
        case 'csv':
          // Convert to CSV
          const csvData = [];
          
          // Flatten data for CSV
          if (userData.deals) {
            userData.deals.forEach(deal => {
              csvData.push({
                type: 'deal',
                ...deal,
                amount: deal.amount.toString(),
                commission_amount: deal.commission_amount?.toString()
              });
            });
          }
          
          if (userData.commissions) {
            userData.commissions.forEach(commission => {
              csvData.push({
                type: 'commission',
                ...commission,
                deal_amount: commission.deal_amount.toString(),
                commission_amount: commission.commission_amount.toString()
              });
            });
          }

          const parser = new Parser();
          response = parser.parse(csvData);
          filename += '.csv';
          res.setHeader('Content-Type', 'text/csv');
          break;

        case 'excel':
          // Create Excel workbook
          const workbook = new ExcelJS.Workbook();
          
          // Profile sheet
          const profileSheet = workbook.addWorksheet('Profile');
          profileSheet.columns = [
            { header: 'Field', key: 'field', width: 30 },
            { header: 'Value', key: 'value', width: 50 }
          ];
          Object.entries(userData.profile || {}).forEach(([key, value]) => {
            profileSheet.addRow({ field: key, value: String(value) });
          });

          // Deals sheet
          if (userData.deals && userData.deals.length > 0) {
            const dealsSheet = workbook.addWorksheet('Deals');
            dealsSheet.columns = Object.keys(userData.deals[0]).map(key => ({
              header: key,
              key: key,
              width: 20
            }));
            userData.deals.forEach(deal => {
              dealsSheet.addRow(deal);
            });
          }

          // Commissions sheet
          if (userData.commissions && userData.commissions.length > 0) {
            const commissionsSheet = workbook.addWorksheet('Commissions');
            commissionsSheet.columns = Object.keys(userData.commissions[0]).map(key => ({
              header: key,
              key: key,
              width: 20
            }));
            userData.commissions.forEach(commission => {
              commissionsSheet.addRow(commission);
            });
          }

          // Generate Excel buffer
          const buffer = await workbook.xlsx.writeBuffer();
          response = buffer;
          filename += '.xlsx';
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;

        case 'json':
        default:
          response = JSON.stringify(userData, null, 2);
          filename += '.json';
          res.setHeader('Content-Type', 'application/json');
          break;
      }

      // Log the export
      await prisma.activity_log.create({
        data: {
          user_id: userId,
          company_id: req.user.company_id,
          action: 'data_export',
          entity_type: 'user',
          entity_id: userId,
          context: {
            format,
            include_deals,
            include_commissions,
            include_targets,
            include_team,
            date_from,
            date_to
          },
          success: true
        }
      });

      // Set download headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(response);

    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({
        error: 'Failed to export data',
        code: 'EXPORT_FAILED'
      });
    }
});

// Right to be forgotten - Delete all user data
router.delete('/delete-account',
  dataExportRateLimit,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { password, confirmation } = req.body;

      // Require password confirmation
      if (!password) {
        return res.status(400).json({
          error: 'Password required for account deletion',
          code: 'PASSWORD_REQUIRED'
        });
      }

      // Require explicit confirmation
      if (confirmation !== 'DELETE MY ACCOUNT') {
        return res.status(400).json({
          error: 'Please type "DELETE MY ACCOUNT" to confirm',
          code: 'CONFIRMATION_REQUIRED'
        });
      }

      // Verify password
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { password: true, email: true }
      });

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Start transaction for data deletion
      await prisma.$transaction(async (tx) => {
        // Log the deletion request
        await tx.activity_log.create({
          data: {
            user_id: userId,
            company_id: req.user.company_id,
            action: 'account_deletion_requested',
            entity_type: 'user',
            entity_id: userId,
            context: {
              email: user.email,
              requested_at: new Date()
            },
            success: true
          }
        });

        // Anonymize user data instead of hard delete (for data integrity)
        const anonymizedEmail = `deleted-${crypto.randomBytes(16).toString('hex')}@deleted.local`;
        const anonymizedName = 'Deleted User';

        // Update user record
        await tx.users.update({
          where: { id: userId },
          data: {
            email: anonymizedEmail,
            first_name: anonymizedName,
            last_name: anonymizedName,
            password: crypto.randomBytes(32).toString('hex'), // Random unrecoverable password
            is_active: false,
            territory: null,
            performance_profile: null,
            employee_id: null,
            last_activity: new Date(),
            password_reset_token: null,
            password_reset_expires: null,
            two_factor_enabled: false,
            two_factor_secret: null
          }
        });

        // Note: Deals remain linked to anonymized user for audit trail
        // No need to update deals as they reference user by ID

        // Delete refresh tokens
        await tx.refresh_tokens.deleteMany({
          where: { user_id: userId }
        });

        // Anonymize activity logs
        await tx.activity_log.updateMany({
          where: { user_id: userId },
          data: {
            details: {
              anonymized: true,
              anonymized_at: new Date()
            }
          }
        });

        // Remove from teams
        await tx.team_members.deleteMany({
          where: { user_id: userId }
        });

        // Final deletion log
        await tx.activity_log.create({
          data: {
            user_id: userId,
            company_id: req.user.company_id,
            action: 'account_deleted',
            entity_type: 'user',
            entity_id: userId,
            details: {
              deleted_at: new Date(),
              anonymized_email: anonymizedEmail
            }
          }
        });
      });

      res.json({
        success: true,
        message: 'Your account has been successfully deleted',
        deleted_at: new Date()
      });

    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete account',
        code: 'DELETION_FAILED'
      });
    }
});

// Data portability - Get structured data for migration
router.get('/portability',
  dataExportRateLimit,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Collect all user data in a portable format
      const portableData = {
        version: '1.0',
        exported_at: new Date(),
        user: await prisma.users.findUnique({
          where: { id: userId },
          select: {
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            territory: true,
            hire_date: true,
            employee_id: true
          }
        }),
        deals: await prisma.deals.findMany({
          where: { user_id: userId },
          select: {
            deal_name: true,
            account_name: true,
            amount: true,
            status: true,
            close_date: true,
            deal_type: true
          }
        }),
        performance: {
          total_deals: await prisma.deals.count({
            where: { user_id: userId }
          }),
          closed_won: await prisma.deals.count({
            where: { user_id: userId, status: 'closed_won' }
          }),
          total_revenue: await prisma.deals.aggregate({
            where: { user_id: userId, status: 'closed_won' },
            _sum: { amount: true }
          }),
          total_commissions: await prisma.commissions.aggregate({
            where: { user_id: userId, status: 'paid' },
            _sum: { commission_amount: true }
          })
        }
      };

      res.json(portableData);

    } catch (error) {
      console.error('Data portability error:', error);
      res.status(500).json({
        error: 'Failed to generate portable data',
        code: 'PORTABILITY_FAILED'
      });
    }
});

// Privacy settings - Update data sharing preferences
router.put('/privacy-settings',
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        allow_performance_tracking = true,
        allow_ai_analysis = false,
        allow_benchmarking = false,
        data_retention_days = 365
      } = req.body;

      // Store privacy preferences (extend user model as needed)
      await prisma.users.update({
        where: { id: userId },
        data: {
          performance_profile: {
            privacy_settings: {
              allow_performance_tracking,
              allow_ai_analysis,
              allow_benchmarking,
              data_retention_days,
              updated_at: new Date()
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Privacy settings updated',
        settings: {
          allow_performance_tracking,
          allow_ai_analysis,
          allow_benchmarking,
          data_retention_days
        }
      });

    } catch (error) {
      console.error('Privacy settings error:', error);
      res.status(500).json({
        error: 'Failed to update privacy settings',
        code: 'SETTINGS_UPDATE_FAILED'
      });
    }
});

// Data retention policy - Clean up old data
router.post('/cleanup',
  async (req, res) => {
    try {
      // Only admins can trigger cleanup
      if (!req.user.is_admin) {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'FORBIDDEN'
        });
      }

      const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '365');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old activity logs
      const deletedLogs = await prisma.activity_log.deleteMany({
        where: {
          created_at: { lt: cutoffDate }
        }
      });

      // Clean up expired refresh tokens
      const deletedTokens = await prisma.refresh_tokens.deleteMany({
        where: {
          expires_at: { lt: new Date() }
        }
      });

      // Clean up old deal categorizations (ML training data)
      const deletedCategorizations = await prisma.deal_categorizations.deleteMany({
        where: {
          created_at: { lt: cutoffDate }
        }
      });

      res.json({
        success: true,
        message: 'Data cleanup completed',
        deleted: {
          activity_logs: deletedLogs.count,
          refresh_tokens: deletedTokens.count,
          categorizations: deletedCategorizations.count
        }
      });

    } catch (error) {
      console.error('Data cleanup error:', error);
      res.status(500).json({
        error: 'Failed to cleanup data',
        code: 'CLEANUP_FAILED'
      });
    }
});

export default router;