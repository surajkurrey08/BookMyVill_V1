// Uploaded property photos whose file no longer exists (a server lost it) show
// a stock villa photo instead of a broken image. One capture-phase listener
// covers every page: image `error` events don't bubble, but they do capture.
const UPLOADED = /\/(?:api\/properties\/media|uploads\/properties)\/|res\.cloudinary\.com\//i;

export function installImageFallback(fallbackSrc) {
  if (typeof document === 'undefined') return;
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback || !UPLOADED.test(img.currentSrc || img.src)) return;
    img.dataset.fallback = 'true';
    img.srcset = '';
    img.src = fallbackSrc;
  }, true);
}
