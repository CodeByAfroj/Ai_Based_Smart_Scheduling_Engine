import React from 'react';

export const Section = ({ title, children, footer, className = '' }) => (
  <div className={`mb-8 ${className}`}>
    {title && <div className="px-4 text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">{title}</div>}
    <div className="bg-[var(--bg-panel)] border rounded-2xl border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)] shadow-sm">
      {children}
    </div>
    {footer && <div className="px-4 text-[13px] text-[var(--text-muted)] mt-2">{footer}</div>}
  </div>
);

export const Row = ({ icon: Icon, iconColor, title, subtitle, right, onClick, isButton, badge, children, className = '' }) => {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`w-full flex items-center gap-3.5 px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-[var(--bg-hover)] active:bg-black/5 dark:active:bg-white/5 transition-colors text-left' : ''} ${isButton ? 'justify-center' : ''} ${className}`}
    >
      {!isButton && Icon && (
        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm ${iconColor || 'bg-slate-500'}`}>
          <Icon size={16} />
        </div>
      )}
      {!isButton && (
        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex items-center gap-2">
            <div className="text-[15px] text-[var(--text-main)] leading-tight truncate">{title}</div>
            {badge && <span className="bg-[var(--accent-light)] text-[var(--accent-base)] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{badge}</span>}
          </div>
          {subtitle && <div className="text-[13px] text-[var(--text-muted)] leading-snug mt-0.5">{subtitle}</div>}
          {children && <div className="mt-1">{children}</div>}
        </div>
      )}
      {isButton && (
        <div className="flex-1 text-center">
          <div className="text-[15px] font-medium text-[var(--accent-base)]">{title}</div>
        </div>
      )}
      {right && <div className="shrink-0 flex items-center">{right}</div>}
    </div>
  );
};
