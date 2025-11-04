# Railway Environment Variables Guide

## Required Environment Variables

### Core Application
```env
# Discord Bot Configuration (REQUIRED)
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Database Configuration
DATABASE_URL=file:/data/guhdeats.db

# Environment
NODE_ENV=production
```

### Optional Configuration
```env
# Server Configuration
PORT=3000

# Performance & Logging
LOG_LEVEL=info
ENABLE_METRICS=true
HEALTH_CHECK_INTERVAL=30000

# Bot Features
PREFIX=!
DEFAULT_CURRENCY_NAME=credits
MAX_BET_AMOUNT=10000
MIN_BET_AMOUNT=1

# Roulette Configuration
ROULETTE_SPIN_DURATION=5000
ROULETTE_ANIMATION_FPS=60
ROULETTE_CACHE_SIZE=50

# Canvas/Sharp Configuration
CANVAS_WIDTH=800
CANVAS_HEIGHT=600
SHARP_CACHE_SIZE=256

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Railway-Specific Variables

```env
# Railway Auto-generated (don't set manually)
RAILWAY_ENVIRONMENT=production
RAILWAY_PUBLIC_DOMAIN=your-app.railway.app
```

## Environment Setup Instructions

### 1. Required Variables Setup
1. Go to your Railway project dashboard
2. Navigate to Variables tab
3. Add the required variables:

**DISCORD_BOT_TOKEN**
- Create a new Discord application at https://discord.com/developers/applications
- Go to Bot section and create a bot
- Copy the bot token and paste it as `DISCORD_BOT_TOKEN`

**DATABASE_URL** (Auto-configured)
- Railway will automatically set this for SQLite deployments
- Value: `file:/data/guhdeats.db`

### 2. Optional Variables Setup
Add any optional variables based on your needs:

**Performance Tuning**
```env
LOG_LEVEL=info
ENABLE_METRICS=true
HEALTH_CHECK_INTERVAL=30000
```

**Roulette Game Settings**
```env
ROULETTE_SPIN_DURATION=3000
ROULETTE_ANIMATION_FPS=60
MAX_BET_AMOUNT=50000
```

### 3. Validation
After setting variables, verify using Railway CLI:
```bash
railway variables
```

Or check the health endpoint:
```
https://your-app.railway.app/health
```

## Troubleshooting

### Common Issues

**❌ "DISCORD_BOT_TOKEN not found"**
- Ensure DISCORD_BOT_TOKEN is set in Railway variables
- Verify the token is valid and hasn't been reset

**❌ "Database migration failed"**
- Check DATABASE_URL is properly set
- Ensure write permissions to /data directory

**❌ "Canvas/SSharp dependencies failed"**
- This should be handled automatically by the Dockerfile
- Check build logs for native dependency errors

**❌ "Health check failed"**
- Check the health endpoint: `/health`
- Verify PORT is properly set (defaults to 3000)

### Monitoring Variables

Monitor these variables in Railway dashboard:
- `HEALTH_CHECK_INTERVAL` - Health check frequency
- `LOG_LEVEL` - Log verbosity (debug, info, warn, error)
- `ENABLE_METRICS` - Enable detailed metrics collection

## Security Best Practices

1. **Never commit tokens** to version control
2. **Use Railway's variable encryption** for sensitive data
3. **Rotate tokens regularly** (Discord, etc.)
4. **Monitor usage** through Railway's built-in monitoring
5. **Set appropriate rate limits** to prevent abuse

## Production Deployment Checklist

- [ ] DISCORD_BOT_TOKEN set and verified
- [ ] Database URL configured
- [ ] Health check endpoint responding
- [ ] All required dependencies installed
- [ ] Logs visible in Railway dashboard
- [ ] Metrics collection enabled
- [ ] Rate limiting configured
- [ ] Error tracking active

## Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| DISCORD_BOT_TOKEN | string | - | Discord bot authentication token |
| DATABASE_URL | string | file:/data/guhdeats.db | Database connection string |
| NODE_ENV | string | production | Application environment |
| PORT | number | 3000 | Server port for health checks |
| LOG_LEVEL | string | info | Logging verbosity level |
| ENABLE_METRICS | boolean | true | Enable performance metrics |
| HEALTH_CHECK_INTERVAL | number | 30000 | Health check frequency (ms) |
| PREFIX | string | ! | Discord command prefix |
| MAX_BET_AMOUNT | number | 10000 | Maximum bet per game |
| MIN_BET_AMOUNT | number | 1 | Minimum bet per game |