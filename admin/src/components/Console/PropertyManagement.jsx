import { useEffect, useState } from 'react';
import { adminApi } from './api';
import { MANAGEMENT_STATUS, managementLabel, staffId, staffName } from './config';
import { Alert, ConfirmDialog, Facts, Labelled, StatusBadge } from './ui';

export default function PropertyManagement({ property, can, onChanged }) {
  const [draft, setDraft] = useState(null);
  const [confirmMode, setConfirmMode] = useState(false);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffRetry, setStaffRetry] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = Boolean(can('properties.manage'));
  const mode = property.managementMode || 'SELF_MANAGED';
  const editing = Boolean(draft);

  useEffect(() => {
    if (!editing || !editable) return;
    const controller = new AbortController();
    setLoading(true); setStaffError('');
    adminApi('/property-management-staff', { signal: controller.signal }).then(setStaff).catch(err => {
      if (err.name !== 'AbortError') setStaffError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [editing, editable, staffRetry]);

  const edit = () => {
    setError(''); setNotice(''); setConfirmMode(false);
    setDraft({ managementMode: mode, assignedVillaManager: staffId(property.assignedVillaManager), assignedDataEntryUser: staffId(property.assignedDataEntryUser) });
  };
  const close = () => { if (!busy) { setDraft(null); setConfirmMode(false); setError(''); } };
  const changes = draft ? Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== (key === 'managementMode' ? mode : staffId(property[key]))).map(([key, value]) => [key, value || null])) : {};

  async function save(body) {
    if (busy || !editable) return;
    setBusy(true); setError(''); let saved = false;
    try {
      await adminApi(`/properties/${property._id}/management`, { method: 'PATCH', body });
      saved = true;
      await onChanged();
      setDraft(null); setConfirmMode(false); setNotice('Property management saved.');
    } catch (err) {
      setError(saved ? 'Changes were saved, but the property could not refresh. Close and reopen it to see the latest information.' : err.message);
    } finally { setBusy(false); }
  }

  function submit() {
    if (!Object.keys(changes).length) { close(); return; }
    if (draft.managementMode !== mode && !confirmMode) { setConfirmMode(true); return; }
    save(changes);
  }

  const staffSelect = (field, label, items, current) => <Labelled label={label} hint="Choose Unassigned to remove the assignment.">
    <select aria-label={label} value={draft[field]} disabled={busy || loading || Boolean(staffError) || (field === 'assignedVillaManager' && draft.managementMode === 'SELF_MANAGED')} onChange={e => setDraft(previous => ({ ...previous, [field]: e.target.value }))}>
      <option value="">Unassigned</option>
      {current && !items.some(user => user._id === staffId(current)) && <option value={staffId(current)} disabled>{staffName(current)} (currently assigned; unavailable)</option>}
      {items.map(user => <option key={user._id} value={user._id}>{user.name}{user.email || user.phone ? ` — ${user.email || user.phone}` : ''}</option>)}
    </select>
    {!loading && !staffError && !items.length && <small>No active {field === 'assignedVillaManager' ? 'Villa Manager' : 'Data Entry'} users available. Assignment can remain unassigned.</small>}
  </Labelled>;

  return <section className="ac-sub">
    <h4>Management</h4>
    <Facts items={[
      ['Management Mode', <StatusBadge meta={MANAGEMENT_STATUS[mode]} fallback={managementLabel(mode)} />],
      ['Villa Manager', staffName(property.assignedVillaManager)],
      ['Data Entry', staffName(property.assignedDataEntryUser)],
    ]} />
    {mode === 'BOOKMYVILLA_MANAGED' && !property.assignedVillaManager && <Alert kind="warn">Villa Manager: Unassigned. Assign a manager when ready; the property remains available for review.</Alert>}
    {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
    {error && !draft && <Alert onClose={() => setError('')}>{error}</Alert>}
    {editable && <div className="ac-toolbar">
      <button type="button" className="ac-btn ghost sm" disabled={busy} onClick={edit}>Change management / assignments</button>
      {property.assignedVillaManager && <button type="button" className="ac-btn ghost sm" disabled={busy} onClick={() => save({ assignedVillaManager: null })}>Remove Villa Manager</button>}
      {property.assignedDataEntryUser && <button type="button" className="ac-btn ghost sm" disabled={busy} onClick={() => save({ assignedDataEntryUser: null })}>Remove Data Entry</button>}
    </div>}
    {draft && <ConfirmDialog title={confirmMode ? 'Confirm management mode change' : 'Edit property management'} confirmLabel={confirmMode ? 'Confirm management change' : 'Save changes'} busy={busy} onClose={close} onConfirm={submit}>
      <Alert>{error}</Alert>
      {confirmMode ? <>
        <p><strong>{managementLabel(mode)} → {managementLabel(draft.managementMode)}</strong></p>
        <p>{draft.managementMode === 'BOOKMYVILLA_MANAGED' ? 'BookMyVilla will operationally manage this property. The owner keeps ownership, but operational write access is restricted by the backend. You may assign a Villa Manager.' : 'This property returns to owner-managed operations. The previous Villa Manager assignment is cleared and will no longer provide operational control.'}</p>
        <p>Villa Manager: {draft.assignedVillaManager ? staffName(staff?.villaManagers.find(user => user._id === draft.assignedVillaManager) || property.assignedVillaManager) : 'Unassigned'}<br />Data Entry: {draft.assignedDataEntryUser ? staffName(staff?.dataEntryUsers.find(user => user._id === draft.assignedDataEntryUser) || property.assignedDataEntryUser) : 'Unassigned'}</p>
        <button type="button" className="ac-btn ghost sm" disabled={busy} onClick={() => setConfirmMode(false)}>Back to edit</button>
      </> : <>
        <Labelled label="Management Mode">
          <select aria-label="Management Mode" value={draft.managementMode} disabled={busy} onChange={e => setDraft(previous => ({ ...previous, managementMode: e.target.value, ...(e.target.value === 'SELF_MANAGED' && { assignedVillaManager: '' }) }))}>
            {Object.entries(MANAGEMENT_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </Labelled>
        {loading && <p className="ac-muted">Loading eligible staff…</p>}
        {staffError && <><Alert>{staffError}</Alert><button type="button" className="ac-btn ghost sm" onClick={() => setStaffRetry(previous => previous + 1)}>Retry staff lookup</button></>}
        {staffSelect('assignedVillaManager', 'Villa Manager', staff?.villaManagers || [], property.assignedVillaManager)}
        {staffSelect('assignedDataEntryUser', 'Data Entry', staff?.dataEntryUsers || [], property.assignedDataEntryUser)}
        {draft.managementMode === 'SELF_MANAGED' && <p>Villa Manager assignment is not required for a self-managed property.</p>}
      </>}
    </ConfirmDialog>}
  </section>;
}
