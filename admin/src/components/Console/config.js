export const rupees = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
export const compactRupees = amount => {
  const n = Number(amount || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
};
export const dateTime = v => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const shortDate = v => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return '—';
  const diff = now - new Date(iso).getTime();
  const m = Math.round(Math.abs(diff) / 60000);
  const label = m < 1 ? 'just now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  return m < 1 ? label : `${label} ago`;
}

export const ACCOUNT_STATUS = {
  active: { label: 'Active', tone: 'good', icon: 'fa-circle-check' },
  approved: { label: 'Active', tone: 'good', icon: 'fa-circle-check' },
  restricted: { label: 'Restricted', tone: 'warn', icon: 'fa-triangle-exclamation' },
  suspended: { label: 'Suspended', tone: 'bad', icon: 'fa-ban' },
  pending: { label: 'Pending', tone: 'info', icon: 'fa-hourglass-half' },
  rejected: { label: 'Rejected', tone: 'bad', icon: 'fa-circle-xmark' }
};

export const PROPERTY_STATUS = {
  pending: { label: 'Pending review', tone: 'info', icon: 'fa-hourglass-half' },
  under_review: { label: 'Changes requested', tone: 'warn', icon: 'fa-pen-ruler' },
  approved: { label: 'Live', tone: 'good', icon: 'fa-circle-check' },
  rejected: { label: 'Rejected', tone: 'bad', icon: 'fa-circle-xmark' },
  suspended: { label: 'Suspended', tone: 'bad', icon: 'fa-ban' }
};

export const BOOKING_STATUS = {
  pending: { label: 'Pending', tone: 'info', icon: 'fa-hourglass-half' },
  confirmed: { label: 'Confirmed', tone: 'good', icon: 'fa-circle-check' },
  cancelled: { label: 'Cancelled', tone: 'bad', icon: 'fa-circle-xmark' }
};
export const PAYMENT_STATUS = {
  pending: { label: 'Unpaid', tone: 'warn', icon: 'fa-hourglass-half' },
  paid: { label: 'Paid', tone: 'good', icon: 'fa-indian-rupee-sign' },
  failed: { label: 'Failed', tone: 'bad', icon: 'fa-circle-xmark' }
};
export const STAY_STATUS = {
  expected: { label: 'Expected', tone: 'info' }, in_house: { label: 'In house', tone: 'good' }, checked_out: { label: 'Checked out', tone: 'neutral' }
};
export const KYC_STATUS = {
  approved: { label: 'Verified', tone: 'good' }, pending: { label: 'Pending', tone: 'info' }, rejected: { label: 'Rejected', tone: 'bad' }, not_submitted: { label: 'Not submitted', tone: 'neutral' }
};
export const SEVERITY = {
  critical: { label: 'Critical', tone: 'bad', icon: 'fa-triangle-exclamation' },
  high: { label: 'High', tone: 'warn', icon: 'fa-arrow-up' },
  medium: { label: 'Medium', tone: 'info', icon: 'fa-minus' }
};

export const PERMISSION_LABELS = {
  'dashboard.view': 'View dashboard', 'owners.view': 'View owners', 'owners.manage': 'Manage owner accounts',
  'properties.view': 'View properties', 'properties.approve': 'Approve / reject properties', 'properties.suspend': 'Suspend properties',
  'bookings.view': 'View bookings', 'bookings.note': 'Add booking notes',
  'customers.view': 'View customers', 'customers.manage': 'Manage customer accounts',
  'audit.view': 'View audit log', 'team.manage': 'Manage admin team'
};
