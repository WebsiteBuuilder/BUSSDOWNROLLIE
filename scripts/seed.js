import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample users with VP
  const users = [
    { discordId: '100000000000000001', vp: 150 },
    { discordId: '100000000000000002', vp: 89 },
    { discordId: '100000000000000003', vp: 234 },
    { discordId: '100000000000000004', vp: 45 },
    { discordId: '100000000000000005', vp: 312 },
    { discordId: '100000000000000006', vp: 67 },
    { discordId: '100000000000000007', vp: 198 },
    { discordId: '100000000000000008', vp: 23 },
    { discordId: '100000000000000009', vp: 401 },
    { discordId: '100000000000000010', vp: 156 }
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { discordId: userData.discordId },
      update: {},
      create: userData
    });
  }

  console.log(`✅ Created ${users.length} sample users`);

  // Create some pending vouches
  const user1 = await prisma.user.findUnique({ where: { discordId: '100000000000000001' } });
  const user2 = await prisma.user.findUnique({ where: { discordId: '100000000000000002' } });

  await prisma.vouch.create({
    data: {
      messageId: '900000000000000001',
      userId: user1.id,
      imageUrl: 'https://example.com/food1.jpg',
      providerMentioned: false,
      status: 'pending'
    }
  });

  await prisma.vouch.create({
    data: {
      messageId: '900000000000000002',
      userId: user2.id,
      imageUrl: 'https://example.com/food2.jpg',
      providerMentioned: false,
      status: 'pending'
    }
  });

  console.log('✅ Created 2 pending vouches');

  // Initialize config if not exists
  const defaultConfig = {
    cooldown_hours: '0',
    require_provider_approval: 'true',
    daily_rng_chance: '0.35',
    five_cost: '25',
    free_cost: '60',
    transfer_fee_percent: '5',
    battle_rake_percent: '2',
    bj_min: '1',
    bj_max: '50',
    daily_amount: '1'
  };

  for (const [key, value] of Object.entries(defaultConfig)) {
    await prisma.config.upsert({
      where: { key },
      update: {},
      create: { key, value }
    });
  }

  console.log('✅ Initialized config values');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

