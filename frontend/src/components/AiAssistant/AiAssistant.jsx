import React, { useState, useRef, useEffect } from 'react';
import './AiAssistant.css';

const HOTEL_AND_LOCATION_DATABASE = [
  {
    names: ['sunset', 'grand sunset', 'sunset villa'],
    title: '👑 Grand Sunset Villa & Resort',
    location: 'Sunset Point Road, Mahabaleshwar',
    perspective: {
      rating: '4.9/5 ⭐ (Guest Favorite)',
      stayVibe: 'Panoramic valley view, serene foggy evenings & quiet luxury experience',
      amenities: ['Private Infinity Pool', '4 King Bedrooms', '24/7 Chef & Caretaker', 'Lawn & Bonfire'],
      distance: '1.2 km from Sunset Point | 2.5 km from Main Market',
      bestFor: 'Couples, Luxury Seekers & Family Gatherings',
      price: '₹5,500 - ₹8,500 / night',
      guestReview: '"The view from the pool at sunset is unmatched. Caretaker Ramesh prepared delicious fresh Maharashtrian meals for us!" — Verified Guest'
    }
  },
  {
    names: ['strawberry', 'strawberry hill', 'strawberry estate'],
    title: '🍓 Strawberry Hill Luxury Estate',
    location: 'Avakali Village, Panchgani-Mahabaleshwar Road',
    perspective: {
      rating: '4.8/5 ⭐ (Top Rated Stay)',
      stayVibe: 'Private strawberry farm picking, crisp mountain air & wooden cottage luxury',
      amenities: ['Private Strawberry Garden', 'Jacuzzi', 'Gazebo Dining', 'Home-cooked Meals'],
      distance: '3.0 km from Mapro Garden | 4.0 km from Panchgani Market',
      bestFor: 'Families with Kids & Nature Lovers',
      price: '₹4,800 - ₹7,200 / night',
      guestReview: '"Waking up to picking fresh strawberries right outside our bedroom was magical. 10/10 hospitality!" — Verified Guest'
    }
  },
  {
    names: ['venna', 'venna lake', 'lake retreat', 'lake view'],
    title: '🌊 Venna Lake View Villa & Suites',
    location: 'Venna Lake Front Road, Mahabaleshwar',
    perspective: {
      rating: '4.9/5 ⭐ (Best Location)',
      stayVibe: 'Waterfront luxury with direct lake views, misty morning breeze & boating access',
      amenities: ['Lake View Balconies', '3 Deluxe BHK Suites', 'Barbecue & Bonfire', '24/7 Caretaker'],
      distance: '0.4 km from Venna Lake Boating Deck | 1.8 km from Market',
      bestFor: 'Lake Enthusiasts, Adventure Lovers & Group Outings',
      price: '₹5,200 - ₹9,000 / night',
      guestReview: '"Direct view of Venna Lake from the bed! We loved horse riding and boating just 5 mins away." — Verified Guest'
    }
  },
  {
    names: ['panchgani', 'panchgani hill'],
    title: '🏞️ Panchgani Valley Stays & Estates',
    location: 'Panchgani Hill Station Plateau',
    perspective: {
      rating: '4.7/5 ⭐ (Scenic Hill View)',
      stayVibe: 'Table Land view, cooler breeze, strawberry orchards & heritage bungalows',
      amenities: ['Private Lawn', 'Table Land View Balcony', 'Barbecue Pit', 'Spacious Parking'],
      distance: '15 km from Mahabaleshwar Town | Close to Sydney Point & Table Land',
      bestFor: 'Weekenders, Corporate Retreats & Quiet Getaways',
      price: '₹3,900 - ₹6,500 / night',
      guestReview: '"Quiet retreat away from city noise. Great access to Table Land and local strawberry cafes."'
    }
  },
  {
    names: ['mapro', 'mapro garden'],
    title: '🍓 Mapro Garden & Strawberry Corridor',
    location: 'Gureghar, Panchgani-Mahabaleshwar Road',
    perspective: {
      rating: '4.9/5 ⭐ (Must-Visit Landmark)',
      stayVibe: 'Famous for fresh strawberry ice cream, wood-fired pizzas, syrups & lush greenery',
      amenities: ['Gourmet Food Court', 'Chocolate Factory Tour', 'Strawberry Shopping', 'Children Park'],
      distance: '8 km from Mahabaleshwar Market',
      bestFor: 'Foodies, Shoppers & Family Outings',
      price: 'Free Entry (Shopping & Dining as per menu)',
      guestReview: '"Best wood-fired pizza and strawberry cream in India! Nearby stays are super convenient."'
    }
  },
  {
    names: ['arthur', 'arthur seat', 'elephant', 'view point'],
    title: '⛰️ Arthur’s Seat & Elephant’s Head Point',
    location: 'Old Mahabaleshwar Ridge',
    perspective: {
      rating: '4.9/5 ⭐ (Top Attraction)',
      stayVibe: 'Queen of all points! Deep Savitri river valley views, floating echo point & breezy cliffs',
      amenities: ['Sunrise/Sunset Views', 'Echo Point', 'Local Tea & Corn Stalls', 'Trekking Paths'],
      distance: '12 km from Main City Center',
      bestFor: 'Photography, Nature Lovers & Sightseeing',
      price: 'Nominal Entry / Parking Fee',
      guestReview: '"The clouds literally float right past your face! Nearby private villas offer stunning sunrise views."'
    }
  }
];

