import { Children, cloneElement, isValidElement, useId } from 'react';
export function Icon({ name, ...props }) {
  const paths = { dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', properties: 'M4 21V3h16v18M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3', queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', media: 'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M8 7h.01', review: 'M9 3h6v4H9zM7 5H4v16h16V5h-3M8 14l3 3 5-6', profile: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', logout: 'M9 21H3V3h6M13 8l5 4-5 4M7 12h11', menu: 'M3 6h18M3 12h18M3 18h18', arrow: 'M5 12h14M14 7l5 5-5 5', check: 'M5 12l4 4L19 6', close: 'M6 6l12 12M18 6 6 18', save: 'M4 3h13l4 4v14H3V3h1M7 3v6h9V3M7 21v-8h10v8', lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4' };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.properties} /></svg>;
}
export const titleCase = value => (value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
export function Badge({ value }) { return <span className={`badge ${['COMPLETED', 'approved'].includes(value) ? 'good' : ['CHANGES_REQUIRED', 'under_review', 'rejected'].includes(value) ? 'warn' : ''}`}>{titleCase(value)}</span>; }
export function Alert({ children, tone = 'error' }) { return children ? <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div> : null; }
export function Loading() { return <div className="loading" role="status">Loading your workspace…<div /><div /><div /></div>; }
export function Empty({ title, children }) { return <div className="empty"><Icon name="properties" width="32" height="32" /><h2>{title}</h2><p>{children}</p></div>; }
export function Field({ label, required, children, hint, error }) {
  const id = useId();
  return <div className={`field ${error ? 'invalid' : ''}`}><label htmlFor={id}>{label}{required && <span className="required" aria-hidden="true"> *</span>}</label>{Children.map(children, child => isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child, { id, 'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined }) : child)}{hint && <small id={`${id}-hint`}>{hint}</small>}{error && <small id={`${id}-error`} className="field-error">{error}</small>}</div>;
}
export const date = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'Not saved yet';
