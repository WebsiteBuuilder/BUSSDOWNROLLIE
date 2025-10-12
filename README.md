# 🍔 GUHD EATS Discord Bot

A production-ready Discord bot for GUHD EATS, featuring a complete vouch-based virtual point (VP) economy system. Users earn VP by posting food order photos, which can be transferred, wagered in games, or redeemed for real rewards.

## 🌟 Features

### 💰 VP Economy System
- **Vouch System**: Post food photos with provider mentions to earn VP instantly
- **Daily Claims**: Random daily VP with configurable success rate
- **Transfers**: Send VP to other users with automatic fee calculation
- **Redemptions**: Redeem VP for $5 orders or free $20 orders via private tickets

### 🎮 Games & Entertainment
- **5 Battle Games**:
  - 🪨📄✂️ Rock Paper Scissors
  - 🎴 High Card
  - 🎲 Dice Duel
  - 🔢 Hi-Lo Number Duel
  - ⚡ Reaction Speed Duel
- **♠️ Interactive Blackjack**: Full-featured blackjack with hit/stand/double down
- **🏆 Leaderboard**: Compete for top VP rankings

### 🛠️ Admin Tools
- VP management (add/remove/set)
- User blacklisting
- Configurable economy settings
- CSV export for data backup

## 📋 Tech Stack

- **Runtime**: Node.js 18+
- **Discord Library**: discord.js v14
- **Database**: SQLite with Prisma ORM
- **Hosting**: Railway with persistent storage
- **Testing**: Vitest

## 🚀 Local Development

### Prerequisites

- Node.js 18 or higher
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))
- A Discord server for testing

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/WebsiteBuuilder/BUSSDOWNROLLIE.git
   cd BUSSDOWNROLLIE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your values:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   GUILD_ID=your_guild_id_here
   PROVIDER_ROLE_ID=your_provider_role_id_here
   ADMIN_ROLE_ID=your_admin_role_id_here
   VOUCH_CHANNEL_ID=your_vouch_channel_id_here
   CASINO_CHANNEL_ID=your_casino_channel_id_here
   LOG_CHANNEL_ID=your_log_channel_id_here
   ```

4. **Set up database**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed sample data (optional)**
   ```bash
   npm run seed
   ```

6. **Start the bot**
   ```bash
   npm run dev
   ```

### Finding Discord IDs

Enable **Developer Mode** in Discord (User Settings → Advanced → Developer Mode), then:
- **Server ID**: Right-click server icon → Copy Server ID
- **Role IDs**: Server Settings → Roles → Right-click role → Copy Role ID  
- **Channel IDs**: Right-click channel → Copy Channel ID

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build -t guhd-eats-bot .
```

### Run with Docker

```bash
docker run -d \
  --name guhd-eats \
  -v $(pwd)/data:/data \
  --env-file .env \
  guhd-eats-bot
```

## 🚂 Railway Deployment

### Prerequisites

