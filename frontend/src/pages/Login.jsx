import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import { CalendarSync, Sparkles, ShieldCheck, ArrowRight, Eye, Mail, Lock } from 'lucide-react';
import { getApiBase } from '../utils/apiConfig';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleAuthSuccess = async (token) => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        const data = await res.json();
        login(data.access_token);
        navigate('/', { replace: true });
      } else {
        console.error("Backend auth failed", await res.text());
      }
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => handleAuthSuccess(tokenResponse.access_token),
    onError: errorResponse => console.error('Google Login Error:', errorResponse),
  });

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex">
      
      {/* Left Column - Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-hover)] border-r border-[var(--border-subtle)] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg overflow-hidden border border-[var(--border-subtle)]">
              <img src="/logo.png" alt="TaskPulse Logo" className="w-full h-full object-cover" />
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
            <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] text-[var(--accent-base)] flex items-center justify-center mb-4">
                <CalendarSync size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">Dual-Way Sync</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Real-time bi-directional cadence with Google & Outlook.</p>
            </div>
            
            <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] text-[var(--accent-base)] flex items-center justify-center mb-4">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">AI Smart Priority</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Context-aware ranking prevents deadline bottlenecks.</p>
            </div>

            <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] text-[var(--accent-base)] flex items-center justify-center mb-4">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-main)] mb-2">Zero Drift Guarantee</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">Automated buffer reserves prevent work spillover.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-8">
          <p className="text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase mb-2">Enterprise Performance</p>
          <p className="text-xl font-semibold text-[var(--text-main)]">Trusted by 45,000+ teams</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">From high-growth scaleups to distributed Fortune 500 units.</p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-[var(--bg-app)]">
        <div className="w-full max-w-md flex flex-col">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg mb-4 overflow-hidden border border-[var(--border-subtle)]">
              <img src="/logo.png" alt="TaskPulse Logo" className="w-full h-full object-cover" />
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

          <div className="w-full flex flex-col items-center justify-center mb-6">
            <div className="w-full flex justify-center mb-3">
              <GoogleLogin
                onSuccess={(credentialResponse) => handleAuthSuccess(credentialResponse.credential)}
                onError={() => console.error('Google One-Tap Login Failed')}
                theme="filled_blue"
                shape="pill"
                size="large"
                width="100%"
                useOneTap
              />
            </div>
            <button 
              onClick={() => handleGoogleLogin()}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] transition-colors text-xs font-semibold text-[var(--text-muted)] shadow-sm"
            >
              Alternative Popup Login
            </button>
          </div>

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
                <input type="email" placeholder="alex.turner@company.com" className="input-field !pl-10 bg-[var(--bg-app)] border-transparent focus:border-[var(--accent-base)]" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-main)]">Password</label>
                <a href="#" className="text-xs text-[var(--accent-base)] font-medium">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input type="password" placeholder="••••••••••••" className="input-field !pl-10 !pr-10 bg-[var(--bg-app)] border-transparent focus:border-[var(--accent-base)]" />
                <Eye className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              </div>
            </div>

            <div className="flex items-center mb-4">
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] font-medium cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--accent-base)] focus:ring-[var(--accent-base)]" />
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
