# Bot Stability & Maintenance Plan

To keep the GUHD EATS bot stable and prevent future crashes, adopt the following ongoing plan:

## 1. Automated Testing
- **Unit Tests**: Run `npm test` before every deployment to verify game logic (blackjack, battles, utilities).
- **Continuous Integration**: Configure CI (e.g., GitHub Actions) to execute the test suite on each pull request.
- **Database Validations**: Add integration tests for Prisma interactions once a staging database is available.

## 2. Error Monitoring
- **Centralized Logging**: Ensure `initLogger` always points to a dedicated Discord channel for surfacing runtime issues.
- **Unhandled Rejection Handling**: Extend `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers to capture unexpected crashes and alert maintainers.

## 3. Command Health Checks
- **Startup Validation**: During `init`, verify that all commands load without runtime references to unavailable variables (as was the case with `client`).
- **Interaction Coverage**: Add targeted tests or mocked interaction flows for buttons (blackjack, battles, etc.) to ensure each `customId` path resolves correctly.

## 4. Dependency & Environment Maintenance
- **Dependency Updates**: Schedule monthly reviews to update `discord.js`, Prisma, and other dependencies after confirming compatibility.
- **Environment Verification**: Maintain `.env.example` with required variables (e.g., `DISCORD_TOKEN`, `CASINO_CHANNEL_ID`, `LOG_CHANNEL_ID`) and validate them on startup.

## 5. Operational Playbook
- **Backup & Recovery**: Document the procedure for backing up and restoring the Prisma database.
- **Incident Response**: Keep a checklist for investigating crashes (review logs, reproduce locally, run tests) and create follow-up issues for long-term fixes.

Following this plan will help keep the bot robust, observable, and ready to handle future features without regressions.
