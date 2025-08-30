# HubSpot Integration Setup Guide

## Prerequisites
You need a HubSpot developer account and a HubSpot app to use this integration.

## Step 1: Create a HubSpot App

1. Go to [HubSpot Developer Account](https://app.hubspot.com/developers/)
2. Sign in or create a developer account
3. Click "Create an app" 
4. Fill in the app details:
   - **App name**: Sales Commission SaaS Integration
   - **Description**: Integration for syncing deals with Sales Commission SaaS

## Step 2: Configure OAuth Settings

In your HubSpot app settings:

1. Navigate to the **Auth** tab
2. Add the following redirect URLs:
   - **Local Development**: `http://localhost:3002/api/integrations/hubspot/callback`
   - **Production**: `https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/callback`

3. Select the required scopes:
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.owners.read`
   - `crm.schemas.deals.read`
   - `oauth`

## Step 3: Get Your App Credentials

1. In the **Auth** tab, you'll find:
   - **Client ID**: A string like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Client Secret**: Click "Show" to reveal it

## Step 4: Update Environment Variables

### Local Development (.env)
```bash
HUBSPOT_CLIENT_ID=your-actual-client-id-here
HUBSPOT_CLIENT_SECRET=your-actual-client-secret-here
HUBSPOT_REDIRECT_URI=http://localhost:3002/api/integrations/hubspot/callback
```

### Production (Render Environment Variables)
Add these to your Render backend service:
```bash
HUBSPOT_CLIENT_ID=your-actual-client-id-here
HUBSPOT_CLIENT_SECRET=your-actual-client-secret-here
HUBSPOT_REDIRECT_URI=https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/callback
```

## Step 5: Test the Integration

1. Restart your backend server after updating the .env file
2. Go to the Integrations page in your app
3. Click "Connect to HubSpot" 
4. You'll be redirected to HubSpot to authorize the connection
5. After authorization, you'll be redirected back to your app
6. The HubSpot card should show as "Connected"
7. Click "Sync Now" to import deals from HubSpot

## Troubleshooting

### "Invalid client_id" Error
- Ensure you've created a HubSpot app and copied the correct Client ID
- Check that the Client ID in your .env file doesn't have any extra spaces or quotes

### "Invalid redirect_uri" Error  
- Make sure the redirect URI in your .env file EXACTLY matches one configured in HubSpot
- Check for trailing slashes - they must match exactly

### Connection Not Working
- Verify all required scopes are selected in your HubSpot app
- Ensure your backend server was restarted after updating .env
- Check backend logs for any error messages

## Webhook Configuration (Optional)

For real-time updates, configure webhooks in your HubSpot app:

1. Go to **Webhooks** tab in your HubSpot app
2. Add webhook URL: 
   - Local: `http://localhost:3002/api/integrations/hubspot/webhook`
   - Production: `https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/webhook`
3. Subscribe to these events:
   - `deal.creation`
   - `deal.propertyChange`
   - `deal.deletion`

## Security Notes

- Never commit your actual Client ID and Client Secret to version control
- Use environment variables for all sensitive credentials
- In production, ensure HTTPS is used for all OAuth redirects
- Regularly rotate your Client Secret for security

## Additional Resources

- [HubSpot OAuth Documentation](https://developers.hubspot.com/docs/api/oauth)
- [HubSpot CRM API Documentation](https://developers.hubspot.com/docs/api/crm/deals)
- [HubSpot Webhooks Documentation](https://developers.hubspot.com/docs/api/webhooks)