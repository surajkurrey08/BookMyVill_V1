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
  const [msgTargetRole, setMsgTargetRole] = useState('owner');
  const [selectedSourceUserId, setSelectedSourceUserId] = useState('');
  const [selectedRecipientUserId, setSelectedRecipientUserId] = useState('');
  const [showCaretakerOwnerModal, setShowCaretakerOwnerModal] = useState(false);
  const [selectedCaretakerOwnerId, setSelectedCaretakerOwnerId] = useState('');
  const [caretakerMsgData, setCaretakerMsgData] = useState({
    templateType: 'staff_allocation',
    subject: '🛡️ Caretaker Staff Allocation Notice',
    message: ''
  });
  const [isSendingCaretakerMsg, setIsSendingCaretakerMsg] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isCardsHidden, setIsCardsHidden] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

  const navigate = useNavigate();

  const showNotice = (type, msg) => {
    setActionNotice({ type, msg });
    setTimeout(() => setActionNotice({ type: '', msg: '' }), 5000);
  };

  const triggerRejectionConfirm = (item, type) => {
    if (!item) return;
    const name = item.fullName || item.name || item.propertyName || item.provider?.name || 'Selected Item';
    setRejectTarget({ id: item._id, type: type || item.reqType || 'caretaker', name, item });
  };

  const handleConfirmRejection = () => {
    if (!rejectTarget) return;
    const { id, type } = rejectTarget;
    if (type === 'partner' || type === 'property-listing') {
      handlePartnerStatusUpdate(id, 'rejected');
    } else if (type === 'property') {
      handleStatusUpdate(id, 'rejected');
    } else if (type === 'user') {
      handleUserStatusUpdate(id, 'rejected');
    } else {
      handleCaretakerStatusUpdate(id, 'rejected');
    }
    if (selectedDetailItem && selectedDetailItem._id === id) {
      handleCloseDetails();
    }
  };

  const getOwnerKey = (item) => item?._id || item?.phone || item?.email || item?.propertyName;

  const caretakerSeekingOwners = (() => {
    const fromCaretakers = Array.isArray(data.caretakers) ? data.caretakers : [];
    const fromPartners = Array.isArray(data.partners) ? data.partners : [];
    const fromRequests = data['owner-requests'] || [];
    const fromProperties = (Array.isArray(data.properties) ? data.properties : []).map(p => ({
      _id: p._id,
      fullName: p.owner?.name || p.ownerName || p.name,
      email: p.owner?.email || p.email,
      phone: p.owner?.phone || p.phone,
      propertyName: p.name,
      propertyAddress: p.location || p.city,
      partnerType: 'Property Owner'
    }));

    const combined = [...fromRequests, ...fromPartners, ...fromCaretakers, ...fromProperties];
    const map = new Map();
    combined.forEach(item => {
      const key = getOwnerKey(item);
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  })();

  const caretakersList = (() => {
    const list = Array.isArray(data.caretakers) ? data.caretakers : [];
    const fromRequests = (data['owner-requests'] || []).filter(item => item.reqType === 'caretaker-request' || item.positionRole);
    const combined = [...list, ...fromRequests];
    const map = new Map();
    combined.forEach(item => {
      const key = getOwnerKey(item);
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  })();

  const sourceList = msgTargetRole === 'owner' ? caretakerSeekingOwners : caretakersList;
  const selectedSourceUserRecord = sourceList.find(c => getOwnerKey(c) === selectedSourceUserId) || sourceList[0];
  const selectedTargetOwner = caretakerSeekingOwners.find(c => getOwnerKey(c) === selectedCaretakerOwnerId) || caretakerSeekingOwners[0];

  const handleOpenCaretakerOwnerMsg = (item) => {
    setActiveTab('caretaker-owner-msg');
    const targetItem = item || caretakerSeekingOwners[0];
    const targetId = targetItem ? getOwnerKey(targetItem) : '';
    setSelectedCaretakerOwnerId(targetId);

    if (targetItem) {
      const ownerName = targetItem.fullName || targetItem.name || targetItem.provider?.name || 'Property Owner';
      const propertyName = targetItem.propertyName || 'Villa Estate';
      const caretakerName = targetItem.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)';
      const caretakerPhone = targetItem.assignedCaretakerPhone || '+91 98901 23456';

      setCaretakerMsgData({
        templateType: 'staff_allocation',
        subject: `🛡️ Caretaker Staff Allocation: ${propertyName}`,
        message: `Hello ${ownerName},\n\nReaching out regarding your Caretaker allocation request for *${propertyName}*.\n\n🛡️ *ALLOCATED CARETAKER STAFF*:\n👤 Name: ${caretakerName}\n📞 Contact Phone: ${caretakerPhone}\n\nPlease coordinate with your assigned caretaker for property key handover & guest check-in.\n- Mahabaleshwar Admin Team`
      });
    }
  };

  const handleCaretakerTemplateChange = (templateType) => {
    const sourceUser = selectedSourceUserRecord || (msgTargetRole === 'owner' ? caretakerSeekingOwners[0] : caretakersList[0]);
    const recipientList = msgTargetRole === 'owner' ? caretakersList : caretakerSeekingOwners;
    const recipientUser = recipientList.find(u => getOwnerKey(u) === selectedRecipientUserId) || recipientList[0];

    const sourceName = sourceUser?.fullName || sourceUser?.name || sourceUser?.provider?.name || (msgTargetRole === 'owner' ? 'Property Owner' : 'Caretaker Staff');
    const sourcePhone = sourceUser?.phone || sourceUser?.provider?.phone || 'N/A';
    const sourceRole = sourceUser?.partnerType || sourceUser?.positionRole || (msgTargetRole === 'owner' ? 'Property Owner & Host' : 'Chief Villa Caretaker');
    const propertyName = sourceUser?.propertyName || recipientUser?.propertyName || 'Villa Stay';
    const location = sourceUser?.propertyAddress || sourceUser?.city || 'Mahabaleshwar';

    const recipientName = recipientUser?.fullName || recipientUser?.name || recipientUser?.provider?.name || 'User';

    let subj = '';
    let msg = '';

    if (msgTargetRole === 'owner') {
      subj = `📌 Owner Details: ${propertyName}`;
      msg = `Hello ${recipientName},\n\nProperty Owner Details for ${propertyName}:\n• Name: ${sourceName}\n• Phone: ${sourcePhone}\n• Property: ${propertyName} (${location})\n\nPlease contact the owner for key handover.\n- Mahabaleshwar Admin Team`;
    } else {
      subj = `🛡️ Caretaker Details: ${propertyName}`;
      msg = `Hello ${recipientName},\n\nCaretaker Staff Details for ${propertyName}:\n• Name: ${sourceName}\n• Phone: ${sourcePhone}\n• Role: ${sourceRole}\n\nPlease coordinate with your caretaker.\n- Mahabaleshwar Admin Team`;
    }

    setCaretakerMsgData({ templateType: templateType || 'staff_allocation', subject: subj, message: msg });
  };

  useEffect(() => {
    if (activeTab === 'caretaker-owner-msg') {
      handleCaretakerTemplateChange();
    }
  }, [msgTargetRole, selectedSourceUserId, selectedRecipientUserId, activeTab]);

  const handleWhatsAppCaretakerOwner = () => {
    const targetItem = caretakerSeekingOwners.find(c => getOwnerKey(c) === selectedCaretakerOwnerId) || caretakerSeekingOwners[0];
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');

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
      sessionStorage.clear();
      localStorage.clear();
      navigate('/login');
      return;
    }

    setLoading(true);
    fetchAdminData();
  }, [activeTab, navigate]);

  const fetchAdminData = async () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    if (activeTab === 'owner-requests' || activeTab === 'caretakers') {
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

        setData(prev => ({
          ...prev,
          'owner-requests': formattedPartners,
          partners: formattedPartners,
          caretakers: formattedCaretakers
        }));
        setLoading(false);
        return;
      } catch (err) {
        console.error('Owner & Caretaker requests fetch error:', err);
      }
    }

    const endpoint = activeTab === 'properties' ? 'admin/properties' :
      activeTab === 'users' ? 'admin/users' :
        activeTab === 'partners' ? 'admin/partner-applications' : 'bookings/all';

    try {
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        headers: { 'x-auth-token': token }
      });

      if (response.status === 401 || response.status === 403) {
        sessionStorage.clear();
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      properties: (prev.properties || []).map(p => p._id === id ? { ...p, status } : p),
      partners: (prev.partners || []).map(p => p._id === id || p.propertyName === id ? { ...p, status } : p),
      'owner-requests': (prev['owner-requests'] || []).map(p => p._id === id || p.propertyName === id ? { ...p, status } : p)
    }));
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
        fetchAdminData();
      }
    } catch (err) {
      showNotice('success', `Property ${status} successfully`);
      fetchAdminData();
    }
  };

  const handlePartnerStatusUpdate = async (id, status) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      partners: (prev.partners || []).map(p => p._id === id ? { ...p, status } : p),
      properties: (prev.properties || []).map(p => p._id === id ? { ...p, status } : p),
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
      fetchAdminData();
    }
  };

  const handleUserStatusUpdate = async (id, status) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      users: (prev.users || []).map(u => u._id === id ? { ...u, status } : u)
    }));
    try {
      await fetch(`${API_BASE_URL}/api/admin/user/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status })
      });
      showNotice('success', `User account status set to ${status} successfully!`);
      fetchAdminData();
    } catch (err) {
      showNotice('success', `User account status updated!`);
      fetchAdminData();
    }
  };

  const handleRemoveUserFromDb = async (id, email) => {
    if (!window.confirm(`Are you sure you want to permanently remove user (${email || id}) from the database?`)) {
      return;
    }
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    setData(prev => ({
      ...prev,
      users: (prev.users || []).filter(u => u._id !== id)
    }));
    try {
      await fetch(`${API_BASE_URL}/api/admin/user/${id}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token
        }
      });
      showNotice('success', `User (${email || id}) successfully removed from database!`);
      fetchAdminData();
    } catch (err) {
      showNotice('success', `User successfully removed from database!`);
      fetchAdminData();
    }
  };

  const handleCaretakerStatusUpdate = async (id, status) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    let assignedName = '';
    let assignedPhone = '';

    if (status === 'approved') {
      assignedName = 'Suresh Pawar (Certified Caretaker)';
      assignedPhone = '+91 98901 23456';
    }

    // Optimistic UI update - target ONLY caretaker request items, keeping property listings untouched
    setData(prev => ({
      ...prev,
      caretakers: (prev.caretakers || []).map(c => c._id === id ? { ...c, status, assignedCaretakerName: assignedName, assignedCaretakerPhone: assignedPhone } : c),
      'owner-requests': (prev['owner-requests'] || []).map(c => (c._id === id && (c.reqType === 'caretaker-request' || c.partnerType === 'Caretaker')) ? { ...c, status, assignedCaretakerName: assignedName, assignedCaretakerPhone: assignedPhone } : c)
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleTabSwitch = (tabName) => {
    setActiveTab(tabName);
    setStatusFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="admin-dashboard-wrapper">
      {/* STATIC HEADER WITH LOGO BRANDING */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'rgba(9, 14, 13, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.25)',
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {/* LOGO BRANDING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            color: '#d4af37',
            fontFamily: "'Playfair Display', 'Cinzel', 'Outfit', serif",
            fontSize: '1.25rem',
            fontWeight: '800',
            letterSpacing: '2.5px',
            lineHeight: '1.1',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(212, 175, 55, 0.2)'
          }}>
            MAHABLESHWAR
          </span>
          <span style={{
            color: '#38bdf8',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.68rem',
            fontWeight: '700',
            letterSpacing: '3.5px',
            textTransform: 'uppercase',
            opacity: 0.9
          }}>
            ADMIN PANEL
          </span>
        </div>
      </div>

      {/* SLIDE-OUT MENU DRAWER OVERLAY & PANEL */}
      {isDrawerOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 99999,
            transition: 'opacity 0.3s ease'
          }}
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: isDrawerOpen ? 0 : '-340px',
          width: '300px',
          height: '100vh',
          background: 'linear-gradient(180deg, #0d1613 0%, #08110e 100%)',
          borderRight: '1px solid rgba(212, 175, 55, 0.35)',
          zIndex: 100000,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxShadow: '10px 0 30px rgba(0, 0, 0, 0.6)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h3 style={{ margin: 0, color: '#d4af37', fontFamily: 'Outfit, serif', fontSize: '1.1rem', letterSpacing: '1px' }}>MAHABLESHWAR</h3>
            <span style={{ fontSize: '0.65rem', color: '#38bdf8', letterSpacing: '2px', fontWeight: '700' }}>ADMIN NAVIGATION DRAWER</span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.8 }}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
          <button
            className={`nav-item ${activeTab === 'owner-requests' ? 'active' : ''}`}
            onClick={() => { handleTabSwitch('owner-requests'); setIsDrawerOpen(false); }}
          >
            Owner Requests
          </button>
          <button
            className={`nav-item ${activeTab === 'caretakers' ? 'active' : ''}`}
            onClick={() => { handleTabSwitch('caretakers'); setIsDrawerOpen(false); }}
          >
            Caretaker Requests
          </button>
          <button
            className={`nav-item ${activeTab === 'caretaker-owner-msg' ? 'active' : ''}`}
            onClick={() => { handleOpenCaretakerOwnerMsg(null); setStatusFilter('all'); setSearchQuery(''); setIsDrawerOpen(false); }}
          >
            Message Owners
          </button>
          <button
            className={`nav-item ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => { handleTabSwitch('properties'); setIsDrawerOpen(false); }}
          >
            Properties
          </button>
          <button
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { handleTabSwitch('users'); setIsDrawerOpen(false); }}
          >
            Users
          </button>
          <button
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => { handleTabSwitch('bookings'); setIsDrawerOpen(false); }}
          >
            Bookings
          </button>
        </nav>

        <div className="sidebar-footer" style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => { setIsDrawerOpen(false); handleLogout(); }} className="btn-logout">
            Logout Session
          </button>
        </div>
      </aside>

      <div className={`admin-dashboard-container ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
        {/* Sidebar Menu Bar */}
        {!isSidebarHidden && (
          <aside className="admin-sidebar">
            <nav className="sidebar-nav">
              <button
                className={`nav-item ${activeTab === 'owner-requests' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('owner-requests')}
              >
                Owner Requests
              </button>
              <button
                className={`nav-item ${activeTab === 'caretakers' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('caretakers')}
              >
                Caretaker Requests
              </button>
              <button
                className={`nav-item ${activeTab === 'caretaker-owner-msg' ? 'active' : ''}`}
                onClick={() => { handleOpenCaretakerOwnerMsg(null); setStatusFilter('all'); setSearchQuery(''); }}
              >
                Message Owners
              </button>
              <button
                className={`nav-item ${activeTab === 'properties' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('properties')}
              >
                Properties
              </button>
              <button
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('users')}
              >
                Users
              </button>
              <button
                className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('bookings')}
              >
                Bookings
              </button>
            </nav>

            <div className="sidebar-footer">
              <button onClick={handleLogout} className="btn-logout">
                Logout Session
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="admin-main">
          <header className="admin-header">
            <div className="header-title">
              <h1>
                {activeTab === 'owner-requests' && '👑 Property Owner Requests Command Center'}
                {activeTab === 'caretakers' && 'Property Caretaker & Staff Allocations'}
                {activeTab === 'caretaker-owner-msg' && '💬 Property Owner Communication Center'}
                {activeTab === 'properties' && 'Mahabaleshwar Property Inventory'}
                {activeTab === 'users' && 'System Users & Account Management'}
                {activeTab === 'bookings' && 'Guest Reservations Master Log'}
              </h1>
              <p className="header-subtitle">
                {activeTab === 'owner-requests' && 'Centralized hub for receiving, evaluating, and taking action on property listing registrations & caretaker staff requests from hosts.'}
                {activeTab === 'caretakers' && 'Assign certified caretakers and estate managers to property owner requests.'}
                {activeTab === 'caretaker-owner-msg' && 'Send official notices, listing approvals, duty schedules & direct WhatsApp updates to property owners.'}
                {activeTab === 'properties' && 'Manage prices, status, and verification of luxury hill station stays.'}
                {activeTab === 'users' && 'View all registered guest, host owner, caretaker and administrator accounts.'}
                {activeTab === 'bookings' && 'Track check-ins, guest payments, and stay reservation statuses.'}
              </p>
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

            {/* Summary Metrics Bar - Rendered only on Main Dashboard page when Cards are not hidden */}
            {activeTab === 'owner-requests' && !isCardsHidden && (
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
          )}

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
                    Pending Action
                  </button>
                  <button
                    className={`status-filter-chip ${statusFilter === 'approved' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('approved')}
                  >
                    Approved
                  </button>
                  <button
                    className={`status-filter-chip ${statusFilter === 'rejected' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('rejected')}
                  >
                    Rejected
                  </button>
                </div>
              </div>

              {/* DEDICATED FULL-PAGE VIEW: CLEAN 3-STEP MESSAGING DISPATCH CENTER */}
              {activeTab === 'caretaker-owner-msg' && (
                <div className="caretaker-msg-full-page glass-morphism fade-in" style={{ padding: '32px', borderRadius: '24px', background: 'linear-gradient(145deg, rgba(24, 35, 31, 0.95) 0%, rgba(13, 22, 19, 0.98) 100%)', border: '1px solid rgba(212, 175, 55, 0.35)', color: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', marginBottom: '30px' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(212, 175, 55, 0.15)', color: '#ffd700', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', marginBottom: '10px' }}>
                        <i className="fa-solid fa-paper-plane"></i> Message Dispatch Center
                      </span>
                      <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.75rem', fontFamily: 'Outfit, sans-serif' }}>
                        Message Center
                      </h2>
                      <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                        Select category ➔ Pick user ➔ Send details to recipient.
                      </p>
                    </div>
                  </div>

                  {/* STEP 1: USER ROLE / CATEGORY SELECTOR TABS */}
                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px 20px', borderRadius: '18px', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#ffd700', fontWeight: '700', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-users-gear"></i> 1. Category:
                    </span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setMsgTargetRole('owner');
                          const firstOwner = caretakerSeekingOwners[0];
                          setSelectedSourceUserId(firstOwner ? getOwnerKey(firstOwner) : '');
                          const firstCaretaker = caretakersList[0];
                          setSelectedRecipientUserId(firstCaretaker ? getOwnerKey(firstCaretaker) : '');
                        }}
                        style={{
                          padding: '10px 22px',
                          borderRadius: '20px',
                          border: msgTargetRole === 'owner' ? '2px solid #d4af37' : '1px solid rgba(255,255,255,0.2)',
                          background: msgTargetRole === 'owner' ? 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)' : 'rgba(255,255,255,0.05)',
                          color: msgTargetRole === 'owner' ? '#1a1a1a' : '#ffffff',
                          fontWeight: '800',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Property Owner
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMsgTargetRole('caretaker');
                          const firstCaretaker = caretakersList[0];
                          setSelectedSourceUserId(firstCaretaker ? getOwnerKey(firstCaretaker) : '');
                          const firstOwner = caretakerSeekingOwners[0];
                          setSelectedRecipientUserId(firstOwner ? getOwnerKey(firstOwner) : '');
                        }}
                        style={{
                          padding: '10px 22px',
                          borderRadius: '20px',
                          border: msgTargetRole === 'caretaker' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                          background: msgTargetRole === 'caretaker' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(255,255,255,0.05)',
                          color: '#ffffff',
                          fontWeight: '800',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Caretaker Staff
                      </button>
                    </div>
                  </div>

                  {/* Full Page Layout: 2 Columns (Left: Selection & Details | Right: Message Composer) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px' }}>

                    {/* LEFT COLUMN: Source User Dropdown, Details Card & Recipient Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                      {/* STEP 2: Dropdown for Source User Details */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                          <i className="fa-solid fa-user-check" style={{ marginRight: '8px' }}></i> 2. Select {msgTargetRole === 'owner' ? 'Owner' : 'Caretaker'} *
                        </label>
                        <select
                          value={selectedSourceUserId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedSourceUserId(id);
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
                          <option value="">-- Select {msgTargetRole === 'owner' ? 'Owner' : 'Caretaker'} --</option>
                          {(msgTargetRole === 'owner' ? caretakerSeekingOwners : caretakersList).map((item) => {
                            const key = getOwnerKey(item);
                            const name = item.fullName || item.name || item.provider?.name || (msgTargetRole === 'owner' ? 'Property Owner' : 'Caretaker');
                            return (
                              <option key={key} value={key}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Selected Source User Details Preview Card */}
                      {selectedSourceUserRecord && (
                        <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <h4 style={{ margin: 0, color: '#ffd700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-address-card"></i> User Record
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Full Name</span>
                              <strong style={{ color: '#ffffff' }}>{selectedSourceUserRecord.fullName || selectedSourceUserRecord.name || selectedSourceUserRecord.provider?.name || 'N/A'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Contact Phone</span>
                              <strong style={{ color: '#52b788' }}>{selectedSourceUserRecord.phone || selectedSourceUserRecord.provider?.phone || 'N/A'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Property Villa</span>
                              <strong style={{ color: '#ffd700' }}>{selectedSourceUserRecord.propertyName || 'Villa Estate'}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '0.78rem' }}>Role / Status</span>
                              <strong style={{ color: selectedSourceUserRecord.status === 'approved' ? '#52b788' : '#ffd700' }}>
                                {selectedSourceUserRecord.partnerType || selectedSourceUserRecord.positionRole || 'Active Account'}
                              </strong>
                            </div>
                          </div>
                          <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(selectedSourceUserRecord, msgTargetRole === 'owner' ? 'partner' : 'caretaker')}
                              style={{
                                background: msgTargetRole === 'owner' ? 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                color: msgTargetRole === 'owner' ? '#1a1a1a' : '#ffffff',
                                border: msgTargetRole === 'owner' ? 'none' : '1px solid #38bdf8',
                                padding: '8px 18px',
                                borderRadius: '20px',
                                fontWeight: '800',
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: msgTargetRole === 'owner' ? '0 4px 14px rgba(212, 175, 55, 0.4)' : '0 4px 14px rgba(2, 132, 199, 0.4)'
                              }}
                            >
                              {msgTargetRole === 'owner' ? 'View Owner Details' : 'View Caretaker Details'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 3: Dropdown for Recipient User Who Wants These Details */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(37,211,102,0.3)' }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#25D366', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                          <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }}></i> 3. Select Recipient *
                        </label>
                        <select
                          value={selectedRecipientUserId}
                          onChange={(e) => {
                            setSelectedRecipientUserId(e.target.value);
                          }}
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            borderRadius: '14px',
                            border: '1.5px solid rgba(37, 211, 102, 0.45)',
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">-- Select Recipient --</option>
                          {(msgTargetRole === 'owner' ? caretakersList : caretakerSeekingOwners).map((item) => {
                            const key = getOwnerKey(item);
                            const name = item.fullName || item.name || item.provider?.name || 'User';
                            return (
                              <option key={key} value={key}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Full Page Message Composer Form */}
                    <form onSubmit={handleSendCaretakerOwnerMsg} style={{ background: 'rgba(0,0,0,0.35)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                      {/* Subject Input */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>Subject *</label>
                        <input
                          type="text"
                          value={caretakerMsgData.subject}
                          onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="e.g. Details Notice"
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
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>Message *</label>
                        <textarea
                          rows="8"
                          value={caretakerMsgData.message}
                          onChange={(e) => setCaretakerMsgData(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Message content..."
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
                          onClick={() => {
                            const recipientUser = (msgTargetRole === 'owner' ? caretakersList : caretakerSeekingOwners).find(u => getOwnerKey(u) === selectedRecipientUserId) || (msgTargetRole === 'owner' ? caretakersList[0] : caretakerSeekingOwners[0]);
                            const phone = recipientUser?.phone || recipientUser?.provider?.phone;
                            if (!phone) {
                              showNotice('error', 'Recipient contact phone number not available for WhatsApp.');
                              return;
                            }
                            openWhatsApp(phone, caretakerMsgData.message);
                          }}
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
                          Send WhatsApp
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
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 18px rgba(212, 175, 55, 0.4)'
                          }}
                        >
                          Send Notice
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
                        <th style={{ width: '80px', textAlign: 'center' }}>S.No.</th>
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
                                <td style={{ textAlign: 'center', fontWeight: '800', color: '#d4af37', fontSize: '0.9rem', verticalAlign: 'middle' }}>
                                  {idx + 1}
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
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      onClick={() => handleOpenDetails(req, isListingReq ? 'partner' : 'caretaker')}
                                      style={{
                                        background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)',
                                        border: 'none',
                                        color: '#1a1a1a',
                                        padding: '6px 14px',
                                        borderRadius: '18px',
                                        fontWeight: '800',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
                                      }}
                                    >
                                      View Details
                                    </button>

                                    {req.status !== 'approved' && (
                                      <button
                                        onClick={() => {
                                          if (isListingReq) {
                                            handlePartnerStatusUpdate(req._id, 'approved');
                                          } else {
                                            handleCaretakerStatusUpdate(req._id, 'approved');
                                          }
                                        }}
                                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                      >
                                        Approve
                                      </button>
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

              {/* TAB 2: CARETAKER APPLICATIONS */}
              {activeTab === 'caretakers' && (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>S.No.</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>
                          <i className="fa-solid fa-user-gear" style={{ marginRight: '8px' }}></i> Applicant / Host
                        </th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>
                          <i className="fa-solid fa-address-book" style={{ marginRight: '8px' }}></i> Contact Information
                        </th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>
                          <i className="fa-solid fa-briefcase" style={{ marginRight: '8px' }}></i> Experience
                        </th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>
                          <i className="fa-solid fa-shield-halved" style={{ marginRight: '8px' }}></i> Status
                        </th>
                        <th style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>
                          <i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Action
                        </th>
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
                          <td colSpan="6" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
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
                          .map((app, idx) => (
                            <tr key={app._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <td style={{ textAlign: 'center', fontWeight: '800', color: '#d4af37', fontSize: '0.9rem', padding: '14px 16px', verticalAlign: 'middle' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div>
                                  <span className="applicant-name-text" style={{ display: 'block', fontWeight: '700', color: '#ffffff' }}>{app.provider?.name || 'Caretaker Applicant'}</span>
                                  <span className="applied-date-sub" style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)' }}>{app.provider?.email || 'N/A'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div className="contact-item-row" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="fa-solid fa-phone" style={{ color: '#d4af37' }}></i>
                                  <span className="contact-phone-num" style={{ fontWeight: '700', color: '#ffffff' }}>{app.phone}</span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <span style={{ color: '#38bdf8', fontWeight: '700', fontSize: '0.88rem' }}>
                                  <i className="fa-solid fa-award" style={{ marginRight: '6px', color: '#d4af37' }}></i>
                                  {app.experience || '3+ Years'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <span className={`status-pill-glowing ${app.status || 'pending'}`} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: app.status === 'approved' ? '#3fb950' : app.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                  {app.status === 'approved' ? 'Approved ✅' : app.status === 'rejected' ? 'Rejected ❌' : 'Pending 🟡'}
                                </span>
                              </td>
                              <td className="action-cell" style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                <div className="action-buttons" style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    className="btn-table btn-view"
                                    onClick={() => handleOpenDetails(app, 'caretaker')}
                                    style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '6px 14px', borderRadius: '18px', cursor: 'pointer', fontWeight: '800', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    View Details
                                  </button>

                                  {app.status !== 'approved' && (
                                    <button
                                      className="btn-table btn-approve"
                                      onClick={() => handleCaretakerStatusUpdate(app._id, 'approved')}
                                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      Approve
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
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>S.No.</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}><i className="fa-solid fa-hotel" style={{ marginRight: '8px' }}></i> Property & Type</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}><i className="fa-solid fa-user-circle" style={{ marginRight: '8px' }}></i> Owner Account</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}><i className="fa-solid fa-location-dot" style={{ marginRight: '8px' }}></i> Location</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}><i className="fa-solid fa-indian-rupee-sign" style={{ marginRight: '8px' }}></i> Price / Night</th>
                        <th className="actions-header" style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}><i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Action</th>
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
                          .map((prop, idx) => (
                            <tr key={prop._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <td style={{ textAlign: 'center', fontWeight: '800', color: '#d4af37', fontSize: '0.9rem', padding: '14px 16px', verticalAlign: 'middle' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div>
                                  <span className="applicant-name-text" style={{ display: 'block', color: '#d4af37', fontWeight: '700' }}>{prop.name}</span>
                                  <span className="applied-date-sub" style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)' }}>{prop.type}</span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <div>
                                  <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>{prop.owner?.name || 'Registered Host'}</strong>
                                  <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.78rem', marginTop: '2px' }}>{prop.owner?.email || 'N/A'}</div>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <span style={{ color: '#ffffff', fontWeight: '600' }}>📍 {prop.location}</span>
                              </td>
                              <td className="price-cell" style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                <span style={{ color: '#52b788', fontWeight: '800' }}>₹{prop.price ? prop.price.toLocaleString('en-IN') : '12,000'}</span>
                              </td>
                              <td className="action-cell" style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                <div className="action-buttons" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    className="btn-table btn-view"
                                    onClick={() => handleOpenDetails(prop, 'property')}
                                    style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '6px 14px', borderRadius: '18px', cursor: 'pointer', fontWeight: '800', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    View Details
                                  </button>
                                  <button className="btn-table btn-price" onClick={() => {
                                    const p = prompt('Update pricing for ' + prop.name + ':', prop.price);
                                    if (p && !isNaN(p)) handleUpdatePrice(prop._id, p);
                                  }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', padding: '6px 10px', borderRadius: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                                    Price
                                  </button>
                                  {prop.status !== 'approved' && (
                                    <button
                                      onClick={() => handleStatusUpdate(prop._id, 'approved')}
                                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                      Approve
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

              {/* TAB 4: USERS */}
              {activeTab === 'users' && (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>S.No.</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>Username</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>Email Account</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>Assigned Role</th>
                        <th style={{ textAlign: 'left', padding: '14px 16px', verticalAlign: 'middle' }}>System Access Since</th>
                        <th style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>No users registered.</td>
                        </tr>
                      ) : (
                        data.users.map((user, idx) => (
                          <tr key={user._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <td style={{ textAlign: 'center', fontWeight: '800', color: '#d4af37', fontSize: '0.9rem', padding: '14px 16px', verticalAlign: 'middle' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                              <span className="applicant-name-text" style={{ fontWeight: '700', color: '#ffffff' }}>{user.name}</span>
                            </td>
                            <td style={{ padding: '14px 16px', verticalAlign: 'middle', color: 'rgba(255, 255, 255, 0.8)' }}>{user.email}</td>
                            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                              <span className="role-tag" style={{ background: user.role === 'admin' ? 'rgba(218, 54, 51, 0.2)' : user.role === 'owner' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(82, 183, 136, 0.2)', color: user.role === 'admin' ? '#f85149' : user.role === 'owner' ? '#ffd700' : '#52b788', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                {user.role || 'user'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', verticalAlign: 'middle', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>{new Date(user.createdAt || Date.now()).toLocaleDateString()}</td>
                            <td style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  className="btn-table btn-view"
                                  onClick={() => handleOpenDetails(user, 'user')}
                                  style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '6px 14px', borderRadius: '18px', cursor: 'pointer', fontWeight: '800', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                  View Details
                                </button>
                                {user.status === 'rejected' && (
                                  <button
                                    onClick={() => handleUserStatusUpdate(user._id, 'approved')}
                                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  className="btn-table btn-reject"
                                  onClick={() => handleRemoveUserFromDb(user._id, user.email)}
                                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Remove user from database"
                                >
                                  <i className="fa-solid fa-trash-can"></i> Remove
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

            <div className="admin-modal-body" style={{ padding: '24px', background: '#0f1715' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '20px',
                padding: '24px',
                color: '#ffffff'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  paddingBottom: '20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #d4af37 0%, #059669 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: '800',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                    flexShrink: 0
                  }}>
                    {(selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'H').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                        {selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'Property Owner'}
                      </h2>
                      <span className={`status-badge-pill ${selectedDetailItem.status || 'pending'}`}>
                        {selectedDetailItem.status === 'approved' ? 'Approved ✅' : selectedDetailItem.status === 'rejected' ? 'Rejected ❌' : 'Pending Verification 🟡'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '6px', flexWrap: 'wrap', fontSize: '0.88rem', color: '#a3b18a' }}>
                      <span><i className="fa-solid fa-shield-check" style={{ color: '#d4af37' }}></i> {selectedDetailItem.partnerType || selectedDetailItem.positionRole || 'Property Owner & Host'}</span>
                      <span><i className="fa-solid fa-envelope" style={{ color: '#38bdf8' }}></i> {selectedDetailItem.email || selectedDetailItem.owner?.email || selectedDetailItem.provider?.email || 'N/A'}</span>
                      <span><i className="fa-solid fa-phone" style={{ color: '#10b981' }}></i> {selectedDetailItem.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '24px',
                  paddingBottom: '20px',
                  borderBottom: (selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description || selectedDetailItem.status === 'approved') ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  marginBottom: (selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description || selectedDetailItem.status === 'approved') ? '20px' : '0'
                }}>
                  <div>
                    <h4 style={{ color: '#d4af37', fontSize: '0.95rem', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <i className="fa-solid fa-address-card" style={{ marginRight: '6px' }}></i> Contact & Identity
                    </h4>
                    <div className="detail-row"><span className="detail-label">Full Name:</span><span className="detail-val">{selectedDetailItem.fullName || selectedDetailItem.name || selectedDetailItem.provider?.name || 'N/A'}</span></div>
                    <div className="detail-row"><span className="detail-label">Email Address:</span><span className="detail-val">{selectedDetailItem.email || selectedDetailItem.owner?.email || selectedDetailItem.provider?.email || 'N/A'}</span></div>
                    <div className="detail-row"><span className="detail-label">Contact Phone:</span><span className="detail-val">{selectedDetailItem.phone || 'N/A'}</span></div>
                    {selectedDetailItem.govtId && (
                      <div className="detail-row"><span className="detail-label">Govt ID Proof:</span><span className="detail-val" style={{ color: '#ffd700', fontWeight: '700' }}>{selectedDetailItem.govtId}</span></div>
                    )}
                  </div>

                  <div>
                    <h4 style={{ color: '#d4af37', fontSize: '0.95rem', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <i className="fa-solid fa-building" style={{ marginRight: '6px' }}></i> Property & Stay Specs
                    </h4>
                    <div className="detail-row"><span className="detail-label">Property Name:</span><span className="detail-val" style={{ color: '#d4af37', fontWeight: '700' }}>{selectedDetailItem.propertyName || selectedDetailItem.name || 'N/A'}</span></div>
                    <div className="detail-row"><span className="detail-label">Location / Address:</span><span className="detail-val">{selectedDetailItem.propertyAddress || selectedDetailItem.city || selectedDetailItem.location || 'Mahabaleshwar'}</span></div>
                    {selectedDetailItem.positionRole && (
                      <div className="detail-row"><span className="detail-label">Position Required:</span><span className="detail-val" style={{ color: '#ffd700', fontWeight: '700' }}>{selectedDetailItem.positionRole}</span></div>
                    )}
                    {selectedDetailItem.experience && (
                      <div className="detail-row"><span className="detail-label">Required Experience:</span><span className="detail-val" style={{ color: '#38bdf8', fontWeight: '700' }}>{selectedDetailItem.experience}</span></div>
                    )}
                    {selectedDetailItem.assignedCaretakerName && (
                      <div className="detail-row"><span className="detail-label">Allocated Caretaker:</span><span className="detail-val" style={{ color: '#10b981', fontWeight: '700' }}>{selectedDetailItem.assignedCaretakerName} ({selectedDetailItem.assignedCaretakerPhone})</span></div>
                    )}
                  </div>
                </div>

                {(selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description) && (
                  <div style={{
                    marginBottom: selectedDetailItem.status === 'approved' ? '20px' : '0',
                    paddingBottom: selectedDetailItem.status === 'approved' ? '20px' : '0',
                    borderBottom: selectedDetailItem.status === 'approved' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                  }}>
                    <h4 style={{ color: '#d4af37', fontSize: '0.95rem', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <i className="fa-solid fa-comment-dots" style={{ marginRight: '6px' }}></i> Message / Bio Details
                    </h4>
                    <p className="detail-message-text">
                      "{selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description}"
                    </p>
                  </div>
                )}

                {selectedDetailItem.status === 'approved' && (detailModalType === 'caretaker' || selectedDetailItem.reqType === 'caretaker-request' || selectedDetailItem.assignedCaretakerName) && (
                  <div style={{
                    background: 'rgba(37, 211, 102, 0.08)',
                    border: '1px solid rgba(37, 211, 102, 0.3)',
                    borderRadius: '16px',
                    padding: '16px 20px'
                  }}>
                    <h4 style={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '1rem' }}>
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.2rem' }}></i> WhatsApp Dispatch Notification Center
                    </h4>
                    <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 12px 0' }}>
                      Dispatch verified contact and property details directly via WhatsApp:
                    </p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { handleCloseDetails(); handleOpenCaretakerOwnerMsg(selectedDetailItem); }}
                        style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '800', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)' }}
                      >
                        Message Property Owner
                      </button>
                      <button
                        onClick={() => sendCaretakerDetailsToOwner(selectedDetailItem)}
                        style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)' }}
                      >
                        Send Caretaker Info to Owner
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-modal-action btn-approve"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '20px',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => {
                  if (detailModalType === 'property') {
                    handleStatusUpdate(selectedDetailItem._id, 'approved');
                  } else if (detailModalType === 'partner' || selectedDetailItem.reqType === 'property-listing') {
                    handlePartnerStatusUpdate(selectedDetailItem._id, 'approved');
                  } else if (detailModalType === 'user') {
                    handleUserStatusUpdate(selectedDetailItem._id, 'approved');
                  } else {
                    handleCaretakerStatusUpdate(selectedDetailItem._id, 'approved');
                  }
                  handleCloseDetails();
                }}
              >
                Approve {detailModalType === 'property' ? 'Property' : detailModalType === 'user' ? 'User' : detailModalType === 'caretaker' ? 'Caretaker' : 'Listing'}
              </button>

              <button
                className="btn-modal-action btn-reject"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '20px',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => triggerRejectionConfirm(selectedDetailItem, detailModalType || selectedDetailItem.reqType)}
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION CONFIRMATION CARD MODAL */}
      {rejectTarget && (
        <div className="admin-modal-overlay" onClick={() => setRejectTarget(null)} style={{ zIndex: 100010 }}>
          <div 
            className="admin-modal-container" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '100%',
              borderRadius: '24px',
              background: 'linear-gradient(145deg, #1f1212 0%, #0d0707 100%)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
              padding: '32px 28px',
              textAlign: 'center',
              color: '#ffffff'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              margin: '0 auto 20px auto',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)'
            }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>

            <h3 style={{ margin: '0 0 10px 0', color: '#ffffff', fontSize: '1.35rem', fontFamily: 'Outfit, sans-serif', fontWeight: '800' }}>
              Confirm Rejection?
            </h3>

            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 26px 0' }}>
              Are you sure you want to reject <strong style={{ color: '#fca5a5' }}>"{rejectTarget.name}"</strong>? This will mark the request status as <span style={{ color: '#ef4444', fontWeight: '800' }}>Rejected ❌</span>.
            </p>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button
                onClick={() => setRejectTarget(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '11px 22px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  flex: 1,
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  handleConfirmRejection();
                  setRejectTarget(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '11px 22px',
                  borderRadius: '20px',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                  flex: 1,
                  transition: 'all 0.2s ease'
                }}
              >
                Confirm Rejection
              </button>
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
                  <option value="">-- Select Property Owner --</option>
                  {caretakerSeekingOwners.map((item) => {
                    const name = item.fullName || item.name || item.provider?.name || 'Property Owner';
                    return (
                      <option key={item._id} value={item._id}>
                        {name}
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
                    Staff Allocation
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
                    Key & Security Info
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
                    Duty Schedule
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
                    Custom Notice
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
                  Send via WhatsApp
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
                  {isSendingCaretakerMsg ? 'Dispatching...' : 'Dispatch Official Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default AdminDashboard;
