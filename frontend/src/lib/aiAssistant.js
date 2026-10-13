export const AI_TOGGLE_EVENT = 'bmv:ai-toggle';
export const AI_STATE_EVENT = 'bmv:ai-state'; // detail: { open: boolean }
export const AI_DOCK_EVENT = 'bmv:ai-dock';

let headerButtons = 0;

export const hasHeaderButton = () => headerButtons > 0;

// Call from a mounted header button; returns the cleanup for useEffect.
export const registerHeaderButton = () => {
  headerButtons += 1;
  window.dispatchEvent(new Event(AI_DOCK_EVENT));
  return () => {
    headerButtons = Math.max(0, headerButtons - 1);
    window.dispatchEvent(new Event(AI_DOCK_EVENT));
  };
};

export const toggleAiAssistant = () => window.dispatchEvent(new Event(AI_TOGGLE_EVENT));
export const openAiAssistant = () => window.dispatchEvent(new CustomEvent(AI_TOGGLE_EVENT, { detail: { open: true } }));
export const closeAiAssistant = () => window.dispatchEvent(new CustomEvent(AI_TOGGLE_EVENT, { detail: { open: false } }));
