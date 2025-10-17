# 🎮 Complete Command Reference

## 👤 User Commands

### Balance & Economy
```
/balance [@user]
```
Check your VP balance or another user's balance.

```
/send @user <amount>
```
Transfer VP to another user (5% fee applies, minimum 1 VP).

```
/daily
```
Claim random daily VP with 35% success rate (24-hour cooldown).

### Leaderboard
```
/leaderboard [page]
```
View top VP holders. Shows 10 users per page with medals for top 3.

### Battle Games
```
/battle @user <amount> [game]
```
Challenge another user to a 1v1 game. Optional game choices:
- `rps` - Rock Paper Scissors (default)
- `highcard` - High Card draw
- `dice` - Dice Duel (2d6)
- `hilow` - Hi-Lo number guess
- `reaction` - Reaction speed test

**Examples:**
```
/battle @John 10
/battle @Sarah 25 rps
/battle @Mike 50 highcard
```

### Blackjack
```
/blackjack play <bet>
```
Start a blackjack game with your bet amount (min: 1 VP, max: 50 VP).
Only works in designated casino channel.

```
/blackjack rules
```
View blackjack rules, table limits, and payout information.

### Redemptions
```
/redeem five
```
Redeem VP for $5 order reward (costs 25 VP).
Creates a private ticket with providers.

```
/redeem free
```
Redeem VP for free $20 order reward (costs 60 VP).
Creates a private ticket with providers.

---

## 👔 Provider Commands

### Vouch Management
```
/approvevouch
```
Open an interactive list of pending vouches. Click the button next to a vouch to approve it and credit +1 VP to the user.

> 💡 Users who include an `@` mention in their vouch post are approved automatically. Only vouches without a mention require manual approval.

### Redemption Management
```
/redeem fulfill <redemption_id>
```
Mark a redemption as fulfilled/complete.

**Example:**
```
/redeem fulfill 42
```

---

## 🛡️ Admin Commands

All admin commands are under the `/admin` parent command.

### VP Management
```
/admin add @user <amount>
```
Add VP to a user's balance.

```
/admin remove @user <amount>
```
Remove VP from a user's balance (requires sufficient balance).

```
/admin set @user <amount>
```
Set a user's balance to exact amount.

**Examples:**
```
/admin add @John 100
/admin remove @Sarah 50
/admin set @Mike 200
```

### Blacklist Management
```
/admin blacklist @user
```
Blacklist a user from earning or using VP.

```
/admin unblacklist @user
```
Remove a user from the blacklist.

### Configuration
```
/admin config
```
View all current bot configuration settings.

```
/admin config <key>
```
View specific configuration value.

```
/admin config <key> <value>
```
Update a configuration setting.

**Available config keys:**
- `daily_rng_chance` - Daily claim success rate (0-1, default: 0.35)
- `transfer_fee_percent` - Transfer fee percentage (default: 5)
- `battle_rake_percent` - House cut from battles (default: 2)
- `bj_min` - Minimum blackjack bet (default: 1)
- `bj_max` - Maximum blackjack bet (default: 50)
- `five_cost` - VP cost for $5 order (default: 25)
- `free_cost` - VP cost for free order (default: 60)
- `daily_amount` - VP amount for daily claim (default: 1)

**Examples:**
```
/admin config
/admin config daily_rng_chance
/admin config daily_rng_chance 0.50
/admin config five_cost 20
/admin config bj_max 100
```

### Data Export
```
/admin export
```
Export all user balances as CSV file for backup/analysis.

---

## 🎯 Automatic Features

### Vouch System
Post a message in the designated vouch channel with:
- ✅ At least one image attachment (jpg/png/webp/gif)
- ✅ Mention of @Provider role

**Auto-approval flow:**
1. Post image + @Provider mention in #vouch
2. Instantly receive +1 VP
3. Get DM confirmation
4. Vouch logged to audit channel

