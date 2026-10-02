import { useEffect, useRef } from 'react';

export function Icon({ name, label }) {
  return <i className={name.startsWith('fa-brands') ? name : `fa-solid ${name}`} aria-hidden={label ? undefined : 'true'} aria-label={label}></i>;
}

export function StatusBadge({ meta, fallback, className = '' }) {
  if (!meta) return fallback ? <span className={`ac-badge neutral ${className}`}>{fallback}</span> : null;
  return <span className={`ac-badge ${meta.tone} ${className}`}>{meta.icon && <Icon name={meta.icon} />}{meta.label}</span>;
}

export function MetricCard({ label, value, sub, changePct, onClick, attention }) {
  const clickable = Boolean(onClick);
  const Tag = clickable ? 'button' : 'div';
  return <Tag type={clickable ? 'button' : undefined} className={`ac-metric ${attention ? 'attention' : ''} ${clickable ? 'clickable' : ''}`} onClick={onClick}>
    <span className="ac-metric-label">{label}</span>
    <strong className="ac-metric-value">{value}</strong>
    <span className="ac-metric-sub">
      {typeof changePct === 'number' && <span className={`ac-delta ${changePct > 0 ? 'up' : changePct < 0 ? 'down' : ''}`}><Icon name={changePct > 0 ? 'fa-arrow-up' : changePct < 0 ? 'fa-arrow-down' : 'fa-minus'} /> {Math.abs(changePct)}%</span>}
      {sub}
    </span>
  </Tag>;
}

export function Drawer({ title, subtitle, onClose, children, actions }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = e => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  return <div className="ac-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeRef.current(); }}>
    <aside className="ac-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" ref={panel}>
      <header className="ac-drawer-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="ac-icon-btn" onClick={onClose} aria-label="Close"><Icon name="fa-xmark" /></button>
      </header>
      <div className="ac-drawer-body">{children}</div>
      {actions && <footer className="ac-drawer-foot">{actions}</footer>}
    </aside>
  </div>;
}

export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onClose, busy, reason, setReason, reasonRequired, reasonLabel = 'Reason (kept in the audit trail)' }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => { box.current?.querySelector('textarea,button')?.focus(); const onKey = e => { if (e.key === 'Escape') closeRef.current(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, []);
  const blocked = reasonRequired && !(reason || '').trim();
  return <div className="ac-overlay ac-center" onMouseDown={e => { if (e.target === e.currentTarget) closeRef.current(); }}>
    <div className="ac-modal" role="dialog" aria-modal="true" aria-label={title} ref={box}>
      <header className="ac-drawer-head"><h2>{title}</h2><button type="button" className="ac-icon-btn" onClick={onClose} aria-label="Close"><Icon name="fa-xmark" /></button></header>
      <div className="ac-modal-body">
        {children}
        {setReason && <label className="ac-field"><span>{reasonLabel}{reasonRequired ? ' *' : ''}</span><textarea rows="3" maxLength="500" value={reason} onChange={e => setReason(e.target.value)} /></label>}
        <div className="ac-modal-actions">
          <button type="button" className="ac-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`ac-btn ${tone}`} onClick={onConfirm} disabled={busy || blocked}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  </div>;
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return <div className={`ac-alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <Icon name={kind === 'error' ? 'fa-circle-exclamation' : kind === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check'} />
    <div>{children}</div>
    {onClose && <button type="button" className="ac-icon-btn" onClick={onClose} aria-label="Dismiss"><Icon name="fa-xmark" /></button>}
  </div>;
}

export function EmptyState({ icon = 'fa-inbox', title, children }) {
  return <div className="ac-empty"><Icon name={icon} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function Pager({ page, pages, total, onPage, label = 'rows' }) {
  if (!total) return null;
  return <nav className="ac-pager" aria-label="Pagination">
    <span>{total.toLocaleString('en-IN')} {label}</span>
    <div>
      <button type="button" className="ac-btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="fa-chevron-left" /></button>
      <span>Page {page} / {pages}</span>
      <button type="button" className="ac-btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><Icon name="fa-chevron-right" /></button>
    </div>
  </nav>;
}

export function Labelled({ label, children, hint }) {
  return <label className="ac-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Facts({ items }) {
  return <dl className="ac-facts">{items.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function AuditTimeline({ entries }) {
  if (!entries?.length) return <p className="ac-muted">No admin actions recorded yet.</p>;
  return <ol className="ac-timeline">{entries.map(e => <li key={e._id}>
    <span className="ac-timeline-dot"><Icon name="fa-shield-halved" /></span>
    <div>
      <strong>{(e.action || '').replace(/[._]/g, ' ')}</strong>
      {(e.before || e.after) && <small className="ac-change">{e.before?.status && e.after?.status ? `${e.before.status} → ${e.after.status}` : ''}</small>}
      {e.reason && <p>“{e.reason}”</p>}
      <small>{e.actor?.name || e.actorName || 'Admin'} · {new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
    </div>
  </li>)}</ol>;
}
