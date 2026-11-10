const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

console.log('Starting script...');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://Baob653kYpN8nKU.root:eWjitgEjLbuTgx5R@gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000/campus_ledger?sslAccept=strict&sslCa=./tidb-ca.pem'
    }
  }
});

(async () => {
  try {
    console.log('Connecting to database...');

    const accounts = [
      { email: 'admin@tmc.edu', name: 'Campus Ledger Admin', password: 'CampusAdmin#2026', role: 'ADMIN' },
      { email: 'treasurer@tmc.edu', name: 'Campus Treasurer', password: 'Treasurer#2026', role: 'TREASURER' },
      { email: 'auditor@tmc.edu', name: 'Campus Auditor', password: 'Auditor#2026', role: 'AUDITOR' },
    ];

    for (const acc of accounts) {
      console.log('Processing:', acc.email);
      const existing = await prisma.user.findUnique({ where: { email: acc.email } });
      if (existing) {
        console.log('  Already exists:', acc.email);
        continue;
      }
      const hash = await bcrypt.hash(acc.password, 12);
      console.log('  Hash created, inserting...');
      await prisma.user.create({
        data: {
          email: acc.email,
          name: acc.name,
          passwordHash: hash,
          role: acc.role
        }
      });
      console.log('  ✓ Created:', acc.email);
    }
    console.log('✓ All done!');
  } catch (e) {
    console.error('✗ Error:', e.message);
    console.error(e.stack);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected.');
  }
})();
