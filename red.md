Auditing the codebase — mapping structure and stack.

→Explored: 7 reads, 3 searches
Found a Next.js + Express split — now digging into data model and roles.
→Explored: 10 reads
+Thought · 2.0s

Campus Ledger — Codebase Analysis
Student fund collection + audit system for CCS. Two processes: Next.js frontend (:3000) + Express API (:4000) backed by MySQL + Prisma.

1. Stack
Root package.json:13-19: next@14.2.18, react@18.3.1, recharts@2.15, lucide-react.
server/package.json:13-24: express@4, @prisma/client@6, bcryptjs, jsonwebtoken, multer, xlsx, zod, cors. Dev: tsx, prisma, typescript.
No tests, no linter config, no CI.

2. Structure
src/app/page.tsx -> redirect /login
src/app/login/page.tsx -> JWT in localStorage, role redirect
src/app/treasurer/page.tsx + auditor/page.tsx -> thin wrappers
src/app/components/DashboardView.tsx:36 -> single 325-line client component for both roles
src/lib/api.ts:3 -> fetch wrapper, NEXT_PUBLIC_API_URL fallback localhost:4000
server/src/index.ts:1-265 -> all API routes in one file (~265 lines)
server/prisma/schema.prisma:1-150 -> 8 models + 4 enums
server/prisma/seed.ts:1-36 -> bootstrap 3 users + 364 BSIT roster
server/prisma/bsit-year4-students.json -> prepared roster
server/uploads/ -> local receipt storage
Run: npm run dev via concurrently — package.json:6.

3. Data Model server/prisma/schema.prisma
-User:34 — TREASURER|AUDITOR|ADMIN, email unique, passwordHash.
-Student:47 — course/yearLevel/block/firstName/lastName unique, studentNo? unique, active flag. Index on course,yearLevel,block,lastName.
-Assessment:62 — purpose,amount(12,2), optional scope course/yearLevel/block, dueDate.
-Payment:77 — studentId+assessmentId unique, UNPAID|PAID, paidAt,reference. 1:1 optional LedgerEntry.
-Expense:94 — purpose,vendor,amount,spentAt,receiptPath (required), notes. 1:1 optional LedgerEntry.
-LedgerEntry:108 — CREDIT|DEBIT, paymentId? unique, expenseId? unique. Double-entry enforced in app code, not DB constraint.
-PaymentSubmission:123 + SubmissionRow:130 — auditor uploads, MatchStatus: MATCHED|NOT_ON_ROSTER|AMOUNT_MISMATCH|PAYMENT_STATUS_MISMATCH|DUPLICATE.
-CashCount:144 — amount,note,countedAt,countedById — no FK relation to User, no index. Incomplete vs other models.

4. Backend server/src/index.ts
All logic in one Express file:
-auth:32 — Bearer JWT verify, allow:38 role gate. treasurer:42 = TREASURER,ADMIN; auditor:43 = AUDITOR,ADMIN.
-POST /api/auth/login:46 — zod validate, bcrypt.compare, jwt.sign 8h.
-POST /api/users:55 — ADMIN-only, creates TREASURER|AUDITOR only, min(12) password.
-GET /api/students:65 — filter course,block,yearLevel,q, no pagination.
-POST /api/students/import:73 — multer.memory 8MB, XLSX.read, scans 6 rows for header, handles Last,First vs split columns, sheet name Block N fallback, createMany skipDuplicates:500/batch. Courses hardcoded to 5.
-POST /api/assessments:136 — creates Assessment + N Payment(UNPAID) rows. Fails if 0 matching students. No idempotency — duplicate purpose creates duplicate assessments (will hit Payment[studentId,assessmentId] unique only per-assessment, so duplicates allowed).
-PATCH /api/payments/:id/mark-paid:153 — $transaction: Payment->PAID + LedgerEntry CREDIT. 404/409 on missing/already-paid.
-POST /api/expenses:165 — multer.disk receipts (jpeg/png/webp/pdf, 8MB), zod validate else unlinkSync. $transaction: Expense + LedgerEntry DEBIT.
-GET /api/expenses/:id/receipt:178 — sendFile with only auth, no role check — any logged-in user can fetch any receipt.
-GET /api/audit/summary:184 (auditor-only) vs GET /api/dashboard/summary:195 (any auth) — credits/debits aggregates, paid/unpaid counts, recent 8 ledger entries.
-POST /api/audit/cash-count:208, POST /api/audit/submissions:214 — payment-list reconcile: fuzzy contains name match (take:2), checks PAYMENT_STATUS_MISMATCH, AMOUNT_MISMATCH, DUPLICATE, NOT_ON_ROSTER. Amount parse replace(/[^\d.]/g).
-Error handler index.ts:260 — masks 500s, leaks error.message for 4xx.

5. Frontend
-login/page.tsx:24 — checks localStorage campus-ledger-token via /api/auth/me, redirects by role. No httpOnly cookie, XSS-vulnerable by design.
-DashboardView.tsx:36 — one component branches on dashboardRole. Role nav DashboardView.tsx:223-227. Session check DashboardView.tsx:120-138: ADMIN forced to treasurer view; auditor forced to auditor view.
-Data: refreshLiveData:84 — 5 parallel apiRequest, then per-assessment payments fetch. Maps Prisma to local Student{id:number,...} with index-based id — fragile. Falls back to seedStudents:19 preview data when offline.
-Actions: markPaid:177 re-fetches payments then matches by split(', ') string compare — breaks on middle names/suffixes. createAssessment:193, addExpense:209 (requires FormData + file), submitImport:140, saveCashCount:152.
-UI: recharts AreaChart trend, tables limited to 6 rows on overview, full tables unpaginated.

6. Key Workflows
1.Seed 364 BSIT Y4 (seed.ts:32) → Import other courses via Excel.
2.Treasurer creates Assessment → N UNPAID payments.
3.Treasurer mark-paid → atomic CREDIT.
4.Treasurer expense + receipt → atomic DEBIT.
5.Auditor: dashboard/summary book balance (credits-debits), cash-count variance, submissions list reconciliation.

7. Strengths
-Atomic money moves via prisma.$transaction.
-Receipt mandatory for debits, served via auth route.
-Role gates on sensitive routes, bootstrap enforces distinct emails + 12-char passwords seed.ts:20-21.
-Duplicate-tolerant imports (skipDuplicates).
-Reconciliation flags 4 distinct mismatch types.
8. Risks / Gaps
-DashboardView.tsx monolith: preview + live logic, magic strings, any types (liveSummary:68, entries:any[]), no pagination — will degrade at 364+ rows.
-Name-based matching fragile both client (markPaid) and server (contains + take:2 in index.ts:241).
-Number(Decimal) throughout (index.ts:192, DashboardView.tsx:76) — precision loss for Decimal(12,2).
-Auth in localStorage, no refresh/ revocation, 8h window.
-CashCount no FK, no GET history route.
-No DELETE/correction flow, no ledger immutability guard, no audit of who edited roster.
-Receipts on local disk uploads/ — no backup, no virus scan, path traversal safe via basename but filename collisions handled only by timestamp+rand.
-GET /api/students, /api/assessments/:id/payments lack pagination/limits.
-ADMIN has no UI — only POST /api/users via curl.
