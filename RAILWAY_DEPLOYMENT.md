# Railway Deployment Guide for Roulette System

## Overview

This guide provides step-by-step instructions for deploying the Roulette System to Railway with Node.js 20 optimizations, enhanced monitoring, and health checks.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI**: Install using `npm install -g @railway/cli`
3. **Docker**: Docker must be installed for local testing
4. **Node.js**: Version 18+ installed locally for development

## Quick Deployment

### Option 1: Using the Automated Script

```bash
# Make script executable (if needed)
chmod +x scripts/deploy-railway.sh

# Run deployment
npm run deploy:railway
```

### Option 2: Manual Deployment

```bash
# 1. Login to Railway
railway login

# 2. Link to project (creates new project if none exists)
railway link

# 3. Set environment variables
railway variables set DISCORD_BOT_TOKEN=your_token_here

# 4. Deploy
railway up

# 5. Monitor deployment
railway logs
```

## Environment Variables Setup

### Required Variables

```bash
railway variables set DISCORD_BOT_TOKEN=your_discord_bot_token
```

### Optional Variables (for optimization)

```bash
# Performance settings
railway variables set LOG_LEVEL=info
railway variables set ENABLE_METRICS=true
railway variables set HEALTH_CHECK_INTERVAL=30000

# Game settings
railway variables set MAX_BET_AMOUNT=10000
railway variables set ROULETTE_SPIN_DURATION=5000
```

### Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DISCORD_BOT_TOKEN` | string | - | **REQUIRED** Discord bot token |
| `DATABASE_URL` | string | auto | SQLite database path |
| `NODE_ENV` | string | production | Application environment |
| `PORT` | number | 3000 | Health check server port |
| `LOG_LEVEL` | string | info | Logging verbosity |
| `ENABLE_METRICS` | boolean | true | Enable performance metrics |
| `HEALTH_CHECK_INTERVAL` | number | 30000 | Health check frequency (ms) |

## Pre-Deployment Checklist

### 1. System Requirements Validation

```bash
# Run system requirements check
npm run system:validate

# Expected output: All checks should pass ✅
```

### 2. Local Build Test

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Test critical dependencies
node -e "require('canvas'); require('sharp'); console.log('✅ Dependencies OK')"
```

### 3. Docker Build Test

```bash
# Build Docker image
docker build -t roulette-system:test .

# Run container test
docker run --rm -d --name roulette-test roulette-system:test

# Check logs
docker logs roulette-test

# Stop test container
docker stop roulette-test
```

## Configuration Files

### 1. Dockerfile Optimizations

The `Dockerfile` includes:

- **Multi-stage build** for smaller runtime image
- **Native dependencies** for Canvas and Sharp
- **Railway-specific optimizations**:
  - Non-root user for security
  - Health check script integration
  - Optimized layer caching
  - Runtime libraries for stability

### 2. Railway Configuration (`railway.json`)

Key settings:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "healthcheckPath": "/health",
    "startupTimeout": 600
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 3. Health Check Endpoints

- `GET /health` - Comprehensive health check
- `GET /ready` - Readiness probe
- `GET /metrics` - Performance metrics

## Post-Deployment Verification

### 1. Health Check

```bash
# Replace with your Railway domain
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": true,
    "prisma": true,
    "canvas": true,
    "sharp": true,
    "discord": true,
    "dependencies": true
  }
}
```

### 2. Application Status

```bash
# Check deployment status
railway status

# View recent logs
railway logs

# Open Railway dashboard
railway open
```

### 3. Performance Monitoring

```bash
# View metrics
curl https://your-app.railway.app/metrics

# Monitor resource usage in Railway dashboard
```

## Troubleshooting

### Common Issues

#### 1. "DISCORD_BOT_TOKEN not found"

**Solution:**
```bash
# Verify token is set
railway variables

# Re-set if missing
railway variables set DISCORD_BOT_TOKEN=your_token
```

#### 2. "Canvas/Ssharp dependencies failed"

**Solution:**
- Check build logs in Railway dashboard
- Ensure Dockerfile includes native dependencies
- Try redeploy: `railway up`

#### 3. "Database migration failed"

**Solution:**
```bash
# Check database URL
railway variables get DATABASE_URL

