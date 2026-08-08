import React, { useState, useRef, useEffect } from 'react';
import './AiAssistant.css';

const CARETAKER_AI_KNOWLEDGE_BASE = [
  {
    keywords: ['pool', 'water', 'ph', 'chlorine', 'clean'],
    response: "🏊 **Pool Sanitation Guidelines:**\n1. Run filter pump for at least **4 hours** before guest check-in.\n2. Maintain pH level between **7.2 - 7.6**.\n3. Add 20g chlorine granule per 10,000L water daily at 6:00 PM."
  },
  {
    keywords: ['checkin', 'key', 'guest', 'welcome', 'lockbox'],
    response: "🔑 **Guest Check-in Key Handover:**\n1. Verify booking ID & main guest name upon arrival.\n2. Hand over master key or share the **4-digit Lockbox PIN**.\n3. Provide welcome fresh strawberry drinks & brief villa tour."
  },
  {
    keywords: ['linen', 'towel', 'bed', 'wash', 'laundry'],
    response: "🧺 **Daily Linen & Room Prep:**\n• Replace all bedsheets, pillow covers & bath towels between check-outs.\n• Restock bathroom toiletries (soap, shampoo, toilet rolls).\n• Turn on geyser 30 mins before guest arrival."
  },
  {
    keywords: ['campfire', 'fire', 'wood', 'bbq', 'barbecue'],
    response: "🔥 **Campfire & BBQ Safety:**\n• Setup campfire only in designated garden pit away from dry trees.\n• Keep a water bucket & extinguisher ready at all times.\n• Douse campfire completely by 11:30 PM as per local hill station rules."
  }
];

const CARETAKER_SUGGESTIONS = [
  { label: '🏊 Pool Sanitation Steps', query: 'How to clean pool water?' },
  { label: '🔑 Guest Check-In Procedure', query: 'What is the check-in key handover rule?' },
  { label: '🧺 Room & Linen Prep', query: 'What are daily room preparation rules?' },
  { label: '🔥 Campfire & BBQ Safety', query: 'How to safely set up garden campfire?' }
];

const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Namaste Caretaker! 👋 I am your **Caretaker AI Operations Assistant**.\nAsk me about **pool sanitation, guest key handover, room linen prep, or campfire safety**!",
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
    const queryLower = userQuery.toLowerCase().trim();
    
    for (const kb of CARETAKER_AI_KNOWLEDGE_BASE) {
      if (kb.keywords.some(kw => queryLower.includes(kw))) {
        return kb.response;
      }
    }

    const cleanQuery = userQuery.replace(/[?.,!]/g, '').trim();
    return `🤖 **Caretaker Operations AI Assistant**\n\n` +
           `Regarding your staff task query: **"${cleanQuery}"**\n\n` +
           `🛠️ **Caretaker Guidance & Safety Protocol:**\n` +
           `For managing **${cleanQuery}** at the villa premises:\n\n` +
           `• **Guest Assistance:** Always inspect guest verification IDs and hand over master keys / lockbox codes warmly.\n` +
           `• **Sanitation Checklist:** Ensure pool filtration, daily room linen change, and bathroom restocking before 12:00 PM check-in.\n` +
           `• **Safety Rules:** Maintain bonfire safety bucket and enforce 10:00 PM quiet hours as per local hill station rules.\n\n` +
           `📞 **Emergency Staff Line:** Contact Property Host or Admin Hotline at +91 98765 43210 for urgent assistance!`;
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
          title="Caretaker AI Assistant"
        >
          <div className="ai-trigger-icon-pulse">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <span className="ai-unread-dot"></span>
        </button>
      )}

      {isOpen && (
        <div className="ai-chat-window glass-morphism">
          <div className="ai-chat-header">
            <div className="ai-header-info">
              <div className="ai-avatar-icon">
                <i className="fa-solid fa-user-gear"></i>
              </div>
              <div>
                <h3>Caretaker AI Assistant</h3>
                <span className="ai-online-status">🟢 Online • Staff Duty Assist</span>
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
            {CARETAKER_SUGGESTIONS.map((sug, i) => (
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
              placeholder="Ask Caretaker AI Assistant..."
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
