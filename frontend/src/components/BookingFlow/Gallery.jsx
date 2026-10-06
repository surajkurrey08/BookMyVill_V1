import { useCallback, useEffect, useState } from 'react';
import { icon } from './shared';

// Property photo gallery that fits any number of photos (1, 2, 3 or many) in a
// fixed-height frame, plus a full-screen viewer for browsing all of them.
export default function Gallery({ photos, name, badge }) {
  const [viewer, setViewer] = useState(null); // index being viewed, or null
  const count = photos.length;
  const side = photos.slice(1, 4);
  const extra = count - 4;

  return <>
    <div className={`bf-gallery bf-gallery-${Math.min(count, 4)}`}>
      <button type="button" className="bf-gallery-primary" onClick={() => setViewer(0)} aria-label={`Open photo 1 of ${count}`}>
        <img src={photos[0]} alt={name} />
        {badge}
        {count > 1 && <span className="bf-gallery-count">{icon('images')} {count} photos</span>}
      </button>
      {side.length > 0 && <div className="bf-gallery-stack">
        {side.map((src, index) => <button type="button" key={src + index} onClick={() => setViewer(index + 1)} aria-label={`Open photo ${index + 2} of ${count}`}>
          <img src={src} alt={`${name} view ${index + 2}`} loading="lazy" />
          {index === side.length - 1 && extra > 0 && <span className="bf-more-photos">+{extra} photos</span>}
        </button>)}
      </div>}
    </div>
    {viewer !== null && <PhotoViewer photos={photos} name={name} start={viewer} onClose={() => setViewer(null)} />}
  </>;
}

function PhotoViewer({ photos, name, start, onClose }) {
  const [index, setIndex] = useState(start);
  const count = photos.length;
  const go = useCallback(step => setIndex(current => (current + step + count) % count), [count]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    window.__lenis?.stop();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; window.__lenis?.start(); };
  }, [go, onClose]);

  return <div className="bf-viewer" role="dialog" aria-modal="true" aria-label={`${name} photos`} data-lenis-prevent onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="bf-viewer-top"><span>{index + 1} / {count}</span><button type="button" onClick={onClose} aria-label="Close photos">{icon('xmark')}</button></div>
    <div className="bf-viewer-stage">
      {count > 1 && <button type="button" className="bf-viewer-nav is-prev" onClick={() => go(-1)} aria-label="Previous photo">{icon('chevron-left')}</button>}
      <img src={photos[index]} alt={`${name} photo ${index + 1}`} />
      {count > 1 && <button type="button" className="bf-viewer-nav is-next" onClick={() => go(1)} aria-label="Next photo">{icon('chevron-right')}</button>}
    </div>
    {count > 1 && <div className="bf-viewer-thumbs">{photos.map((src, i) => <button type="button" key={src + i} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`}><img src={src} alt="" loading="lazy" /></button>)}</div>}
  </div>;
}
