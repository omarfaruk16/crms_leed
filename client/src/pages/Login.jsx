import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/ui.jsx';

const STATS = [
  { value: '12,400+', label: 'Leads managed' },
  { value: '$840M', label: 'Pipeline value' },
  { value: '38%', label: 'Avg. close rate' },
];

const FEATURES = [
  ['◧', 'Live pipeline', 'Kanban & table views update in real time'],
  ['◔', 'Smart analytics', 'CPL, conversion funnels & agent leaderboards'],
  ['◈', 'Event ROI', 'Track campaign spend against won deals'],
  ['⚡', 'Built for speed', 'Indexed Postgres handles millions of rows'],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
      nav('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="min-h-screen flex">
      {/* Left brand / marketing panel */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] xl:w-1/2 relative overflow-hidden
        bg-gradient-to-br from-[#0c3b3a] via-[#0f4f4d] to-[#08312f] text-white p-12 xl:p-16">
        {/* decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary-500 dark:bg-primary-600/30 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-[#1d6b68]/40 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/95 grid place-items-center text-primary-500 dark:text-primary-400 font-heading text-2xl font-bold shadow-lg">S</div>
            <div>
              <div className="font-heading text-2xl font-bold">Sky Root</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/60 font-semibold">Properties</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight mb-4">
            The CRM that closes<br />real estate deals faster.
          </h1>
          <p className="text-white/70 text-base max-w-md leading-relaxed mb-10">
            From first enquiry to keys in hand — manage leads, campaigns and agents in one elegant, lightning-fast workspace.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            {FEATURES.map(([icon, title, desc]) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <div className="text-xl mb-1.5">{icon}</div>
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-white/55 text-xs mt-0.5 leading-snug">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-heading text-3xl font-bold">{s.value}</div>
              <div className="text-white/55 text-xs uppercase tracking-wide font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-neutral-900">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-primary-500 dark:bg-primary-600 grid place-items-center text-white font-heading text-2xl font-bold">S</div>
            <div>
              <div className="font-heading text-xl font-bold text-neutral-900 dark:text-white">Sky Root Properties</div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400 font-semibold">CRM</div>
            </div>
          </div>

          <h2 className="font-heading text-3xl font-bold text-neutral-900 dark:text-white">Welcome back</h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1 mb-8">Sign in to your account to continue.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" autoComplete="username" placeholder="your@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <div className="text-sm font-semibold text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-xl px-3 py-2">{err}</div>}
            <button className="btn-primary w-full !py-3 text-base" disabled={busy}>
              {busy ? <Spinner className="w-5 h-5 border-white/40 border-t-white" /> : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-300 dark:border-neutral-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-3">Demo credentials</div>
            <div className="space-y-2">
              {[
                ['admin@skyroot.com', 'admin123', 'Admin'],
                ['olivia@skyroot.com', 'manager123', 'Manager'],
                ['liam@skyroot.com', 'agent123', 'Agent'],
                ['owner@skyroot.com', 'owner123', 'Owner'],
                ['affiliate@partners.com', 'affiliate123', 'Affiliate'],
              ].map(([em, pw, role]) => (
                <button key={em} onClick={() => fill(em, pw)} type="button"
                  className="w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:border-primary-500 dark:border-primary-400 hover:bg-primary-500 dark:bg-primary-600/5 transition group">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 group-hover:text-primary-500 dark:text-primary-400">{em}</span>
                  <span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">{role}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-500 mt-3">Click a credential to autofill, then press Sign in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