**Manual approval flow:**
1. Post image without @Provider mention
2. Bot asks you to mention provider
3. Provider uses `/approvevouch` command
4. Receive +1 VP once approved

---

## 🎲 Game Mechanics

### Rock Paper Scissors
- Both players select simultaneously
- Ties trigger sudden-death re-pick
- Classic RPS rules apply

### High Card
- Each player draws one card
- Highest card wins (Ace = high)
- Ties auto-redraw

### Dice Duel
- Each player rolls 2d6
- Highest total wins
- Ties auto-reroll

### Hi-Lo
- Bot picks random number 1-100
- Challenger guesses HIGH (>50) or LOW (<50)
- Opponent gets opposite guess
- Number 50 = tie (re-pick)

### Reaction Duel
- Bot shows "GET READY" message
- After 2-5 second random delay, shows "CLICK NOW"
- Fastest click within 2 seconds wins
- Pre-clicks before "CLICK NOW" are ignored

### Blackjack
- Standard blackjack rules
- Dealer hits on soft 17
- Natural blackjack pays 3:2
- Double down available on first two cards
- Split available (same value cards)
- 60-second timeout per action (auto-stand)

---

## 💰 Economy Details

### Transfer Fees
- 5% of transfer amount (configurable)
- Minimum fee: 1 VP
- Example: Send 100 VP = 5 VP fee (total cost: 105 VP)

### Battle Rake
- 2% of total pot (configurable)
- Deducted from winner's prize
- Example: 100 VP battle = 4 VP rake (winner gets 196 VP)

### Redemption Costs
- $5 Order: 25 VP (configurable)
- Free Order: 60 VP (configurable)

### Blackjack Payouts
- Blackjack: 3:2 (bet 10 → win 25 total)
- Regular win: 1:1 (bet 10 → win 20 total)
- Push: Bet returned
- Loss: Lose bet

---

## 📊 Status Indicators

### Battle Status
- ⏳ Awaiting Response - Challenge sent
- 🎮 In Progress - Game active
- 🏆 Complete - Winner decided
- ❌ Canceled - Declined or timeout

### Vouch Status
- 🟢 Auto - Instantly approved with provider mention
- ✅ Approved - Manually approved by provider
- ⏳ Pending - Waiting for approval
- ❌ Rejected - Denied by provider

### Redemption Status
- 🎟️ Opened - Ticket created, pending fulfillment
- ✅ Fulfilled - Completed by provider
- ❌ Canceled - Canceled by admin

---

## ⌨️ Quick Command Reference

| Command | Description | Who Can Use |
|---------|-------------|-------------|
| `/balance` | Check VP | Everyone |
| `/send` | Transfer VP | Everyone |
| `/daily` | Daily claim | Everyone |
| `/battle` | Start game | Everyone |
| `/blackjack` | Play blackjack | Everyone |
| `/leaderboard` | View rankings | Everyone |
| `/redeem` | Redeem rewards | Everyone |
| `/approvevouch` | Approve vouch | Providers |
| `/redeem fulfill` | Complete redemption | Providers |
| `/admin *` | Manage bot | Admins |

---

## 🆘 Common Questions

**Q: Why didn't I get VP for my vouch?**
A: Make sure you:
- Posted in the correct vouch channel
- Included at least one image
- Mentioned the @Provider role
- Are not blacklisted

**Q: How do I get more VP?**
A: You can earn VP by:
- Posting food vouches with provider mention
- Claiming daily (35% success rate)
- Winning battles
- Winning blackjack
- Receiving transfers from others

**Q: Can I cancel a battle?**
A: Opponent can decline within 60 seconds. After acceptance, the game must be completed.

**Q: What happens if I disconnect during blackjack?**
A: The game will auto-stand after 60 seconds of inactivity.

**Q: How do I see my vouch history?**
A: Admins can use `/admin export` to get full data export.

---

**Need more help?** Check the [README.md](README.md) or ask server admins!

