'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowDownLeft, ArrowDownToLine, ArrowUpRight, BadgeCheck, Bell,
  CalendarDays, Check, ChevronDown, CircleHelp, ClipboardCheck, Clock3, Download, FileCheck2,
  FileSpreadsheet, Filter, LayoutDashboard, Menu, Plus, ReceiptText, Search, ShieldCheck,
  LogOut, Moon, SlidersHorizontal, Sun, User, Users, Wallet, X,
} from 'lucide-react';
import { API_BASE_URL, apiRequest } from '@/lib/api';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

type Course = 'BSIT' | 'EDUC' | 'BSOA' | 'CRIM' | 'CAS';
type Student = { id: number; name: string; course: Course; yearLevel: number; block: string; status: 'paid' | 'unpaid' | 'none'; paidAt?: string; dbId?: string; payments?: Record<string, any> };
type Assessment = { id: number; purpose: string; amount: number; course: string; major: string; yearLevel: number; block: string; due: string; students: number };
type Expense = { id: number; purpose: string; vendor: string; amount: number; date: string; receipt: string };
const courses: Course[] = ['BSIT', 'EDUC', 'BSOA', 'CRIM', 'CAS'];
const courseLogos: Record<Course, string> = { BSIT: '/course-bsit.png', EDUC: '/course-educ.png', BSOA: '/course-bsoa.png', CRIM: '/course-crim.png', CAS: '/course-cas.png' };
const casMajors = ['BA COMM', 'POLSCI'];
const eduMajors = ['BSED', 'BEED'];
const majorsFor = (c: string) => (c === 'CAS' ? casMajors : c === 'EDUC' ? eduMajors : []);
const seedStudents: Student[] = [
  { id: 1, name: 'Agot, Azeel', course: 'BSIT', yearLevel: 4, block: '4', status: 'paid', paidAt: 'Today, 9:42 AM' },
  { id: 2, name: 'Balahay, Ageneth', course: 'BSIT', yearLevel: 4, block: '4', status: 'unpaid' },
  { id: 3, name: 'Bermoy, Ina Marie', course: 'BSIT', yearLevel: 4, block: '4', status: 'paid', paidAt: 'Yesterday' },
  { id: 4, name: 'Boncales, Jona A.', course: 'BSIT', yearLevel: 4, block: '4', status: 'unpaid' },
  { id: 5, name: 'Busalanan, Faye Marie', course: 'BSIT', yearLevel: 4, block: '4', status: 'paid', paidAt: 'Yesterday' },
  { id: 6, name: 'Butal, Mary Claire', course: 'BSIT', yearLevel: 4, block: '4', status: 'unpaid' },
  { id: 7, name: 'Cagoco, Cherry Ann', course: 'BSIT', yearLevel: 4, block: '4', status: 'paid', paidAt: 'Sep 28, 2026' },
  { id: 8, name: 'De La Cruz, Rutchel', course: 'BSIT', yearLevel: 4, block: '4', status: 'unpaid' },
  { id: 9, name: 'Evangelista, Chamel', course: 'BSIT', yearLevel: 4, block: '4', status: 'paid', paidAt: 'Sep 27, 2026' },
  { id: 10, name: 'Galicia, Fritzel', course: 'BSIT', yearLevel: 4, block: '4', status: 'unpaid' },
];
const initialAssessment: Assessment = { id: 1, purpose: 'Pictorial', amount: 1850, course: 'BSIT', major: '', yearLevel: 4, block: '4', due: 'Oct 20, 2026', students: 40 };
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);

