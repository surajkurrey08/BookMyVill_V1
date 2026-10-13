import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { updateSeoMetadata } from '../utils/seoMetadata';
import { seoPages } from '../seoPages';

const SITE_URL = 'https://bookmyvilla.online';

export default function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const page = seoPages[normalizedPath];
    const isProperty = /^\/property\/[^/]+$/.test(normalizedPath);
    const title = page?.title || (isProperty
      ? 'Book a Villa in Mahabaleshwar | BookMyVilla'
      : 'BookMyVilla | Find Your Perfect Stay');
    const description = page?.description || (isProperty
      ? 'Explore villa details, amenities and availability in Mahabaleshwar. Find your next stay with BookMyVilla.'
      : 'Discover handpicked villas, resorts and holiday stays in Mahabaleshwar with BookMyVilla.');
    const canonicalPath = page?.canonical || normalizedPath;
    const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
    const shouldIndex = Boolean(page || isProperty) && !page?.noindex;

    updateSeoMetadata({ title, description, canonicalUrl, shouldIndex });
  }, [pathname]);

  return null;
}
