import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { CalendarSync, Sparkles, ShieldCheck, ArrowRight, Eye, Mail, Lock } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token })
        });
        if (res.ok) {
          const data = await res.json();
          login(data.access_token);
          navigate('/');
        } else {
          console.error("Backend auth failed", await res.text());
        }
      } catch (err) {
        console.error('Login failed', err);
      }
    },
    onError: errorResponse => console.error('Google Login Error:', errorResponse),
  });

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex">
      
      {/* Left Column - Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#eff6ff] to-[#e0e7ff] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-base)] flex items-center justify-center text-white shadow-lg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="font-bold text-2xl text-[var(--text-main)]">TaskPulse</span>
          </div>

          <div className="mb-8">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[var(--accent-base)] uppercase mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-base)]"></span>
              Autonomous Schedule Engine 4.2
            </span>
            <h1 className="text-5xl font-bold text-[var(--text-main)] leading-[1.15] tracking-tight mb-6">
              Automate your daily schedules and protect deep focus blocks.
            </h1>
            <p className="text-lg text-[var(--text-muted)] max-w-lg leading-relaxed">
              TaskPulse orchestrates cross-calendar sync, algorithmic task sequencing, and frictionless execution for high-velocity engineering and product teams.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-16">
            <div className="bg-white/60 backdrop-blur p-5 rounded-2xl border border-white/40 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                <CalendarSync size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">Dual-Way Sync</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Real-time bi-directional cadence with Google & Outlook.</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur p-5 rounded-2xl border border-white/40 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">AI Smart Priority</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Context-aware ranking prevents deadline bottlenecks.</p>
            </div>

            <div className="bg-white/60 backdrop-blur p-5 rounded-2xl border border-white/40 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">Zero Drift Guarantee</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Automated buffer reserves prevent work spillover.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-indigo-200/50 pt-8">
          <p className="text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase mb-2">Enterprise Performance</p>
          <p className="text-xl font-semibold text-[var(--text-main)]">Trusted by 45,000+ teams</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">From high-growth scaleups to distributed Fortune 500 units.</p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md flex flex-col">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-base)] flex items-center justify-center text-white shadow-lg mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">TaskPulse</h1>
            <p className="text-sm text-[var(--text-muted)]">Autonomous Schedule Engine</p>
          </div>

          <div className="hidden lg:flex items-center justify-between mb-12">
            <span className="text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase">Workspace Access</span>
            <span className="px-3 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success-text)] text-xs font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-text)]"></span>
              All systems operational
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--text-main)] mb-2">Welcome back</h2>
            <p className="text-[var(--text-muted)] text-sm">Access your time-blocked schedule and prioritized backlog.</p>
          </div>

          <button 
            onClick={() => handleGoogleLogin()}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] hover:bg-slate-100 transition-colors mb-6 font-semibold text-[var(--text-main)] shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[var(--border-subtle)]"></div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">OR SIGN IN WITH WORK EMAIL</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]"></div>
          </div>

          <form className="flex flex-col gap-5" onSubmit={e => e.preventDefault()}>
            <div>
              <label className="text-xs font-semibold text-[var(--text-main)] mb-1.5 block">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input type="email" placeholder="alex.turner@company.com" className="input-field pl-10 bg-[var(--bg-app)] border-transparent focus:border-[var(--accent-base)]" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-main)]">Password</label>
                <a href="#" className="text-xs text-[var(--accent-base)] font-medium">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input type="password" placeholder="••••••••••••" className="input-field pl-10 pr-10 bg-[var(--bg-app)] border-transparent focus:border-[var(--accent-base)]" />
                <Eye className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              </div>
            </div>

            <div className="flex items-center mb-4">
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] font-medium cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-[var(--accent-base)] focus:ring-[var(--accent-base)]" />
                Remember this device for 30 days
              </label>
            </div>

            <button type="button" className="btn-primary w-full py-3.5 rounded-xl shadow-md flex justify-center items-center gap-2">
              Sign In to Workspace
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-12 text-center text-sm">
            <span className="text-[var(--text-muted)]">Don't have an enterprise workspace? </span>
            <a href="#" className="text-[var(--accent-base)] font-medium hover:underline">Request pilot demo</a>
            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[var(--text-muted)] font-medium">
              <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-500" /> SOC2 Type II</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-500" /> ISO 27001</span>
              <span>&bull;</span>
              <span>Single Sign-On Enforced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