const AI_KNOWLEDGE_BASE = [
  {
    keywords: ['book', 'reservation', 'price', 'rate', 'cost', 'pay', 'deposit'],
    response: "📅 **How to Book a Stay:**\n1. Go to the **Explore Stays** section.\n2. Select your check-in and check-out dates.\n3. Choose your favorite luxury villa.\n4. Click **Book Now** to secure instant confirmation!\n\nAll bookings include 24/7 caretaker assistance & fresh welcome drinks."
  },
  {
    keywords: ['caretaker', 'staff', 'host', 'service', 'key', 'clean', 'food'],
    response: "👤 **24/7 Caretaker Staff Support:**\nEvery villa on Mahabaleshwar Luxury Stays includes a certified local caretaker for:\n• Instant key handover & gate security\n• Home-cooked authentic Maharashtrian meals\n• Daily housekeeping & bonfire setup\n• Emergency assistance"
  },
  {
    keywords: ['contact', 'help', 'phone', 'support', 'owner', 'number'],
    response: "📞 **Support & Direct Contact:**\n• Admin Helpline: +91 98765 43210\n• WhatsApp Support: Instant Live Support via bottom WhatsApp button\n• Email: support@mahabaleshwarstays.com"
  },
  {
    keywords: ['list', 'partner', 'owner', 'add property', 'join'],
    response: "🤝 **Property Owners & Hosts:**\nYou can list your luxury villa or resort with us! Click **'Join Us'** or **'Register Property'** in the top menu to get your villa verified by our admin team."
  }
];

const QUICK_SUGGESTIONS = [
  { label: '🏰 Grand Sunset Villa', query: 'Tell me details about Grand Sunset Villa' },
  { label: '🌊 Venna Lake Retreat', query: 'Search Venna Lake View Villa details' },
  { label: '🍓 Strawberry Estate', query: 'Tell me about Strawberry Hill Estate' },
  { label: '🏞️ Panchgani Stays', query: 'What are Panchgani stays like?' },
  { label: '📞 Support Contact', query: 'How can I contact admin support?' }
];

const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hello! 👋 I am your **Mahabaleshwar AI Luxury Concierge**.\nSearch any **Hotel, Villa or Location** (e.g. *Sunset Villa*, *Venna Lake*, *Panchgani*, *Mapro Garden*) to view guest perspective details!",
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

