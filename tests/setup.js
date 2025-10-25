// Test setup and global mocks
import { beforeAll, afterAll } from 'vitest';

// Mock environment variables for tests
process.env.DATABASE_URL = 'file:./data/test.db';
process.env.DISCORD_TOKEN = 'test_token';
process.env.GUILD_ID = '123456789';
process.env.PROVIDER_ROLE_ID = '111111111';
process.env.ADMIN_ROLE_ID = '222222222';
process.env.VOUCH_CHANNEL_ID = '333333333';
process.env.CASINO_CHANNEL_ID = '444444444';
process.env.LOG_CHANNEL_ID = '555555555';

beforeAll(() => {
  console.log('🧪 Setting up tests...');
});

afterAll(() => {
  console.log('✅ Tests complete!');
});
