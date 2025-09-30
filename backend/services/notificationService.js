// Notification Service
// Centralized service for creating and managing notifications
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class NotificationService {
  /**
   * Create a notification
   */
  async createNotification({
    user_id,
    company_id,
    type,
    title,
    message,
    priority = 'normal',
    action_url = null,
    metadata = null,
    expires_at = null
  }) {
    try {
      const notification = await prisma.notifications.create({
        data: {
          user_id,
          company_id,
          type,
          title,
          message,
          priority,
          action_url,
          metadata,
          expires_at
        }
      });

      console.log(`✅ Notification created: ${type} for user ${user_id}`);
      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(users, notificationData) {
    try {
      const notifications = await prisma.notifications.createMany({
        data: users.map(user_id => ({
          user_id,
          ...notificationData
        }))
      });

      console.log(`✅ Created ${notifications.count} bulk notifications`);
      return notifications;
    } catch (error) {
      console.error('Failed to create bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Notify about integration sync completion
   */
  async notifyIntegrationSync({
    integration,
    syncResult,
    targetUsers,
    company_id
  }) {
    const { deals_synced, deals_created, deals_updated, errors, sync_type } = syncResult;
    const integrationName = integration.crm_type.charAt(0).toUpperCase() + integration.crm_type.slice(1);

    const title = `${integrationName} sync ${errors > 0 ? 'completed with errors' : 'completed'}`;
    const message = `Synced ${deals_synced} deals (${deals_created} new, ${deals_updated} updated)${errors > 0 ? `, ${errors} errors` : ''}`;

    return await this.createBulkNotifications(
      targetUsers,
      {
        company_id,
        type: errors > 0 ? 'integration_sync_failed' : 'integration_sync_success',
        title,
        message,
        priority: errors > 0 ? 'high' : sync_type === 'scheduled' ? 'low' : 'normal',
        action_url: '/integrations',
        metadata: {
          integration_id: integration.id,
          integration_type: integration.crm_type,
          sync_result: syncResult
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    );
  }

  /**
   * Notify managers when a deal is moved
   */
  async notifyDealMoved({
    deal,
    fromCategory,
    toCategory,
    categorizedBy,
    targetManagers,
    company_id
  }) {
    const title = `Deal moved by ${categorizedBy.first_name} ${categorizedBy.last_name}`;
    const message = `${deal.deal_name} (£${parseFloat(deal.amount).toLocaleString()}) moved from ${fromCategory || 'Pipeline'} → ${toCategory}`;

    return await this.createBulkNotifications(
      targetManagers,
      {
        company_id,
        type: 'deal_moved',
        title,
        message,
        priority: 'normal',
        action_url: `/deals?highlight=${deal.id}`,
        metadata: {
          deal_id: deal.id,
          deal_name: deal.deal_name,
          amount: deal.amount,
          from_category: fromCategory,
          to_category: toCategory,
          categorized_by: categorizedBy.id
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    );
  }

  /**
   * Notify managers when a commission needs approval
   */
  async notifyCommissionPendingApproval({
    commission,
    deal,
    targetManagers,
    company_id
  }) {
    const title = 'Commission pending approval';
    const message = `${deal.user.first_name} ${deal.user.last_name} - £${parseFloat(commission.commission_amount).toLocaleString()} commission on ${deal.deal_name}`;

    return await this.createBulkNotifications(
      targetManagers,
      {
        company_id,
        type: 'commission_pending',
        title,
        message,
        priority: 'high',
        action_url: '/commissions?filter=pending',
        metadata: {
          commission_id: commission.id,
          deal_id: deal.id,
          deal_name: deal.deal_name,
          amount: commission.commission_amount,
          user_id: deal.user_id
        },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    );
  }

  /**
   * Notify sales rep when their commission is approved
   */
  async notifyCommissionApproved({
    commission,
    deal,
    targetUser,
    company_id
  }) {
    const title = 'Commission approved! 🎉';
    const message = `Your £${parseFloat(commission.commission_amount).toLocaleString()} commission on ${deal.deal_name} has been approved`;

    return await this.createNotification({
      user_id: targetUser,
      company_id,
      type: 'commission_approved',
      title,
      message,
      priority: 'high',
      action_url: '/commissions',
      metadata: {
        commission_id: commission.id,
        deal_id: deal.id,
        deal_name: deal.deal_name,
        amount: commission.commission_amount
      },
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  /**
   * Notify sales rep when their commission is rejected
   */
  async notifyCommissionRejected({
    commission,
    deal,
    reason,
    targetUser,
    company_id
  }) {
    const title = 'Commission requires attention';
    const message = `Your commission on ${deal.deal_name} needs review: ${reason}`;

    return await this.createNotification({
      user_id: targetUser,
      company_id,
      type: 'commission_rejected',
      title,
      message,
      priority: 'urgent',
      action_url: '/commissions',
      metadata: {
        commission_id: commission.id,
        deal_id: deal.id,
        deal_name: deal.deal_name,
        amount: commission.commission_amount,
        reason
      },
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId) {
    return await prisma.notifications.count({
      where: {
        user_id: userId,
        read: false
      }
    });
  }

  /**
   * Get notifications for a user (paginated)
   */
  async getNotifications(userId, { limit = 20, offset = 0, read = null }) {
    const where = {
      user_id: userId
    };

    if (read !== null) {
      where.read = read;
    }

    const notifications = await prisma.notifications.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      skip: offset
    });

    const total = await prisma.notifications.count({ where });

    return {
      notifications,
      total,
      limit,
      offset
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    return await prisma.notifications.updateMany({
      where: {
        id: notificationId,
        user_id: userId
      },
      data: {
        read: true,
        read_at: new Date()
      }
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllRead(userId) {
    return await prisma.notifications.updateMany({
      where: {
        user_id: userId,
        read: false
      },
      data: {
        read: true,
        read_at: new Date()
      }
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    return await prisma.notifications.deleteMany({
      where: {
        id: notificationId,
        user_id: userId
      }
    });
  }

  /**
   * Delete all read notifications for a user
   */
  async clearReadNotifications(userId) {
    return await prisma.notifications.deleteMany({
      where: {
        user_id: userId,
        read: true
      }
    });
  }

  /**
   * Clean up expired notifications (to be run as a cron job)
   */
  async cleanupExpired() {
    const deleted = await prisma.notifications.deleteMany({
      where: {
        expires_at: {
          lte: new Date()
        }
      }
    });

    console.log(`🧹 Cleaned up ${deleted.count} expired notifications`);
    return deleted;
  }
}

export default new NotificationService();
