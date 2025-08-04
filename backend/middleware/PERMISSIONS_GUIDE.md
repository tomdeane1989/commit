# Permission Middleware Usage Guide

## Overview
The centralized permission middleware provides consistent permission checking across all routes using boolean flags (`is_admin`, `is_manager`) instead of string roles.

## Available Middleware Functions

### 1. `requireAdmin`
Only allows administrators (is_admin = true)
```javascript
router.post('/admin-only-route', requireAdmin, (req, res) => {
  // Only admins can access this
});
```

### 2. `requireManager`
Allows managers and administrators (is_manager = true OR is_admin = true)
```javascript
router.get('/team', requireManager, (req, res) => {
  // Managers and admins can view team data
});
```

### 3. `requireOwnerOrManager(userIdField)`
Allows resource owner OR managers/admins
```javascript
// Default checks req.params.user_id, req.body.user_id, or req.query.user_id
router.get('/deals/:id', requireOwnerOrManager(), (req, res) => {
  // User can access their own deals, managers can access all
});

// Custom field name
router.get('/targets/:id', requireOwnerOrManager('target_user_id'), (req, res) => {
  // Checks for target_user_id field
});
```

### 4. `requireTeamManagement`
Only allows team member management (inviting, editing, removing) - admin only
```javascript
router.post('/team/invite', requireTeamManagement, (req, res) => {
  // Only admins can invite new team members
});
```

### 5. `requireTeamView`
Allows viewing team data - managers and admins
```javascript
router.get('/team/performance', requireTeamView, (req, res) => {
  // Managers and admins can view team performance
});
```

### 6. `requireTargetManagement`
Allows creating/editing targets - managers and admins
```javascript
router.post('/targets', requireTargetManagement, (req, res) => {
  // Managers and admins can create targets
});
```

### 7. `requireCommissionApproval`
Only allows commission approval - admin only
```javascript
router.post('/commissions/:id/approve', requireCommissionApproval, (req, res) => {
  // Only admins can approve commission payments
});
```

### 8. `requireIntegrationManagement`
Only allows CRM integration management - admin only
```javascript
router.post('/integrations', requireIntegrationManagement, (req, res) => {
  // Only admins can setup integrations
});
```

### 9. `requirePermissionLevel(allowedLevels)`
Dynamic permission checking for multiple levels
```javascript
// Allow both managers and sales users (but not just admins)
router.get('/deals', requirePermissionLevel(['manager', 'sales_user']), (req, res) => {
  // Accessible by managers and sales users
});
```

### 10. `attachPermissions`
Adds permission info to request object (non-blocking)
```javascript
router.use(attachPermissions);
router.get('/dashboard', (req, res) => {
  // req.permissions available with all permission info
  if (req.permissions.canManageTeam) {
    // Show team data
  }
});
```

## Permission Levels

| Level | Description | Flags |
|-------|-------------|-------|
| `admin` | Full system access | is_admin = true |
| `manager` | Team management access | is_manager = true |
| `sales_user` | Basic user access | is_admin = false, is_manager = false |

## Error Response Format

All permission middleware returns consistent error responses:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "userLevel": "sales_user|manager|admin",
  "required": ["admin", "manager"] // For requirePermissionLevel
}
```

Error codes:
- `AUTH_REQUIRED` - User not authenticated
- `ADMIN_REQUIRED` - Admin access required
- `MANAGER_REQUIRED` - Manager access required
- `ACCESS_DENIED` - General access denied
- `TEAM_MANAGEMENT_REQUIRED` - Team management access required
- `TEAM_VIEW_REQUIRED` - Team view access required
- `TARGET_MANAGEMENT_REQUIRED` - Target management access required
- `COMMISSION_APPROVAL_REQUIRED` - Commission approval access required
- `INTEGRATION_MANAGEMENT_REQUIRED` - Integration management required
- `INSUFFICIENT_PERMISSIONS` - User doesn't have required permission level

## Migration Example

### Before (string role checking):
```javascript
router.post('/targets', authMiddleware, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  // ... route logic
});
```

### After (centralized middleware):
```javascript
import { requireTargetManagement } from '../middleware/permissions.js';

router.post('/targets', authMiddleware, requireTargetManagement, async (req, res) => {
  // Permission already checked by middleware
  // ... route logic
});
```

## Best Practices

1. **Use specific middleware** - Choose the most specific middleware for your use case
2. **Layer middleware** - Can combine multiple middleware: `router.use(authMiddleware, attachPermissions)`
3. **Consistent errors** - All middleware returns consistent error format
4. **No string roles** - Never check `req.user.role` directly
5. **Use helpers** - Import functions from roleHelpers.js for custom logic

## Common Patterns

### Protected admin panel:
```javascript
// All admin routes
router.use('/admin/*', requireAdmin);
```

### Team data with owner access:
```javascript
// Team members can see team data, individuals can see their own
router.get('/performance/:user_id', 
  requireOwnerOrManager('user_id'), 
  async (req, res) => {
    // Logic here
  }
);
```

### Conditional logic in routes:
```javascript
router.get('/dashboard', authMiddleware, attachPermissions, async (req, res) => {
  const data = {
    personal: await getPersonalData(req.user.id)
  };
  
  if (req.permissions.canManageTeam) {
    data.team = await getTeamData(req.user.company_id);
  }
  
  res.json(data);
});
```