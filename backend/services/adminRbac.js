// Admin-console RBAC. Permissions are the unit of authorization; roles are a
// convenient bundle of permissions. The backend always enforces permissions
// (the frontend only hides what a user cannot do).

const PERMISSIONS = [
  'dashboard.view',
  'owners.view', 'owners.manage',
  'properties.view', 'properties.approve', 'properties.suspend',
  'bookings.view', 'bookings.note',
  'customers.view', 'customers.manage',
  'audit.view',
  'team.manage'
];

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  operations: ['dashboard.view', 'owners.view', 'owners.manage', 'properties.view', 'properties.approve', 'properties.suspend', 'bookings.view', 'bookings.note', 'customers.view', 'audit.view'],
  finance: ['dashboard.view', 'owners.view', 'bookings.view', 'audit.view'],
  support: ['dashboard.view', 'owners.view', 'bookings.view', 'bookings.note', 'customers.view', 'customers.manage'],
  risk: ['dashboard.view', 'owners.view', 'properties.view', 'properties.suspend', 'customers.view', 'audit.view'],
  content: ['dashboard.view', 'properties.view'],
  read_only: ['dashboard.view', 'owners.view', 'properties.view', 'bookings.view', 'customers.view', 'audit.view']
};

const ROLE_LABELS = {
  super_admin: 'Super Admin', operations: 'Operations', finance: 'Finance', support: 'Support',
  risk: 'Risk & Fraud', content: 'Content', read_only: 'Read Only'
};

// A role `admin` user with no explicit adminRole is the original platform admin
// and keeps full access. Otherwise permissions come from the role bundle plus
// any explicit extra grants in adminPermissions.
function effectivePermissions(user) {
  if (!user || user.role !== 'admin') return [];
  const role = user.adminRole || 'super_admin';
  const base = ROLE_PERMISSIONS[role] || [];
  if (base.includes('*')) return ['*'];
  return [...new Set([...base, ...(user.adminPermissions || []).filter(p => PERMISSIONS.includes(p))])];
}

function hasPermission(user, permission) {
  const perms = effectivePermissions(user);
  return perms.includes('*') || perms.includes(permission);
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, effectivePermissions, hasPermission };
