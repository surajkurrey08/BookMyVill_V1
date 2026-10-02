import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

// Every page keeps its bundled image until an admin uploads a replacement.
export default function useSiteHero(pageKey, fallbackImage) {
  const [image, setImage] = useState(fallbackImage);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/site-heroes`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Hero images unavailable');
        const data = await response.json();
        const url = data.images?.[pageKey]?.url;
        if (active) setImage(url ? `${API_BASE_URL}${url}` : fallbackImage);
      } catch {
        if (active) setImage(fallbackImage);
      }
    };

    load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [pageKey, fallbackImage]);

  return image;
}