# Manual migration (if needed)
railway run npx prisma migrate deploy
```

#### 4. "Health check timeout"

**Solution:**
- Check application logs: `railway logs`
- Verify PORT environment variable
- Ensure health check endpoint responds

### Debug Commands

```bash
# Enter Railway container for debugging
railway shell

# Check running processes
railway run ps aux

# Check environment variables
railway run env

# Test health endpoint locally
railway run node /health-check.js
```

## Performance Optimization

### 1. Memory Optimization

```bash
# Set memory limits (if needed)
railway variables set NODE_OPTIONS="--max-old-space-size=512"
```

### 2. Database Optimization

```bash
# SQLite optimization
railway variables set PRAGMA_journal_mode=WAL
railway variables set PRAGMA_synchronous=NORMAL
```

### 3. Canvas Rendering Optimization

```bash
# Disable anti-aliasing for better performance
railway variables set CANVAS_DISABLE_ANTI_ALIAS=true

# Reduce canvas cache size
railway variables set CANVAS_CACHE_SIZE=256
```

## Monitoring & Alerts

### 1. Railway Built-in Monitoring

- **Health Checks**: Automatic via `/health` endpoint
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Alerts**: Email notifications for failures

### 2. Custom Metrics

Access metrics via:
```bash
curl https://your-app.railway.app/metrics
```

Metrics include:
- Memory usage
- Request count
- Error rate
- Operation performance

### 3. Log Levels

Configure logging verbosity:
```bash
railway variables set LOG_LEVEL=debug  # Most verbose
railway variables set LOG_LEVEL=info   # Default
railway variables set LOG_LEVEL=warn   # Less verbose
railway variables set LOG_LEVEL=error  # Only errors
```

## Scaling Considerations

### Current Limits

- **Free Tier**: 1 GB RAM, 1 CPU core
- **Hobby Tier**: 1 GB RAM, 1 CPU core  
- **Pro Tier**: 8 GB RAM, 8 CPU cores

### Horizontal Scaling

Railway automatically handles:
- Load balancing
- Health checks
- Automatic restarts
- Zero-downtime deployments

### Vertical Scaling

For increased resources:
1. Upgrade plan in Railway dashboard
2. Monitor resource usage
3. Adjust memory limits if needed

## Security Best Practices

### 1. Environment Variables

- Never commit tokens to git
- Use Railway's encrypted variables
- Rotate tokens regularly

### 2. Container Security

- Non-root user in Dockerfile
- Minimal base image (bookworm-slim)
- No unnecessary packages

### 3. Application Security

- Rate limiting configured
- Input validation on all commands
- Secure Discord bot permissions

## Maintenance

### Regular Tasks

1. **Update Dependencies** (Monthly)
   ```bash
   npm update
   npm audit fix
   ```

2. **Monitor Logs** (Weekly)
   ```bash
   railway logs --tail
   ```

3. **Check Performance** (Weekly)
   ```bash
   curl https://your-app.railway.app/metrics
   ```

4. **Update Discord Bot** (As needed)
   - Check Discord API changes
   - Update bot permissions
   - Test new features

### Backup Strategy

```bash
# Backup database (SQLite)
railway run cp /data/guhdeats.db /tmp/backup-$(date +%Y%m%d).db

# Or use Railway's automatic backups
```

## Support & Resources

### Useful Links

- [Railway Documentation](https://docs.railway.app)
- [Discord.js Guide](https://discordjs.guide)
- [Prisma Documentation](https://www.prisma.io/docs)

### Getting Help

1. **Railway Support**: support@railway.app
2. **Discord.js Discord**: [discord.gg/discord-js](https://discord.gg/discord-js)
3. **Project Issues**: Check GitHub issues

### Performance Tips

- Monitor memory usage in Railway dashboard
- Use health checks to detect issues early
- Keep logs at `info` level in production
- Enable metrics for performance monitoring
- Regular dependency updates for security

## Deployment Commands Reference

```bash
# Quick deploy
npm run deploy:railway

# Manual deploy
railway up

# Check status
railway status

# View logs
railway logs

# Open dashboard
railway open

# Set variable
railway variables set KEY=value

# Get variable
railway variables get KEY

# List all variables
railway variables

# Run command in Railway environment
railway run npm test

# Connect to Railway container
railway shell
```