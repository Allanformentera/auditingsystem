const bcrypt = require('bcryptjs');

const accounts = [
  { email: 'admin@tmc.edu', name: 'Campus Ledger Admin', password: 'CampusAdmin#2026', role: 'ADMIN' },
  { email: 'treasurer@tmc.edu', name: 'Campus Treasurer', password: 'Treasurer#2026', role: 'TREASURER' },
  { email: 'auditor@tmc.edu', name: 'Campus Auditor', password: 'Auditor#2026', role: 'AUDITOR' },
];

(async () => {
  for (const acc of accounts) {
    const hash = await bcrypt.hash(acc.password, 12);
    console.log(`INSERT INTO \`User\` (\`id\`, \`name\`, \`email\`, \`passwordHash\`, \`role\`, \`createdAt\`) VALUES ('${acc.email}', '${acc.name}', '${acc.email}', '${hash}', '${acc.role}', NOW());`);
  }
  console.log('\n--- Copy and run all lines above in TiDB Cloud SQL Editor ---');
})();
