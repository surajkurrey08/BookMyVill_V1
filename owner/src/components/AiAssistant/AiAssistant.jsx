import React, { useState, useRef, useEffect } from 'react';
import './AiAssistant.css';

const OWNER_AI_KNOWLEDGE_BASE = [
  {
    keywords: ['price', 'pricing', 'rate', 'revenue', 'tariff', 'cost'],
    response: "💡 **Host Dynamic Pricing Advisor:**\n• Peak Monsoon & Weekend Demand (Fri-Sun): Increase night rates by **25% - 35%**.\n• Off-peak Weekday Discount (Mon-Thu): Offer **15% discount** to boost occupancy.\n• Extra Guest Fee: Standard ₹1,000 per extra adult per night.\n• Instant Discount: Apply 10% coupon for bookings over 3 nights."
  },
  {
    keywords: ['caretaker', 'duty', 'staff', 'clean', 'pool', 'linen', 'laundry'],
    response: "🛡️ **Caretaker Management & Guidelines:**\n• Assign daily shift duties in **Caretaker & Daily Tasks** tab.\n• Ensure pool water filtration & linen sanitation checklist before guest check-in.\n• Emergency Request: Click 'Send Caretaker Request to Admin' in top bar."
  },
  {
    keywords: ['payout', 'bank', 'earnings', 'settle', 'money', 'payment'],
    response: "💳 **Bank Payout & Financials:**\n• Direct payouts are processed every **Monday morning** directly to your registered bank account.\n• Track net earnings & stay breakdown under **Earnings & Financials** tab.\n• GST invoices are auto-generated for all completed stays."
  },
  {
    keywords: ['occupancy', 'boost', 'photo', 'booking', 'promote', 'guests'],
    response: "📈 **Boost Villa Occupancy:**\n1. Upload at least **6 high-definition photos** including sunset views.\n2. Enable **Live GPS Map Location** link.\n3. Add complimentary amenities like campfire setup or welcome strawberry drinks.\n4. Keep caretaker response time under 15 minutes."
  },
  {
    keywords: ['sightseeing', 'location', 'point', 'mapro', 'lake', 'tourist'],
    response: "📍 **Mahabaleshwar Sightseeing Support:**\n• Venna Lake: 15 mins drive (Boating & Horse Riding)\n• Mapro Garden: Fresh Strawberry Cream & Wood-fired Pizza\n• Arthur's Seat & Elephant Head: Panoramic Savitri Valley Echo Point\n• Panchgani Table Land: Sunset point & paragliding"
  }
];

const OWNER_SUGGESTIONS = [
  { label: '💡 Dynamic Pricing Tips', query: 'How should I price my villa rates?' },
  { label: '🛡️ Caretaker Duties', query: 'How to manage caretaker staff duties?' },
  { label: '💳 Payout Schedules', query: 'When are bank payouts processed?' },
  { label: '📈 Boost Occupancy', query: 'How to boost property occupancy?' },
  { label: '📍 Local Sightseeing Points', query: 'What local sightseeing points should I recommend to guests?' }
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

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#•]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateBotReply = (userQuery) => {
    const queryLower = userQuery.toLowerCase().trim();
    
    for (const kb of OWNER_AI_KNOWLEDGE_BASE) {
      if (kb.keywords.some(kw => queryLower.includes(kw))) {
        return kb.response;
      }
    }

    const cleanQuery = userQuery.replace(/[?.,!]/g, '').trim();
    return `🤖 **Property Owner AI Advisor**\n\n` +
           `Regarding your host query: **"${cleanQuery}"**\n\n` +
           `💡 **Host Guidance & Assistance:**\n` +
           `As a property owner on Mahabaleshwar Luxury Stays, you have full control over **${cleanQuery}**!\n\n` +
           `• **Dashboard Control:** Update villa tariffs, manage availability calendars, and review guest arrivals in real-time.\n` +
           `• **Caretaker Coordination:** Assign tasks, pool maintenance, and check-in schedules directly via the Caretaker Portal.\n` +
           `• **Direct Bank Payouts:** Every Monday morning, net booking payouts are directly deposited to your bank account.\n\n` +
           `📞 **Host Partner Helpdesk:** Call +91 98765 43210 or email partner-support@mahabaleshwarstays.com for dedicated host assistance.`;
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

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: "Chat reset! How else can I assist your property hosting?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="ai-assistant-wrapper">
      {!isOpen && (
        <button 
          className="ai-floating-trigger"
          onClick={() => setIsOpen(true)}
          title="Mahabaleshwar Host AI Assistant"
        >
          <div className="ai-trigger-icon-pulse">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <span className="ai-unread-dot"></span>
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
                <span className="ai-online-status">🟢 Online • Owner Support</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={clearChat} 
                title="Reset Chat"
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.8 }}
              >
                <i className="fa-solid fa-rotate-left"></i>
              </button>
              <button className="ai-close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
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
                  <span className="ai-message-time">
                    {msg.time}
                    {msg.sender === 'bot' && (
                      <button 
                        onClick={() => speakText(msg.text)} 
                        title="Listen Voice"
                        style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', marginLeft: '6px', fontSize: '0.75rem' }}
                      >
                        <i className="fa-solid fa-volume-high"></i>
                      </button>
                    )}
                  </span>
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
