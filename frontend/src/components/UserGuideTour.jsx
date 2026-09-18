import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  X, ChevronRight, ChevronLeft, CheckCircle2,
  LayoutGrid, Zap, Target, CheckSquare, Calendar,
  User, Palette, Bell, Mic, Settings as SettingsIcon
} from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 'dashboard-hero',
    page: '/',
    target: '[data-tour="dashboard-hero"]',
    sidebarTarget: '[data-tour="nav-dashboard"]',
    mobSidebarTarget: '[data-tour="mob-nav-dashboard"]',
    icon: LayoutGrid,
    title: '1. Command Center',
    description: 'Welcome to TaskPulse! Monitor your readiness score, focus metrics, and daily schedule timeline at a glance.',
    placement: 'bottom-center',
  },
  {
    id: 'ai-recommendation',
    page: '/',
    target: '[data-tour="ai-recommendation"]',
    sidebarTarget: '[data-tour="nav-dashboard"]',
    mobSidebarTarget: '[data-tour="mob-nav-dashboard"]',
    icon: Zap,
    title: '2. Zero-Dataset AI Engine',
    description: 'TaskPulse evaluates your real-time energy levels and deadlines to auto-recommend the single best task to run now.',
    placement: 'bottom-center',
  },
  {
    id: 'priority-inbox',
    page: '/',
    target: '[data-tour="priority-inbox"]',
    sidebarTarget: '[data-tour="nav-dashboard"]',
    mobSidebarTarget: '[data-tour="mob-nav-dashboard"]',
    icon: Target,
    title: '3. Priority Inbox Queue',
    description: 'Urgent and critical items surface here automatically. Complete tasks in one tap or view scheduled blocks.',
    placement: 'left-center',
  },
  {
    id: 'tasks-studio',
    page: '/tasks',
    target: '[data-tour="tasks-header"]',
    sidebarTarget: '[data-tour="nav-tasks"]',
    mobSidebarTarget: '[data-tour="mob-nav-tasks"]',
    icon: CheckSquare,
    title: '4. Tasks & Projects Studio',
    description: 'Manage your task backlog, filter task modes (AI Flexible vs Fixed Meetings), and create new tasks.',
    placement: 'bottom-center',
  },
  {
    id: 'schedule-timeline',
    page: '/schedule',
    target: '[data-tour="schedule-header"]',
    sidebarTarget: '[data-tour="nav-schedule"]',
    mobSidebarTarget: '[data-tour="mob-nav-schedule"]',
    icon: Calendar,
    title: '5. Autonomous Schedule Engine',
    description: 'Run the solver anytime to orchestrate conflict-free time blocks across your upcoming day.',
    placement: 'bottom-center',
  },
  {
    id: 'profile-studio',
    page: '/profile',
    target: '[data-tour="profile-header"]',
    sidebarTarget: '[data-tour="nav-profile"]',
    mobSidebarTarget: '[data-tour="mob-nav-profile"]',
    icon: User,
    title: '6. Profile & Biometrics Studio',
    description: 'Configure active work hours, timezone, sleep rhythm, break intervals, and chronotype to personalize AI scheduling.',
    placement: 'bottom-center',
  },
  {
    id: 'settings-theme',
    page: '/settings',
    target: '[data-tour="settings-theme"]',
    sidebarTarget: '[data-tour="nav-settings"]',
    mobSidebarTarget: '[data-tour="mob-nav-settings"]',
    icon: Palette,
    title: '7. Appearance & Theme Settings',
    description: 'Customize visual modes (Light, Dark, or System mode) across all workstation devices.',
    placement: 'right-center',
  },
  {
    id: 'settings-notif',
    page: '/settings',
    target: '[data-tour="settings-notif"]',
    sidebarTarget: '[data-tour="nav-settings"]',
    mobSidebarTarget: '[data-tour="mob-nav-settings"]',
    icon: Bell,
    title: '8. Notification Preferences',
    description: 'Configure Neural AI Voice alerts, text + sound chimes, or silent visual badges prior to task start times.',
    placement: 'right-center',
  },
  {
    id: 'ai-assistant',
    page: '/settings',
    target: '[data-tour="ai-assistant"]',
    sidebarTarget: null,
    mobSidebarTarget: null,
    icon: Mic,
    title: '9. 2-Way AI Voice Assistant',
    description: 'Click or tap this orb anytime on any page to speak or chat. Schedule meetings and manage tasks hands-free!',
    placement: 'top-left',
  },
  {
    id: 'user-profile',
    page: '/',
    target: '[data-tour="user-menu"]',
    sidebarTarget: '[data-tour="nav-profile"]',
    mobSidebarTarget: '[data-tour="mob-nav-profile"]',
    fallbackTarget: '[data-tour="sidebar-nav"]',
    icon: SettingsIcon,
    title: '10. Replay Guide & Profile Menu',
    description: 'Open your user menu anytime to fine-tune your work hours, profile, or restart this onboarding guide.',
    placement: 'bottom-left',
  },
];

