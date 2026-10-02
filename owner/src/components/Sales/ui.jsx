import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';

export const iconClass = name => (name.startsWith('fa-brands') ? name : `fa-solid ${name}`);

export function Icon({ name, label }) {
  return <i className={iconClass(name)} aria-hidden={label ? undefined : 'true'} aria-label={label}></i>;
}

export function StatusChip({ meta, className = '' }) {
  if (!meta) return null;
  return <span className={`sd-chip sd-tone-${meta.tone || 'muted'} ${className}`}><Icon name={meta.icon} />{meta.label}</span>;
}

// Focus-trapping side panel used for lead and quotation details.
export function Drawer({ title, subtitle, onClose, children, wide = false, labelledBy = 'sd-drawer-title' }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    const onKey = event => {
      // Only the top-most dialog reacts, so Escape closes one layer at a time.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab' && panel.current) {
        const focusable = panel.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);
  return <div className="sd-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeRef.current(); }}>
    <aside className={`sd-drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex="-1" ref={panel}>
      <header className="sd-drawer-head">
        <div><h2 id={labelledBy}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="sd-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <div className="sd-drawer-body">{children}</div>
    </aside>
  </div>;
}

export function Modal({ title, onClose, children, width = 520, labelledBy = 'sd-modal-title' }) {
  const box = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const firstField = box.current?.querySelector('.sd-modal-body input, .sd-modal-body select, .sd-modal-body textarea');
    (firstField || box.current)?.focus();
    const onKey = event => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (event.key === 'Escape' && dialogs[dialogs.length - 1] === box.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);
  return <div className="sd-overlay sd-center" onMouseDown={event => { if (event.target === event.currentTarget) closeRef.current(); }}>
    <div className="sd-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} style={{ maxWidth: width }} ref={box} tabIndex="-1">
      <header className="sd-drawer-head">
        <h2 id={labelledBy}>{title}</h2>
        <button type="button" className="sd-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <div className="sd-modal-body">{children}</div>
    </div>
  </div>;
}

export function EmptyState({ icon = 'fa-inbox', title, children, action }) {
  return <div className="sd-empty">
    <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

export function Pager({ page, pages, total, onPage, label = 'results' }) {
  if (!total) return null;
  return <nav className="sd-pager" aria-label="Pagination">
    <span>{total} {total === 1 ? label.replace(/s$/, '') : label}</span>
    <div>
      <button type="button" className="sd-btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i> Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="sd-btn ghost small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
    </div>
  </nav>;
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return <div className={`sd-alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <i className={`fa-solid ${kind === 'error' ? 'fa-circle-exclamation' : kind === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} aria-hidden="true"></i>
    <div>{children}</div>
    {onClose && <button type="button" className="sd-icon-btn" onClick={onClose} aria-label="Dismiss"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>}
  </div>;
}

// Label + control + optional hint. The hint is linked as a description so
// screen readers announce the label alone as the field name.
export function Labelled({ label, hint, children, className = '' }) {
  const id = useId();
  if (!isValidElement(children)) return <label className={`sd-field ${className}`}><span>{label}</span>{children}</label>;
  const controlId = children.props.id || `${id}-control`;
  const control = cloneElement(children, { id: controlId, 'aria-describedby': hint ? `${id}-hint` : children.props['aria-describedby'] });
  return <div className={`sd-field ${className}`}><label htmlFor={controlId}>{label}</label>{control}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
