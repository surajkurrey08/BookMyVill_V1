import React, { useState, useRef, useEffect } from 'react';
import './AiAssistant.css';

const OWNER_AI_KNOWLEDGE_BASE = [
  {
    keywords: ['price', 'pricing', 'rate', 'revenue', 'tariff'],
    response: "💡 **Host Dynamic Pricing Advisor:**\n• Peak Monsoon & Weekend Demand (Fri-Sun): Increase night rates by **25% - 35%**.\n• Off-peak Weekday Discount (Mon-Thu): Offer **15% discount** to boost occupancy.\n• Extra Guest Fee: Standard ₹1,000 per extra adult per night."
  },
  {
    keywords: ['caretaker', 'duty', 'staff', 'clean', 'pool', 'linen'],
    response: "🛡️ **Caretaker Management:**\n• Assign daily shift duties in **Caretaker & Daily Tasks** tab.\n• Ensure pool water filtration & linen sanitation checklist before guest check-in.\n• Emergency Request: Click 'Send Caretaker Request to Admin' in top bar."
  },
  {
    keywords: ['payout', 'bank', 'earnings', 'settle', 'money'],
    response: "💳 **Bank Payout & Earnings:**\n• Direct payouts are processed every **Monday morning** directly to your registered bank account.\n• Track net earnings & stay breakdown under **Earnings & Financials** tab."
  },
  {
    keywords: ['occupancy', 'boost', 'photo', 'booking'],
    response: "📈 **Boost Villa Occupancy:**\n1. Upload at least **6 high-definition photos** including sunset views.\n2. Enable **Live GPS Map Location** link.\n3. Add complimentary amenities like campfire setup or welcome strawberry drinks."
  }
];

const OWNER_SUGGESTIONS = [
  { label: '💡 Dynamic Pricing Tips', query: 'How should I price my villa rates?' },
  { label: '🛡️ Caretaker Duties', query: 'How to manage caretaker staff duties?' },
  { label: '💳 Payout Schedules', query: 'When are bank payouts processed?' },
  { label: '📈 Boost Villa Bookings', query: 'How to boost property occupancy?' }
];

const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Welcome Host! 👋 I am your **Property Owner AI Advisor**.\nAsk me anything about **pricing optimization, caretaker staff duties, bank payouts, or booking occupancy**!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const generateBotReply = (userQuery) => {
    const queryLower = userQuery.toLowerCase();
    
    for (const kb of OWNER_AI_KNOWLEDGE_BASE) {
      if (kb.keywords.some(kw => queryLower.includes(kw))) {
        return kb.response;
      }
    }

    return "🤖 **Host Assistant:**\nFor host account inquiries, pricing optimizations, or caretaker assignments, select from the suggested topics below or contact Admin Support!";
  };

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const replyText = generateBotReply(text.trim());
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="ai-assistant-wrapper">
      {!isOpen && (
        <button 
          className="ai-floating-trigger"
          onClick={() => setIsOpen(true)}
          title="Open Owner AI Advisor"
        >
          <div className="ai-trigger-icon-pulse">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <span className="ai-trigger-label">Host AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <div className="ai-chat-window glass-morphism">
          <div className="ai-chat-header">
            <div className="ai-header-info">
              <div className="ai-avatar-icon">
                <i className="fa-solid fa-robot"></i>
              </div>
              <div>
                <h3>Host AI Advisor</h3>
                <span className="ai-online-status">🟢 Online • Owner Intelligence</span>
              </div>
            </div>
            <button className="ai-close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="ai-chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`ai-message-row ${msg.sender}`}>
                {msg.sender === 'bot' && (
                  <div className="ai-msg-avatar"><i className="fa-solid fa-sparkles"></i></div>
                )}
                <div className="ai-message-bubble">
                  <div className="ai-message-text">
                    {msg.text.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                  <span className="ai-message-time">{msg.time}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="ai-message-row bot">
                <div className="ai-msg-avatar"><i className="fa-solid fa-sparkles"></i></div>
                <div className="ai-message-bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>

          <div className="ai-quick-pills">
            {OWNER_SUGGESTIONS.map((sug, i) => (
              <button 
                key={i}
                className="ai-pill-btn"
                onClick={() => handleSendMessage(sug.query)}
              >
                {sug.label}
              </button>
            ))}
          </div>

          <form className="ai-chat-input-bar" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
            <input 
              type="text"
              placeholder="Ask Host AI Advisor..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="ai-send-btn">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AiAssistant;
