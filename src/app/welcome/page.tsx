'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import './welcome.css';

type AuthUser = { name: string; role: string };

function dashboardPath(role: string) {
  return role === 'AUDITOR' ? '/auditor' : '/treasurer';
}

function roleLabel(role: string) {
  if (role === 'AUDITOR') return 'Auditor';
  if (role === 'TREASURER') return 'Treasurer';
  if (role === 'ADMIN') return 'Administrator';
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : 'Member';
}

export default function WelcomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem('campus-ledger-token');
    if (!token) {
      router.replace('/login');
      return;
    }
    void apiRequest<{ user: AuthUser }>('/api/auth/me', token)
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setChecking(false);
      })
      .catch(() => {
        window.localStorage.removeItem('campus-ledger-token');
        router.replace('/login');
      });
  }, [router]);

  function getStarted() {
    if (user) router.push(dashboardPath(user.role));
  }

  function signOut() {
    window.localStorage.removeItem('campus-ledger-token');
    router.replace('/login');
  }

  if (checking || !user) {
    return <main className="welcome-page welcome-centered">
      <div className="welcome-loading">
        <div className="welcome-logos">
          <img src="/tmc-logo.png" alt="Trinidad Municipal College seal" className="welcome-logo" />
          <img src="/tmc-graduating-class.png" alt="TMC Graduating Class logo" className="welcome-logo" />
        </div>
        <span>Preparing your workspace…</span>
      </div>
    </main>;
  }

  return <main className="welcome-page">
    <header className="welcome-topbar">
      <div className="welcome-brand">
        <img src="/tmc-logo.png" alt="Trinidad Municipal College seal" className="welcome-brand-logo" />
        <div>
          <strong>Trinidad Municipal College</strong>
          <span>Campus Ledger · TMC Graduating Class 2026–2027</span>
        </div>
        <img src="/tmc-graduating-class.png" alt="TMC Graduating Class 2026–2027 logo" className="welcome-brand-logo" />
      </div>
      <button type="button" className="welcome-signout" onClick={signOut}>
        <LogOut size={15} /> Sign out
      </button>
    </header>

    <section className="welcome-card" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <span className="welcome-eyebrow"><Sparkles size={14} /> YOUR FINANCE WORKSPACE</span>
        <h1 id="welcome-title" className="welcome-title">Welcome to <span>Campus Ledger</span></h1>
        <p className="welcome-subtitle">
          The official auditing workspace of the TMC Graduating Class 2026–2027. Track collections,
          review expenses, and keep every peso accountable.
        </p>
        <div className="welcome-role-row">
          <span className="welcome-role-pill"><ShieldCheck size={15} /> {roleLabel(user.role)}</span>
          <span className="welcome-user">Signed in as <strong>{user.name}</strong></span>
        </div>
        <button type="button" className="welcome-get-started" onClick={getStarted}>
          Get Started <ArrowRight size={18} />
        </button>
        <p className="welcome-hint">You can switch accounts anytime from the dashboard.</p>
      </div>

      <div className="welcome-visual">
        <div className="welcome-photo-frame">
          <img
            src="/welcome-team.jpg"
            alt="TMC Graduating Class 2026–2027 group photo"
            className="welcome-photo"
            width={2048}
            height={1366}
          />
          <div className="welcome-photo-caption">
            <span>TMC Graduating Class</span>
            <strong>2026–2027</strong>
          </div>
        </div>
        <p className="welcome-photo-note">One team. One ledger. Every peso accounted for.</p>
      </div>
    </section>

    <footer className="welcome-footer">
      <span>Trinidad Municipal College · Trinidad, Bohol · Since 1985</span>
      <span><ShieldCheck size={13} /> Role-based access enabled</span>
    </footer>
  </main>;
}