// SVG Helper: Generates an organic hand-drawn thread curve
function getHandDrawnThreadPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) return `M ${x1} ${y1} L ${x2} ${y2}`;

  const curvature = Math.min(40, Math.max(15, dist * 0.2));
  const nx = -dy / dist;
  const ny = dx / dist;

  let cx1 = x1 + dx * 0.35 + nx * curvature;
  let cy1 = y1 + dy * 0.35 + ny * curvature;

  let cx2 = x1 + dx * 0.65 - nx * (curvature * 0.4);
  let cy2 = y1 + dy * 0.65 - ny * (curvature * 0.4);

  // Clamp control points to viewport bounds so curve never loops off-screen
  const minTop = 10;
  const maxBottom = window.innerHeight - 10;
  if (cy1 < minTop) cy1 = minTop;
  if (cy2 < minTop) cy2 = minTop;
  if (cy1 > maxBottom) cy1 = maxBottom;
  if (cy2 > maxBottom) cy2 = maxBottom;

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

// Helper: Query visible element with width > 0 & height > 0 (prevents selecting hidden desktop elements on mobile)
function getVisibleElement(selector) {
  if (!selector) return null;
  const elements = document.querySelectorAll(selector);
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return elements[0] || null;
}

export default function UserGuideTour() {
  const { profile } = useAuth();
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const prevStepRef = useRef(-1);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState(null);
  const [sidebarRect, setSidebarRect] = useState(null);
  const [arrowPath, setArrowPath] = useState(null);

  useEffect(() => {
    if (activeStepIndex !== prevStepRef.current) {
      setIsNavigating(true);
      const timer = setTimeout(() => setIsNavigating(false), 400);
      prevStepRef.current = activeStepIndex;
      return () => clearTimeout(timer);
    }
  }, [activeStepIndex]);

  const transitionClass = isNavigating ? 'transition-all duration-300 ease-out' : '';

  const location = useLocation();
  const navigate = useNavigate();
  const isTourActive = activeStepIndex >= 0 && activeStepIndex < TOUR_STEPS.length;
  const animationFrameRef = useRef(null);

  // User-scoped localStorage key so new user accounts automatically see the tour
  const userStorageKey = profile?.id
    ? `taskpulse_tour_completed_${profile.id}`
    : (profile?.email ? `taskpulse_tour_completed_${profile.email}` : 'taskpulse_tour_completed');

  const startTour = useCallback(() => {
    localStorage.removeItem(userStorageKey);
    localStorage.removeItem('taskpulse_tour_completed');
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    setActiveStepIndex(0);
  }, [userStorageKey, navigate]);

  // Auto trigger on first login/visit for new user account
  useEffect(() => {
    const hasSeenTour = localStorage.getItem(userStorageKey);
    const isNewUser = !hasSeenTour || profile?.is_new_user === true || profile?.tour_completed === false;

    if (isNewUser) {
      const timer = setTimeout(() => {
        setActiveStepIndex(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userStorageKey, profile]);

  // Set global data-tour-active attribute to suppress popups/banners during tour
  useEffect(() => {
    if (isTourActive) {
      document.documentElement.setAttribute('data-tour-active', 'true');
    } else {
      document.documentElement.removeAttribute('data-tour-active');
    }
    return () => {
      document.documentElement.removeAttribute('data-tour-active');
    };
  }, [isTourActive]);

  // Expose global start function & event listener for manual replay request
  useEffect(() => {
    const triggerStart = () => {
      localStorage.removeItem(userStorageKey);
      localStorage.removeItem('taskpulse_tour_completed');
      if (window.location.pathname !== '/') {
        navigate('/');
      }
      setActiveStepIndex(0);
    };

    window.startTaskPulseTour = triggerStart;
    window.addEventListener('start_user_tour', triggerStart);

    return () => {
      delete window.startTaskPulseTour;
      window.removeEventListener('start_user_tour', triggerStart);
    };
  }, [userStorageKey, navigate]);

  const updatePositions = useCallback(() => {
    if (!isTourActive) return;
    const step = TOUR_STEPS[activeStepIndex];
    if (!step) return;

    let elem = getVisibleElement(step.target);
    if (!elem && step.fallbackTarget) {
      elem = getVisibleElement(step.fallbackTarget);
    }

    const isMobile = window.innerWidth < 768;
    const cardWidth = Math.min(320, window.innerWidth - 32);
    const cardHeight = isMobile ? 185 : 170;

    // If target is unmounted during route transition, retain previous rects for smooth gliding
    if (!elem) {
      return;
    }

    let elemRect = elem.getBoundingClientRect();
    const scrollContainer = elem.closest('main') || document.documentElement;

    // Smooth scroll target into view if out of viewport bounds
    if (elemRect.top < 70 || elemRect.bottom > window.innerHeight - 30) {
      if (scrollContainer && scrollContainer.scrollTo) {
        const containerTop = scrollContainer.getBoundingClientRect().top;
        const targetScrollTop = scrollContainer.scrollTop + (elemRect.top - containerTop) - 16;
        scrollContainer.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      } else {
        elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      elemRect = elem.getBoundingClientRect();
    }

    const padding = 6;
    const computedTargetRect = {
      top: elemRect.top - padding,
      left: Math.max(6, elemRect.left - padding),
      width: elemRect.width + padding * 2,
      height: elemRect.height + padding * 2,
    };
    setTargetRect(computedTargetRect);

    // Sidebar/Bottom Nav Item Target (Desktop vs Mobile)
    const isDesktop = window.innerWidth >= 1024;
    const navSelector = isDesktop ? step.sidebarTarget : step.mobSidebarTarget;

    if (navSelector) {
      const sElem = getVisibleElement(navSelector);
      if (sElem) {
        const sRect = sElem.getBoundingClientRect();
        if (sRect.width > 0 && sRect.height > 0) {
          setSidebarRect({
            top: Math.max(4, sRect.top - 4),
            left: Math.max(4, sRect.left - 4),
            width: sRect.width + 8,
            height: sRect.height + 8,
          });
        } else {
          setSidebarRect(null);
        }
      } else {
        setSidebarRect(null);
      }
    } else {
      setSidebarRect(null);
    }

    let placement = step.placement || 'bottom-center';
    let top = 0;
    let left = 0;

    // Special layout for bottom-right floating AI Assistant orb (Step 9)
    if (step.id === 'ai-assistant') {
      top = Math.max(16, elemRect.top - cardHeight - 70);
      left = Math.max(16, elemRect.right - cardWidth - 15);
    } else if (isMobile) {
      // Mobile specific layout adjustments
      const targetCenterY = elemRect.top + elemRect.height / 2;
      left = Math.max(16, (window.innerWidth - cardWidth) / 2);

      if (targetCenterY > window.innerHeight / 2) {
        top = Math.max(16, elemRect.top - cardHeight - 35);
      } else {
        top = Math.min(window.innerHeight - cardHeight - 75, elemRect.bottom + 35);
      }
    } else {
      // Desktop placement
      if (placement === 'bottom-center') {
        top = elemRect.bottom + 45;
        left = elemRect.left + elemRect.width / 2 - cardWidth / 2;
      } else if (placement === 'top-right') {
        top = elemRect.top - cardHeight - 45;
        left = elemRect.right - cardWidth + 20;
      } else if (placement === 'left-center') {
        top = elemRect.top + elemRect.height / 2 - cardHeight / 2;
        left = elemRect.left - cardWidth - 45;
      } else if (placement === 'right-center') {
        top = elemRect.top + elemRect.height / 2 - cardHeight / 2;
        left = elemRect.right + 45;
      } else if (placement === 'top-left') {
        top = elemRect.top - cardHeight - 45;
        left = elemRect.left - cardWidth + 80;
      } else if (placement === 'bottom-left') {
        top = elemRect.bottom + 45;
        left = elemRect.right - cardWidth;
      } else {
        top = elemRect.bottom + 45;
        left = elemRect.left + elemRect.width / 2 - cardWidth / 2;
      }
    }

    // Viewport clamping
    if (left < 16) left = 16;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (top < 16) top = Math.min(window.innerHeight - cardHeight - 75, elemRect.bottom + 35);
    if (top + cardHeight > window.innerHeight - 16) {
      top = Math.max(16, elemRect.top - cardHeight - 35);
    }

    setCardPos({ top, left });

    // Arrow Path calculation from Card edge (x1, y1) to Target edge (x2, y2)
    const cardCenterX = left + cardWidth / 2;
    const cardCenterY = top + cardHeight / 2;

    const targetCenterX = elemRect.left + elemRect.width / 2;
    const targetCenterY = elemRect.top + elemRect.height / 2;

    let x1 = cardCenterX;
    let y1 = top;
    if (targetCenterY > top + cardHeight) {
      y1 = top + cardHeight;
    } else if (targetCenterY < top) {
      y1 = top;
    } else if (targetCenterX < left) {
      x1 = left;
      y1 = cardCenterY;
    } else if (targetCenterX > left + cardWidth) {
      x1 = left + cardWidth;
      y1 = cardCenterY;
    }

    let x2 = targetCenterX;
    let y2 = elemRect.top;
    if (cardCenterY > elemRect.bottom) {
      y2 = elemRect.bottom;
    } else if (cardCenterY < elemRect.top) {
      y2 = elemRect.top;
    } else if (cardCenterX < elemRect.left) {
      x2 = elemRect.left;
      y2 = targetCenterY;
    } else if (cardCenterX > elemRect.right) {
      x2 = elemRect.right;
      y2 = targetCenterY;
    }

    const threadD = getHandDrawnThreadPath(x1, y1, x2, y2);
    setArrowPath({ x1, y1, x2, y2, pathD: threadD });
  }, [activeStepIndex, isTourActive]);

  // Continuous frame polling during route transition to ensure smooth gliding without jumps
  useEffect(() => {
    if (!isTourActive) return;

    let startTime = Date.now();
    let frameId = null;

    const pollTarget = () => {
      const step = TOUR_STEPS[activeStepIndex];
      if (step) {
        const found = getVisibleElement(step.target) || (step.fallbackTarget && getVisibleElement(step.fallbackTarget));
        if (found) {
          updatePositions();
        } else if (Date.now() - startTime < 600) {
          frameId = requestAnimationFrame(pollTarget);
          return;
        }
      }
      updatePositions();
    };

    pollTarget();

    const handleUpdate = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updatePositions);
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [activeStepIndex, location.pathname, isTourActive, updatePositions]);

  const handleNext = () => {
    if (activeStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = activeStepIndex + 1;
      const nextStep = TOUR_STEPS[nextIndex];
      if (nextStep && nextStep.page && location.pathname !== nextStep.page) {
        navigate(nextStep.page);
      }
      setActiveStepIndex(nextIndex);
    } else {
      finishTour();
    }
  };

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      const prevIndex = activeStepIndex - 1;
      const prevStep = TOUR_STEPS[prevIndex];
      if (prevStep && prevStep.page && location.pathname !== prevStep.page) {
        navigate(prevStep.page);
      }
      setActiveStepIndex(prevIndex);
    }
  };

  const finishTour = () => {
    localStorage.setItem(userStorageKey, 'true');
    localStorage.setItem('taskpulse_tour_completed', 'true');
    setActiveStepIndex(-1);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  if (!isTourActive) return null;

  const currentStep = TOUR_STEPS[activeStepIndex];
  const StepIcon = currentStep.icon;
  const totalSteps = TOUR_STEPS.length;

  return (
    <div className="fixed inset-0 z-[999999] pointer-events-auto overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* SVG Spotlight Mask Layer */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-[999998]">
        <defs>
          <mask id="tourSpotlightMask">
            <rect width="100%" height="100%" fill="white" />
            
            {/* Primary Content Cutout */}
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="16"
                fill="black"
                className={transitionClass}
              />
            )}

            {/* Sidebar Nav Item Cutout */}
            {sidebarRect && (
              <rect
                x={sidebarRect.left}
                y={sidebarRect.top}
                width={sidebarRect.width}
                height={sidebarRect.height}
                rx="10"
                fill="black"
                className={transitionClass}
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.78)"
          mask="url(#tourSpotlightMask)"
        />
      </svg>

      {/* Primary Target Glowing Highlight Ring */}
      {targetRect && (
        <div
          className={`fixed rounded-2xl pointer-events-none z-[999999] ${transitionClass}`}
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            border: '2px solid rgba(129, 140, 248, 0.9)',
            boxShadow: '0 0 30px 6px rgba(99, 102, 241, 0.6), inset 0 0 15px rgba(99, 102, 241, 0.3)',
          }}
        />
      )}

      {/* Sidebar Nav Item Glowing Highlight Ring */}
      {sidebarRect && (
        <div
          className={`fixed rounded-xl pointer-events-none z-[999999] ${transitionClass}`}
          style={{
            top: `${sidebarRect.top}px`,
            left: `${sidebarRect.left}px`,
            width: `${sidebarRect.width}px`,
            height: `${sidebarRect.height}px`,
            border: '2px solid rgba(129, 140, 248, 0.9)',
            boxShadow: '0 0 20px 4px rgba(99, 102, 241, 0.5), inset 0 0 10px rgba(99, 102, 241, 0.2)',
          }}
        />
      )}

      {/* SVG Neon Thread Arrow Pointer (Slim, Delicate & High-Precision) */}
      {arrowPath && (
        <svg className="fixed inset-0 w-full h-full pointer-events-none z-[1000000] overflow-visible">
          <defs>
            <linearGradient id="neonThreadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>

            <marker
              id="loomLineArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 1.8 1.8 L 7.2 5 L 1.8 8.2"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>

          </defs>

          {/* Slim Outer Halo */}
          <path
            d={arrowPath.pathD}
            stroke="rgba(129, 140, 248, 0.35)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className={transitionClass}
            style={isNavigating ? { transition: 'd 300ms ease-out, stroke 300ms ease-out' } : {}}
          />

          {/* Delicate Animated Thin Neon Thread Path */}
          <path
            d={arrowPath.pathD}
            stroke="url(#neonThreadGrad)"
            strokeWidth="1.8"
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            markerEnd="url(#loomLineArrow)"
            className={transitionClass}
            style={isNavigating ? { transition: 'd 300ms ease-out, stroke 300ms ease-out' } : {}}
          />

          {/* Delicate Node Pin Dot */}
          <circle
            cx={arrowPath.x1}
            cy={arrowPath.y1}
            r="2.8"
            fill="#a855f7"
            className={transitionClass}
          />
        </svg>
      )}

      {/* Floating Info Card */}
      <div
        className={`fixed z-[1000001] w-[calc(100vw-32px)] sm:w-[325px] ${transitionClass}`}
        style={{
          top: `${cardPos.top}px`,
          left: `${cardPos.left}px`,
        }}
      >
        <div className="bg-slate-950/95 backdrop-blur-2xl text-white rounded-[24px] shadow-[0_25px_80px_rgba(0,0,0,0.85)] p-5 border border-indigo-500/40 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <StepIcon size={16} className="text-indigo-300 stroke-[2.2px]" />
              </div>
              <h4 className="text-[13px] sm:text-[14px] font-extrabold text-white tracking-[-0.01em] leading-snug truncate">
                {currentStep.title}
              </h4>
            </div>

            <button
              type="button"
              onClick={finishTour}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
              title="Close tour"
            >
              <X size={15} />
            </button>
          </div>

          {/* Description — High-Contrast Crisp Readability */}
          <p className="text-[12.5px] sm:text-[13px] text-slate-100 font-medium leading-[1.65] tracking-[0.01em] mb-4">
            {currentStep.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
            {/* Step Indicators */}
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeStepIndex
                      ? 'w-5 bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.9)]'
                      : 'w-1.5 bg-slate-700/80'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-1.5">
              {activeStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="text-[12px] font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all flex items-center gap-0.5"
                >
                  <ChevronLeft size={13} /> Back
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:brightness-110 text-white font-extrabold text-[12px] px-4 py-1.5 rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.45)] border border-indigo-400/30 transition-all flex items-center gap-1 active:scale-95"
              >
                {activeStepIndex === totalSteps - 1 ? (
                  <>Finish <CheckCircle2 size={13} /></>
                ) : (
                  <>Next <ChevronRight size={13} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
