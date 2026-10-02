const HEADER_OFFSET = 76;

// Scrolls to a section AND pushes it into the URL as a real "#id" route, so
// the nav items that don't have their own page (Explore, Contact) are still
// bookmarkable/shareable links instead of silent in-page scrolling.
export const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
  if (window.history?.pushState) {
    window.history.pushState(null, '', `#${id}`);
  }
};
