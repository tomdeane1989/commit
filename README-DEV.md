# 🚀 Development Setup

## Quick Start

```bash
# Start new feature
./dev-tools.sh new-feature your-feature-name

# Start development servers
./dev-tools.sh start-dev

# Deploy to production when ready
./dev-tools.sh deploy-prod
```

## Environment Setup

### Local Development
- Frontend: `http://localhost:3000` 
- Backend: `http://localhost:3002`
- Uses `.env.development` for API URLs

### Production
- Frontend: `https://commit-snowy.vercel.app`
- Backend: `https://commit-5moi.onrender.com` 
- Uses `.env.production` for API URLs

## Branch Workflow

1. **`develop`** - Local testing and integration
2. **`feature/*`** - Individual features  
3. **`main`** - Production (triggers deployments)

## Common Commands

```bash
# Create feature branch
./dev-tools.sh new-feature fix-timeout

# Check status
./dev-tools.sh status

# Clean up old branches  
./dev-tools.sh clean
```

See `dev-workflow.md` for detailed instructions.