import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import XLSX from 'xlsx';
import { PrismaClient, Role, PaymentStatus, LedgerKind, MatchStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const receiptUpload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
}), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  cb(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype));
} });
const avatarDir = path.join(uploadDir, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });
const avatarUpload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req: SessionRequest, file, cb) => cb(null, `${req.user!.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
}), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error('Choose a JPG, PNG, or WEBP picture.'), { status: 400 }));
} });

type SessionRequest = express.Request & { user?: { id: string; role: Role; name: string; email: string } };
function auth(req: SessionRequest, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try { req.user = jwt.verify(token, jwtSecret!) as SessionRequest['user']; next(); }
  catch { return res.status(401).json({ error: 'Your session expired. Sign in again.' }); }
}
const allow = (...roles: Role[]) => (req: SessionRequest, res: express.Response, next: express.NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Your account cannot perform this action.' });
  next();
};
const treasurer = allow(Role.TREASURER, Role.ADMIN);
const auditor = allow(Role.AUDITOR, Role.ADMIN);
const staff = allow(Role.TREASURER, Role.AUDITOR, Role.ADMIN);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, jwtSecret!, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
app.get('/api/auth/me', auth, (req: SessionRequest, res) => res.json({ user: req.user }));
app.post('/api/users', auth, allow(Role.ADMIN), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(12), role: z.enum(['TREASURER', 'AUDITOR']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a name, valid email, role, and password of at least 12 characters.' });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'An account already uses that email.' });
  const { name, role, password } = parsed.data;
  const user = await prisma.user.create({ data: { name, role, email, passwordHash: await bcrypt.hash(password, 12) } });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
app.patch('/api/users/me', auth, avatarUpload.single('avatar'), async (req: SessionRequest, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!current) return res.status(404).json({ error: 'Account not found.' });
  let avatarPath = current.avatarPath;
  if (req.file) {
    if (avatarPath) { try { fs.unlinkSync(path.join(avatarDir, avatarPath)); } catch { /* keep new upload */ } }
    avatarPath = path.basename(req.file.path);
  }
  const rawName = req.body.name !== undefined ? String(req.body.name || '').trim() : undefined;
  if (rawName !== undefined && rawName.length < 2) {
    if (req.file && req.file.path !== (current.avatarPath ? path.join(avatarDir, current.avatarPath) : '')) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    return res.status(400).json({ error: 'Display name needs at least 2 characters.' });
  }
  const updated = await prisma.user.update({ where: { id: current.id }, data: { ...(rawName !== undefined ? { name: rawName } : {}), avatarPath } });
  res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, hasAvatar: !!updated.avatarPath } });
});
app.post('/api/users/me/password', auth, async (req: SessionRequest, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'New password needs at least 12 characters.' });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
  res.json({ ok: true });
});
app.get('/api/users/me/avatar', auth, async (req: SessionRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.avatarPath) return res.status(404).json({ error: 'No profile picture yet.' });
  res.sendFile(path.join(avatarDir, user.avatarPath));
});

app.get('/api/students', auth, async (req, res) => {
  const { course, block, q, yearLevel, major } = req.query;
  const students = await prisma.student.findMany({ where: {
    active: true, ...(course ? { course: String(course) } : {}), ...(block ? { block: String(block) } : {}), ...(yearLevel ? { yearLevel: Number(yearLevel) } : {}), ...(major ? { major: String(major) } : {}),
    ...(q ? { OR: [{ firstName: { contains: String(q) } }, { lastName: { contains: String(q) } }] } : {}),
  }, orderBy: [{ course: 'asc' }, { block: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }] });
  res.json({ students, count: students.length });
});
app.post('/api/students/import', auth, auditor, memoryUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an Excel workbook first.' });
  const course = String(req.body.course || 'BSIT').toUpperCase();
  const yearLevel = Number(req.body.yearLevel || 4);
  if (!['BSIT', 'EDUC', 'BSOA', 'CRIM', 'CAS'].includes(course)) return res.status(400).json({ error: 'Choose one of the five supported courses.' });
  const major = String(req.body.major || '').toUpperCase();
  const courseMajors: Record<string, string[]> = { CAS: ['BA COMM', 'POLSCI'], EDUC: ['BSED', 'BEED'] };
  if ((course === 'CAS' || course === 'EDUC') && !(courseMajors[course] || []).includes(major)) return res.status(400).json({ error: `Choose a ${course} major (${(courseMajors[course] || []).join(' or ')}).` });
  if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) return res.status(400).json({ error: 'Choose a valid year level.' });
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const records: { studentNo?: string; firstName: string; lastName: string; block: string; course: string; major: string; yearLevel: number }[] = [];
  const invalid: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const blockMatch = sheetName.match(/(?:block|blk)\s*[-#]?\s*(\d+)/i);
    const defaultBlock = blockMatch ? String(Number(blockMatch[1])) : '';
    const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    let headerRow = -1, fullNameCol = -1, lastNameCol = -1, firstNameCol = -1, blockCol = -1, studentNoCol = -1;
    let fullRow = -1, fullFull = -1, fullLast = -1, fullFirst = -1, fullBlock = -1, fullNo = -1;
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const headers = (rows[r] as unknown[]).map(normalizeHeader);
      const full = headers.findIndex(h => ['name', 'student name', 'full name', 'name of student'].includes(h));
      const last = headers.findIndex(h => ['last name', 'surname', 'family name'].includes(h));
      const first = headers.findIndex(h => ['first name', 'given name', 'firstname'].includes(h));
      const blk = headers.findIndex(h => ['block', 'section', 'class'].includes(h));
      const no = headers.findIndex(h => ['student no', 'student number', 'student id', 'id number', 'id no', 'id'].includes(h));
      if (last >= 0 && first >= 0) {
        headerRow = r; fullNameCol = full; lastNameCol = last; firstNameCol = first;
        blockCol = blk;
        studentNoCol = no;
        break;
      }
      if (fullRow < 0 && full >= 0) {
        fullRow = r; fullFull = full; fullLast = last; fullFirst = first; fullBlock = blk; fullNo = no;
      }
    }
    if (headerRow < 0 && fullRow >= 0) {
      headerRow = fullRow; fullNameCol = fullFull; lastNameCol = fullLast; firstNameCol = fullFirst;
      blockCol = fullBlock;
      studentNoCol = fullNo;
    }
    for (let i = headerRow >= 0 ? headerRow + 1 : 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const values = row.map(v => String(v ?? '').trim());
      const cells = values.filter(Boolean);
      if (!cells.length) continue;
      if (headerRow < 0 && /^(male|female|student name|full name|last name|first name|surname|family name|student|name|no\.|student no\.?|student id)$/i.test(cells[0])) continue;
      let lastName = '', firstName = '';
      if (headerRow >= 0 && lastNameCol >= 0 && firstNameCol >= 0) {
        lastName = values[lastNameCol] || ''; firstName = values[firstNameCol] || '';
      } else if (headerRow >= 0 && fullNameCol >= 0) {
        const full = values[fullNameCol] || '';
        if (full.includes(',')) [lastName, firstName] = full.split(/,(.*)/s).map(v => v.trim());
        else { const parts = full.split(/\s+/); lastName = parts.pop() || ''; firstName = parts.join(' '); }
      } else if (cells[0].includes(',')) [lastName, firstName] = cells[0].split(/,(.*)/s).map(v => v.trim());
      else if (cells.length > 1) { lastName = cells[0].replace(/^\d+\.\s*/, ''); firstName = cells[1].trim(); }
      else { invalid.push(`${sheetName}, row ${i + 1}`); continue; }
      const block = (blockCol >= 0 ? String(values[blockCol] || '').replace(/^(?:block|blk)\s*/i, '') : '') || defaultBlock || String(req.body.block || '').trim();
      if (!lastName || !firstName || !block) { invalid.push(`${sheetName}, row ${i + 1}`); continue; }
      const studentNo = studentNoCol >= 0 ? values[studentNoCol] || undefined : undefined;
      records.push({ ...(studentNo ? { studentNo } : {}), firstName, lastName, block, course, major, yearLevel });
    }
  }
  let added = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = await prisma.student.createMany({ data: records.slice(i, i + 500), skipDuplicates: true });
    added += batch.count;
  }
  const inserted = { added, skipped: records.length - added };
  const importBlock = String(req.body.block || '').trim();
  const importMajor = course === 'CAS' || course === 'EDUC' ? String(req.body.major || '').toUpperCase() : '';
  const fileBlocks = [...new Set(records.map(r => r.block))];
  const restored = await prisma.student.updateMany({ where: { active: false, course, yearLevel, major: importMajor, ...(fileBlocks.length ? { block: { in: fileBlocks } } : {}) }, data: { active: true } });
  const matching = await prisma.assessment.findMany({ where: { AND: [
    { OR: [{ course: null }, { course }] },
    { OR: [{ yearLevel: null }, { yearLevel }] },
    { OR: [{ major: '' }, { major: importMajor }] },
  ] } });
  let enrolled = 0;
  for (const a of matching) {
    const scope: { course: string; yearLevel: number; major?: string; block?: string | { in: string[] } } = { course, yearLevel };
    if (importMajor) scope.major = importMajor;
    if (a.block) scope.block = a.block;
    else if (fileBlocks.length) scope.block = { in: fileBlocks };
    const roster = await prisma.student.findMany({ where: scope, select: { id: true } });
    const r = await prisma.payment.createMany({ data: roster.map(s => ({ studentId: s.id, assessmentId: a.id, amount: a.amount })), skipDuplicates: true });
    enrolled += r.count;
  }
  res.json({ ...inserted, restored: restored.count, enrolled, invalidRows: invalid, parsed: records.length, sheets: workbook.SheetNames });
});
app.delete('/api/students', auth, auditor, async (req, res) => {
  const course = String(req.query.course || '').toUpperCase();
  const block = String(req.query.block || '').trim();
  const yearLevel = Number(req.query.yearLevel || 4);
  const major = String(req.query.major || '').toUpperCase();
  if (!course || !block) return res.status(400).json({ error: 'Choose a course and block first.' });
  const result = await prisma.student.updateMany({ where: { active: true, course, block, yearLevel, ...(major ? { major } : {}) }, data: { active: false } });
  res.json({ removed: result.count });
});
app.delete('/api/students/:id', auth, auditor, async (req, res) => {
  const student = await prisma.student.findFirst({ where: { id: req.params.id as string, active: true } });
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  await prisma.student.update({ where: { id: student.id }, data: { active: false } });
  res.json({ ok: true });
});

app.post('/api/students', auth, staff, async (req, res) => {
  const course = String(req.body.course || '').toUpperCase();
  const yearLevel = Number(req.body.yearLevel || 4);
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const block = String(req.body.block || '').trim().replace(/^(?:block|blk)\s*/i, '');
  const studentNo = String(req.body.studentNo || '').trim() || undefined;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Enter the first and last name.' });
  if (!['BSIT', 'EDUC', 'BSOA', 'CRIM', 'CAS'].includes(course)) return res.status(400).json({ error: 'Choose one of the five supported courses.' });
  const major = String(req.body.major || '').toUpperCase();
  const courseMajors: Record<string, string[]> = { CAS: ['BA COMM', 'POLSCI'], EDUC: ['BSED', 'BEED'] };
  if ((course === 'CAS' || course === 'EDUC') && !(courseMajors[course] || []).includes(major)) return res.status(400).json({ error: `Choose a ${course} major (${(courseMajors[course] || []).join(' or ')}).` });
  if (!block) return res.status(400).json({ error: 'Choose a block.' });
  if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) return res.status(400).json({ error: 'Choose a valid year level.' });
  const majorValue = course === 'CAS' || course === 'EDUC' ? major : '';
  if (studentNo) {
    const taken = await prisma.student.findUnique({ where: { studentNo } });
    if (taken && taken.active) return res.status(409).json({ error: 'That student number is already on the roster.' });
  }
  let student = await prisma.student.findFirst({ where: { course, yearLevel, block, major: majorValue, firstName, lastName } });
  let restored = false;
  if (student && !student.active) {
    student = await prisma.student.update({ where: { id: student.id }, data: { active: true, ...(studentNo ? { studentNo } : {}) } });
    restored = true;
  }
  if (!student) {
    try {
      student = await prisma.student.create({ data: { ...(studentNo ? { studentNo } : {}), firstName, lastName, block, course, major: majorValue, yearLevel } });
    } catch {
      return res.status(409).json({ error: 'This student is already on the roster.' });
    }
  }
  const matching = await prisma.assessment.findMany({ where: { AND: [
    { OR: [{ course: null }, { course }] },
    { OR: [{ yearLevel: null }, { yearLevel }] },
    { OR: [{ major: '' }, { major: majorValue }] },
  ] } });
  let enrolled = 0;
  for (const a of matching) {
    if (a.block && a.block !== student.block) continue;
    const r = await prisma.payment.createMany({ data: [{ studentId: student.id, assessmentId: a.id, amount: a.amount }], skipDuplicates: true });
    enrolled += r.count;
  }
  res.status(restored ? 200 : 201).json({ student, enrolled, restored });
});
app.get('/api/assessments', auth, async (_req, res) => {
  const assessments = await prisma.assessment.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { payments: true } }, payments: { select: { status: true, amount: true } } } });
  res.json({ assessments: assessments.map(a => ({ id: a.id, purpose: a.purpose, amount: a.amount, course: a.course, major: a.major, yearLevel: a.yearLevel, block: a.block, dueDate: a.dueDate, createdAt: a.createdAt, studentCount: a._count.payments, paidCount: a.payments.filter(p => p.status === PaymentStatus.PAID).length })) });
});
app.post('/api/assessments', auth, treasurer, async (req: SessionRequest, res) => {
  const parsed = z.object({ purpose: z.string().trim().min(2), amount: z.coerce.number().positive(), course: z.enum(['BSIT', 'EDUC', 'BSOA', 'CRIM', 'CAS']).optional(), major: z.string().optional(), yearLevel: z.coerce.number().int().min(1).max(6).optional(), block: z.string().optional(), dueDate: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a purpose and a valid amount.' });
  const d = parsed.data;
  const students = await prisma.student.findMany({ where: { active: true, ...(d.course ? { course: d.course } : {}), ...(d.major ? { major: d.major } : {}), ...(d.yearLevel ? { yearLevel: d.yearLevel } : {}), ...(d.block ? { block: d.block } : {}) }, select: { id: true } });
  if (!students.length) return res.status(400).json({ error: 'No active students match this assessment scope. Import a roster first.' });
  const assessment = await prisma.assessment.create({ data: {
    purpose: d.purpose, amount: new Prisma.Decimal(d.amount), course: d.course, major: d.major || '', yearLevel: d.yearLevel, block: d.block,
    dueDate: d.dueDate ? new Date(d.dueDate) : undefined, createdById: req.user!.id,
    payments: { create: students.map(s => ({ studentId: s.id, amount: new Prisma.Decimal(d.amount) })) },
  } });
  res.status(201).json({ assessment, studentsAdded: students.length });
});
app.get('/api/assessments/:id/payments', auth, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { assessmentId: req.params.id as string }, include: { student: true }, orderBy: [{ student: { course: 'asc' } }, { student: { block: 'asc' } }, { student: { lastName: 'asc' } }] });
  res.json({ payments });
});
app.patch('/api/payments/:id/mark-paid', auth, treasurer, async (req: SessionRequest, res) => {
  const receipt = String(req.body.reference ?? '').trim();
  if (receipt && !/^\d{4}$/.test(receipt)) return res.status(400).json({ error: 'Receipt number must be exactly 4 digits.' });
  const payment = await prisma.$transaction(async tx => {
    const current = await tx.payment.findUnique({ where: { id: req.params.id as string }, include: { student: true, assessment: true } });
    if (!current) throw Object.assign(new Error('Payment record not found.'), { status: 404 });
    if (current.status === PaymentStatus.PAID) throw Object.assign(new Error('This student is already marked paid.'), { status: 409 });
    const updated = await tx.payment.update({ where: { id: current.id }, data: { status: PaymentStatus.PAID, paidAt: new Date(), reference: receipt || null, recordedById: req.user!.id } });
    await tx.ledgerEntry.create({ data: { kind: LedgerKind.CREDIT, amount: current.amount, description: `${current.assessment.purpose} · ${current.student.lastName}, ${current.student.firstName}`, paymentId: current.id, createdById: req.user!.id } });
    return updated;
  });
  res.json({ payment });
});
app.patch('/api/payments/:id/mark-unpaid', auth, treasurer, async (req: SessionRequest, res) => {
  const payment = await prisma.$transaction(async tx => {
    const current = await tx.payment.findUnique({ where: { id: req.params.id as string } });
    if (!current) throw Object.assign(new Error('Payment record not found.'), { status: 404 });
    if (current.status === PaymentStatus.UNPAID) throw Object.assign(new Error('This payment is already unpaid.'), { status: 409 });
    await tx.ledgerEntry.deleteMany({ where: { paymentId: current.id } });
    return tx.payment.update({ where: { id: current.id }, data: { status: PaymentStatus.UNPAID, paidAt: null, reference: null } });
  });
  res.json({ payment });
});
app.patch('/api/payments/:id/receipt', auth, auditor, async (req, res) => {
  const receipt = String(req.body.receipt ?? '').trim();
  if (!/^\d{4}$/.test(receipt)) return res.status(400).json({ error: 'Receipt number must be exactly 4 digits.' });
  const current = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
  if (!current) return res.status(404).json({ error: 'Payment record not found.' });
  const payment = await prisma.payment.update({ where: { id: current.id }, data: { reference: receipt } });
  res.json({ payment });
});

app.post('/api/expenses', auth, treasurer, receiptUpload.single('receipt'), async (req: SessionRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a receipt image or PDF before recording this expense.' });
  const parsed = z.object({ purpose: z.string().trim().min(2), vendor: z.string().optional(), amount: z.coerce.number().positive(), spentAt: z.string().min(1), notes: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Enter the expense details and a valid amount.' }); }
  const { purpose, vendor, amount, spentAt, notes } = parsed.data;
  const expense = await prisma.$transaction(async tx => {
    const item = await tx.expense.create({ data: { purpose, vendor, amount: new Prisma.Decimal(amount), spentAt: new Date(spentAt), notes, receiptPath: path.basename(req.file!.path), createdById: req.user!.id } });
    await tx.ledgerEntry.create({ data: { kind: LedgerKind.DEBIT, amount: item.amount, description: purpose, expenseId: item.id, createdById: req.user!.id } });
    return item;
  });
  res.status(201).json({ expense });
});
app.get('/api/expenses', auth, async (_req, res) => res.json({ expenses: await prisma.expense.findMany({ orderBy: { spentAt: 'desc' }, include: { createdBy: { select: { name: true } } } }) }));
app.get('/api/expenses/:id/receipt', auth, async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id as string } });
  if (!expense) return res.status(404).json({ error: 'Receipt not found.' });
  res.sendFile(path.join(uploadDir, expense.receiptPath));
});

app.get('/api/audit/summary', auth, auditor, async (_req, res) => {
  const [credits, debits, paidCount, unpaidCount, students, recent, assessments] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { kind: LedgerKind.CREDIT }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { kind: LedgerKind.DEBIT }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: PaymentStatus.PAID } }), prisma.payment.count({ where: { status: PaymentStatus.UNPAID } }),
    prisma.student.count({ where: { active: true } }), prisma.ledgerEntry.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { name: true, role: true } } } }),
    prisma.assessment.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { payments: { select: { status: true, amount: true } } } }),
  ]);
  const credit = Number(credits._sum.amount || 0), debit = Number(debits._sum.amount || 0);
  res.json({ totalCredits: credit, totalDebits: debit, bookBalance: credit - debit, paidCount, unpaidCount, students, recent, assessments: assessments.map(a => ({ purpose: a.purpose, credits: a.payments.filter(p => p.status === 'PAID').reduce((n, p) => n + Number(p.amount), 0), collected: a.payments.filter(p => p.status === 'PAID').length, expected: a.payments.length })) });
});
app.get('/api/dashboard/summary', auth, async (_req, res) => {
  const [credits, debits, paidCount, unpaidCount, students, cashCount, recent] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { kind: LedgerKind.CREDIT }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { kind: LedgerKind.DEBIT }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: PaymentStatus.PAID } }),
    prisma.payment.count({ where: { status: PaymentStatus.UNPAID } }),
    prisma.student.count({ where: { active: true } }),
    prisma.cashCount.findFirst({ orderBy: { countedAt: 'desc' } }),
    prisma.ledgerEntry.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { payment: { include: { student: true, assessment: true } }, expense: true } }),
  ]);
  const totalCredits = Number(credits._sum.amount || 0), totalDebits = Number(debits._sum.amount || 0);
  res.json({ totalCredits, totalDebits, bookBalance: totalCredits - totalDebits, paidCount, unpaidCount, students, latestCashCount: cashCount ? Number(cashCount.amount) : null, recent });
});
app.post('/api/audit/cash-count', auth, auditor, async (req: SessionRequest, res) => {
  const parsed = z.object({ amount: z.coerce.number().min(0), note: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the counted cash amount.' });
  const count = await prisma.cashCount.create({ data: { amount: new Prisma.Decimal(parsed.data.amount), note: parsed.data.note, countedById: req.user!.id } });
  res.status(201).json({ count });
});
app.post('/api/audit/submissions', auth, auditor, memoryUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose the mayor or representative payment list.' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) return res.status(400).json({ error: 'No payment rows were found in that sheet.' });
  const keys = Object.keys(rows[0]);
  const get = (row: Record<string, unknown>, hints: string[]) => { const key = keys.find(k => hints.some(h => k.toLowerCase().includes(h))); return key ? String(row[key] ?? '').trim() : ''; };
  const submission = await prisma.paymentSubmission.create({ data: { sourceName: req.file.originalname } });
  const listMajor = String(req.body.major || '').toUpperCase();
  let matched = 0;
  for (const row of rows) {
    const fullNameKey = keys.find(k => ['student name', 'full name', 'name', 'name of student', 'student', 'learner'].includes(k.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
    const fullName = fullNameKey ? String(row[fullNameKey] ?? '').trim() : '';
    const splitFirst = get(row, ['first name', 'given name']);
    const splitLast = get(row, ['last name', 'surname', 'family name']);
    const studentName = fullName || (splitFirst && splitLast ? `${splitLast}, ${splitFirst}` : '');
    const course = (get(row, ['course', 'program']) || String(req.body.course || 'BSIT')).toUpperCase();
    const yearLevel = Number(get(row, ['year level', 'year']) || req.body.yearLevel || 4);
    const block = get(row, ['block', 'section']);
    const amountRaw = get(row, ['amount', 'paid amount', 'amount paid']);
    const reportedAmount = Number(amountRaw.replace(/[^\d.]/g, '')) || null;
    const statusRaw = get(row, ['payment status', 'status']).toLowerCase();
    const reportedPaid = /^(paid|yes|received|complete|completed)$/i.test(statusRaw) ? true : /^(unpaid|no|pending)$/i.test(statusRaw) ? false : null;
    const [lastName, firstName] = studentName.includes(',')
      ? studentName.split(/,(.*)/s).map(s => s.trim())
      : (() => { const parts = studentName.trim().split(/\s+/); return [parts.pop() || '', parts.join(' ')]; })();
    const normalizedBlock = block.replace(/^(?:block|blk)\s*/i, '');
    const candidates = studentName ? await prisma.student.findMany({ where: { course, yearLevel, ...(listMajor ? { major: listMajor } : {}), ...(normalizedBlock ? { block: normalizedBlock } : {}), firstName: { contains: firstName || '' }, lastName: { contains: lastName || '' } }, take: 2 }) : [];
    let status: MatchStatus = MatchStatus.NOT_ON_ROSTER, details = 'Student name did not match an active roster entry.';
    if (candidates.length > 1) { status = MatchStatus.DUPLICATE; details = 'More than one student matched; review manually.'; }
    else if (candidates.length === 1) {
      const student = candidates[0];
      const payment = await prisma.payment.findFirst({ where: { studentId: student.id, ...(get(row, ['purpose', 'assessment']) ? { assessment: { purpose: { contains: get(row, ['purpose', 'assessment']) } } } : {}) } });
      if (!payment || (reportedPaid !== null && (payment.status === PaymentStatus.PAID) !== reportedPaid) || (payment.status === PaymentStatus.UNPAID && reportedPaid === null)) {
        status = MatchStatus.PAYMENT_STATUS_MISMATCH;
        details = !payment ? 'Student is on the roster, but no payment record matches this assessment.' : `Submitted list and ledger disagree about whether this payment was received.`;
      }
      else if (reportedAmount !== null && Number(payment.amount) !== reportedAmount) { status = MatchStatus.AMOUNT_MISMATCH; details = `List says ₱${reportedAmount.toFixed(2)}; assessment is ₱${Number(payment.amount).toFixed(2)}.`; }
      else { status = MatchStatus.MATCHED; details = 'Matches a recorded payment.'; matched++; }
    }
    await prisma.submissionRow.create({ data: { submissionId: submission.id, studentName: studentName || '(blank name)', course, major: listMajor || null, block: block || null, purpose: get(row, ['purpose', 'assessment']) || null, reportedAmount: reportedAmount ? new Prisma.Decimal(reportedAmount) : null, status, details } });
  }
  res.status(201).json({ submission, rows: rows.length, matched, review: rows.length - matched });
});
app.get('/api/audit/submissions', auth, auditor, async (_req, res) => res.json({ submissions: await prisma.paymentSubmission.findMany({ orderBy: { uploadedAt: 'desc' }, include: { rows: true } }) }));

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Attached file is too large.' });
  next(error);
});
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.status || 500;
  if (status === 500) console.error('API error', error.message);
  res.status(status).json({ error: status === 500 ? 'The request could not be completed.' : error.message });
});
app.listen(port, () => console.log(`Campus Ledger API listening on :${port}`));
