export const getRawMapLink = (mapLink) => {
  if (!mapLink || typeof mapLink !== 'string') return '';
  let trimmed = mapLink.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const cleanLocationString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]|📍|⛰️|🏨|🏡|🚗/gu, '').trim();
};

export const formatGoogleMapsDirectionsUrl = (mapLink, name, location) => {
  if (mapLink && typeof mapLink === 'string') {
    let trimmed = mapLink.trim();
    if (trimmed) {
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = `https://${trimmed}`;
      }
      if (trimmed.includes('/dir/')) {
        return trimmed;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
    }
  }

  const cleanName = cleanLocationString(name);
  const cleanLoc = cleanLocationString(location);
  const destinationQuery = cleanLoc ? `${cleanName ? cleanName + ', ' : ''}${cleanLoc}` : (cleanName || 'Mahabaleshwar');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;
};
