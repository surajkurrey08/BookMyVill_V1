import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { entryApi, session } from './api';
import { Alert, Icon, Loading } from './ui';
import { Dashboard, PropertyList, Profile } from './Workspace';
import Editor from './Editor';
const Auth = createContext(null);
export const useAuth = () => useContext(Auth);
function AuthProvider({ children }) {
  const [data, setData] = useState(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    if (session.token()) entryApi.me(c.signal).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!c.signal.aborted) setBooting(false); });
    else setBooting(false);
    const expire = () => { setData(null); setError('Your session expired. Sign in again to continue.'); };
    window.addEventListener('data-entry-session-expired', expire);
    return () => { c.abort(); window.removeEventListener('data-entry-session-expired', expire); };
  }, []);
  return <Auth.Provider value={{ data, setData, booting, error, setError, logout: () => { session.clear(); setData(null); setError(''); } }}>{children}</Auth.Provider>;
}
function Login() {
  const auth = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (auth.data) return <Navigate to="/dashboard" replace />;
  async function login(e) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    try { const data = await entryApi.login({ email: f.get('email').trim(), password: f.get('password') }); auth.setData(data); auth.setError(''); navigate('/dashboard'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-card"><div className="brand">BookMyVilla</div><h1>Data Entry sign in</h1><p>Complete assigned listings and send them to Admin for review.</p><Alert>{error || auth.error}</Alert><form onSubmit={login}><label className="field"><span>Work email</span><input name="email" type="email" autoComplete="username" required /></label><label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label><button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'}<Icon name="arrow" /></button></form><p className="login-note"><Icon name="lock" /> Use the staff account issued by your Admin.</p></section></main>;
}
const NAV = [['/dashboard', 'dashboard', 'Dashboard'], ['/properties', 'properties', 'Assigned Properties'], ['/queue', 'queue', 'Data Entry Queue'], ['/media', 'media', 'Media'], ['/review-status', 'review', 'Review Status'], ['/profile', 'profile', 'Profile']];
function Shell() {
  const auth = useAuth(); const location = useLocation(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  if (auth.booting) return <Loading />;
  if (!auth.data) return <Navigate to="/login" replace />;
  const title = NAV.find(([path]) => location.pathname.startsWith(path))?.[2] || 'Property listing';
  return <div className="shell">{open && <button className="backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'open' : ''}`}><div className="brand">BookMyVilla <svg width="28" height="18" viewBox="0 0 28 18" aria-hidden="true"><path d="m1 16 8-10 5 5 5-9 8 14" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div><div className="workspace-name">Data Entry workspace</div><nav aria-label="Main navigation">{NAV.map(([path, icon, text]) => <NavLink key={path} to={path}><Icon name={icon} />{text}</NavLink>)}</nav><div className="sidebar-foot"><strong>{auth.data.user.name}</strong><span>Data Entry staff</span><button className="button ghost" onClick={auth.logout}><Icon name="logout" />Sign out</button></div></aside>
    <div className="main"><header className="topbar"><button className="menu-button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="menu" /></button><span>{title}</span><span className="staff-label">Assigned listings only</span></header><div className="content"><Outlet /></div></div>
  </div>;
}
const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { element: <Shell />, children: [
    { path: '/', element: <Navigate to="/dashboard" replace /> }, { path: '/dashboard', element: <Dashboard /> },
    { path: '/properties', element: <PropertyList /> }, { path: '/queue', element: <PropertyList mode="queue" /> },
    { path: '/media', element: <PropertyList mode="media" /> }, { path: '/review-status', element: <PropertyList mode="review" /> },
    { path: '/profile', element: <Profile /> }, { path: '/properties/:id', element: <Editor /> },
    { path: '/properties/:id/:section', element: <Editor /> }, { path: '*', element: <Navigate to="/dashboard" replace /> }
  ] }
]);
export default function App() { return <AuthProvider><RouterProvider router={router} /></AuthProvider>; }