1. [Railway account](https://railway.app)
2. GitHub repository connected to Railway

### Deployment Steps

1. **Create Railway Project**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your forked repository

2. **Add Persistent Volume**
   - In your Railway project, click "Settings"
   - Go to "Volumes" section
   - Click "Add Volume"
   - Mount path: `/data`
   - Size: 1GB (or more as needed)

3. **Set Environment Variables**
   - Click "Variables" tab
   - Add all variables from `.env.example`
   - Make sure `DATABASE_URL=file:/data/guhdeats.db`

4. **Deploy**
   - Railway will automatically detect the Dockerfile
   - Click "Deploy" and wait for build to complete
   - Bot will automatically run migrations and start

5. **Run Migrations (First Deploy)**
   ```bash
   railway run npx prisma migrate deploy
   ```

### Railway CLI Commands

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Run migrations
railway run npx prisma migrate deploy

# View logs
railway logs

# Access shell
railway shell
```

## 📦 Database Management

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Deploy migrations (production)
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Backup & Restore

```bash
# Backup database
cp data/guhdeats.db data/backup-$(date +%Y%m%d).db

# Or use /admin export command in Discord for CSV export
```

## 🎮 Bot Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/balance [@user]` | Check VP balance |
| `/send @user <amount>` | Transfer VP to another user |
| `/daily` | Claim random daily VP (24h cooldown) |
| `/battle @user <amount> [game]` | Challenge user to 1v1 game |
| `/blackjack play <bet>` | Start blackjack game |
| `/blackjack rules` | View blackjack rules |
| `/leaderboard [page]` | View top VP holders |
| `/redeem five` | Redeem $5 order (25 VP) |
| `/redeem free` | Redeem free order (60 VP) |

### Provider Commands

| Command | Description |
|---------|-------------|
| `/approvevouch <message_link>` | Manually approve a vouch |
| `/redeem fulfill <redemption_id>` | Mark redemption as complete |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/admin add @user <amount>` | Add VP to user |
| `/admin remove @user <amount>` | Remove VP from user |
| `/admin set @user <amount>` | Set exact VP balance |
| `/admin blacklist @user` | Blacklist user |
| `/admin unblacklist @user` | Remove blacklist |
| `/admin config [key] [value]` | View/update config |
| `/admin export` | Export all data as CSV |

## ⚙️ Configuration

All economy settings can be adjusted via `/admin config`:

| Setting | Default | Description |
|---------|---------|-------------|
| `daily_rng_chance` | 0.35 | Daily claim success rate (35%) |
| `transfer_fee_percent` | 5 | Transfer fee percentage |
| `battle_rake_percent` | 2 | House cut from battles |
| `bj_min` | 1 | Minimum blackjack bet |
| `bj_max` | 50 | Maximum blackjack bet |
| `five_cost` | 25 | VP cost for $5 order |
| `free_cost` | 60 | VP cost for free order |
| `daily_amount` | 1 | VP amount for daily claim |

## 🔒 Discord Bot Setup

### 1. Create Bot Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "GUHD EATS Bot"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (use for `DISCORD_TOKEN`)

### 2. Enable Privileged Intents

In the Bot section, enable:
- ✅ **Presence Intent**
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

### 3. Generate Invite Link

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Manage Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use Slash Commands
   - ✅ Manage Channels (for redemption tickets)
4. Copy the generated URL and invite bot to your server

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/vouch.test.js
```

## 🎯 Vouch System Flow

1. **User posts in #vouch**
   - Must contain at least one image
   - Must mention a user with PROVIDER_ROLE_ID

2. **Auto-approval (with @Provider)**
   - Instantly credits +1 VP
   - Creates vouch record with status='auto'
   - DMs user confirmation
   - Logs to audit channel

3. **Manual approval (no @Provider)**
   - Creates vouch record with status='pending'
   - Provider uses `/approvevouch <message_link>` to approve
   - Credits +1 VP on approval

4. **Anti-abuse**
   - Ignores duplicate messages
   - Ignores blacklisted users
   - No cooldown between vouches
   - All vouches logged for audit

## 🎲 Battle System

### Game Types

**Rock Paper Scissors**: Interactive button selection, ties trigger sudden death

**High Card**: Draw from 52-card deck, highest card wins, auto-redraws on ties

**Dice Duel**: Each player rolls 2d6, highest total wins

**Hi-Lo**: Guess if hidden number (1-100) is high (>50) or low (<50)

**Reaction Duel**: Click button fastest after random delay (2-5s)

### Flow

1. `/battle @user <amount> [game]` creates challenge
2. Opponent has 60s to accept or decline
3. Game plays out with interactive UI
4. Winner receives (amount × 2) - rake%
5. Both players receive DM with results

## ♠️ Blackjack Rules

- Dealer hits on soft 17
- Blackjack pays 3:2
- Double down available on first two cards
- 60-second timeout per action (auto-stand)
- Only playable in designated casino channel

## 📊 Leaderboard & Economy

- Top 10 users per page
- Medals for top 3 (🥇🥈🥉)
- 60-second cache to reduce database load
- Real-time balance updates across all features

## 🛡️ Security & Anti-Abuse

- **Blacklist System**: Prevents earning/using VP
- **Transaction Safety**: Database transactions for all multi-step operations
- **Rate Limiting**: Per-user command cooldowns
- **Input Validation**: All amounts verified before processing
- **Audit Trail**: Complete logging of all VP changes

## 📝 Troubleshooting

### Bot doesn't respond to commands

1. Check bot is online in Discord
2. Verify bot has correct permissions
3. Check `GUILD_ID` is set for faster command registration
4. View logs: `railway logs` or check console

### Database errors

```bash
# Regenerate Prisma client
npx prisma generate

# Reset and recreate database
npx prisma migrate reset
```

### Slash commands not appearing

```bash
# Force command re-registration
# Delete all commands:
railway run node -e "const { REST } = require('@discordjs/rest'); const rest = new REST().setToken(process.env.DISCORD_TOKEN); rest.put('/applications/{CLIENT_ID}/guilds/{GUILD_ID}/commands', { body: [] });"

# Restart bot to re-register
```

## 📈 Monitoring & Logs

All VP transactions are logged to `LOG_CHANNEL_ID` with:
- Transaction type
- Users involved
- Amounts
- Timestamps
- Results

View Railway logs:
```bash
railway logs --tail
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **GitHub Repository**: https://github.com/WebsiteBuuilder/BUSSDOWNROLLIE
- **Discord.js Documentation**: https://discord.js.org
- **Prisma Documentation**: https://www.prisma.io/docs
- **Railway Documentation**: https://docs.railway.app

## 💡 Support

For issues or questions:
1. Check this README thoroughly
2. Review Railway logs for errors
3. Open an issue on GitHub
4. Contact server administrators

---

**Made with ❤️ for GUHD EATS Community** 🍔💰

