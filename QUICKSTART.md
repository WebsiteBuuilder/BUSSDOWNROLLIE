# 🚀 Quick Start Guide

Get GUHD EATS bot running in 5 minutes!

## 📦 Prerequisites

- [Node.js 18+](https://nodejs.org/)
- Discord Bot Token
- A Discord server with admin access

## ⚡ Fast Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**Required values:**
- `DISCORD_TOKEN` - Your bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- `GUILD_ID` - Your server ID (right-click server → Copy Server ID)
- `PROVIDER_ROLE_ID` - Role ID for providers who validate vouches
- `ADMIN_ROLE_ID` - Role ID for administrators
- `VOUCH_CHANNEL_ID` - Channel where users post food vouches
- `CASINO_CHANNEL_ID` - Channel for blackjack games
- `LOG_CHANNEL_ID` - Channel for audit logs

### 3. Setup Database

```bash
npx prisma migrate dev --name init
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Seed Sample Data (Optional)

```bash
npm run seed
```

### 6. Start the Bot

```bash
npm run dev
```

## 🎯 First Steps After Starting

1. **Invite Bot to Server**
   - Go to Discord Developer Portal → OAuth2 → URL Generator
   - Select `bot` and `applications.commands`
   - Check required permissions (see README)
   - Use generated URL to invite bot

2. **Test Commands**
   ```
   /balance - Check your VP
   /daily - Try daily claim
   /leaderboard - View leaderboard
   ```

3. **Test Vouch System**
   - Post an image in your vouch channel
   - Mention your provider role (e.g., @Provider)
   - You should receive +1 VP automatically!

4. **Configure Economy (Optional)**
   ```
   /admin config daily_rng_chance 0.50
   /admin config five_cost 20
   ```

## 🔧 Common Issues

### Commands not showing up?

Wait 1-2 minutes after bot starts, or:
```bash
# Restart bot
# Commands are registered on startup
```

### Database errors?

```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Bot not responding?

Check:
- ✅ Bot is online in Discord
- ✅ Bot has required permissions
- ✅ `GUILD_ID` is set correctly
- ✅ Developer Mode is enabled in Discord

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Set up [Railway deployment](README.md#-railway-deployment) for production
- Customize economy settings via `/admin config`
- Run tests: `npm test`

## 🆘 Need Help?

1. Check [README.md](README.md) troubleshooting section
2. Review console logs for errors
3. Verify all environment variables are set
4. Open an issue on GitHub

---

**Ready to go!** Post your first vouch and start earning VP! 🍔💰