const DYNAMIC_NLP_TOPICS = [
  {
    keywords: ['pet', 'pets', 'dog', 'dogs', 'cat', 'animal'],
    response: "🐾 **Pet-Friendly Stays:**\nMost of our private luxury villas in Mahabaleshwar are pet-friendly! Guests can bring pets into private garden lawns. Please mention your pet details to the caretaker during check-in so extra pet bowls & bed setups can be prepared."
  },
  {
    keywords: ['checkin', 'checkout', 'check in', 'check out', 'time', 'early', 'late', 'timing'],
    response: "⏰ **Standard Check-in & Check-out Timings:**\n• Check-in: **12:00 PM**\n• Check-out: **10:00 AM**\n\n💡 *Early check-in or late check-out is available free of cost subject to villa availability. Simply contact your villa caretaker upon arrival!*"
  },
  {
    keywords: ['food', 'breakfast', 'meal', 'lunch', 'dinner', 'cook', 'chef', 'eat', 'veg', 'non-veg', 'menu', 'tea'],
    response: "🍽️ **Fresh Homemade Dining:**\n• Complimentary Maharashtrian breakfast (Pohe, Upma, Fresh Strawberry Juice/Tea).\n• Authentic Veg & Non-Veg meals (Mahabaleshwar style handi chicken/mutton).\n• Full access to private kitchen or personal caretaker cook."
  },
  {
    keywords: ['pool', 'swimming', 'water', 'swim', 'jacuzzi'],
    response: "🏊 **Private Infinity Pool & Sanitation:**\n• Temperature-checked fresh mountain water filtered daily.\n• Pool Hours: 6:00 AM - 10:00 PM.\n• Private gazebo dining & poolside lounge loungers."
  },
  {
    keywords: ['wifi', 'internet', 'network', 'power', 'generator', 'backup', 'work', 'speed'],
    response: "📶 **Connectivity & 24/7 Power Backup:**\n• High-speed fiber Wi-Fi (50+ Mbps) suitable for remote work.\n• 24/7 automatic DG generator backup for continuous lighting & hot water during foggy monsoon weather."
  },
  {
    keywords: ['park', 'parking', 'car', 'vehicle', 'suv', 'bus', 'driver'],
    response: "🚗 **Secure Gated Parking:**\n• Free private gated parking inside villa premises for up to 4 large SUVs.\n• Complimentary driver restroom & accommodation available on request."
  },
  {
    keywords: ['bonfire', 'campfire', 'bbq', 'barbecue', 'fire', 'grill'],
    response: "🔥 **Campfire & BBQ Nights:**\n• Complimentary wood logs for evening lawn campfire.\n• Marinated veg & non-veg barbecue grill setup managed by villa caretaker."
  },
  {
    keywords: ['cancel', 'refund', 'policy', 'modify', 'change date'],
    response: "🛡️ **Flexible Cancellation & Refund Policy:**\n• 100% full refund if cancelled 48 hours prior to check-in.\n• Free date modification within 30 days of booking.\n• Instant refund processing back to source payment account."
  },
  {
    keywords: ['weather', 'rain', 'monsoon', 'temperature', 'winter', 'cloth', 'season', 'jacket'],
    response: "🌤️ **Mahabaleshwar Climate & Attire Guide:**\n• Temperature: Cool 15°C – 22°C year-round.\n• Monsoon (Jun - Sep): Lush foggy valleys, waterfalls & heavy rain.\n• Winter (Oct - Feb): Fresh strawberry harvest & crisp chilly evenings.\n💡 *Recommendation: Carry a light jacket or sweater for chilly evenings.*"
  },
  {
    keywords: ['party', 'event', 'birthday', 'anniversary', 'music', 'speaker', 'celebrate'],
    response: "🎉 **Private Events & Celebrations:**\n• Private birthday/anniversary lawn decoration available on request.\n• High-bass Bluetooth speakers provided.\n• Outdoor music allowed till 10:00 PM as per hill station quiet hours."
  },
  {
    keywords: ['couple', 'unmarried', 'safety', 'safe', 'family', 'kids'],
    response: "🔒 **Guest Safety & Verification:**\n• 100% couple-friendly and family safe environment.\n• Valid Government Photo ID (Aadhaar, Passport, Driving License) required at check-in.\n• 24/7 gated CCTV security & dedicated local caretaker."
  }
];

  const generateBotReply = (userQuery) => {
    const queryLower = userQuery.toLowerCase().trim();
    
    // 1. Search Hotel & Location Database for User Perspective Details
    for (const item of HOTEL_AND_LOCATION_DATABASE) {
      if (item.names.some(name => queryLower.includes(name))) {
        const p = item.perspective;
        return `🏨 **${item.title}**\n📍 *${item.location}*\n\n` +
               `⭐ **Guest Rating:** ${p.rating}\n` +
               `✨ **User Perspective & Vibe:** ${p.stayVibe}\n` +
               `🏡 **Key Amenities:** ${p.amenities.join(', ')}\n` +
               `📍 **Distance:** ${p.distance}\n` +
               `🎯 **Ideal For:** ${p.bestFor}\n` +
               `💰 **Pricing Range:** ${p.price}\n\n` +
               `💬 **Guest Feedback:** ${p.guestReview}\n\n` +
               `👉 *Click **Explore Stays** in the menu to check live dates & book!*`;
      }
    }

    // 2. Check Dynamic NLP Topics for User Defined Inputs
    for (const topic of DYNAMIC_NLP_TOPICS) {
      if (topic.keywords.some(kw => queryLower.includes(kw))) {
        return topic.response;
      }
    }

    // 3. Check General Knowledge Base
    for (const item of AI_KNOWLEDGE_BASE) {
      if (item.keywords.some(kw => queryLower.includes(kw))) {
        return item.response;
      }
    }

    // 4. Intelligent Smart NLP Generator for Any Custom User Defined Input
    const cleanQuery = userQuery.replace(/[?.,!]/g, '').trim();
    return `🤖 **Mahabaleshwar AI Luxury Assistant**\n\n` +
           `Regarding your query: **"${cleanQuery}"**\n\n` +
           `✨ **Assistance & Guidance:**\n` +
           `All properties on Mahabaleshwar Luxury Stays are fully serviced to accommodate custom guest requirements regarding **${cleanQuery}**!\n\n` +
           `• **24/7 Caretaker Assistance:** Certified local caretakers manage check-in, key handovers, meals & custom guest preferences.\n` +
           `• **Premium Amenities:** Private pool, high-speed Wi-Fi, 24/7 generator power backup, gated SUV parking & lawn bonfire.\n` +
           `• **Flexible Booking:** Instant confirmation with 100% flexible 48-hour cancellation policy.\n\n` +
           `📞 **Need Direct Help?** Call our 24/7 Support Helpline at **+91 98765 43210** or message our live WhatsApp concierge!`;
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
      const replyText = generateBotReply(text);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 900);
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: "Chat history reset! How else can I assist you?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <>
      {/* Floating Circular Trigger Button with Only Logo */}
      <button 
        className="ai-assistant-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Mahabaleshwar AI Luxury Assistant"
      >
        <i className="fa-solid fa-wand-magic-sparkles ai-trigger-icon"></i>
      </button>

      {/* Floating AI Chat Window */}
      {isOpen && (
        <div className="ai-assistant-window" data-lenis-prevent>
          {/* Header */}
          <div className="ai-window-header">
            <div className="ai-header-info">
              <div className="ai-avatar-badge">
                <i className="fa-solid fa-robot"></i>
              </div>
              <div className="ai-header-text">
                <h3>AI Assistant <i className="fa-solid fa-circle-check" style={{ color: '#d4af37', fontSize: '0.85rem' }}></i></h3>
                <div className="ai-status-indicator">
                  <span className="ai-status-dot"></span>
                  <span>Online • 24/7 Support</span>
                </div>
              </div>
            </div>

            <div className="ai-header-actions">
              <button className="ai-action-btn" onClick={clearChat} title="Reset Chat">
                <i className="fa-solid fa-rotate-left"></i>
              </button>
              <button className="ai-action-btn" onClick={() => setIsOpen(false)} title="Close">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="ai-chat-body" ref={chatBodyRef} data-lenis-prevent>
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-msg-row ${msg.sender}`}>
                {msg.sender === 'bot' && (
                  <div className="ai-msg-avatar">
                    <i className="fa-solid fa-sparkles"></i>
                  </div>
                )}
                <div className="ai-msg-bubble">
                  <div style={{ whitespace: 'pre-line' }}>{msg.text}</div>
                  <span className="ai-msg-time">
                    {msg.time}
                    {msg.sender === 'bot' && (
                      <button className="ai-speech-btn" onClick={() => speakText(msg.text)} title="Listen">
                        <i className="fa-solid fa-volume-high"></i>
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="ai-msg-row bot">
                <div className="ai-msg-avatar">
                  <i className="fa-solid fa-sparkles"></i>
                </div>
                <div className="ai-msg-bubble ai-typing-indicator">
                  <span className="ai-typing-dot"></span>
                  <span className="ai-typing-dot"></span>
                  <span className="ai-typing-dot"></span>
                </div>
              </div>
            )}

            {/* Quick Suggestions */}
            {messages.length < 5 && !isTyping && (
              <div className="ai-suggestions-container">
                {QUICK_SUGGESTIONS.map((s, idx) => (
                  <button 
                    key={idx}
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage(s.query)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Input Form */}
          <div className="ai-chat-footer">
            <form 
              className="ai-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input 
                type="text"
                className="ai-chat-input"
                placeholder="Ask AI Assistant anything..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="ai-send-btn" title="Send Message">
                <i className="fa-solid fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiAssistant;
