import { API_BASE_URL } from '../config';

let scriptPromise;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment window could not load.'));
      script.onerror = () => reject(new Error('Payment window could not load.'));
      document.body.appendChild(script);
    }).catch(error => { scriptPromise = null; throw error; });
  }
  return scriptPromise;
}

export async function launchRazorpayCheckout({ order, token, propertyName, user, onPaid, onError, onDismiss }) {
  await loadCheckout();
  const checkout = new window.Razorpay({
    key: order.key_id,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'BookMyVilla',
    description: propertyName || 'Property booking',
    order_id: order.order_id,
    prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
    theme: { color: '#c9a227' },
    handler: async payment => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify(payment)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.msg || 'Payment could not be verified.');
        onPaid(result);
      } catch (error) { onError(error); }
    },
    modal: { ondismiss: () => onDismiss?.() }
  });
  checkout.on('payment.failed', response => onError(new Error(response.error?.description || 'Payment failed. Your booking remains pending.')));
  checkout.open();
}
export { loadCheckout as loadRazorpayCheckout };
