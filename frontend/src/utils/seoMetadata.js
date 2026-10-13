function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = url;
}

export function updateSeoMetadata({ title, description, canonicalUrl, shouldIndex }) {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', shouldIndex ? 'index,follow' : 'noindex,follow');
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', 'BookMyVilla');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setCanonical(canonicalUrl);
}
