// HubSpot Webhook Signature Validation Middleware
import crypto from 'crypto';

/**
 * Middleware to validate HubSpot webhook signatures
 * Ensures webhooks are genuinely from HubSpot and haven't been tampered with
 */
export function validateHubSpotSignature(req, res, next) {
  try {
    // Get signature headers
    const signature = req.headers['x-hubspot-signature-v3'];
    const timestamp = req.headers['x-hubspot-request-timestamp'];
    
    // Check if required headers are present
    if (!signature || !timestamp) {
      console.error('Missing HubSpot webhook signature headers');
      return res.status(401).json({ 
        error: 'Missing authentication headers',
        details: 'Webhook signature validation failed'
      });
    }
    
    // Check timestamp is within 5 minutes to prevent replay attacks
    const currentTime = Date.now();
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 300000) { // 5 minutes in milliseconds
      console.error(`Webhook timestamp too old: ${timeDiff}ms difference`);
      return res.status(401).json({ 
        error: 'Request timestamp too old',
        details: 'Webhook must be processed within 5 minutes'
      });
    }
    
    // Get webhook secret from environment
    const webhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('HUBSPOT_WEBHOOK_SECRET not configured');
      // In development, allow webhooks without signature validation
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Webhook signature validation skipped in development');
        return next();
      }
      return res.status(500).json({ 
        error: 'Webhook validation not configured',
        details: 'Server configuration error'
      });
    }
    
    // Construct the source string for signature verification
    // Format: method + url + body + timestamp
    const sourceString = req.method + req.originalUrl + req.rawBody + timestamp;
    
    // Generate hash using webhook secret
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(sourceString)
      .digest('hex');
    
    // Expected signature format: "v3=<hash>"
    const expectedSignature = `v3=${hash}`;
    
    // Compare signatures
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
      
      return res.status(401).json({ 
        error: 'Invalid signature',
        details: 'Webhook signature validation failed'
      });
    }
    
    // Signature is valid, continue processing
    console.log('✅ HubSpot webhook signature validated successfully');
    
    // Add validated flag to request for logging
    req.webhookValidated = true;
    req.webhookTimestamp = timestamp;
    
    next();
    
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return res.status(500).json({ 
      error: 'Webhook validation error',
      details: error.message
    });
  }
}

/**
 * Middleware to capture raw body for signature validation
 * Must be applied before body parsing middleware
 */
export function captureRawBody(req, res, buf, encoding) {
  // Only capture for webhook endpoints
  if (req.originalUrl && req.originalUrl.includes('/webhook')) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

/**
 * Helper to verify webhook event hasn't been processed already
 * Prevents duplicate processing of webhook events
 */
export async function checkWebhookEventDuplicate(eventId, prisma) {
  // Check if we've processed this event ID before
  const existingEvent = await prisma.webhook_events.findUnique({
    where: { event_id: eventId }
  });
  
  if (existingEvent) {
    console.log(`Duplicate webhook event detected: ${eventId}`);
    return true;
  }
  
  // Record this event as processed
  await prisma.webhook_events.create({
    data: {
      event_id: eventId,
      processed_at: new Date(),
      // Auto-cleanup old events after 30 days
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });
  
  return false;
}

export default {
  validateHubSpotSignature,
  captureRawBody,
  checkWebhookEventDuplicate
};