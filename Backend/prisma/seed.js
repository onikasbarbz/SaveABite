const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@saveabite.com';
  
  console.log('🌱 Starting admin database seed...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log(`✨ Admin user with email ${adminEmail} already exists! Seed skipped.`);
    return;
  }

  // Hash password
  const plainPassword = 'admin123';
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

  // Insert the Admin
  const admin = await prisma.user.create({
    data: {
      full_name: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      isVerified: true
    }
  });

  console.log(`✅ Admin user seeded successfully!`);
  console.log(`📧 Email: ${admin.email}`);
  console.log(`🔑 Password: ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error('🔥 Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
