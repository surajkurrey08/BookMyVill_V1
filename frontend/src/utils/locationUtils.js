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
      // 1. If it's GPS coordinates like "17.9258,73.6510" or "17.9258, 73.6510"
      if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed)) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
      }

      // 2. Add protocol if missing
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        // If it looks like a domain or URL path (e.g., maps.app.goo.gl/xxx or google.com/maps)
        if (trimmed.includes('.') || trimmed.includes('/')) {
          trimmed = `https://${trimmed}`;
        } else {
          // It's a text address string
          return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed + ', Mahabaleshwar, Maharashtra')}`;
        }
      }

      // 3. If it's a full URL (google.com/maps, maps.app.goo.gl, goo.gl/maps, etc.), return directly!
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
    }
  }

  // 4. Fallback search query constructed from hotel name and location
  const cleanName = cleanLocationString(name);
  const cleanLoc = cleanLocationString(location);
  const destinationQuery = cleanLoc 
    ? `${cleanName ? cleanName + ', ' : ''}${cleanLoc}, Mahabaleshwar, Maharashtra` 
    : (cleanName ? `${cleanName}, Mahabaleshwar, Maharashtra` : 'Mahabaleshwar, Maharashtra');

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;
};
