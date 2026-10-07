import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import roster from './bsit-year4-students.json';

const prisma = new PrismaClient();
async function main() {
  const accounts: Array<{ role: Role; emailKey: string; passwordKey: string; nameKey: string; defaultName: string }> = [
    { role: Role.ADMIN, emailKey: 'BOOTSTRAP_ADMIN_EMAIL', passwordKey: 'BOOTSTRAP_ADMIN_PASSWORD', nameKey: 'BOOTSTRAP_ADMIN_NAME', defaultName: 'System Administrator' },
    { role: Role.TREASURER, emailKey: 'BOOTSTRAP_TREASURER_EMAIL', passwordKey: 'BOOTSTRAP_TREASURER_PASSWORD', nameKey: 'BOOTSTRAP_TREASURER_NAME', defaultName: 'Campus Treasurer' },
    { role: Role.AUDITOR, emailKey: 'BOOTSTRAP_AUDITOR_EMAIL', passwordKey: 'BOOTSTRAP_AUDITOR_PASSWORD', nameKey: 'BOOTSTRAP_AUDITOR_NAME', defaultName: 'Campus Auditor' },
  ];
  const configuredAccounts = accounts.map((account) => {
    const email = process.env[account.emailKey]?.trim().toLowerCase();
    const password = process.env[account.passwordKey];
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error(`Set a valid ${account.emailKey} before seeding.`);
    if (!password || password.length < 12) throw new Error(`Set ${account.passwordKey} to a password of at least 12 characters before seeding.`);
    return { ...account, email, password, name: process.env[account.nameKey]?.trim() || account.defaultName };
  });
  if (new Set(configuredAccounts.map(({ email }) => email)).size !== configuredAccounts.length) {
    throw new Error('Each bootstrap role must have a different email address.');
  }

  for (const account of configuredAccounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, passwordHash, role: account.role },
      create: { name: account.name, email: account.email, passwordHash, role: account.role },
    });
  }
  for (let i = 0; i < roster.length; i += 500) {
    await prisma.student.createMany({ data: roster.slice(i, i + 500), skipDuplicates: true });
  }
}
main().finally(() => prisma.$disconnect());
