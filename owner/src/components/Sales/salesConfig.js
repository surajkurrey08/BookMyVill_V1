// Human-readable labels and icons for sales statuses. Status is always shown
// as icon + text, never by colour alone.

export const LEAD_STATUS = {
  new: { label: 'New', icon: 'fa-bolt', tone: 'gold' },
  contacted: { label: 'Contacted', icon: 'fa-phone', tone: 'blue' },
  qualified: { label: 'Qualified', icon: 'fa-user-check', tone: 'blue' },
  quotation_sent: { label: 'Quotation sent', icon: 'fa-file-invoice', tone: 'violet' },
  follow_up: { label: 'Follow-up', icon: 'fa-clock-rotate-left', tone: 'amber' },
  payment_pending: { label: 'Payment pending', icon: 'fa-hourglass-half', tone: 'amber' },
  booked: { label: 'Booked', icon: 'fa-circle-check', tone: 'emerald' },
  lost: { label: 'Lost', icon: 'fa-circle-xmark', tone: 'muted' }
};

export const QUOTE_STATUS = {
  draft: { label: 'Draft', icon: 'fa-pen-ruler', tone: 'muted' },
  sent: { label: 'Sent', icon: 'fa-paper-plane', tone: 'blue' },
  viewed: { label: 'Viewed', icon: 'fa-eye', tone: 'violet' },
  accepted: { label: 'Accepted', icon: 'fa-handshake', tone: 'emerald' },
  rejected: { label: 'Declined', icon: 'fa-thumbs-down', tone: 'danger' },
  expired: { label: 'Expired', icon: 'fa-hourglass-end', tone: 'amber' },
  withdrawn: { label: 'Withdrawn', icon: 'fa-rotate-left', tone: 'muted' },
  converted: { label: 'Booked', icon: 'fa-circle-check', tone: 'emerald' }
};

export const SOURCES = {
  website: { label: 'Website', icon: 'fa-globe' },
  phone: { label: 'Phone call', icon: 'fa-phone' },
  whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram' },
  facebook: { label: 'Facebook', icon: 'fa-brands fa-facebook' },
  walk_in: { label: 'Walk-in', icon: 'fa-person-walking' },
  agent: { label: 'Travel agent', icon: 'fa-briefcase' },
  ota: { label: 'OTA', icon: 'fa-building' },
  referral: { label: 'Referral', icon: 'fa-user-group' },
  email: { label: 'Email', icon: 'fa-envelope' },
  other: { label: 'Other', icon: 'fa-ellipsis' }
};

export const LOST_REASONS = {
  price: 'Price too high',
  dates_unavailable: 'Dates not available',
  booked_elsewhere: 'Booked elsewhere',
  no_response: 'Stopped responding',
  plans_cancelled: 'Trip cancelled',
  requirements_not_met: 'Requirements not met',
  other: 'Other'
};

export const CHANNELS = {
  call: { label: 'Call', icon: 'fa-phone' },
  whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  email: { label: 'Email', icon: 'fa-envelope' },
  sms: { label: 'SMS', icon: 'fa-comment-sms' },
  visit: { label: 'Visit', icon: 'fa-location-dot' },
  other: { label: 'Other', icon: 'fa-ellipsis' }
};

export const ACTIVITY = {
  created: { label: 'Inquiry received', icon: 'fa-inbox' },
  note: { label: 'Note', icon: 'fa-note-sticky' },
  call: { label: 'Call', icon: 'fa-phone' },
  whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  email: { label: 'Email', icon: 'fa-envelope' },
  sms: { label: 'SMS', icon: 'fa-comment-sms' },
  meeting: { label: 'Meeting', icon: 'fa-people-arrows' },
  status_change: { label: 'Status changed', icon: 'fa-arrow-right-arrow-left' },
  assignment: { label: 'Assignment', icon: 'fa-user-tag' },
  follow_up: { label: 'Follow-up', icon: 'fa-bell' },
  quote_created: { label: 'Quotation drafted', icon: 'fa-file-pen' },
  quote_sent: { label: 'Quotation sent', icon: 'fa-paper-plane' },
  quote_viewed: { label: 'Guest opened quotation', icon: 'fa-eye' },
  quote_accepted: { label: 'Guest accepted', icon: 'fa-handshake' },
  quote_rejected: { label: 'Guest declined', icon: 'fa-thumbs-down' },
  quote_withdrawn: { label: 'Quotation withdrawn', icon: 'fa-rotate-left' },
  quote_expired: { label: 'Quotation expired', icon: 'fa-hourglass-end' },
  quote_converted: { label: 'Booking created', icon: 'fa-calendar-check' },
  payment: { label: 'Payment', icon: 'fa-indian-rupee-sign' },
  system: { label: 'Update', icon: 'fa-circle-info' }
};

export const ADDON_CATEGORIES = { meal: 'Meal', experience: 'Experience', decoration: 'Decoration', transport: 'Transport', room: 'Room & beds', service: 'Service', other: 'Other' };
export const PRICING_UNITS = { per_stay: 'Per stay', per_night: 'Per night', per_guest: 'Per guest', per_guest_per_night: 'Per guest per night', per_unit: 'Per unit' };
export const PROMO_TYPES = {
  promo_code: 'Promo code', early_bird: 'Early bird', last_minute: 'Last minute', long_stay: 'Long stay',
  repeat_guest: 'Returning guest', corporate: 'Corporate', group: 'Group', seasonal: 'Seasonal'
};
export const STAFF_ROLES = { caretaker: 'Caretaker', front_desk: 'Front desk', housekeeping: 'Housekeeping', maintenance: 'Maintenance', manager: 'Manager', sales: 'Sales', reservations: 'Reservations' };

export const VALIDITY_OPTIONS = [
  { value: 30, label: '30 minutes' }, { value: 120, label: '2 hours' }, { value: 360, label: '6 hours' },
  { value: 1440, label: '24 hours' }, { value: 2880, label: '48 hours' }, { value: 4320, label: '72 hours' }, { value: 10080, label: '7 days' }
];
export const HOLD_MAX_MINUTES = 4320;

export const CANCELLATION_POLICIES = { flexible: 'Flexible', moderate: 'Moderate', strict: 'Strict', non_refundable: 'Non-refundable', custom: 'Custom' };

export const TAX_MODES = {
  none: 'No tax (not GST registered)',
  gst_hotel: 'GST hotel slabs (5% / 18%)',
  custom: 'Custom rate on stay'
};
