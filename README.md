# Sales Commission SaaS

A lightweight SaaS solution for UK-based small to medium B2B companies to manage sales targets and commission payouts. Integrates with popular CRMs and provides AI-ready data architecture.

## Features

### For Sales Reps
- Clear pipeline visualization with quota progress tracking
- Deal categorization (commit/best_case/pipeline buckets)
- Real-time commission calculations and projections
- Simple dashboard matching quota vs. actual performance

### For Sales Management
- Team performance dashboards
- Weekly/monthly/quarterly forecast tracking
- Commission approval workflows
- AI-powered sales outcome predictions

### AI-Ready Architecture
- Comprehensive behavioral data logging
- Historical forecast accuracy tracking
- Deal categorization learning patterns
- Performance optimization insights

## Tech Stack

**Backend:**
- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT Authentication
- Comprehensive API with rate limiting

**Frontend:**
- Next.js 15 + React 19
- TypeScript
- Tailwind CSS
- TanStack React Query
- Recharts for data visualization

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Git

### 1. Clone and Install
```bash
git clone <repository-url>
cd sales-commission-saas

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb sales_commission_db

# Copy environment file
cd backend
cp .env.example .env

# Update .env with your database URL:
# DATABASE_URL="postgresql://username:password@localhost:5432/sales_commission_db"
```

### 3. Run Database Migrations
```bash
cd backend
npm run migrate
```

### 4. Start Development Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

### 5. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sales_commission_db"

# Server
PORT=3001
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CRM Integrations (optional)
SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
PIPEDRIVE_CLIENT_ID=your-pipedrive-client-id
PIPEDRIVE_CLIENT_SECRET=your-pipedrive-client-secret

# AI Services (future use)
OPENAI_API_KEY=your-openai-api-key
AI_ENABLED=false
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/sales-rep/:userId?` - Get dashboard data
- `PATCH /api/dashboard/deals/:dealId/category` - Update deal category

### Deals
- `GET /api/deals` - Get deals with filtering
- `POST /api/deals` - Create new deal
- `PUT /api/deals/:id` - Update deal
- `DELETE /api/deals/:id` - Delete deal

### Targets
- `GET /api/targets` - Get sales targets
- `POST /api/targets` - Create target
- `PUT /api/targets/:id` - Update target
- `PATCH /api/targets/:id/deactivate` - Deactivate target

### Commissions
- `GET /api/commissions` - Get commissions
- `POST /api/commissions/calculate` - Calculate commissions
- `PATCH /api/commissions/:id/approve` - Approve commission

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `GET /api/users/team` - Get team members
- `GET /api/users/activity` - Get activity log

## Database Schema

The database is designed for AI consumption with comprehensive metadata:

### Core Tables
- `companies` - Multi-tenant company data
- `users` - User profiles with performance metadata
- `deals` - CRM deal data with AI predictions
- `deal_categorizations` - Rep categorization decisions
- `targets` - Sales quotas and commission rates
- `commissions` - Calculated commission payments
- `forecasts` - Historical forecast snapshots
- `activity_log` - Comprehensive audit trail

### AI-Ready Features
- Historical performance patterns
- Deal categorization learning
- Forecast accuracy tracking
- Behavioral metadata capture

## Development Workflow

### 1. First Time Setup
```bash
# Register first user (becomes admin)
curl -X POST http://localhost:3001/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@company.com",
    "password": "password123",
    "first_name": "Admin",
    "last_name": "User",
    "company_name": "Your Company"
  }'
```

### 2. Create Sales Target
```bash
# Set quarterly target
curl -X POST http://localhost:3001/api/targets \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "period_type": "quarterly",
    "period_start": "2024-01-01",
    "period_end": "2024-03-31",
    "quota_amount": 100000,
    "commission_rate": 0.05
  }'
```

### 3. Add Test Deals
```bash
# Create sample deal
curl -X POST http://localhost:3001/api/deals \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "deal_name": "Enterprise Software License",
    "account_name": "Acme Corp",
    "amount": 25000,
    "probability": 75,
    "close_date": "2024-02-15"
  }'
```

## Production Deployment

### Database Migration
```bash
npm run migrate
```

### Environment Setup
- Set `NODE_ENV=production`
- Use secure JWT secrets
- Configure proper CORS origins
- Set up SSL/TLS certificates

### Security Checklist
- [ ] Change default JWT secret
- [ ] Set up HTTPS
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Enable audit logging
- [ ] Configure CORS properly

## Future Enhancements

### AI Features (Planned)
- Deal probability predictions
- Commission optimization
- Forecast accuracy improvements
- Performance pattern analysis
- Automated insights generation

### CRM Integrations
- Salesforce OAuth integration
- HubSpot deal sync
- Pipedrive webhook support
- Google Sheets import

### Advanced Features
- Multi-currency support
- Territory management
- Complex commission structures
- Payment processing integration
- Mobile app

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - see LICENSE file for details.