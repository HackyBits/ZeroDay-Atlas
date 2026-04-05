'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import db from '@/lib/instant';

const FEATURES = [
  {
    icon: '🛡',
    title: 'Zero-Day Tracking',
    desc: 'Log and track zero-day vulnerabilities with auto-generated IDs and CVE linking across all your products.',
  },
  {
    icon: '⚡',
    title: 'Risk Assessment',
    desc: 'Auto-calculate risk scores with CVSS-style scoring and get severity suggestions — Critical, High, Medium, Low.',
  },
  {
    icon: '🔁',
    title: 'Full Lifecycle',
    desc: 'From triage to closure: assign owners, track SLA deadlines, verify fixes, and archive audit trails.',
  },
  {
    icon: '📊',
    title: 'Real-Time Dashboards',
    desc: 'Live metrics on MTTR, SLA compliance, and active zero-days — filterable by product, severity, and team.',
  },
];

type AuthStep = 'form' | 'verify';
type AuthMode = 'signin' | 'signup';

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleSendCode(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await db.auth.sendMagicCode({ email });
      setStep('verify');
    } catch {
      setError('Failed to send code. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await db.auth.signInWithMagicCode({ email, code });
      router.push('/dashboard');
    } catch {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-bold text-sm">
              ZA
            </div>
            <span className="font-semibold text-white text-lg">Zero-Day Atlas</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <span>Features</span>
            <span>Docs</span>
            <span>Security</span>
          </div>
        </div>
      </nav>

      {/* Hero + Auth */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: Hero copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 bg-red-950 border border-red-800 text-red-400 text-xs font-medium px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Real-time Vulnerability Intelligence
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Track. Triage.{' '}
            <span className="text-red-500">Terminate.</span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed">
            Zero-Day Atlas is a centralized security platform for logging, assessing, and remediating
            zero-day vulnerabilities across your entire product portfolio — with real-time dashboards,
            SLA tracking, and cross-team collaboration built in.
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-green-500">✓</span> Automated risk scoring
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-green-500">✓</span> SLA breach alerts
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-green-500">✓</span> Full audit trail
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-green-500">✓</span> Jira &amp; GitHub integration
            </div>
          </div>
        </div>

        {/* Right: Auth card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex mb-8 bg-slate-800 rounded-lg p-1">
            {(['signin', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setStep('form'); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === m
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {step === 'form' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    required={mode === 'signup'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition text-sm"
              >
                {sending ? 'Sending code…' : mode === 'signin' ? 'Send Sign-In Code' : 'Create Account'}
              </button>

              <p className="text-center text-xs text-slate-500">
                We&apos;ll email you a one-time code — no password needed.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-slate-300">Code sent to</p>
                <p className="text-white font-medium">{email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={8}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-center tracking-widest text-lg"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition text-sm"
              >
                {sending ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('form'); setError(''); setCode(''); }}
                className="w-full text-slate-400 hover:text-slate-200 text-sm transition"
              >
                ← Back to email
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">
            Everything your security team needs
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            From the moment a zero-day is discovered to the final audit sign-off — one platform for
            your entire vulnerability lifecycle.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition"
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="text-white font-semibold mb-2 text-sm">{f.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>© 2025 Zero-Day Atlas</span>
          <span>Built with Next.js · InstantDB · Tailwind CSS</span>
        </div>
      </footer>
    </div>
  );
}
