import { isManagedProperty } from '../../lib/propertyAccess';

export default function ManagementNotice({ property, className = 'alert-box' }) {
  if (!isManagedProperty(property)) return null;
  return <div className={className} role="status"><div><strong>Managed by BookMyVilla</strong><p style={{ margin: '6px 0 0' }}>This property is currently managed by the BookMyVilla operations team. You can view bookings, performance and financial information, while operational management is handled by BookMyVilla.</p></div></div>;
}
