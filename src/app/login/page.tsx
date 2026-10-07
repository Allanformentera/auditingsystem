'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type AuthUser = { name: string; role: string };
type LoginResult = { token: string; user: AuthUser };

function dashboardPath(role: string) {
  return role === 'AUDITOR' ? '/auditor' : '/treasurer';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem('campus-ledger-token');
    if (!token) { setCheckingSession(false); return; }
    void apiRequest<{ user: AuthUser }>('/api/auth/me', token).then(({ user }) => {
      router.replace(dashboardPath(user.role));
    }).catch(() => {
      window.localStorage.removeItem('campus-ledger-token');
      setCheckingSession(false);
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiRequest<LoginResult>('/api/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      window.localStorage.setItem('campus-ledger-token', result.token);
      router.replace(dashboardPath(result.user.role));
    } catch (cause) {
      setError(cause instanceof TypeError
        ? 'Unable to reach the sign-in service. Check that the API is running, then try again.'
        : cause instanceof Error ? cause.message : 'Sign in failed. Check your details and try again.');
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <main className="login-page"><div className="login-loading"><img src="/tmc-logo.png" alt="Trinidad Municipal College logo" className="login-logo login-logo-small" /><span>Checking your session…</span></div></main>;
  }

  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><img src="/tmc-logo.png" alt="Trinidad Municipal College seal" className="login-logo" /><div className="login-brand-text"><strong>TMC Graduating Class</strong><span>Auditing System · Graduation Funds</span></div><img src="/tmc-graduating-class.png" alt="TMC Graduating Class 2026-2027 logo" className="login-logo" /></div>
      <div className="login-intro"><span className="login-eyebrow">SECURE WORKSPACE</span><h1 id="login-title">Sign in to continue</h1><p>Use your school finance account. Your role opens the matching dashboard.</p></div>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" type="email" autoComplete="username" autoFocus required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@school.edu" />
        <div className="login-password-heading"><label htmlFor="login-password">Password</label></div>
        <div className="login-password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
      </form>
      <div className="login-security"><ShieldCheck size={17} /><span>Access is limited by your assigned role. Treasurer and auditor workspaces are separate.</span></div>
      <footer className="login-footer">Trinidad Municipal College <span>·</span> Trinidad, Bohol <span>·</span> Since 1985</footer>
    </section>
  </main>;
}
