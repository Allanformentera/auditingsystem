import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const FEES: Array<{ purpose: string; amount: number }> = [
  { purpose: 'Graduating Pictorial', amount: 1850 },
  { purpose: 'Diploma Holder', amount: 350 },
  { purpose: 'Yearbook', amount: 1500 },
  { purpose: 'Toga', amount: 500 },
  { purpose: 'Alumni Fee', amount: 400 },
  { purpose: 'Graduation Day Picture', amount: 100 },
  { purpose: 'Contribution', amount: 500 },
];

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'TREASURER'] } }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('Seed an admin/treasurer account first (npm run db:seed).');
  const students = await prisma.student.findMany({ where: { active: true, yearLevel: 4 }, select: { id: true } });
  let created = 0;
  let skipped = 0;
  for (const fee of FEES) {
    const existing = await prisma.assessment.findFirst({ where: { purpose: fee.purpose, course: null, yearLevel: 4, block: null } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.assessment.create({
      data: {
        purpose: fee.purpose,
        amount: new Prisma.Decimal(fee.amount),
        course: null,
        major: '',
        yearLevel: 4,
        block: null,
        createdById: owner.id,
        payments: { create: students.map((s) => ({ studentId: s.id, amount: new Prisma.Decimal(fee.amount) })) },
      },
    });
    created++;
    console.log(`Created "${fee.purpose}" for ${students.length} graduating students.`);
  }
  console.log(`Done: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
