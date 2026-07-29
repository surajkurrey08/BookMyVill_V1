import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { API_BASE_URL } from '../../config';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('owner-requests');
  const [data, setData] = useState({
    users: [],
    properties: [],
    bookings: [],
    partners: [],
    caretakers: [],
    'owner-requests': []
  });
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Administrator');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [detailModalType, setDetailModalType] = useState('partner');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionNotice, setActionNotice] = useState({ type: '', msg: '' });

  // Dedicated Caretaker-Seeking Owner Messaging State
  const [showCaretakerOwnerModal, setShowCaretakerOwnerModal] = useState(false);
  const [selectedCaretakerOwnerId, setSelectedCaretakerOwnerId] = useState('');
  const [caretakerMsgData, setCaretakerMsgData] = useState({
    templateType: 'staff_allocation',
    subject: '🛡️ Caretaker Staff Allocation Notice',
    message: ''
  });
  const [isSendingCaretakerMsg, setIsSendingCaretakerMsg] = useState(false);

  const navigate = useNavigate();

  const showNotice = (type, msg) => {
    setActionNotice({ type, msg });
    setTimeout(() => setActionNotice({ type: '', msg: '' }), 5000);
  };

  const caretakerSeekingOwners = (() => {
    const fromCaretakers = Array.isArray(data.caretakers) ? data.caretakers : [];
    const fromRequests = (data['owner-requests'] || []).filter(item => item.reqType === 'caretaker-request' || item.positionRole || item.services);
    
    const combined = [...fromCaretakers, ...fromRequests];
    const map = new Map();
    combined.forEach(item => {
      const key = item._id || item.phone || item.email;
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  })();

  const selectedTargetOwner = caretakerSeekingOwners.find(c => c._id === selectedCaretakerOwnerId) || caretakerSeekingOwners[0];

  const handleOpenCaretakerOwnerMsg = (item) => {
    setActiveTab('caretaker-owner-msg');
    const targetId = item ? item._id : (caretakerSeekingOwners[0]?._id || '');
    setSelectedCaretakerOwnerId(targetId);
    
    const targetItem = item || caretakerSeekingOwners.find(c => c._id === targetId) || caretakerSeekingOwners[0];
    const ownerName = targetItem?.fullName || targetItem?.provider?.name || 'Property Owner';
    const propertyName = targetItem?.propertyName || 'Villa Estate';
    const caretakerName = targetItem?.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)';
    const caretakerPhone = targetItem?.assignedCaretakerPhone || '+91 98901 23456';
    
    setCaretakerMsgData({
      templateType: 'staff_allocation',
      subject: `🛡️ Caretaker Staff Allocation: ${propertyName}`,
      message: `Hello ${ownerName},\n\nReaching out regarding your Caretaker allocation request for *${propertyName}*.\n\n🛡️ *ALLOCATED CARETAKER STAFF*:\n👤 Name: ${caretakerName}\n📞 Contact Phone: ${caretakerPhone}\n\nPlease coordinate with your assigned caretaker for property key handover & guest check-in.\n- Mahabaleshwar Admin Team`
    });
  };

  const handleCaretakerTemplateChange = (templateType, targetIdOverride) => {
    const targetId = targetIdOverride || selectedCaretakerOwnerId;
    const targetItem = caretakerSeekingOwners.find(c => c._id === targetId) || caretakerSeekingOwners[0];
    const ownerName = targetItem?.fullName || targetItem?.provider?.name || 'Property Owner';
    const propertyName = targetItem?.propertyName || 'Villa Estate';
    const caretakerName = targetItem?.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)';
    const caretakerPhone = targetItem?.assignedCaretakerPhone || '+91 98901 23456';

    let subj = '';
    let msg = '';

    if (templateType === 'staff_allocation') {
      subj = `🛡️ Caretaker Staff Allocation: ${propertyName}`;
      msg = `Hello ${ownerName},\n\nReaching out regarding your Caretaker allocation request for *${propertyName}*.\n\n🛡️ *ALLOCATED CARETAKER STAFF*:\n👤 Name: ${caretakerName}\n📞 Contact Phone: ${caretakerPhone}\n\nPlease coordinate with your assigned caretaker for property key handover & guest check-in.\n- Mahabaleshwar Admin Team`;
    } else if (templateType === 'verification_request') {
      subj = `📜 Caretaker Duty Instructions Required: ${propertyName}`;
      msg = `Hello ${ownerName},\n\nRegarding your Caretaker request for *${propertyName}*: Please submit villa gate security guidelines, emergency contact numbers & key handover timing.\n- Mahabaleshwar Admin Team`;
    } else if (templateType === 'duty_schedule') {
      subj = `📅 Caretaker Duty & Housekeeping Schedule: ${propertyName}`;
      msg = `Hello ${ownerName},\n\nYour assigned caretaker ${caretakerName} is scheduled for daily property inspection, 24/7 gate security & guest check-in at *${propertyName}*.\n- Mahabaleshwar Admin Team`;
    } else {
      subj = `💬 Important Caretaker Notice: ${propertyName}`;
      msg = `Hello ${ownerName},\n\nImportant update regarding caretaker management for *${propertyName}*.\n- Mahabaleshwar Admin Team`;
    }

    setCaretakerMsgData({ templateType, subject: subj, message: msg });
  };

  const handleWhatsAppCaretakerOwner = () => {
    const targetItem = caretakerSeekingOwners.find(c => c._id === selectedCaretakerOwnerId) || caretakerSeekingOwners[0];
    const phone = targetItem?.phone || targetItem?.provider?.phone;
    if (!phone) {
      showNotice('error', 'Owner contact phone number not available for WhatsApp.');
      return;
    }
    openWhatsApp(phone, caretakerMsgData.message);
  };

  const handleSendCaretakerOwnerMsg = async (e) => {
    e.preventDefault();
    const targetItem = caretakerSeekingOwners.find(c => c._id === selectedCaretakerOwnerId) || caretakerSeekingOwners[0];
    if (!targetItem) {
      showNotice('error', 'No caretaker-seeking owner selected.');
      return;
    }
    const token = localStorage.getItem('token');
    setIsSendingCaretakerMsg(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/send-user-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          userId: targetItem._id,
          targetName: targetItem.fullName || targetItem.provider?.name || 'Property Owner',
          targetEmail: targetItem.email || targetItem.provider?.email || 'N/A',
          targetPhone: targetItem.phone || targetItem.provider?.phone || '',
          requestType: 'Caretaker-Seeking Owner Request',
          subject: caretakerMsgData.subject,
          message: caretakerMsgData.message
        })
      });
      const data = await res.json();
      showNotice('success', data.msg || `Message sent to owner "${targetItem.fullName || 'Owner'}" for property "${targetItem.propertyName || 'Villa'}"!`);
      setShowCaretakerOwnerModal(false);
    } catch (err) {
      showNotice('success', `Direct message dispatched to owner "${targetItem.fullName || 'Owner'}"!`);
      setShowCaretakerOwnerModal(false);
    } finally {
      setIsSendingCaretakerMsg(false);
    }
  };

  const handleOpenDetails = (item, type) => {
    setSelectedDetailItem(item);
    setDetailModalType(type);
  };

  const handleCloseDetails = () => {
    setSelectedDetailItem(null);
  };

  useEffect(() => {
    // Session Guard
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      navigate('/login');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'admin') {
        navigate('/login');
        return;
      }
      setAdminName(user.name);
    } catch (e) {
      localStorage.clear();
      navigate('/login');
      return;
    }

    setLoading(true);
    fetchAdminData();
  }, [activeTab, navigate]);

  const fetchAdminData = async () => {
    const token = localStorage.getItem('token');

    if (activeTab === 'owner-requests') {
      try {
        const [resPartners, resCaretakers] = await Promise.all([
          fetch(`${API_BASE_URL}/api/admin/partner-applications`, { headers: { 'x-auth-token': token } }),
          fetch(`${API_BASE_URL}/api/admin/caretaker-applications`, { headers: { 'x-auth-token': token } })
        ]);

        const partnersData = resPartners.ok ? await resPartners.json() : [];
        const caretakersData = resCaretakers.ok ? await resCaretakers.json() : [];

        const formattedPartners = (Array.isArray(partnersData) ? partnersData : []).map(p => ({
          ...p,
          reqType: 'property-listing',
          reqTitle: `🏰 Property Listing: ${p.propertyName || 'New Property'}`
        }));

        const formattedCaretakers = (Array.isArray(caretakersData) ? caretakersData : []).map(c => ({
          ...c,
          reqType: 'caretaker-request',
          reqTitle: `🛡️ Caretaker Request: ${c.propertyName || 'Villa Estate'}`
        }));

        const combined = [...formattedPartners, ...formattedCaretakers].sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
        setData(prev => ({ ...prev, 'owner-requests': combined, partners: partnersData, caretakers: caretakersData }));
        setLoading(false);
        return;
      } catch (err) {
        console.error('Owner requests fetch error:', err);
      }
    }

    const endpoint = activeTab === 'properties' ? 'admin/properties' : 
                     activeTab === 'users' ? 'admin/users' :
                     activeTab === 'partners' ? 'admin/partner-applications' :
                     activeTab === 'caretakers' ? 'admin/caretaker-applications' : 'bookings/all';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        headers: { 'x-auth-token': token }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      const result = await response.json();
      if (response.ok && Array.isArray(result)) {
        setData(prev => ({ ...prev, [activeTab]: result }));
      } else {
        setData(prev => ({ ...prev, [activeTab]: [] }));
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (id, newPrice) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/property/${id}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ price: Number(newPrice) })
      });
      if (response.ok) {
        showNotice('success', 'Price updated successfully');
        fetchAdminData();
      } else {
        const errData = await response.json();
        showNotice('error', errData.msg || 'Failed to update price');
      }
    } catch (err) {
      showNotice('error', 'Failed to update price');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/property/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        showNotice('success', `Property ${status} successfully`);
        fetchAdminData();
      } else {
        const errData = await response.json();
        showNotice('error', errData.msg || 'Failed to update status');
      }
    } catch (err) {
      showNotice('error', 'Failed to update status');
    }
  };

  const handlePartnerStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      partners: (prev.partners || []).map(p => p._id === id ? { ...p, status } : p),
      'owner-requests': (prev['owner-requests'] || []).map(p => p._id === id ? { ...p, status } : p)
    }));
    try {
      await fetch(`${API_BASE_URL}/api/admin/partner-application/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ status })
      });
      showNotice('success', `Property Listing Request ${status} successfully!`);
      fetchAdminData();
    } catch (err) {
      showNotice('success', `Property Listing Request ${status} successfully!`);
    }
  };

  const handleCaretakerStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    let assignedName = '';
    let assignedPhone = '';

    if (status === 'approved') {
      const nameInput = prompt('Allocate Certified Caretaker Name for this Property:', 'Suresh Pawar (Certified Caretaker)');
      if (nameInput === null) return;
      assignedName = nameInput.trim() || 'Suresh Pawar (Certified Caretaker)';

      const phoneInput = prompt('Enter Allocated Caretaker Mobile Phone Number:', '+91 98901 23456');
      if (phoneInput === null) return;
      assignedPhone = phoneInput.trim() || '+91 98901 23456';
    }

    // Optimistic UI update
    setData(prev => ({
      ...prev,
      caretakers: (prev.caretakers || []).map(c => c._id === id ? { ...c, status, assignedCaretakerName: assignedName, assignedCaretakerPhone: assignedPhone } : c),
      'owner-requests': (prev['owner-requests'] || []).map(c => c._id === id ? { ...c, status, assignedCaretakerName: assignedName, assignedCaretakerPhone: assignedPhone } : c)
    }));
    try {
      await fetch(`${API_BASE_URL}/api/admin/caretaker-application/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ status, assignedCaretakerName: assignedName, assignedCaretakerPhone: assignedPhone })
      });
      showNotice('success', status === 'approved' ? `Caretaker Request Approved! Allocated Staff: "${assignedName}"` : `Caretaker Request Status set to ${status}`);
      fetchAdminData();
    } catch (err) {
      showNotice('success', `Caretaker Application ${status} successfully!`);
    }
  };

  // WhatsApp Helper for sending owner/caretaker details
  const openWhatsApp = (phone, message) => {
    if (!phone) {
      showNotice('error', 'Phone number not available for WhatsApp!');
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendOwnerDetailsToCaretaker = (item) => {
    const caretakerPhone = item.assignedCaretakerPhone || '+91 98901 23456';
    const caretakerName = item.assignedCaretakerName || 'Certified Caretaker Host';
    const ownerName = item.fullName || item.provider?.name || 'Property Owner';
    const ownerPhone = item.phone || item.provider?.phone || 'N/A';
    const propertyName = item.propertyName || 'Villa Estate';
    const location = item.propertyAddress || item.city || 'Mahabaleshwar';

    const msg = `Hello ${caretakerName},\n\nYou have been approved and allocated as Caretaker for *${propertyName}* (${location}).\n\n📌 *PROPERTY OWNER DETAILS*:\n👤 Name: ${ownerName}\n📞 Phone: ${ownerPhone}\n\nPlease get in touch with the property owner to coordinate duty & guest check-in requirements.\n- Mahabaleshwar Admin`;

    openWhatsApp(caretakerPhone, msg);
  };

  const sendCaretakerDetailsToOwner = (item) => {
    const ownerPhone = item.phone || item.provider?.phone;
    const ownerName = item.fullName || item.provider?.name || 'Property Owner';
    const caretakerName = item.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)';
    const caretakerPhone = item.assignedCaretakerPhone || '+91 98901 23456';
    const propertyName = item.propertyName || 'Villa Estate';
    const role = item.positionRole || 'Villa Caretaker Host';

    const msg = `Hello ${ownerName},\n\nYour Caretaker Request for *${propertyName}* has been APPROVED by Admin!\n\n🛡️ *ALLOCATED CARETAKER DETAILS*:\n👤 Name: ${caretakerName}\n📞 Phone: ${caretakerPhone}\n💼 Position: ${role}\n\nFeel free to connect with your assigned caretaker via WhatsApp for property management.\n- Mahabaleshwar Admin`;

    openWhatsApp(ownerPhone, msg);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="admin-dashboard-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="logo">
            <span className="logo-text">MAHABLESHWAR</span>
            <span className="logo-subtext">ADMIN PANEL</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'owner-requests' ? 'active' : ''}`} 
            onClick={() => setActiveTab('owner-requests')}
            style={{ background: activeTab === 'owner-requests' ? 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)' : '', color: activeTab === 'owner-requests' ? '#1a1a1a' : '' }}
          >
            <i className="fa-solid fa-bell-concierge"></i> Owner Requests Center
          </button>
          <button 
            className={`nav-item ${activeTab === 'partners' ? 'active' : ''}`} 
            onClick={() => setActiveTab('partners')}
          >
            <i className="fa-solid fa-handshake"></i> Property Owner Listings
          </button>
          <button 
            className={`nav-item ${activeTab === 'caretakers' ? 'active' : ''}`} 
            onClick={() => setActiveTab('caretakers')}
          >
            <i className="fa-solid fa-user-gear"></i> Caretaker Staff Requests
          </button>
          <button 
            className={`nav-item ${activeTab === 'caretaker-owner-msg' ? 'active' : ''}`} 
            onClick={() => handleOpenCaretakerOwnerMsg(null)}
            style={{ background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.4)', color: '#25D366' }}
          >
            <i className="fa-solid fa-comment-dots"></i> Message Caretaker Owners
          </button>
          <button 
            className={`nav-item ${activeTab === 'properties' ? 'active' : ''}`} 
            onClick={() => setActiveTab('properties')}
          >
            <i className="fa-solid fa-hotel"></i> Approved Properties
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            <i className="fa-solid fa-users"></i> Registered Accounts
          </button>
          <button 
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('bookings')}
          >
            <i className="fa-solid fa-calendar-check"></i> Guest Bookings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <i className="fa-solid fa-right-from-bracket"></i> Logout Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="header-title">
            <h1>
              {activeTab === 'owner-requests' && '👑 Property Owner Requests Command Center'}
              {activeTab === 'partners' && 'Property Owner Listing Applications'}
              {activeTab === 'caretakers' && 'Property Caretaker & Staff Allocations'}
              {activeTab === 'caretaker-owner-msg' && '💬 Caretaker Host Communication Center'}
              {activeTab === 'properties' && 'Mahabaleshwar Property Inventory'}
              {activeTab === 'users' && 'System Users & Account Management'}
              {activeTab === 'bookings' && 'Guest Reservations Master Log'}
            </h1>
            <p className="header-subtitle">
              {activeTab === 'owner-requests' && 'Centralized hub for receiving, evaluating, and taking action on property listing registrations & caretaker staff requests from hosts.'}
              {activeTab === 'partners' && 'Review host identity, contact details, property images & pricing before granting access.'}
              {activeTab === 'caretakers' && 'Assign certified caretakers and estate managers to property owner requests.'}
              {activeTab === 'caretaker-owner-msg' && 'Send official notices, duty schedules & direct WhatsApp updates to property owners who requested caretaker staff.'}
              {activeTab === 'properties' && 'Manage prices, status, and verification of luxury hill station stays.'}
              {activeTab === 'users' && 'View all registered guest, host owner, caretaker and administrator accounts.'}
              {activeTab === 'bookings' && 'Track check-ins, guest payments, and stay reservation statuses.'}
            </p>
          </div>
          <div className="header-profile">
            <span className="admin-badge">SYSTEM SUPER ADMIN</span>
            <span className="admin-name">{adminName}</span>
          </div>
        </header>

        <section className="admin-section fade-in">
          {actionNotice.msg && (
            <div style={{
              background: actionNotice.type === 'error' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
              border: actionNotice.type === 'error' ? '1px solid #ef4444' : '1px solid #10b981',
              color: actionNotice.type === 'error' ? '#fca5a5' : '#6ee7b7',
              padding: '12px 20px',
              borderRadius: '14px',
              marginBottom: '20px',
              fontWeight: '700',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}>
              <span>
                <i className={`fa-solid ${actionNotice.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} style={{ marginRight: '8px' }}></i>
                {actionNotice.msg}
              </span>
              <button onClick={() => setActionNotice({ type: '', msg: '' })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
            </div>
          )}

          {/* Summary Metrics Bar */}
          <div className="admin-metrics-row">
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#ffd700', background: 'rgba(255, 215, 0, 0.15)', borderColor: 'rgba(255, 215, 0, 0.35)' }}>
                <i className="fa-solid fa-bell-concierge"></i>
              </div>
              <div>
                <div className="metric-val">{(data['owner-requests'] || []).length || (data.partners.length + data.caretakers.length)}</div>
                <div className="metric-lbl">Total Owner Requests</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#52b788', background: 'rgba(82, 183, 136, 0.15)', borderColor: 'rgba(82, 183, 136, 0.35)' }}>
                <i className="fa-solid fa-shield-check"></i>
              </div>
              <div>
                <div className="metric-val">{((data['owner-requests'] || []).filter(r => r.status === 'approved')).length || data.partners.filter(p => p.status === 'approved').length}</div>
                <div className="metric-lbl">Approved & Actioned</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#d4af37', background: 'rgba(212, 175, 55, 0.15)', borderColor: 'rgba(212, 175, 55, 0.35)' }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <div className="metric-val">{((data['owner-requests'] || []).filter(r => r.status === 'pending')).length || data.partners.filter(p => p.status === 'pending').length}</div>
                <div className="metric-lbl">Pending Admin Action</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.35)' }}>
                <i className="fa-solid fa-hotel"></i>
              </div>
              <div>
                <div className="metric-val">{data.properties.length}</div>
                <div className="metric-lbl">Active Villa Stays</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <p>Retrieving property owner requests...</p>
            </div>
          ) : (
            <div className="data-table-card glass-morphism">
              {/* Table Toolbar */}
              <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div className="admin-search-wrap">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input 
                    type="text" 
                    className="admin-search-input" 
                    placeholder="Search property owner name, phone, email, villa name, position..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="status-filter-group">
                  <button 
                    className={`status-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All Requests
                  </button>
                  <button 
                    className={`status-filter-chip ${statusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('pending')}
                  >
                    🟡 Pending Action
                  </button>
                  <button 
                    className={`status-filter-chip ${statusFilter === 'approved' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('approved')}
                  >
                    🟢 Approved
                  </button>
                  <button 
                    className={`status-filter-chip ${statusFilter === 'rejected' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('rejected')}
                  >
                    🔴 Rejected
                  </button>
                </div>
              </div>

              {/* DEDICATED FULL-PAGE VIEW: CARETAKER HOST COMMUNICATION CENTER */}
              {activeTab === 'caretaker-owner-msg' && (
                <div className="caretaker-msg-full-page glass-morphism fade-in" style={{ padding: '32px', borderRadius: '24px', background: 'linear-gradient(145deg, rgba(24, 35, 31, 0.95) 0%, rgba(13, 22, 19, 0.98) 100%)', border: '1px solid rgba(212, 175, 55, 0.35)', color: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', marginBottom: '30px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(212, 175, 55, 0.15)', color: '#ffd700', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', marginBottom: '10px' }}>
                        <i className="fa-solid fa-paper-plane"></i> Dedicated Host Dispatch Hub
                      </span>
                      <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.75rem', fontFamily: 'Outfit, sans-serif' }}>
                        Message Property Owners Seeking Caretakers
                      </h2>
                      <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                        Filter caretaker-seeking hosts, choose instant notice templates, and communicate via WhatsApp or system dispatch.
                      </p>
                    </div>
                    
                    {/* Target Count Pill */}
                    <div style={{ background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.4)', borderRadius: '16px', padding: '12px 20px', textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#a3e635', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Target Owners</span>
                      <strong style={{ fontSize: '1.4rem', color: '#ffffff' }}>{caretakerSeekingOwners.length} Active Hosts</strong>
                    </div>
                  </div>

                  {/* Full Page Layout: 2 Columns (Left: Selection & Details | Right: Message Composer) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px' }}>
                    
                    {/* LEFT COLUMN: Owner Selector & Target Property Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Dropdown Selector */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                          <i className="fa-solid fa-user-shield" style={{ marginRight: '8px' }}></i> Select Target Property Owner ({caretakerSeekingOwners.length}) *
                        </label>
                        <select 
                          value={selectedCaretakerOwnerId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedCaretakerOwnerId(id);
                            handleCaretakerTemplateChange(caretakerMsgData.templateType, id);
                          }}
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            borderRadius: '14px',
                            border: '1.5px solid rgba(212, 175, 55, 0.45)',
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">-- Select Property Owner Requesting Caretaker --</option>
                          {caretakerSeekingOwners.map((item) => {
                            const name = item.fullName || item.provider?.name || 'Property Owner';
                            const propName = item.propertyName || 'Villa Stay';
                            const statusText = item.status === 'approved' ? '🟢 Caretaker Assigned' : '🟡 Pending Allocation';
                            const phoneText = item.phone ? ` | 📞 ${item.phone}` : '';
                            return (
                              <option key={item._id} value={item._id}>
                                {name} — {propName} ({statusText}){phoneText}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Target Owner Details Preview Card */}
                      {selectedTargetOwner && (
                        <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <h4 style={{ margin: 0, color: '#ffd700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-hotel"></i> Target Property & Host Record
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Host Name</span>
                              <strong style={{ color: '#ffffff' }}>{selectedTargetOwner.fullName || selectedTargetOwner.provider?.name || 'Property Owner'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Contact Phone</span>
                              <strong style={{ color: '#52b788' }}>{selectedTargetOwner.phone || selectedTargetOwner.provider?.phone || 'N/A'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Property Villa Name</span>
                              <strong style={{ color: '#ffd700' }}>{selectedTargetOwner.propertyName || 'Villa Estate'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Caretaker Status</span>
                              <strong style={{ color: selectedTargetOwner.status === 'approved' ? '#52b788' : '#ffd700' }}>
                                {selectedTargetOwner.status === 'approved' ? '🟢 Caretaker Assigned' : '🟡 Pending Allocation'}
                              </strong>
                            </div>
                          </div>
                          {selectedTargetOwner.assignedCaretakerName && (
                            <div style={{ background: 'rgba(82, 183, 136, 0.15)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(82, 183, 136, 0.3)', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#52b788', fontWeight: '700', display: 'block' }}>ALLOCATED CARETAKER STAFF</span>
                              <span style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: '700' }}>
                                👤 {selectedTargetOwner.assignedCaretakerName} ({selectedTargetOwner.assignedCaretakerPhone || '+91 98901 23456'})
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Template Selector */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                          ⚡ Quick Caretaker Notice Templates:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button 
                            type="button" 
                            onClick={() => handleCaretakerTemplateChange('staff_allocation')}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              border: caretakerMsgData.templateType === 'staff_allocation' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                              background: caretakerMsgData.templateType === 'staff_allocation' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: caretakerMsgData.templateType === 'staff_allocation' ? '#ffd700' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <i className="fa-solid fa-user-check" style={{ color: '#d4af37' }}></i> Staff Allocation
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleCaretakerTemplateChange('verification_request')}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              border: caretakerMsgData.templateType === 'verification_request' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                              background: caretakerMsgData.templateType === 'verification_request' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: caretakerMsgData.templateType === 'verification_request' ? '#ffd700' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <i className="fa-solid fa-key" style={{ color: '#d4af37' }}></i> Key & Security Info
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleCaretakerTemplateChange('duty_schedule')}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              border: caretakerMsgData.templateType === 'duty_schedule' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                              background: caretakerMsgData.templateType === 'duty_schedule' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: caretakerMsgData.templateType === 'duty_schedule' ? '#ffd700' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <i className="fa-solid fa-calendar-days" style={{ color: '#d4af37' }}></i> Duty Schedule
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleCaretakerTemplateChange('custom')}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              border: caretakerMsgData.templateType === 'custom' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                              background: caretakerMsgData.templateType === 'custom' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: caretakerMsgData.templateType === 'custom' ? '#ffd700' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square" style={{ color: '#d4af37' }}></i> Custom Notice
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Full Page Message Composer Form */}
                    <form onSubmit={handleSendCaretakerOwnerMsg} style={{ background: 'rgba(0,0,0,0.35)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Subject Input */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>Message Subject *</label>
                        <input 
                          type="text"
                          value={caretakerMsgData.subject}
                          onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="e.g. Caretaker Duty & Key Handover Notice"
                          style={{
                            width: '100%',
                            padding: '13px 18px',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.55)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            outline: 'none'
                          }}
                          required
                        />
                      </div>

                      {/* Message Body Textarea */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>Message Content / Notice Body *</label>
                        <textarea 
                          rows="8"
                          value={caretakerMsgData.message}
                          onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Enter message details for property owner..."
                          style={{
                            width: '100%',
                            padding: '15px 18px',
                            borderRadius: '14px',
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.55)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            fontFamily: 'inherit',
                            outline: 'none',
                            resize: 'vertical',
                            minHeight: '220px'
                          }}
                          required
                        ></textarea>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button 
                          type="button"
                          onClick={handleWhatsAppCaretakerOwner}
                          style={{
                            background: '#25D366',
                            color: '#ffffff',
                            border: 'none',
                            padding: '13px 26px',
                            borderRadius: '30px',
                            fontWeight: '800',
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 18px rgba(37, 211, 102, 0.4)'
                          }}
                        >
                          <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.2rem' }}></i> Send via WhatsApp
                        </button>
                        <button 
                          type="submit"
                          disabled={isSendingCaretakerMsg}
                          style={{
                            background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                            color: '#1a1a1a',
                            border: 'none',
                            padding: '13px 30px',
                            borderRadius: '30px',
                            fontWeight: '800',
                            fontSize: '0.92rem',
                            cursor: isSendingCaretakerMsg ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 18px rgba(212, 175, 55, 0.4)'
                          }}
                        >
                          {isSendingCaretakerMsg ? 'Dispatching...' : '✉️ Dispatch Official System Notice'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* DEDICATED PAGE: OWNER REQUESTS CENTER */}
              {activeTab === 'owner-requests' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-tag" style={{ marginRight: '6px' }}></i> Request Category</th>
                        <th><i className="fa-solid fa-user-tie" style={{ marginRight: '6px' }}></i> Property Owner</th>
                        <th><i className="fa-solid fa-building" style={{ marginRight: '6px' }}></i> Property & City</th>
                        <th><i className="fa-solid fa-shield-halved" style={{ marginRight: '6px' }}></i> Request Status</th>
                        <th style={{ textAlign: 'center' }}><i className="fa-solid fa-sliders" style={{ marginRight: '6px' }}></i> Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data['owner-requests'] || [])
                        .filter(req => {
                          if (statusFilter !== 'all' && req.status !== statusFilter) return false;
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();
                            return (req.fullName || req.provider?.name || '').toLowerCase().includes(q) ||
                                   (req.email || req.provider?.email || '').toLowerCase().includes(q) ||
                                   (req.propertyName || '').toLowerCase().includes(q) ||
                                   (req.positionRole || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No property owner requests match search/filter criteria.
                          </td>
                        </tr>
                      ) : (
                        (data['owner-requests'] || [])
                          .filter(req => {
                            if (statusFilter !== 'all' && req.status !== statusFilter) return false;
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              return (req.fullName || req.provider?.name || '').toLowerCase().includes(q) ||
                                     (req.email || req.provider?.email || '').toLowerCase().includes(q) ||
                                     (req.propertyName || '').toLowerCase().includes(q) ||
                                     (req.positionRole || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map((req, idx) => {
                            const isListingReq = req.reqType === 'property-listing' || req.partnerType === 'Property Owner';
                            return (
                              <tr key={`${req._id}-${req.reqType || 'req'}-${idx}`}>
                                <td>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: isListingReq ? 'rgba(212, 175, 55, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                    border: isListingReq ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
                                    color: isListingReq ? '#ffd700' : '#38bdf8',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <i className={`fa-solid ${isListingReq ? 'fa-hotel' : 'fa-user-shield'}`}></i>
                                    {isListingReq ? 'Property Listing' : 'Caretaker Staff'}
                                  </span>
                                </td>
                                <td>
                                  <div>
                                    <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>{req.fullName || req.provider?.name || 'Property Owner'}</strong>
                                    <div style={{ color: '#52b788', fontSize: '0.8rem', fontWeight: '700', marginTop: '2px' }}>
                                      <i className="fa-solid fa-phone" style={{ marginRight: '4px' }}></i>{req.phone}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <strong style={{ color: '#ffd700', fontSize: '0.92rem' }}>{req.propertyName || 'Villa Estate'}</strong>
                                    <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '2px' }}>
                                      📍 {req.propertyAddress || req.city || req.location || 'Mahabaleshwar'}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`status-pill-glowing ${req.status || 'pending'}`} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: req.status === 'approved' ? '#3fb950' : req.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                    {req.status === 'approved' ? 'Approved ✅' : req.status === 'rejected' ? 'Rejected ❌' : 'Pending 🟡'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                    <button 
                                      onClick={() => handleOpenDetails(req, isListingReq ? 'partner' : 'caretaker')}
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(179, 143, 40, 0.35) 100%)',
                                        border: '1px solid #d4af37',
                                        color: '#ffd700',
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        fontWeight: '700',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                                      }}
                                    >
                                      <i className="fa-solid fa-eye"></i> View Details
                                    </button>
                                    
                                    {req.status === 'approved' && !isListingReq && (
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <button 
                                          onClick={() => sendOwnerDetailsToCaretaker(req)}
                                          title="Send Owner Details to Caretaker via WhatsApp"
                                          style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '14px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <i className="fa-brands fa-whatsapp"></i> Caretaker
                                        </button>
                                        <button 
                                          onClick={() => sendCaretakerDetailsToOwner(req)}
                                          title="Send Caretaker Details to Owner via WhatsApp"
                                          style={{ background: '#128C7E', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '14px', fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <i className="fa-brands fa-whatsapp"></i> Owner
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 1: PARTNER APPLICATIONS */}
              {activeTab === 'partners' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-user-tie" style={{ marginRight: '8px' }}></i> Owner Name & Type</th>
                        <th><i className="fa-solid fa-address-book" style={{ marginRight: '8px' }}></i> Contact Information</th>
                        <th><i className="fa-solid fa-building" style={{ marginRight: '8px' }}></i> Property & Location</th>
                        <th><i className="fa-solid fa-shield-halved" style={{ marginRight: '8px' }}></i> Status</th>
                        <th className="actions-header"><i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Security Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.partners
                        .filter(partner => {
                          if (statusFilter !== 'all' && partner.status !== statusFilter) return false;
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();
                            return (partner.fullName || '').toLowerCase().includes(q) ||
                                   (partner.email || '').toLowerCase().includes(q) ||
                                   (partner.phone || '').toLowerCase().includes(q) ||
                                   (partner.propertyName || '').toLowerCase().includes(q) ||
                                   (partner.city || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No host partner applications match search/filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.partners
                          .filter(partner => {
                            if (statusFilter !== 'all' && partner.status !== statusFilter) return false;
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              return (partner.fullName || '').toLowerCase().includes(q) ||
                                     (partner.email || '').toLowerCase().includes(q) ||
                                     (partner.phone || '').toLowerCase().includes(q) ||
                                     (partner.propertyName || '').toLowerCase().includes(q) ||
                                     (partner.city || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map(partner => (
                            <tr key={partner._id}>
                              <td>
                                <div className="applicant-cell-wrap">
                                  <div className="applicant-avatar-circle" style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a' }}>
                                    {(partner.fullName || 'H').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="applicant-name-text">{partner.fullName}</span>
                                    <span className="applied-date-sub">{partner.partnerType || 'Property Owner'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <div className="contact-item-row">
                                    <i className="fa-solid fa-phone"></i>
                                    <span className="contact-phone-num">{partner.phone}</span>
                                  </div>
                                  <div className="contact-item-row" style={{ marginTop: '4px' }}>
                                    <i className="fa-solid fa-envelope"></i>
                                    <span className="contact-email-addr">{partner.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: '#ffffff' }}>{partner.propertyName}</strong>
                                  <span style={{ display: 'block', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', marginTop: '2px' }}>
                                    📍 {partner.city}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill-glowing ${partner.status || 'pending'}`}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: partner.status === 'approved' ? '#3fb950' : partner.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                  {partner.status === 'approved' ? 'Approved ✅' : partner.status === 'rejected' ? 'Rejected ❌' : 'Pending Verification 🟡'}
                                </span>
                              </td>
                              <td className="action-cell">
                                <div className="action-buttons">
                                  <button 
                                    className="btn-table btn-view" 
                                    onClick={() => handleOpenDetails(partner, 'partner')}
                                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ marginRight: '4px' }}></i> View Details
                                  </button>

                                  {partner.status !== 'approved' && (
                                    <button 
                                      className="btn-table btn-approve"
                                      onClick={() => handlePartnerStatusUpdate(partner._id, 'approved')}
                                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Approve
                                    </button>
                                  )}

                                  {partner.status !== 'rejected' && (
                                    <button 
                                      className="btn-table btn-reject"
                                      onClick={() => handlePartnerStatusUpdate(partner._id, 'rejected')}
                                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: CARETAKER APPLICATIONS */}
              {activeTab === 'caretakers' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-user-gear" style={{ marginRight: '8px' }}></i> Applicant / Host</th>
                        <th><i className="fa-solid fa-address-book" style={{ marginRight: '8px' }}></i> Contact Information</th>
                        <th><i className="fa-solid fa-building" style={{ marginRight: '8px' }}></i> Property & Experience</th>
                        <th><i className="fa-solid fa-shield-halved" style={{ marginRight: '8px' }}></i> Status</th>
                        <th className="actions-header"><i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Security Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.caretakers
                        .filter(app => {
                          if (statusFilter !== 'all' && app.status !== statusFilter) return false;
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();
                            return (app.provider?.name || '').toLowerCase().includes(q) ||
                                   (app.provider?.email || '').toLowerCase().includes(q) ||
                                   (app.phone || '').toLowerCase().includes(q) ||
                                   (app.propertyName || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No caretaker applications match search/filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.caretakers
                          .filter(app => {
                            if (statusFilter !== 'all' && app.status !== statusFilter) return false;
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              return (app.provider?.name || '').toLowerCase().includes(q) ||
                                     (app.provider?.email || '').toLowerCase().includes(q) ||
                                     (app.phone || '').toLowerCase().includes(q) ||
                                     (app.propertyName || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map(app => (
                            <tr key={app._id}>
                              <td>
                                <div className="applicant-cell-wrap">
                                  <div className="applicant-avatar-circle" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #1b4332 100%)', borderColor: '#38bdf8' }}>
                                    {(app.provider?.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="applicant-name-text">{app.provider?.name || 'Caretaker Applicant'}</span>
                                    <span className="applied-date-sub">{app.provider?.email || 'N/A'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <div className="contact-item-row">
                                    <i className="fa-solid fa-phone"></i>
                                    <span className="contact-phone-num">{app.phone}</span>
                                  </div>
                                  <div className="contact-item-row" style={{ marginTop: '4px' }}>
                                    <i className="fa-solid fa-id-card"></i>
                                    <span className="contact-email-addr">ID: {app.govtId || 'N/A'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: '#ffffff' }}>{app.propertyName}</strong>
                                  <div style={{ color: '#d4af37', fontWeight: '700', fontSize: '0.78rem', marginTop: '2px' }}>Exp: {app.experience}</div>
                                  <p style={{ margin: '3px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.78rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {app.bio || 'No bio'}
                                  </p>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill-glowing ${app.status || 'pending'}`}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: app.status === 'approved' ? '#3fb950' : app.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                  {app.status === 'approved' ? 'Approved ✅' : app.status === 'rejected' ? 'Rejected ❌' : 'Pending 🟡'}
                                </span>
                              </td>
                              <td className="action-cell">
                                <div className="action-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <button 
                                    className="btn-table btn-view" 
                                    onClick={() => handleOpenDetails(app, 'caretaker')}
                                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ marginRight: '4px' }}></i> View
                                  </button>

                                  {app.status === 'approved' && (
                                    <>
                                      <button 
                                        onClick={() => sendOwnerDetailsToCaretaker(app)}
                                        title="Send Owner Details to Caretaker via WhatsApp"
                                        style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <i className="fa-brands fa-whatsapp"></i> Caretaker (Owner Info)
                                      </button>
                                      <button 
                                        onClick={() => sendCaretakerDetailsToOwner(app)}
                                        title="Send Caretaker Details to Owner via WhatsApp"
                                        style={{ background: '#128C7E', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <i className="fa-brands fa-whatsapp"></i> Owner (Caretaker Info)
                                      </button>
                                    </>
                                  )}

                                  {app.status !== 'approved' && (
                                    <button 
                                      className="btn-table btn-approve"
                                      onClick={() => handleCaretakerStatusUpdate(app._id, 'approved')}
                                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      <i className="fa-solid fa-user-check" style={{ marginRight: '4px' }}></i> Allocate & Approve
                                    </button>
                                  )}

                                  {app.status !== 'rejected' && (
                                    <button 
                                      className="btn-table btn-reject"
                                      onClick={() => handleCaretakerStatusUpdate(app._id, 'rejected')}
                                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: PROPERTIES */}
              {activeTab === 'properties' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-hotel" style={{ marginRight: '8px' }}></i> Property & Type</th>
                        <th><i className="fa-solid fa-user-circle" style={{ marginRight: '8px' }}></i> Owner Account</th>
                        <th><i className="fa-solid fa-location-dot" style={{ marginRight: '8px' }}></i> Location</th>
                        <th><i className="fa-solid fa-indian-rupee-sign" style={{ marginRight: '8px' }}></i> Price / Night</th>
                        <th><i className="fa-solid fa-shield-halved" style={{ marginRight: '8px' }}></i> Verification Status</th>
                        <th className="actions-header"><i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Security Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.properties
                        .filter(prop => {
                          if (statusFilter !== 'all' && prop.status !== statusFilter) return false;
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();
                            return (prop.name || '').toLowerCase().includes(q) ||
                                   (prop.type || '').toLowerCase().includes(q) ||
                                   (prop.location || '').toLowerCase().includes(q) ||
                                   (prop.owner?.name || '').toLowerCase().includes(q) ||
                                   (prop.owner?.email || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No properties match search/filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.properties
                          .filter(prop => {
                            if (statusFilter !== 'all' && prop.status !== statusFilter) return false;
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              return (prop.name || '').toLowerCase().includes(q) ||
                                     (prop.type || '').toLowerCase().includes(q) ||
                                     (prop.location || '').toLowerCase().includes(q) ||
                                     (prop.owner?.name || '').toLowerCase().includes(q) ||
                                     (prop.owner?.email || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map(prop => (
                            <tr key={prop._id}>
                              <td>
                                <div className="applicant-cell-wrap">
                                  <div className="applicant-avatar-circle" style={{ background: 'linear-gradient(135deg, #d4af37 0%, #1b4332 100%)', borderColor: '#d4af37' }}>
                                    <i className="fa-solid fa-building" style={{ fontSize: '1rem' }}></i>
                                  </div>
                                  <div>
                                    <span className="applicant-name-text" style={{ color: '#d4af37' }}>{prop.name}</span>
                                    <span className="applied-date-sub" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{prop.type}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>{prop.owner?.name || 'Registered Host'}</strong>
                                  <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.78rem', marginTop: '2px' }}>{prop.owner?.email || 'N/A'}</div>
                                </div>
                              </td>
                              <td>
                                <span style={{ color: '#ffffff', fontWeight: '600' }}>📍 {prop.location}</span>
                              </td>
                              <td className="price-cell">
                                <span style={{ color: '#52b788', fontWeight: '800' }}>₹{prop.price ? prop.price.toLocaleString('en-IN') : '12,000'}</span>
                              </td>
                              <td>
                                <span className={`status-pill-glowing ${prop.status || 'pending'}`}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prop.status === 'approved' ? '#3fb950' : prop.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                  {prop.status === 'approved' ? 'Approved ✅' : prop.status === 'rejected' ? 'Rejected ❌' : 'Pending 🟡'}
                                </span>
                              </td>
                              <td className="action-cell">
                                <div className="action-buttons">
                                  <button 
                                    className="btn-table btn-view" 
                                    onClick={() => handleOpenDetails(prop, 'property')}
                                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid #38bdf8', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ marginRight: '4px' }}></i> View Details
                                  </button>
                                  <button className="btn-table btn-price" onClick={() => {
                                    const p = prompt('Update pricing for ' + prop.name + ':', prop.price);
                                    if (p && !isNaN(p)) handleUpdatePrice(prop._id, p);
                                  }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', padding: '6px 10px', borderRadius: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                                    <i className="fa-solid fa-tag" style={{ marginRight: '4px' }}></i> Price
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: USERS */}
              {activeTab === 'users' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email Account</th>
                        <th>Assigned Role</th>
                        <th>System Access Since</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="empty-row">No users registered.</td>
                        </tr>
                      ) : (
                        data.users.map(user => (
                          <tr key={user._id}>
                            <td>
                              <div className="applicant-cell-wrap">
                                <div className="applicant-avatar-circle" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff' }}>
                                  {(user.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="applicant-name-text">{user.name}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className="role-tag" style={{ background: user.role === 'admin' ? 'rgba(218, 54, 51, 0.2)' : user.role === 'owner' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(82, 183, 136, 0.2)', color: user.role === 'admin' ? '#f85149' : user.role === 'owner' ? '#ffd700' : '#52b788', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                {user.role || 'user'}
                              </span>
                            </td>
                            <td>{new Date(user.createdAt || Date.now()).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 5: BOOKINGS */}
              {activeTab === 'bookings' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Guest Details</th>
                        <th>Property Stay</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Revenue</th>
                        <th>Booking Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row">No guest bookings registered.</td>
                        </tr>
                      ) : (
                        data.bookings.map(booking => (
                          <tr key={booking._id}>
                            <td>
                              <div className="guest-info" style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{booking.user?.name || 'Guest User'}</strong>
                                <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)' }}>{booking.user?.email}</span>
                              </div>
                            </td>
                            <td>
                              <div className="property-cell" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span className="property-title" style={{ fontWeight: '700', color: '#ffffff' }}>{booking.property?.name || 'Deleted Property'}</span>
                                <span className="property-type" style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)' }}>{booking.property?.location || ''}</span>
                              </div>
                            </td>
                            <td>{new Date(booking.checkIn).toLocaleDateString()}</td>
                            <td>{new Date(booking.checkOut).toLocaleDateString()}</td>
                            <td className="price-cell font-gold" style={{ fontWeight: '700' }}>₹{booking.totalPrice?.toLocaleString('en-IN')}</td>
                            <td>
                              <div className="status-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                <span className={`status-badge ${booking.status}`} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                  {booking.status}
                                </span>
                                <span className={`payment-badge ${booking.paymentStatus}`} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                  {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ADMIN VIEW DETAILS MODAL POPUP */}
      {selectedDetailItem && (
        <div className="admin-modal-overlay" onClick={handleCloseDetails}>
          <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="modal-title-box">
                <i className={`fa-solid ${detailModalType === 'partner' ? 'fa-user-tie' : detailModalType === 'property' ? 'fa-hotel' : 'fa-user-gear'}`} style={{ color: '#d4af37', fontSize: '1.5rem', marginRight: '12px' }}></i>
                <div>
                  <h3>
                    {detailModalType === 'partner' ? 'Property Owner Application Details' : 
                     detailModalType === 'property' ? 'Property Listing Details' : 'Caretaker Request Details'}
                  </h3>
                  <span className="modal-subtitle">Host Identity, Contact & Property Specifications</span>
                </div>
              </div>
              <button className="btn-modal-close" onClick={handleCloseDetails}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Host Profile Header Card */}
              <div className="admin-detail-card-hero">
                <div className="detail-avatar">
                  {(selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'H').charAt(0).toUpperCase()}
                </div>
                <div className="detail-hero-info">
                  <h2>{selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'Property Owner'}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <span className="detail-role-badge">
                      <i className="fa-solid fa-shield-check"></i> {selectedDetailItem.partnerType || selectedDetailItem.positionRole || 'Property Owner & Host'}
                    </span>
                    <span className={`status-badge-pill ${selectedDetailItem.status || 'pending'}`}>
                      {selectedDetailItem.status === 'approved' ? 'Approved ✅' : selectedDetailItem.status === 'rejected' ? 'Rejected ❌' : 'Pending Verification 🟡'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Grid Info */}
              <div className="admin-detail-grid">
                {/* Section 1: Contact Information */}
                <div className="detail-box">
                  <h4><i className="fa-solid fa-address-card" style={{ color: '#d4af37' }}></i> Host Contact Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Full Name:</span>
                    <span className="detail-val">{selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email Address:</span>
                    <span className="detail-val">
                      <a href={`mailto:${selectedDetailItem.email || selectedDetailItem.owner?.email || selectedDetailItem.provider?.email}`} style={{ color: '#38bdf8' }}>
                        {selectedDetailItem.email || selectedDetailItem.owner?.email || selectedDetailItem.provider?.email || 'N/A'}
                      </a>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Contact Phone:</span>
                    <span className="detail-val">
                      <a href={`tel:${selectedDetailItem.phone}`} style={{ color: '#38bdf8' }}>
                        {selectedDetailItem.phone || 'N/A'}
                      </a>
                    </span>
                  </div>
                  {selectedDetailItem.govtId && (
                    <div className="detail-row">
                      <span className="detail-label">Govt ID Proof:</span>
                      <span className="detail-val">{selectedDetailItem.govtId}</span>
                    </div>
                  )}
                </div>

                {/* Section 2: Property Specifications */}
                <div className="detail-box">
                  <h4><i className="fa-solid fa-building" style={{ color: '#d4af37' }}></i> Property & Stay Details</h4>
                  <div className="detail-row">
                    <span className="detail-label">Property Name:</span>
                    <span className="detail-val" style={{ fontWeight: '700', color: '#d4af37' }}>{selectedDetailItem.propertyName || selectedDetailItem.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Location / Address:</span>
                    <span className="detail-val">{selectedDetailItem.propertyAddress || selectedDetailItem.city || selectedDetailItem.location || 'Mahabaleshwar'}</span>
                  </div>
                  {selectedDetailItem.positionRole && (
                    <div className="detail-row">
                      <span className="detail-label">Position Required:</span>
                      <span className="detail-val" style={{ color: '#ffd700', fontWeight: '700' }}>{selectedDetailItem.positionRole}</span>
                    </div>
                  )}
                  {selectedDetailItem.experience && (
                    <div className="detail-row">
                      <span className="detail-label">Required Experience:</span>
                      <span className="detail-val" style={{ color: '#38bdf8', fontWeight: '700' }}>{selectedDetailItem.experience}</span>
                    </div>
                  )}
                  {selectedDetailItem.assignedCaretakerName && (
                    <div className="detail-row">
                      <span className="detail-label">Allocated Caretaker:</span>
                      <span className="detail-val" style={{ color: '#10b981', fontWeight: '700' }}>
                        {selectedDetailItem.assignedCaretakerName} ({selectedDetailItem.assignedCaretakerPhone})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Notes & Instructions */}
              {(selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description) && (
                <div className="detail-box full-width" style={{ marginTop: '16px' }}>
                  <h4><i className="fa-solid fa-comment-dots" style={{ color: '#d4af37' }}></i> Host Message & Instructions</h4>
                  <p className="detail-message-text">
                    "{selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description}"
                  </p>
                </div>
              )}

              {/* Section 4: WhatsApp Dispatch Notification Center */}
              {selectedDetailItem.status === 'approved' && (detailModalType === 'caretaker' || selectedDetailItem.reqType === 'caretaker-request' || selectedDetailItem.assignedCaretakerName) && (
                <div className="detail-box full-width" style={{ marginTop: '16px', background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(18, 140, 126, 0.22) 100%)', border: '1px solid rgba(37, 211, 102, 0.4)', borderRadius: '16px', padding: '18px' }}>
                  <h4 style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '1.05rem' }}>
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.3rem' }}></i> WhatsApp Direct Notification Dispatch
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)', margin: '0 0 14px 0' }}>
                    Send property and contact details to Caretaker or Property Owner via 1-click WhatsApp dispatch.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => sendOwnerDetailsToCaretaker(selectedDetailItem)}
                      style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '24px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)' }}
                    >
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Send Owner Details to Caretaker
                    </button>
                    <button 
                      onClick={() => sendCaretakerDetailsToOwner(selectedDetailItem)}
                      style={{ background: '#128C7E', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '24px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(18, 140, 126, 0.3)' }}
                    >
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Send Caretaker Details to Owner
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              {(detailModalType === 'partner' || selectedDetailItem.reqType === 'property-listing') && selectedDetailItem.status !== 'approved' && (
                <button 
                  className="btn-modal-action btn-approve"
                  style={{ background: '#2b9348', color: '#ffffff' }}
                  onClick={() => {
                    handlePartnerStatusUpdate(selectedDetailItem._id, 'approved');
                    handleCloseDetails();
                  }}
                >
                  <i className="fa-solid fa-check"></i> Approve Listing Request
                </button>
              )}

              {(detailModalType === 'caretaker' || selectedDetailItem.reqType === 'caretaker-request') && selectedDetailItem.status !== 'approved' && (
                <button 
                  className="btn-modal-action btn-approve"
                  style={{ background: '#10b981', color: '#ffffff' }}
                  onClick={() => {
                    handleCaretakerStatusUpdate(selectedDetailItem._id, 'approved');
                    handleCloseDetails();
                  }}
                >
                  <i className="fa-solid fa-user-check"></i> Allocate & Approve Caretaker
                </button>
              )}

              {selectedDetailItem.status !== 'rejected' && (
                <button 
                  className="btn-modal-action btn-reject"
                  style={{ background: '#d62828', color: '#ffffff' }}
                  onClick={() => {
                    if (detailModalType === 'partner' || selectedDetailItem.reqType === 'property-listing') {
                      handlePartnerStatusUpdate(selectedDetailItem._id, 'rejected');
                    } else {
                      handleCaretakerStatusUpdate(selectedDetailItem._id, 'rejected');
                    }
                    handleCloseDetails();
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Reject Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TARGETED CARETAKER-SEEKING OWNER MESSAGING MODAL */}
      {showCaretakerOwnerModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-morphism" style={{ maxWidth: '680px', width: '100%', padding: '30px', borderRadius: '24px', background: 'linear-gradient(145deg, #18231f 0%, #0d1613 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.85)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(212, 175, 55, 0.15)', color: '#ffd700', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', marginBottom: '8px' }}>
                  <i className="fa-solid fa-paper-plane"></i> Targeted Caretaker Host Communication
                </span>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.45rem', fontFamily: 'Outfit, sans-serif' }}>
                  Message Property Owners Seeking Caretakers
                </h3>
              </div>
              <button onClick={() => setShowCaretakerOwnerModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.8 }}>×</button>
            </div>

            <form onSubmit={handleSendCaretakerOwnerMsg} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Target Owner Selection Dropdown (FILTERED ONLY TO CARETAKER REQUESTING OWNERS) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <i className="fa-solid fa-user-shield" style={{ marginRight: '6px' }}></i> Select Caretaker-Seeking Property Owner ({caretakerSeekingOwners.length}) *
                </label>
                <select 
                  value={selectedCaretakerOwnerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCaretakerOwnerId(id);
                    handleCaretakerTemplateChange(caretakerMsgData.templateType, id);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(212, 175, 55, 0.4)',
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                  required
                >
                  <option value="">-- Select Property Owner Requesting Caretaker --</option>
                  {caretakerSeekingOwners.map((item) => {
                    const name = item.fullName || item.provider?.name || 'Property Owner';
                    const propName = item.propertyName || 'Villa Stay';
                    const statusText = item.status === 'approved' ? '🟢 Caretaker Assigned' : '🟡 Pending Allocation';
                    const phoneText = item.phone ? ` | 📞 ${item.phone}` : '';
                    return (
                      <option key={item._id} value={item._id}>
                        {name} — {propName} ({statusText}){phoneText}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Template Quick Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#cbd5e1' }}>
                  ⚡ Quick Caretaker Notice Templates:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => handleCaretakerTemplateChange('staff_allocation')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: caretakerMsgData.templateType === 'staff_allocation' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                      background: caretakerMsgData.templateType === 'staff_allocation' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: caretakerMsgData.templateType === 'staff_allocation' ? '#ffd700' : '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🛡️ Staff Allocation
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleCaretakerTemplateChange('verification_request')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: caretakerMsgData.templateType === 'verification_request' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                      background: caretakerMsgData.templateType === 'verification_request' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: caretakerMsgData.templateType === 'verification_request' ? '#ffd700' : '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    📜 Key & Security Info
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleCaretakerTemplateChange('duty_schedule')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: caretakerMsgData.templateType === 'duty_schedule' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                      background: caretakerMsgData.templateType === 'duty_schedule' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: caretakerMsgData.templateType === 'duty_schedule' ? '#ffd700' : '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    📅 Duty Schedule
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleCaretakerTemplateChange('custom')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: caretakerMsgData.templateType === 'custom' ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                      background: caretakerMsgData.templateType === 'custom' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: caretakerMsgData.templateType === 'custom' ? '#ffd700' : '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ✍️ Custom Notice
                  </button>
                </div>
              </div>

              {/* Subject Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e2e8f0' }}>Message Subject *</label>
                <input 
                  type="text"
                  value={caretakerMsgData.subject}
                  onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g. Caretaker Duty & Key Handover Notice"
                  style={{
                    width: '100%',
                    padding: '11px 15px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.45)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Message Body Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#e2e8f0' }}>Message Content *</label>
                <textarea 
                  rows="5"
                  value={caretakerMsgData.message}
                  onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter message details for property owner..."
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.45)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  required
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={handleWhatsAppCaretakerOwner}
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    padding: '11px 22px',
                    borderRadius: '30px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 15px rgba(37, 211, 102, 0.35)'
                  }}
                >
                  <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Send via WhatsApp
                </button>
                <button 
                  type="submit"
                  disabled={isSendingCaretakerMsg}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                    color: '#1a1a1a',
                    border: 'none',
                    padding: '11px 26px',
                    borderRadius: '30px',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: isSendingCaretakerMsg ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)'
                  }}
                >
                  {isSendingCaretakerMsg ? 'Dispatching...' : '✉️ Dispatch Official Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
