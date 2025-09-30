// Notifications API Routes
import express from 'express';
import notificationService from '../services/notificationService.js';

const router = express.Router();

// Auth middleware is applied at app level in server-working.js

/**
 * GET /api/notifications
 * Get user's notifications (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, read } = req.query;

    const readFilter = read === 'true' ? true : read === 'false' ? false : null;

    const result = await notificationService.getNotifications(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      read: readFilter
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/mark-all-read', async (req, res) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);

    res.json({
      success: true,
      message: `Marked ${result.count} notifications as read`
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

/**
 * DELETE /api/notifications/clear-read
 * Clear all read notifications
 */
router.delete('/clear-read', async (req, res) => {
  try {
    const result = await notificationService.clearReadNotifications(req.user.id);

    res.json({
      success: true,
      message: `Cleared ${result.count} read notifications`
    });
  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear read notifications'
    });
  }
});

export default router;
