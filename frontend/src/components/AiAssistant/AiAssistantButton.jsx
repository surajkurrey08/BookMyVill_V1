import { useEffect, useState } from 'react';
import { AI_STATE_EVENT, registerHeaderButton, toggleAiAssistant } from '../../lib/aiAssistant';
import './AiAssistantButton.css';

// Header pill that opens the AI assistant (sits next to Log In / profile).
const AiAssistantButton = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => registerHeaderButton(), []);

  useEffect(() => {
    const onState = (e) => setOpen(Boolean(e.detail?.open));
    window.addEventListener(AI_STATE_EVENT, onState);
    return () => window.removeEventListener(AI_STATE_EVENT, onState);
  }, []);

  return (
    <button
      type="button"
      className={`ai-header-btn ${open ? 'is-open' : ''}`}
      onClick={toggleAiAssistant}
      aria-expanded={open}
      aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
      title="BookMyVilla AI Assistant"
    >
      <span className="ai-header-btn-icon" aria-hidden="true">
        <i className="fa-solid fa-robot"></i>
      </span>
      <span className="ai-header-btn-label">AI</span>
      <span className="ai-header-btn-arrow" aria-hidden="true">
        <i className="fa-solid fa-arrow-right"></i>
      </span>
    </button>
  );
};

export default AiAssistantButton;