export default function AuditorView() {
  const dashboardRole = 'AUDITOR' as const;
  const router = useRouter();
  const [page, setPage] = useState('Overview');
  const [course, setCourse] = useState<Course>('BSIT');
  const [major, setMajor] = useState('');
  const [yearLevel] = useState('4');
  const [block, setBlock] = useState('4');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState(seedStudents);
  const [assessments, setAssessments] = useState([initialAssessment]);
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: 1, purpose: 'Venue reservation', vendor: 'CCS Activity Center', amount: 3500, date: 'Sep 29, 2026', receipt: 'Official receipt.pdf' },
    { id: 2, purpose: 'Printing and materials', vendor: 'J & M Printshop', amount: 1240, date: 'Sep 26, 2026', receipt: 'Receipt_0926.jpg' },
  ]);
  const [modal, setModal] = useState<'assessment' | 'expense' | 'cash' | 'import' | null>(null);
  const [toast, setToast] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [assessmentForm, setAssessmentForm] = useState({ purpose: '', amount: '', due: '', course: '' as string, yearLevel: '4', major: '', block: '4' });
  const [expenseForm, setExpenseForm] = useState({ purpose: '', vendor: '', amount: '', date: new Date().toISOString().slice(0, 10), receipt: '' });
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [dark, setDark] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [profileDraft, setProfileDraft] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, string>>({});
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [importFile, setImportFile] = useState('');
  const [importKind, setImportKind] = useState<'roster' | 'payment-list'>('roster');
  const [importBlock, setImportBlock] = useState('4');
  const [importUpload, setImportUpload] = useState<File | null>(null);
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);
  const [apiToken, setApiToken] = useState('');
  const [accountName, setAccountName] = useState('');
  const [sessionRole, setSessionRole] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [liveSummary, setLiveSummary] = useState<any>(null);
  const [liveRecent, setLiveRecent] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const isAuditor = dashboardRole === 'AUDITOR';
  const activeMajor = (course === 'CAS' || course === 'EDUC') ? major : '';
  const visibleStudents = useMemo(() => students.filter(s => s.course === course && s.yearLevel === Number(yearLevel) && s.block === block && (filter === 'all' || s.status === filter) && s.name.toLowerCase().includes(query.toLowerCase())), [students, course, yearLevel, block, filter, query]);
  const selectedStudents = students.filter(s => s.course === course && s.yearLevel === Number(yearLevel) && s.block === block);
  const visibleAssessments = assessments.filter(a => (!a.course || a.course === course) && a.yearLevel === Number(yearLevel) && (!a.block || a.block === block) && ((a.major || '') === '' || activeMajor === '' || (a.major || '') === activeMajor));
  const feeTotal = visibleAssessments.reduce((n, a) => n + a.amount, 0);
  const collected = liveSummary ? Number(liveSummary.totalCredits) : selectedStudents.filter(s => s.status === 'paid').length * (feeTotal || initialAssessment.amount);
  const paidCount = selectedStudents.filter(s => s.status === 'paid').length;
  const sampleRate = selectedStudents.length ? Math.round(paidCount / selectedStudents.length * 100) : 0;
  const unpaidCount = selectedStudents.filter(s => s.status === 'unpaid').length;
  const expensesTotal = liveSummary ? Number(liveSummary.totalDebits) : expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = liveSummary ? Number(liveSummary.bookBalance) : collected - expensesTotal;
  const notifications = useMemo(() => {
    if (!dataReady) return [] as { title: string; detail: string }[];
    const list: { title: string; detail: string }[] = [];
    const scope = `${course}${(course === 'CAS' || course === 'EDUC') && major ? ` ${major}` : ''} · Block ${block}`;
    if (unpaidCount > 0) list.push({ title: `${unpaidCount} students still unpaid`, detail: scope });
    const reviewCount = submissions.reduce((n, s) => n + (s.rows || []).filter((r: any) => r.status !== 'MATCHED').length, 0);
    if (reviewCount > 0) list.push({ title: `${reviewCount} list rows need review`, detail: 'Representative payment lists' });
    if (liveRecent.length > 0) list.push({ title: 'Ledger activity updated', detail: `${liveRecent.length} recent entries` });
    return list;
  }, [dataReady, unpaidCount, course, major, block, submissions, liveRecent]);
  const setNotice = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };

  async function refreshLiveData(token: string, accountRole: 'Treasurer' | 'Auditor' = (isAuditor ? 'Auditor' : 'Treasurer')) {
    try {
      const [studentResult, assessmentResult, expenseResult, summary, submissionResult] = await Promise.all([
        apiRequest<{ students: any[] }>(`/api/students?course=${course}&yearLevel=${yearLevel}&block=${block}${activeMajor ? `&major=${encodeURIComponent(activeMajor)}` : ''}`, token),
        apiRequest<{ assessments: any[] }>('/api/assessments', token),
        apiRequest<{ expenses: any[] }>('/api/expenses', token),
        apiRequest<any>('/api/dashboard/summary', token),
        accountRole === 'Auditor' ? apiRequest<{ submissions: any[] }>('/api/audit/submissions', token) : Promise.resolve({ submissions: [] }),
      ]);
      const visible = assessmentResult.assessments.filter(a => (!a.course || a.course === course) && (a.yearLevel == null || a.yearLevel === Number(yearLevel)) && (!a.block || a.block === block) && ((a.major || '') === '' || activeMajor === '' || (a.major || '') === activeMajor));
      const payLists = await Promise.all(visible.map(async a => ({ id: a.id, payments: (await apiRequest<{ payments: any[] }>(`/api/assessments/${a.id}/payments`, token)).payments })));
      const paymentMap = new Map<string, any>();
      for (const pl of payLists) for (const payment of pl.payments) paymentMap.set(`${payment.studentId}:${pl.id}`, payment);
      setStudents(studentResult.students.map((student, index) => {
        const pays: Record<string, any> = {};
        for (const a of visible) { const found = paymentMap.get(`${student.id}:${a.id}`); if (found) pays[a.id] = found; }
        const relevant = visible.filter(a => pays[a.id]);
        const paidAll = relevant.length > 0 && relevant.every(a => pays[a.id].status === 'PAID');
        return { dbId: student.id, id: index + 1, name: `${student.lastName}, ${student.firstName}`, course: student.course as Course, yearLevel: student.yearLevel, block: student.block, status: visible.length === 0 ? 'none' : (paidAll ? 'paid' : 'unpaid'), payments: pays };
      }));
      setAssessments(assessmentResult.assessments.map(a => ({ id: a.id, purpose: a.purpose, amount: Number(a.amount), course: a.course || '', major: a.major || '', yearLevel: a.yearLevel || 4, block: a.block || '', due: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'No due date', students: a.studentCount })));
      setExpenses(expenseResult.expenses.map(e => ({ id: e.id, purpose: e.purpose, vendor: e.vendor || 'Not specified', amount: Number(e.amount), date: new Date(e.spentAt).toLocaleDateString(), receipt: 'Receipt evidence attached' })));
      setActualCash(summary.latestCashCount === null ? '' : String(summary.latestCashCount));
      setLiveSummary(summary);
      setLiveRecent(summary.recent || []);
      setSubmissions(submissionResult.submissions);
      if (!assessmentResult.assessments.length) setAssessments([]);
      setDataReady(true);
    } catch (error) {
      setStudents([]);
      setAssessments([]);
      setExpenses([]);
      setLiveSummary({ totalCredits: 0, totalDebits: 0, bookBalance: 0, recent: [], latestCashCount: null });
      setDataReady(true);
      setNotice(error instanceof Error ? error.message : 'Could not load the live workspace.');
    }
  }
  useEffect(() => {
    const stored = window.localStorage.getItem('campus-ledger-token');
    if (!stored) { router.replace('/login'); return; }
    void apiRequest<{ user: { role: string; name: string; email?: string } }>('/api/auth/me', stored).then(result => {
      const actualRole = result.user.role;
      const allowed = actualRole === dashboardRole;
      if (!allowed) {
        router.replace(actualRole === 'AUDITOR' ? '/auditor' : '/treasurer');
        return;
      }
      setSessionRole(actualRole);
      setAccountName(result.user.name);
      setAccountEmail(result.user.email || '');
      void loadAvatar(stored);
      setApiToken(stored);
      setSessionReady(true);
    }).catch(() => {
      window.localStorage.removeItem('campus-ledger-token');
      router.replace('/login');
    });
  }, [dashboardRole, router]);
  useEffect(() => {
    if (window.localStorage.getItem('campus-ledger-theme') === 'dark') setDark(true);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    window.localStorage.setItem('campus-ledger-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => { if (apiToken) { setNotifRead(false); void refreshLiveData(apiToken); } }, [apiToken, course, major, yearLevel, block, dashboardRole]);
  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    if (!importUpload) return;
    if (!apiToken) { setNotice('Sign in to save this file to the database. The preview does not import files.'); return; }
    try {
      const body = new FormData(); body.set('file', importUpload); body.set('course', course); body.set('yearLevel', '4'); if (activeMajor) body.set('major', activeMajor); body.set('block', importBlock);
      const route = isAuditor && importKind === 'payment-list' ? '/api/audit/submissions' : '/api/students/import';
      const result = await apiRequest<any>(route, apiToken, { method: 'POST', body });
      setModal(null); setImportUpload(null); setImportFile(''); await refreshLiveData(apiToken);
      setNotice(importKind === 'payment-list' ? `List reviewed: ${result.rows} rows · ${result.review} need attention.` : `Roster imported: ${result.added} added · ${result.skipped} duplicates skipped · ${result.enrolled ?? 0} fee records.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'File could not be imported.'); }
  }
  async function saveCashCount(event: React.FormEvent) {
    event.preventDefault();
    if (!actualCash.trim()) return;
    if (apiToken) {
      try {
        await apiRequest('/api/audit/cash-count', apiToken, { method: 'POST', body: JSON.stringify({ amount: Number(actualCash), note: auditNote }) });
        await refreshLiveData(apiToken); setNotice(`Cash count saved · variance ${money(Number(actualCash) - balance)}`); setModal(null); return;
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Cash count could not be saved.'); return; }
    }
    setModal(null); setNotice(`Preview cash count saved · variance ${money(Number(actualCash) - balance)}`); setAuditNote('');
  }
  async function openReceipt(id: number, filename: string) {
    if (!apiToken) { setNotice(`Sample receipt: ${filename}`); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/expenses/${id}/receipt`, { headers: { Authorization: `Bearer ${apiToken}` } });
      if (!response.ok) throw new Error('Receipt could not be opened.');
      const url = URL.createObjectURL(await response.blob()); window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Receipt could not be opened.'); }
  }
  function signOut() {
    window.localStorage.removeItem('campus-ledger-token');
    router.replace('/login');
  }
  async function exportCSV(scope: 'view' | 'department' | 'all') {
    setExportOpen(false);
    if (!apiToken) { setNotice('Sign in to export the list.'); return; }
    try {
      setNotice('Preparing CSV export…');
      const deptCourses = scope === 'all' ? courses : [course];
      const inScope = scope === 'view'
        ? visibleAssessments
        : assessments.filter(a => a.yearLevel === 4 && (scope === 'all' || !a.course || a.course === course) && ((a.major || '') === '' || activeMajor === '' || (a.major || '') === activeMajor));
      const payCache = new Map<string, any[]>();
      const getPays = async (id: string) => {
        if (!payCache.has(id)) payCache.set(id, (await apiRequest<{ payments: any[] }>(`/api/assessments/${id}/payments`, apiToken)).payments);
        return payCache.get(id)!;
      };
      for (const a of inScope) await getPays(String(a.id));
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['Last Name', 'First Name', 'Course', 'Major', 'Block', 'Year Level', ...inScope.flatMap(a => { const label = String(a.purpose).replace(/,/g, ';'); return [label, `${label} OR #`]; }), 'Total Paid', 'Total Due'];
      const lines = [head.map(esc).join(',')];
      let totalRows = 0;
      for (const c of deptCourses) {
        const cm = c === 'CAS' || c === 'EDUC' ? major : '';
        const st = await apiRequest<{ students: any[] }>(`/api/students?course=${c}&yearLevel=4${cm ? `&major=${encodeURIComponent(cm)}` : ''}`, apiToken);
        const fees = inScope.filter(a => !a.course || a.course === c);
        for (const student of st.students) {
          const cells = [student.lastName, student.firstName, student.course, student.major || '', student.block, student.yearLevel];
          let paid = 0;
          let due = 0;
          for (const a of fees) {
            const p = (payCache.get(String(a.id)) || []).find((x: any) => x.studentId === student.id);
            const isPaid = p?.status === 'PAID';
            if (isPaid) paid += Number(a.amount);
            due += Number(a.amount);
            cells.push(p ? (isPaid ? 'Paid' : 'Unpaid') : 'No record');
            cells.push(p?.reference ?? '');
          }
          if (scope === 'view' && String(student.block) !== String(block)) continue;
          cells.push(paid, due);
          lines.push(cells.map(esc).join(','));
          totalRows++;
        }
      }
      const scopeName = scope === 'all' ? 'all-departments' : scope === 'department' ? `${course}-all-blocks` : `${course}-block-${block}`;
      const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `graduating-fees-${scopeName}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice(`Exported ${totalRows} students to CSV.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Export failed.'); }
  }  async function loadAvatar(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/avatar`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { setAvatarUrl(''); return; }
      const blob = await response.blob();
      setAvatarUrl(previous => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
    } catch { setAvatarUrl(''); }
  }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const value = profileDraft.trim();
    if (!apiToken) { setNotice('Sign in to update your profile.'); return; }
    if (value.length < 2) { setNotice('Display name needs at least 2 characters.'); return; }
    try {
      const body = new FormData();
      body.set('name', value);
      if (avatarFile) body.set('avatar', avatarFile);
      const result = await apiRequest<{ user: { name: string; hasAvatar: boolean } }>('/api/users/me', apiToken, { method: 'PATCH', body });
      setAccountName(result.user.name);
      setAvatarFile(null);
      if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(''); }
      setShowProfile(false);
      await loadAvatar(apiToken);
      setNotice('Profile updated.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Profile could not be saved.'); }
  }
  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!apiToken) return;
    if (newPw !== confirmPw) { setPwMsg('New passwords do not match.'); return; }
    if (newPw.length < 12) { setPwMsg('New password needs at least 12 characters.'); return; }
    try {
      await apiRequest('/api/users/me/password', apiToken, { method: 'POST', body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      setCurPw(''); setNewPw(''); setConfirmPw(''); setPwMsg('');
      setNotice('Password changed. Use it next time you sign in.');
    } catch (error) { setPwMsg(error instanceof Error ? error.message : 'Password could not be changed.'); }
  }
  function onAvatarPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { event.currentTarget.value = ''; setNotice('Choose a JPG, PNG, or WEBP picture.'); return; }
    if (file && file.size > 2 * 1024 * 1024) { event.currentTarget.value = ''; setNotice('Picture must be under 2 MB.'); return; }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : '');
  }

  async function togglePayment(studentId: number, assessmentId: number) {
    const student = students.find(s => s.id === studentId);
    const assessment = visibleAssessments.find(a => a.id === assessmentId);
    if (!student || !assessment) return;
    if (!apiToken) { setNotice('Sign in to record payments.'); return; }
    if (isAuditor) return;
    const payment = student.payments?.[assessment.id];
    if (!payment) { setNotice(visibleAssessments.length ? `No payment record for ${student.name} · ${assessment.purpose}.` : 'Create an assessment for this course and block before recording payments.'); return; }
    try {
      const turningPaid = payment.status !== 'PAID';
      const draft = String(receiptDrafts[payment.id] ?? payment.reference ?? '').trim();
      if (turningPaid && !/^\d{4}$/.test(draft)) { setNotice('Enter the 4-digit receipt number before marking paid.'); return; }
      await apiRequest(`/api/payments/${payment.id}/${turningPaid ? 'mark-paid' : 'mark-unpaid'}`, apiToken, { method: 'PATCH', body: JSON.stringify(turningPaid ? { reference: draft } : {}) });
      setReceiptDrafts(prev => { const next = { ...prev }; delete next[payment.id]; return next; });
      await refreshLiveData(apiToken);
      setNotice(`${student.name} · ${assessment.purpose} marked ${turningPaid ? 'paid. Ledger credit recorded.' : 'unpaid. Ledger credit removed.'}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Payment could not be saved.'); }
  }
  async function saveReceipt(paymentId: string) {
    const draft = String(receiptDrafts[paymentId] ?? '').trim();
    if (!/^\d{4}$/.test(draft)) { setNotice('Receipt number must be exactly 4 digits.'); return; }
    if (!apiToken) { setNotice('Sign in to save receipt numbers.'); return; }
    try {
      await apiRequest(`/api/payments/${paymentId}/receipt`, apiToken, { method: 'PATCH', body: JSON.stringify({ receipt: draft }) });
      await refreshLiveData(apiToken);
      setNotice(`Receipt #${draft} saved.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Receipt number could not be saved.'); }
  }
  function shortFee(purpose: string) { const word = purpose.trim().split(/\s+/).pop() || purpose; return word.charAt(0).toUpperCase() + word.slice(1); }
  function feeProgress(student: Student) {
    const total = visibleAssessments.length;
    const paidList = visibleAssessments.filter(a => student.payments?.[a.id]?.status === 'PAID');
    const sum = paidList.reduce((n, a) => n + a.amount, 0);
    return { total, count: paidList.length, sum, pct: total ? Math.round((paidList.length / total) * 100) : 0 };
  }
  function feeRows(student: Student) {
    return <div className="assess-list">{visibleAssessments.map(a => {
      const payment = student.payments?.[a.id];
      const paid = payment?.status === 'PAID';
      return <div className="fee-row" key={a.id}><div className="fee-info"><strong>{a.purpose}</strong><span>{money(a.amount)} · {paid ? 'Paid' : 'Unpaid'}{paid && payment?.reference ? ` · OR #${payment.reference}` : ''}</span></div>{payment ? <div className="fee-action"><input className="receipt-input" value={receiptDrafts[payment.id] ?? payment.reference ?? ''} onChange={e => setReceiptDrafts(prev => ({ ...prev, [payment.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="OR #" inputMode="numeric" maxLength={4} aria-label={`Receipt number for ${student.name} ${a.purpose}`} /><button className="fee-btn receipt-save" onClick={() => saveReceipt(payment.id)}>Save</button><span className={`fee-btn static ${paid ? 'paid' : 'unpaid'}`}>{paid ? 'Paid' : 'Unpaid'}</span></div> : <span className={`fee-btn static ${paid ? 'paid' : 'unpaid'}`}>{paid ? 'Paid' : 'Unpaid'}</span>}</div>;
    })}{visibleAssessments.length === 0 && <div className="empty-inline">No fees yet.</div>}</div>;
  }
  async function createAssessment(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(assessmentForm.amount);
    if (!assessmentForm.purpose.trim() || !amount || amount < 1) return;
    if (apiToken) {
      try {
        const created = await apiRequest<{ studentsAdded: number }>('/api/assessments', apiToken, { method: 'POST', body: JSON.stringify({ purpose: assessmentForm.purpose.trim(), amount, course: assessmentForm.course || undefined, major: assessmentForm.major || undefined, yearLevel: 4, block: assessmentForm.block || undefined, dueDate: assessmentForm.due || undefined }) });
        setModal(null); setAssessmentForm({ purpose: '', amount: '', due: '', course, yearLevel: '4', major: '', block: '4' }); await refreshLiveData(apiToken);
        setNotice(`Assessment created for ${created.studentsAdded} students.`); return;
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Assessment could not be created.'); return; }
    }
    setAssessments(prev => [{ id: Date.now(), purpose: assessmentForm.purpose.trim(), amount, course: assessmentForm.course || 'BSIT', major: assessmentForm.major, yearLevel: Number(assessmentForm.yearLevel), block: assessmentForm.block, due: assessmentForm.due || 'No due date', students: assessmentForm.course === 'BSIT' && assessmentForm.yearLevel === '4' ? (assessmentForm.block ? (Number(assessmentForm.block) < 6 ? 40 : 41) : 364) : 0 }, ...prev]);
    if (assessmentForm.course === 'BSIT' && assessmentForm.block === '4') setBlock('4');
    setModal(null); setAssessmentForm({ purpose: '', amount: '', due: '', course: 'BSIT', yearLevel: '4', major: '', block: '4' });
    setNotice('Assessment created and added to the student list');
  }
  async function addExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!expenseForm.purpose || !Number(expenseForm.amount) || !expenseForm.receipt) return;
    if (apiToken && expenseReceiptFile) {
      try {
        const body = new FormData(); body.set('purpose', expenseForm.purpose); body.set('vendor', expenseForm.vendor); body.set('amount', expenseForm.amount); body.set('spentAt', expenseForm.date); body.set('receipt', expenseReceiptFile);
        await apiRequest('/api/expenses', apiToken, { method: 'POST', body });
        setModal(null); setExpenseReceiptFile(null); setExpenseForm({ purpose: '', vendor: '', amount: '', date: new Date().toISOString().slice(0, 10), receipt: '' }); await refreshLiveData(apiToken); setNotice('Expense and receipt saved to the ledger.'); return;
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Expense could not be saved.'); return; }
    }
    setExpenses(prev => [{ id: Date.now(), purpose: expenseForm.purpose, vendor: expenseForm.vendor || 'Not specified', amount: Number(expenseForm.amount), date: new Date(expenseForm.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), receipt: expenseForm.receipt }, ...prev]);
    setModal(null); setExpenseForm({ purpose: '', vendor: '', amount: '', date: new Date().toISOString().slice(0, 10), receipt: '' });
    setNotice('Expense recorded with receipt evidence');
  }
  const nav = isAuditor ? [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Audit trail', icon: Activity }, { label: 'Collections', icon: Wallet }, { label: 'Expenses & receipts', icon: ReceiptText }, { label: 'Payment lists', icon: FileCheck2 },
  ] : [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Collections', icon: Wallet }, { label: 'Assessments', icon: ClipboardCheck }, { label: 'Expenses', icon: ReceiptText },
  ];

  if (!sessionReady || !dataReady) return <main className="session-loading"><div className="session-logos"><img src="/tmc-logo.png" alt="Trinidad Municipal College seal" className="app-logo app-logo-small" /><img src="/tmc-graduating-class.png" alt="TMC Graduating Class logo" className="app-logo app-logo-small" /></div><p>{sessionReady ? 'Loading your dashboard…' : 'Checking your account…'}</p></main>;

  const initials = accountName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const accountRoleLabel = sessionRole === 'ADMIN' ? 'Administrator' : isAuditor ? 'Auditor' : 'Treasurer';

  return <main className="app-shell theme-auditor">
    <aside className={`sidebar ${navOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src="/tmc-logo.png" alt="Trinidad Municipal College seal" className="app-logo" /><div className="brand-text"><strong>Trinidad Municipal College</strong><span>Campus Ledger</span></div><img src="/tmc-graduating-class.png" alt="TMC Graduating Class logo" className="app-logo" /><button className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <label className="workspace-select workspace-course"><img src={courseLogos[course]} alt="" className="workspace-logo" /><div><strong>{course} · Year 4</strong><small>TMC Graduating Class · 2026-2027</small></div><select value={course} onChange={e => { setCourse(e.target.value as Course); setMajor(''); }} aria-label="Choose course">{courses.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={15} /></label>
      {(course === 'CAS' || course === 'EDUC') && <label className="workspace-major"><span>Major</span><span className="workspace-major-select"><select value={major} onChange={e => setMajor(e.target.value)}>{['', ...majorsFor(course)].map(m => <option key={m} value={m}>{m === '' ? 'All majors' : m}</option>)}</select><ChevronDown size={14} /></span></label>}
      <div className="nav-section">FINANCE</div>
      <nav className="primary-nav" aria-label="Main navigation">{nav.map(item => <button key={item.label} className={`nav-item ${page === item.label ? 'active' : ''}`} onClick={() => { setPage(item.label); setNavOpen(false); }}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Expenses & receipts' && isAuditor && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="audit-note"><div className="audit-note-icon"><ShieldCheck size={17} /></div><div><strong>Accountability, together.</strong><span>Every peso is traceable.</span></div></div><button className="nav-item help-link" onClick={() => setNotice('Ask your system administrator for account or access help.')}><CircleHelp size={17} /> Help & support</button><div className="profile"><div className={`avatar ${isAuditor ? 'avatar-audit' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="Profile picture" className="avatar-img" /> : initials}</div><div className="profile-copy"><strong>{accountName}</strong><span>{accountRoleLabel} account</span></div></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb">CCS Finance <span>/</span> {page}</div><div className="topbar-actions"><div className="role-preview"><span className="role-preview-label">{accountRoleLabel} · {accountName}</span></div><div className="topbar-menu"><button className="icon-button notification" aria-label="Notifications" aria-expanded={notifOpen} onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); setNotifRead(true); }}><Bell size={19} />{!notifRead && notifications.length > 0 && <i />}</button>{notifOpen && <div className="menu-dropdown notif-dropdown"><div className="menu-heading"><strong>Notifications</strong><span>{notifications.length ? `${notifications.length} new` : 'None'}</span></div>{notifications.length ? notifications.map((n, i) => <div className="notif-row" key={i}><span className="notif-dot" /><div><strong>{n.title}</strong><span>{n.detail}</span></div></div>) : <div className="notif-empty"><Bell size={18} /><p>You are all caught up.</p></div>}</div>}</div><div className="topbar-menu"><button className="top-avatar avatar-button" onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }} aria-label="Account menu" aria-expanded={profileOpen}>{avatarUrl ? <img src={avatarUrl} alt="Profile picture" className="avatar-img" /> : initials}</button>{profileOpen && <div className="menu-dropdown profile-dropdown"><div className="menu-profile"><div className="top-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile picture" className="avatar-img" /> : initials}</div><div><strong>{accountName}</strong><span>{accountEmail || `${accountRoleLabel} account`}</span></div></div><button className="menu-item" onClick={() => { setProfileOpen(false); setProfileDraft(accountName); setAvatarFile(null); if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(''); } setCurPw(''); setNewPw(''); setConfirmPw(''); setPwMsg(''); setShowProfile(true); }}><User size={15} /> Change profile</button><button className="menu-item menu-theme" onClick={() => setDark(v => !v)} aria-pressed={dark}><span className="menu-theme-label">{dark ? <Moon size={15} /> : <Sun size={15} />} {dark ? 'Dark mode' : 'Light mode'}</span><span className={`switch ${dark ? 'switch-on' : ''}`}><i /></span></button><div className="menu-divider" /><button className="menu-item menu-danger" onClick={signOut}><LogOut size={15} /> Log out</button></div>}</div></div>{(profileOpen || notifOpen || exportOpen) && <button className="menu-scrim" aria-hidden="true" tabIndex={-1} onClick={() => { setProfileOpen(false); setNotifOpen(false); setExportOpen(false); }} />}</header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{isAuditor ? 'AUDIT WORKSPACE' : 'TREASURER WORKSPACE'} <span className="live-pill"><i /> {apiToken ? 'LIVE DATABASE' : 'SAMPLE DATA'}</span></div><h1>{page === 'Overview' ? `Hello, ${accountName.split(/\s+/)[0] || 'Auditor'}` : page} {page === 'Overview' && !isAuditor && <span className="wave">✦</span>}</h1><p>{page === 'Overview' ? (isAuditor ? 'A clear view of collections, expenses, and cash on hand.' : 'Here’s the latest on your student collections.') : sectionSubtitle(page, isAuditor)}</p></div><div className="heading-actions">{isAuditor && <button className="button button-light" onClick={() => { setImportKind('roster'); setImportBlock(block); setModal('import'); }}><FileSpreadsheet size={16} /> Import roster</button>}{!isAuditor && <button className="button button-primary" onClick={() => { setAssessmentForm(f => ({ ...f, course, yearLevel: '4', major: (course === 'CAS' || course === 'EDUC') ? major : '' })); setModal('assessment'); }}><Plus size={17} /> New assessment</button>}{isAuditor && <button className="button button-light" onClick={() => setModal('cash')}><Wallet size={16} /> Count cash</button>}</div></div>

        {page === 'Overview' && <>
          <div className="summary-grid">
            <article className="summary-card"><div className="summary-top"><span className="summary-label">{isAuditor ? 'BOOK BALANCE' : 'TOTAL COLLECTED'}</span><span className="summary-icon icon-green"><Wallet size={18} /></span></div><div className="summary-value">{money(isAuditor ? balance : collected)}</div><div className="summary-foot"><span className="trend-positive"><ArrowUpRight size={14} /> {apiToken ? 'Ledger' : 'Sample'}</span><span>recent activity</span></div><div className="card-spark green-spark"><FundTrendChart entries={apiToken ? liveRecent : []} /></div></article>
            <article className="summary-card"><div className="summary-top"><span className="summary-label">{isAuditor ? 'TOTAL CREDITS' : 'PAID STUDENTS'}</span><span className="summary-icon icon-blue"><Users size={18} /></span></div><div className="summary-value">{isAuditor ? money(collected) : paidCount}<small>{!isAuditor && <span> / {students.length}</span>}</small></div><div className="summary-foot"><span className="foot-strong">{isAuditor ? 'From student payments' : `${sampleRate}% of preview records`}</span></div><div className="progress-track"><div className="progress-fill blue-fill" style={{ width: `${sampleRate}%` }} /></div></article>
            <article className="summary-card"><div className="summary-top"><span className="summary-label">{isAuditor ? 'TOTAL DEBITS' : 'STILL UNPAID'}</span><span className={`summary-icon ${isAuditor ? 'icon-amber' : 'icon-red'}`}>{isAuditor ? <ArrowDownLeft size={18} /> : <Clock3 size={18} />}</span></div><div className="summary-value">{isAuditor ? money(expensesTotal) : unpaidCount}<small>{!isAuditor && <span> shown</span>}</small></div><div className="summary-foot"><span className={isAuditor ? 'foot-strong' : 'status-text-unpaid'}>{isAuditor ? `${expenses.length} documented expenses` : 'Needs follow-up'}</span><span>{!isAuditor && `${100 - sampleRate}%`}</span></div><div className="progress-track"><div className="progress-fill red-fill" style={{ width: `${100 - sampleRate}%` }} /></div></article>
            <article className="summary-card"><div className="summary-top"><span className="summary-label">{isAuditor ? 'CASH VARIANCE' : 'ACTIVE ASSESSMENT'}</span><span className="summary-icon icon-purple">{isAuditor ? <Activity size={18} /> : <ClipboardCheck size={18} />}</span></div><div className="summary-value">{isAuditor ? (actualCash ? money(Number(actualCash) - balance) : '—') : money(1850)}</div><div className="summary-foot"><span className="foot-strong">{isAuditor ? (actualCash ? 'Compared with book balance' : 'Record a count to compare') : 'Pictorial'}</span></div></article>
          </div>

          <div className="content-grid">
            <section className="panel collections-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>{isAuditor ? 'Collection check' : 'Student collections'}</h2><span className="count-chip">{course === 'BSIT' && yearLevel === '4' ? '364 rostered' : apiToken ? `${students.length} in selection` : 'Roster pending'}</span></div><p>{isAuditor ? 'Review payment status against the selected assessment.' : 'Track payments for the workspace course and block.'}</p></div><button className="text-button" onClick={() => setPage(isAuditor ? 'Collections' : 'Collections')}>View all <ArrowUpRight size={15} /></button></div>
              <div className="filters-row"><div className="filter-controls"><span className="course-chip"><img src={courseLogos[course]} alt="" className="chip-logo" />{course}{(course === 'CAS' || course === 'EDUC') && major ? ` · ${major}` : ''} · Year 4</span><label className="select-wrap"><span className="sr-only">Block</span><select value={block} onChange={e => setBlock(e.target.value)}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Block {i + 1}</option>)}</select><ChevronDown size={14} /></label><label className="search-wrap"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a student" /></label><button className="filter-button" onClick={() => setFilter(f => f === 'all' ? 'unpaid' : f === 'unpaid' ? 'paid' : 'all')} title={`Filter: ${filter}`}><Filter size={16} /><span>{filter === 'all' ? 'Filter' : filter === 'unpaid' ? 'Unpaid' : 'Paid'}</span></button></div></div>
              {course === 'BSIT' || (apiToken && students.length > 0) ? <div className="table-wrap"><table className="student-table"><thead><tr><th>STUDENT</th><th>COURSE & BLOCK</th><th>Payment progress</th></tr></thead><tbody>{visibleStudents.slice(0, 6).map(student => <Fragment key={student.id}><tr className={expandedId === student.id ? 'row-open' : ''}><td><button className="student-opener" onClick={() => setExpandedId(v => (v === student.id ? null : student.id))} aria-expanded={expandedId === student.id} aria-label={`Payment details for ${student.name}`}><div className="student-cell"><div className="student-avatar">{student.name.split(/[ ,]+/).map(n => n[0]).slice(0, 2).join('')}</div><div><strong>{student.name}</strong><span>CCS · Year {student.yearLevel}</span></div><ChevronDown size={15} /></div></button></td><td><span className="course-block">{student.course}</span><span className="block-muted">Block {student.block}</span></td><td>{(() => { const p = feeProgress(student); return <button className="progress-opener" onClick={() => setExpandedId(v => (v === student.id ? null : student.id))} aria-expanded={expandedId === student.id} aria-label={`Payment progress for ${student.name}`}><span>{p.count}/{p.total} paid · {money(p.sum)}</span><span className="progress-track"><span className="progress-fill blue-fill" style={{ width: `${p.pct}%` }} /></span></button>; })()}</td></tr>{expandedId === student.id && <tr className="assess-drop"><td colSpan={3}>{feeRows(student)}</td></tr>}</Fragment>)}</tbody></table>{visibleStudents.length === 0 && <div className="empty-inline">No students match this filter.</div>}</div> : <div className="course-empty"><div className="empty-icon"><Users size={21} /></div><div><strong>{course} roster is not imported yet</strong><span>Import the course list when it’s ready. This course is ready for its first roster.</span></div>{isAuditor && <button className="button button-light button-small" onClick={() => { setImportKind('roster'); setImportBlock(block); setModal('import'); }}>Import list</button>}</div>}
              <div className="table-footer"><span>Showing {course === 'BSIT' ? Math.min(visibleStudents.length, 6) : 0} of {apiToken ? `${students.length} live roster entries` : course === 'BSIT' && block === '4' ? '10 preview records · Block ' + block : '0 preview records'}</span><button onClick={() => setPage('Collections')}>Open collection list <ArrowUpRight size={14} /></button></div>
            </section>
            <section className="panel assessment-panel"><div className="panel-heading"><div><h2>{isAuditor ? 'Assessment progress' : 'Active assessments'}</h2><p>{isAuditor ? 'Collection progress by purpose.' : 'Funds collected against each purpose.'}</p></div><button className="more-button" aria-label="More options" onClick={() => setPage('Assessments')}><SlidersHorizontal size={16} /></button></div>
              {assessments.slice(0, 3).map((a, i) => <div className="assessment-item" key={a.id}><div className={`assessment-symbol symbol-${i}`}><ClipboardCheck size={17} /></div><div className="assessment-info"><div className="assessment-line"><strong>{a.purpose}</strong><span>{money(a.amount)}</span></div><div className="assessment-meta">{a.course || 'All departments'}{a.major ? ` · ${a.major}` : ''} · {a.block ? `Block ${a.block}` : 'All blocks'} <span>·</span> Due {a.due}</div><div className="assessment-progress"><div className="assessment-track"><div style={{ width: `${i === 0 ? sampleRate : 46}%` }} /></div><span>{i === 0 ? `${paidCount}/${students.length} preview` : '—'}</span></div></div></div>)}
              <button className="assessment-add" onClick={() => { setAssessmentForm(f => ({ ...f, course, yearLevel: '4', major: (course === 'CAS' || course === 'EDUC') ? major : '' })); setModal('assessment'); }}><Plus size={16} /> Create an assessment</button>
            </section>
          </div>
          <div className="lower-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>{isAuditor ? 'Recent ledger activity' : 'Recent activity'}</h2><p>A traceable record of money in and money out.</p></div><button className="text-button" onClick={() => setPage('Audit trail')}>View ledger <ArrowUpRight size={15} /></button></div><div className="activity-list">{apiToken ? <RecentEntries entries={liveRecent} /> : <><ActivityRow kind="credit" title="Payment received · Pictorial" subtitle="Agot, Azeel · Block 4 · recorded by Jordan D." amount="+ ₱1,850" time="9:42 AM" /><ActivityRow kind="debit" title="Venue reservation" subtitle="CCS Activity Center · receipt attached" amount="− ₱3,500" time="Yesterday" /><ActivityRow kind="credit" title="Payment received · Pictorial" subtitle="Bermoy, Ina Marie · Block 4" amount="+ ₱1,850" time="Yesterday" /></>}</div></section>
          <section className="panel balance-panel"><div className="panel-heading"><div><h2>Fund position</h2><p>Recorded credits and debits to date.</p></div><div className="balance-icon"><Activity size={17} /></div></div><div className="balance-number">{money(balance)}</div><span className="balance-caption">Current book balance</span><div className="balance-breakdown"><div><span><i className="legend-dot credit-dot" />Money collected</span><strong>{money(collected)}</strong></div><div><span><i className="legend-dot debit-dot" />Expenses recorded</span><strong>− {money(expensesTotal)}</strong></div></div><div className="balance-progress"><span style={{ width: `${collected ? Math.max(7, (expensesTotal / collected) * 100) : 0}%` }} /></div><div className="balance-foot"><span>Expenses as share of credits</span><strong>{collected ? Math.round(expensesTotal / collected * 100) : 0}%</strong></div></section></div>
          {isAuditor && <section className="panel audit-shortcut"><div className="audit-shortcut-copy"><div className="audit-shortcut-icon"><ShieldCheck size={19} /></div><div><strong>Ready to reconcile?</strong><span>Compare the ledger balance to physical cash and review submitted payment lists.</span></div></div><div className="shortcut-actions"><button className="button button-light" onClick={() => setModal('cash')}><Wallet size={16} /> Count actual cash</button><button className="button button-primary" onClick={() => setPage('Payment lists')}><FileCheck2 size={16} /> Review payment lists</button></div></section>}
        </>}

        {page === 'Collections' && <section className="panel full-panel"><div className="panel-heading"><div><h2>{isAuditor ? 'Payment records' : 'Collections by student'}</h2><p>Filter by block and payment status. Course is chosen in the workspace.</p></div><div className="heading-actions compact"><div className="topbar-menu"><button className="button button-light button-small" onClick={() => setExportOpen(v => !v)} aria-expanded={exportOpen} aria-label="Export list"><Download size={14} /> Export CSV</button>{exportOpen && <div className="menu-dropdown export-dropdown"><button className="menu-item" onClick={() => exportCSV('view')}>This block · {course} Block {block}</button><button className="menu-item" onClick={() => exportCSV('department')}>Whole department · {course} all blocks</button><button className="menu-item" onClick={() => exportCSV('all')}>All departments · Year 4</button></div>}</div><span className="course-chip"><img src={courseLogos[course]} alt="" className="chip-logo" />{course}{(course === 'CAS' || course === 'EDUC') && major ? ` · ${major}` : ''} · Year 4</span><label className="select-wrap"><select aria-label="Block" value={block} onChange={e => setBlock(e.target.value)}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Block {i + 1}</option>)}</select><ChevronDown size={14} /></label></div></div><div className="filters-row full-filters"><div className="course-pills">{(['all', 'unpaid', 'paid'] as const).map(f => <button key={f} className={`course-pill ${filter === f ? 'course-active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All students' : f[0].toUpperCase() + f.slice(1)}</button>)}</div><label className="search-wrap"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names" /></label></div>{course === 'BSIT' || (apiToken && students.length > 0) ? <div className="table-wrap"><table className="student-table"><thead><tr><th>STUDENT</th><th>COURSE & BLOCK</th><th>PAYMENT PROGRESS</th></tr></thead><tbody>{visibleStudents.map(s => <Fragment key={s.id}><tr className={expandedId === s.id ? 'row-open' : ''}><td><button className="student-opener" onClick={() => setExpandedId(v => (v === s.id ? null : s.id))} aria-expanded={expandedId === s.id} aria-label={`Payment details for ${s.name}`}><strong>{s.name}</strong><ChevronDown size={15} /></button></td><td>{s.course} · Block {s.block}</td><td>{(() => { const p = feeProgress(s); return <button className="progress-opener" onClick={() => setExpandedId(v => (v === s.id ? null : s.id))} aria-expanded={expandedId === s.id} aria-label={`Payment progress for ${s.name}`}><span>{p.count}/{p.total} paid · {money(p.sum)}</span><span className="progress-track"><span className="progress-fill blue-fill" style={{ width: `${p.pct}%` }} /></span></button>; })()}</td></tr>{expandedId === s.id && <tr className="assess-drop"><td colSpan={3}>{feeRows(s)}</td></tr>}</Fragment>)}</tbody></table></div> : <div className="empty-state">No {course} student list has been imported yet. Import the roster when your course list arrives.</div>}</section>}
        {page === 'Assessments' && <section className="panel full-panel"><div className="panel-heading"><div><h2>Assessments</h2><p>Every assessment automatically creates one student payment record per roster entry.</p></div>{!isAuditor && <button className="button button-primary" onClick={() => { setAssessmentForm(f => ({ ...f, course, yearLevel: '4', major: (course === 'CAS' || course === 'EDUC') ? major : '' })); setModal('assessment'); }}><Plus size={17} /> New assessment</button>}</div><div className="assessment-cards">{assessments.map(a => <article className="assessment-card" key={a.id}><div className="assessment-card-head"><div className="assessment-symbol"><ClipboardCheck size={17} /></div><span className="live-pill"><i /> ACTIVE</span></div><h3>{a.purpose}</h3><div className="assessment-card-amount">{money(a.amount)} <span>per student</span></div><div className="assessment-card-meta">{a.course || 'All departments'}{a.major ? ` · ${a.major}` : ''} · {a.block ? `Block ${a.block}` : 'All blocks'} · {a.students} students · Due {a.due}</div><div className="assessment-progress"><div className="assessment-track"><div style={{ width: '70%' }} /></div><span>28 / 40 paid</span></div></article>)}</div></section>}
        {(page === 'Expenses' || page === 'Expenses & receipts') && <section className="panel full-panel"><div className="panel-heading"><div><h2>{isAuditor ? 'Expenses & receipt review' : 'Expense records'}</h2><p>Every debit is linked to its receipt evidence.</p></div>{!isAuditor && <button className="button button-primary" onClick={() => setModal('expense')}><Plus size={17} /> Record expense</button>}</div><div className="expense-totals"><div><span>Total documented expenses</span><strong>{money(expensesTotal)}</strong></div><span className="status-badge paid"><i /> {expenses.length} receipts attached</span></div><div className="expense-list">{expenses.map(e => <div className="expense-row" key={e.id}><div className="receipt-thumb"><ReceiptText size={19} /></div><div className="expense-copy"><strong>{e.purpose}</strong><span>{e.vendor} · {e.date}</span></div><strong className="expense-amount">− {money(e.amount)}</strong><button className="button button-light button-small" onClick={() => openReceipt(e.id, e.receipt)}><FileCheck2 size={15} /> View receipt</button></div>)}</div></section>}
        {page === 'Audit trail' && <section className="panel full-panel"><div className="panel-heading"><div><h2>Ledger activity</h2><p>Chronological record of every credit and debit.</p></div><span className="count-chip">{apiToken ? liveRecent.length : students.filter(s => s.status === 'paid').length + expenses.length} latest entries</span></div><div className="audit-summary-strip"><div><span>Credits</span><strong className="text-credit">{money(collected)}</strong></div><div><span>Debits</span><strong className="text-debit">− {money(expensesTotal)}</strong></div><div><span>Book balance</span><strong>{money(balance)}</strong></div></div><div className="activity-list activity-full">{apiToken ? <RecentEntries entries={liveRecent} /> : <><ActivityRow kind="credit" title="Payment received · Pictorial" subtitle="Agot, Azeel · Block 4 · Treasurer: Jordan D." amount="+ ₱1,850" time="Today, 9:42 AM" /><ActivityRow kind="debit" title="Venue reservation" subtitle="CCS Activity Center · Receipt attached" amount="− ₱3,500" time="Sep 29, 2026" /><ActivityRow kind="credit" title="Payment received · Pictorial" subtitle="Bermoy, Ina Marie · Block 4 · Treasurer: Jordan D." amount="+ ₱1,850" time="Sep 29, 2026" /></>}</div></section>}
        {page === 'Payment lists' && <section className="panel full-panel"><div className="panel-heading"><div><h2>Submitted payment lists</h2><p>Compare mayor and representative lists with the official roster and ledger.</p></div><button className="button button-primary" onClick={() => { setImportKind('payment-list'); setModal('import'); }}><ArrowDownToLine size={16} /> Import a list</button></div>{submissions.length ? <div className="submission-list">{submissions.map(submission => <article className="submission-card" key={submission.id}><div className="submission-heading"><div><strong>{submission.sourceName}</strong><span>Uploaded {new Date(submission.uploadedAt).toLocaleString()} · {submission.rows.length} rows</span></div><span className="count-chip">{submission.rows.filter((row: any) => row.status !== 'MATCHED').length} to review</span></div><div className="table-wrap"><table className="student-table"><thead><tr><th>STUDENT</th><th>COURSE / BLOCK</th><th>REPORTED AMOUNT</th><th>RESULT</th><th>REVIEW NOTE</th></tr></thead><tbody>{submission.rows.map((row: any) => <tr key={row.id}><td>{row.studentName}</td><td>{row.course}{row.major ? ` · ${row.major}` : ''}{row.block ? ` · Block ${row.block}` : ''}</td><td>{row.reportedAmount ? money(Number(row.reportedAmount)) : '—'}</td><td><span className={`status-badge ${row.status === 'MATCHED' ? 'paid' : 'unpaid'}`}><i />{row.status.replaceAll('_', ' ').toLowerCase()}</span></td><td>{row.details}</td></tr>)}</tbody></table></div></article>)}</div> : <div className="reconcile-empty"><div className="empty-icon"><FileCheck2 size={22} /></div><h3>No lists submitted yet</h3><p>Upload a payment list from a course mayor or representative to flag names that do not match the roster or ledger.</p><button className="button button-light" onClick={() => { setImportKind('payment-list'); setModal('import'); }}>Choose a payment list</button></div>}<div className="reconcile-hint"><BadgeCheck size={17} /><span>Rows are matched by student name, course, block, and amount. Possible duplicates and mismatches are sent for review.</span></div></section>}
      </div>
      <footer className="page-footer"><span>Campus Ledger <i /> CCS Finance · Academic Year 2026–2027</span><span><ShieldCheck size={14} /> Role-based access enabled</span></footer>
    </section>

    {showProfile && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowProfile(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-heading"><div><span className="eyebrow">ACCOUNT</span><h2 id="profile-title">Change profile</h2></div><button className="icon-button" onClick={() => setShowProfile(false)} aria-label="Close"><X size={19} /></button></div><div className="avatar-edit"><div className="avatar-preview">{avatarPreview ? <img src={avatarPreview} alt="New picture preview" /> : avatarUrl ? <img src={avatarUrl} alt="Profile picture" /> : <span>{initials}</span>}</div><div><label className="button button-light button-small avatar-upload">Upload picture<input key={showProfile ? 'open' : 'closed'} type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatarPick} /></label>{avatarFile && <div className="avatar-file">{avatarFile.name} will be saved with your profile.</div>}</div></div><form className="modal-form" onSubmit={saveProfile}><label>Display name (username)<input required autoFocus value={profileDraft} onChange={e => setProfileDraft(e.target.value)} placeholder="Your name" maxLength={60} /></label><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowProfile(false)}>Cancel</button><button className="button button-primary" type="submit">Save changes</button></div></form><div className="modal-divider" /><form className="modal-form" onSubmit={savePassword}><label>Current password<input type="password" required autoComplete="current-password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Enter current password" /></label><div className="form-row"><label>New password (min 12 characters)<input type="password" required autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password" /></label><label>Confirm new password<input type="password" required autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" /></label></div>{pwMsg && <p className="login-error" role="alert">{pwMsg}</p>}<div className="modal-actions"><span /><button className="button button-primary" type="submit">Change password</button></div></form></section></div>}
    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">{modal === 'assessment' ? 'COLLECTION SETUP' : modal === 'expense' ? 'OUTGOING FUNDS' : modal === 'cash' ? 'PHYSICAL RECONCILIATION' : 'ROSTER & REPORTS'}</span><h2 id="modal-title">{modal === 'assessment' ? 'Create an assessment' : modal === 'expense' ? 'Record an expense' : modal === 'cash' ? 'Count actual cash' : 'Import a spreadsheet'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div>
      {modal === 'assessment' && <form className="modal-form" onSubmit={createAssessment}><label>Purpose<input required autoFocus placeholder="e.g. Pictorial" value={assessmentForm.purpose} onChange={e => setAssessmentForm({ ...assessmentForm, purpose: e.target.value })} /></label><label>Amount per student<div className="input-prefix"><span>₱</span><input required min="1" type="number" placeholder="1,850" value={assessmentForm.amount} onChange={e => setAssessmentForm({ ...assessmentForm, amount: e.target.value })} /></div></label><div className="form-row"><label>Department<select value={assessmentForm.course} onChange={e => setAssessmentForm({ ...assessmentForm, course: e.target.value, major: e.target.value === 'CAS' || e.target.value === 'EDUC' ? assessmentForm.major : '' })}>{['', ...courses].map(c => <option key={c} value={c}>{c === '' ? 'All departments' : c}</option>)}</select></label>{(assessmentForm.course === 'CAS' || assessmentForm.course === 'EDUC') && <label>Major<select value={assessmentForm.major} onChange={e => setAssessmentForm({ ...assessmentForm, major: e.target.value })}><option value="">All majors</option>{majorsFor(assessmentForm.course).map(m => <option key={m} value={m}>{m}</option>)}</select></label>}</div><div className="form-scope"><span>Year 4 · Graduating class · one payment record per active student in scope.</span></div><div className="form-row"><label>Block<select value={assessmentForm.block} onChange={e => setAssessmentForm({ ...assessmentForm, block: e.target.value })}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Block {i + 1}</option>)}<option value="">All blocks</option></select></label><label>Due date<input type="date" value={assessmentForm.due} onChange={e => setAssessmentForm({ ...assessmentForm, due: e.target.value })} /></label></div><div className="form-note"><Users size={16} /><span>This creates a payment record for every active student in the selected course and block. Already paid status starts as <b>unpaid</b>.</span></div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16} /> Create assessment</button></div></form>}
      {modal === 'expense' && <form className="modal-form" onSubmit={addExpense}><label>Expense purpose<input required autoFocus placeholder="e.g. Venue reservation" value={expenseForm.purpose} onChange={e => setExpenseForm({ ...expenseForm, purpose: e.target.value })} /></label><div className="form-row"><label>Amount paid<div className="input-prefix"><span>₱</span><input required min="1" type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div></label><label>Date<input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label></div><label>Vendor or paid to<input placeholder="Business or recipient" value={expenseForm.vendor} onChange={e => setExpenseForm({ ...expenseForm, vendor: e.target.value })} /></label><label className="file-drop"><ReceiptText size={19} /><span>{expenseForm.receipt || 'Attach receipt evidence'}</span><small>JPG, PNG, WEBP, or PDF · required</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={e => { const file = e.target.files?.[0] || null; setExpenseReceiptFile(file); setExpenseForm({ ...expenseForm, receipt: file?.name || '' }); }} /></label><div className="form-note note-amber"><ArrowDownLeft size={16} /><span>This entry will be recorded as a <b>debit</b> and reduce the book balance.</span></div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit">Save expense</button></div></form>}
      {modal === 'cash' && <form className="modal-form" onSubmit={saveCashCount}><div className="cash-compare"><span>Current book balance</span><strong>{money(balance)}</strong><small>Credits minus documented expenses</small></div><label>Physical cash counted<input required autoFocus min="0" type="number" placeholder="0.00" value={actualCash} onChange={e => setActualCash(e.target.value)} /></label>{actualCash && <div className={`variance ${Number(actualCash) === balance ? 'variance-even' : 'variance-gap'}`}><Activity size={16} /><span>Variance</span><strong>{money(Number(actualCash) - balance)}</strong></div>}<label>Audit note <textarea value={auditNote} onChange={e => setAuditNote(e.target.value)} placeholder="Count date, witnesses, or explanation for a difference" rows={3} /></label><div className="form-note"><ShieldCheck size={16} /><span>The cash count will be saved to the audit history with your account and timestamp.</span></div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit">Save cash count</button></div></form>}
      {modal === 'import' && <form className="modal-form" onSubmit={submitImport}><label>Import type<select value={importKind} onChange={e => setImportKind(e.target.value as 'roster' | 'payment-list')}><option value="roster">Student roster</option><option value="payment-list">Mayor / representative payment list</option></select></label><div className="form-scope"><img src={courseLogos[course]} alt="" className="chip-logo" /><span>For <b>{course}{(course === 'CAS' || course === 'EDUC') && major ? ` · ${major}` : ''} · Year 4</b> · change course / major from the workspace.</span></div>{importKind === 'roster' && <div className="form-row"><label>Default block (used when the file has none)<select value={importBlock} onChange={e => setImportBlock(e.target.value)}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Block {i + 1}</option>)}</select></label></div>}<label className="file-drop"><FileSpreadsheet size={20} /><span>{importFile || 'Choose an Excel or CSV file'}</span><small>.xlsx, .xls, or .csv</small><input type="file" accept=".xlsx,.xls,.csv" required onChange={e => { const file = e.target.files?.[0] || null; setImportUpload(file); setImportFile(file?.name || ''); }} /></label><div className="form-note"><BadgeCheck size={16} /><span>Duplicate students are skipped. Payment lists are compared with roster and ledger records.</span></div><div className="modal-actions"><button type="button" className="button button-light" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit">Continue import</button></div></form>}
    </section></div>}
    {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15} /></button></div>}
  </main>;
}

function sectionSubtitle(page: string, auditor: boolean) {
  const text: Record<string, string> = { Collections: 'Filter by block and payment status.', Assessments: 'Create purpose-based collections and track their progress.', Expenses: 'Record outflows with receipt evidence attached.', 'Expenses & receipts': 'Review every debit and its supporting receipt.', 'Audit trail': 'Review the record of credits, debits, and account activity.', 'Payment lists': auditor ? 'Compare representative reports against roster and ledger entries.' : 'Manage payment lists submitted by course representatives.' };
  return text[page] || 'Manage the student fund workspace.';
}

function statusLabel(status: Student['status']) {
  return status === 'none' ? 'No assessment' : status === 'paid' ? 'Paid' : 'Unpaid';
}

function ActivityRow({ kind, title, subtitle, amount, time }: { kind: 'credit' | 'debit'; title: string; subtitle: string; amount: string; time: string }) {
  return <div className="activity-row"><div className={`activity-symbol ${kind}`} aria-label={kind === 'credit' ? 'Credit' : 'Debit'}>{kind === 'credit' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div className="activity-copy"><strong>{title}</strong><span>{subtitle}</span></div><span className={`activity-amount ${kind}`}>{amount}</span><span className="activity-time">{time}</span></div>;
}

function RecentEntries({ entries }: { entries: any[] }) {
  if (!entries.length) return <div className="empty-inline">No ledger activity recorded yet.</div>;
  return <>{entries.map(entry => {
    const credit = entry.kind === 'CREDIT';
    const person = entry.payment?.student;
    const title = credit ? `Payment received · ${entry.payment?.assessment?.purpose || 'Student payment'}` : entry.description;
    const subtitle = person ? `${person.lastName}, ${person.firstName} · Block ${person.block}` : entry.expense?.vendor ? `${entry.expense.vendor} · receipt attached` : 'Receipt evidence attached';
    return <ActivityRow key={entry.id} kind={credit ? 'credit' : 'debit'} title={title} subtitle={subtitle} amount={`${credit ? '+' : '−'} ${money(Number(entry.amount))}`} time={new Date(entry.createdAt).toLocaleString()} />;
  })}</>;
}

function FundTrendChart({ entries }: { entries: any[] }) {
  const data = entries.length ? [...entries].reverse().map(entry => ({
    label: new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    credit: entry.kind === 'CREDIT' ? Number(entry.amount) : 0,
    debit: entry.kind === 'DEBIT' ? Number(entry.amount) : 0,
  })) : [
    { label: 'Mon', credit: 1200, debit: 500 }, { label: 'Tue', credit: 1850, debit: 0 }, { label: 'Wed', credit: 900, debit: 400 }, { label: 'Thu', credit: 2500, debit: 800 }, { label: 'Fri', credit: 1850, debit: 0 },
  ];
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}><defs><linearGradient id="fundFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#44956e" stopOpacity={0.55} /><stop offset="100%" stopColor="#44956e" stopOpacity={0.02} /></linearGradient></defs><Tooltip formatter={value => money(Number(value || 0))} labelStyle={{ fontSize: 10 }} contentStyle={{ border: '1px solid #e6ece8', borderRadius: 6, fontSize: 10 }} /><Area type="monotone" dataKey="credit" stroke="#44956e" strokeWidth={2} fill="url(#fundFill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer>;
}
