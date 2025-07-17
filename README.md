# Sales Commission SaaS

A lightweight commission tracking solution for UK-based small to medium B2B companies, focusing purely on commission tracking and deal categorization rather than being a full CRM system.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/tomdeane1989/commit.git
cd sales-commission-saas
```

2. **Backend Setup**
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npx prisma db push
npx prisma generate

# Start backend server
node server-working.js
```

3. **Frontend Setup**
```bash
cd frontend
npm install

# Start development server
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3002

### Test Account
- **Email**: test@company.com
- **Password**: password123
- **Role**: admin

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15.4.1 with Pages Router, Tailwind CSS, TypeScript
- **Backend**: Node.js with Express 4.18.2, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT tokens with localStorage (development)
- **State Management**: TanStack React Query + React Context

### Key Features

#### ✅ **Authentication & Security**
- JWT-based authentication with localStorage for development
- Role-based access control (admin, manager, sales rep)
- Protected routes with proper error handling
- Comprehensive error boundaries

#### ✅ **Dashboard & Analytics**
- Live dashboard with real-time metrics
- Quota progress tracking with visual meters
- Commission calculations and projections
- Performance analytics and trends

#### ✅ **Deal Management**
- 5-column deal categorization interface:
  - **Pipeline**: CRM-synced deals (default state)
  - **Commit**: High confidence deals (drag-and-drop)
  - **Best Case**: Potential opportunities (drag-and-drop)
  - **Closed Won**: Completed deals (auto-populated)
  - **Progress Meter**: Visual quota tracking
- Smooth drag-and-drop functionality
- Real-time amount calculations

#### ✅ **Team Management**
- Team member management with role-based permissions
- Performance tracking and metrics
- Invitation system for new team members
- Modular component architecture:
  - TeamMemberCard: Individual member display
  - TeamStats: Performance overview
  - TeamFilters: Search and filtering
  - InviteModal: Member invitation workflow
  - TargetModal: Sales target management

#### ✅ **Target & Commission System**
- Flexible quota setting (monthly/quarterly/yearly)
- Commission rate configuration
- Progress tracking against targets
- Historical commission data

## 🎨 UI/UX Features

- **Modern Design**: Glassmorphism effects with gradient backgrounds
- **Responsive Layout**: Professional sidebar with active state indicators
- **Smooth Navigation**: Client-side routing without page refreshes
- **Interactive Elements**: Animated progress meters and hover effects
- **Error Handling**: Comprehensive error states and user feedback
- **Loading States**: Proper loading indicators throughout the app

## 🔧 Development

### Project Structure
```
sales-commission-saas/
├── backend/                 # Node.js Express API
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication & security
│   ├── prisma/            # Database schema & migrations
│   └── server-working.js   # Main server file
├── frontend/               # Next.js React application
│   ├── src/pages/         # Pages Router pages
│   ├── src/components/    # Reusable React components
│   ├── src/hooks/         # Custom React hooks
│   ├── src/lib/           # API client & utilities
│   └── src/types/         # TypeScript definitions
└── README.md              # This file
```

### Key Components

#### Backend APIs
- **Authentication**: `/api/auth/*` - Login, registration, token validation
- **Dashboard**: `/api/dashboard/*` - Metrics and analytics data
- **Deals**: `/api/deals/*` - Deal management and categorization
- **Teams**: `/api/team/*` - Team member management
- **Targets**: `/api/targets/*` - Quota and target management
- **Analytics**: `/api/analytics/*` - ML training data collection

#### Frontend Pages
- **Dashboard**: Live metrics and performance overview
- **Deals**: 5-column drag-and-drop categorization interface
- **Team**: Modular team management system
- **Settings**: Target and quota configuration
- **Login**: Authentication with modern UI

### Recent Improvements

#### Security & Architecture (Latest Session)
- ✅ **JWT Authentication**: Proper localStorage-based auth for development
- ✅ **Component Modularization**: Split 1,196-line team component into 5 modules
- ✅ **Performance Optimization**: Fixed N+1 database queries
- ✅ **Navigation Enhancement**: Eliminated page refresh flashing
- ✅ **Error Handling**: Added React error boundaries
- ✅ **Database Integration**: Connected to real seed data

#### Performance Optimizations
- **Database Queries**: Optimized with Prisma groupBy and batch operations
- **Component Architecture**: Modular design for better maintainability
- **State Management**: Efficient React Query caching
- **Navigation**: Smooth client-side routing with Next.js

## 🧪 Testing

### Manual Testing
The application includes comprehensive seed data for testing:
- 6 realistic team members with performance data
- 13 test deals with proper categorization
- Active quarterly target of £250,000
- Historical commission data

### Test Scenarios
- ✅ User authentication and session management
- ✅ Dashboard data loading and display
- ✅ Deal drag-and-drop categorization
- ✅ Team management operations
- ✅ Target creation and editing
- ✅ Navigation between all pages
- ✅ Error handling and recovery

## 🚀 Deployment

### Environment Variables

**Backend (.env)**
```
DATABASE_URL="postgresql://username:password@localhost:5432/sales_commission_db"
JWT_SECRET="your-secret-key"
PORT=3002
```

**Frontend**
```
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### Production Considerations
- Implement proper production authentication (httpOnly cookies, CSRF protection)
- Set up SSL/TLS certificates
- Configure environment-specific database connections
- Implement proper logging and monitoring
- Set up automated testing and CI/CD pipelines

## 🗺️ Roadmap

### Phase 2: Advanced Features (Next)
- CRM integration (Salesforce, HubSpot, Pipedrive)
- Commission approval workflows
- Advanced reporting and analytics
- Bulk deal operations

### Phase 3: AI & Automation
- Deal probability predictions
- Commission optimization recommendations
- Performance pattern analysis
- Automated insights and alerts

### Phase 4: Enterprise Features
- Multi-tenant company management
- Advanced user roles and permissions
- API rate limiting and monitoring
- Audit trails and compliance features

## 🤝 Contributing

This project uses modern development practices:
- TypeScript for type safety
- ESLint and Prettier for code formatting
- Component-based architecture
- RESTful API design
- Comprehensive error handling

## 📄 License

This project is proprietary software. All rights reserved.

---

**Last Updated**: July 17, 2025
**Status**: Phase 1 Complete + Major Refactor
**Next Priority**: CRM Integration