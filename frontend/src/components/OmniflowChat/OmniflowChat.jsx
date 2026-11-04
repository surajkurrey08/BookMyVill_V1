import { useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { loadOmniflowWidget } from '../../services/omniflowWidget';
import { fetchOmniflowSettings } from '../../services/omniflowSettings';
import './OmniflowChat.css';

// One runtime settings request per document, including React StrictMode.
let settingsRequest;

// Presentation only: keep Omniflow's elements, listeners, visitor ID and messages.
function applyBookMyVillaTheme() {
  const panel = document.querySelector('.ofw-panel');
  const launcher = document.querySelector('.ofw-btn');
  if (!panel || !launcher || panel.classList.contains('bmv-chat-panel')) return;

  panel.classList.add('bmv-chat-panel');
  panel.id = 'bookmyvilla-chat-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Chat with BookMyVilla');
  launcher.classList.add('bmv-chat-launcher');
  launcher.setAttribute('aria-controls', panel.id);
  launcher.title = 'Chat with BookMyVilla';
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 11.5h8M8 15h5"/></svg>';

  const heading = panel.querySelector('.ofw-head > span');
  const nativeTitle = panel.querySelector('#ofw-title');
  if (heading && nativeTitle) {
    // Retain the vendor title node: its asynchronous channel config still uses it.
    nativeTitle.hidden = true;
    const brand = document.createElement('span');
    brand.className = 'bmv-chat-brand';
    brand.innerHTML = 'BookMyVilla<svg viewBox="0 0 48 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M1 21 L15 5 L22 13 L30 3 L47 21"/><path d="M26 8 L30 3 L34 8"/></svg>';
    const titleText = Array.from(heading.childNodes).find((node) => node.nodeType === 3);
    if (titleText) heading.replaceChild(brand, titleText);
    else heading.prepend(brand);
    const subtitle = document.createElement('small');
    subtitle.className = 'bmv-chat-subtitle';
    subtitle.textContent = 'Villa & stay support';
    heading.appendChild(subtitle);
  }

  const input = panel.querySelector('#ofw-input');
  if (input) {
    input.setAttribute('aria-label', 'Message BookMyVilla');
    input.placeholder = 'Ask about your next stay…';
  }
}

export default function OmniflowChat() {
  useEffect(() => {
    let active = true;
    let script;
    const warn = (message) => { if (import.meta.env.DEV) console.warn(`[Omniflow] ${message}`); };
    settingsRequest ||= fetchOmniflowSettings(API_BASE_URL);
    settingsRequest.then((settings) => {
      if (!active || !settings) return;
      script = loadOmniflowWidget(settings, { production: import.meta.env.PROD, onError: warn });
      applyBookMyVillaTheme();
      script?.addEventListener('load', applyBookMyVillaTheme);
    }).catch(error => { if (active) warn(error.message); });
    // Document-lifetime widget: do not remove/reinsert the script on effect
    // cleanup. This preserves chat through navigation and StrictMode remounts.
    return () => { active = false; script?.removeEventListener('load', applyBookMyVillaTheme); };
  }, []);

  return null;
}
