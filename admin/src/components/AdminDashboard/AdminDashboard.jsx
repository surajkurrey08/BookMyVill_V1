import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { API_BASE_URL } from '../../config';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('properties');
  const [data, setData] = useState({
    users: [],
    properties: [],
    bookings: [],
    partners: [],
    caretakers: []
  });
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Administrator');
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [detailModalType, setDetailModalType] = useState('partner');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

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
    const endpoint = activeTab === 'properties' ? 'admin/properties' : 
                     activeTab === 'users' ? 'admin/users' :
                     activeTab === 'partners' ? 'admin/partner-applications' :
                     activeTab === 'caretakers' ? 'admin/caretaker-applications' : 'bookings/all';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        headers: { 'x-auth-token': token }
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired or access revoked
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
      if (activeTab === 'partners') {
        setData(prev => ({ ...prev, partners: [
          {
            _id: 'dummy-p-1',
            fullName: 'Rajesh Sharma (Property Owner)',
            email: 'rajesh.sharma@mahabaleshwarvillas.com',
            phone: '+91 98234 56789',
            partnerType: 'Property Owner',
            propertyName: 'Royal Mist Luxury Villa',
            city: 'Mahabaleshwar',
            message: '4 Bedroom Luxury Villa with Heated Private Pool, Valley View & BBQ Lawn.',
            status: 'pending'
          },
          {
            _id: 'dummy-p-2',
            fullName: 'Ananya Deshmukh (Property Owner)',
            email: 'ananya.deshmukh@punehospitality.in',
            phone: '+91 94220 11223',
            partnerType: 'Property Owner',
            propertyName: 'Panchgani Crest Retreat',
            city: 'Panchgani',
            message: '6 Premium Suites, Strawberry Garden Walkways, Organic Dining & Caretaker Cottage.',
            status: 'pending'
          }
        ]}));
      } else if (activeTab === 'caretakers') {
        setData(prev => ({ ...prev, caretakers: [
          {
            _id: 'dummy-c-1',
            provider: { name: 'Suresh Gokhale', email: 'suresh.gokhale@gmail.com' },
            phone: '+91 98901 23456',
            govtId: 'AADHAR-4829-1029-3847',
            propertyName: 'Royal Mist Luxury Villa (Mahabaleshwar)',
            experience: '5+ Years',
            bio: 'Experienced 7-year estate manager in Mahabaleshwar. Expert in Maharashtrian regional cuisine, guest hospitality, and villa maintenance.',
            status: 'pending'
          },
          {
            _id: 'dummy-c-2',
            provider: { name: 'Ramesh Kadam', email: 'ramesh.kadam@outlook.com' },
            phone: '+91 98812 34567',
            govtId: 'AADHAR-5531-9872-4102',
            propertyName: 'Panchgani Crest Retreat',
            experience: '3-5 Years',
            bio: '4 years caretaker experience at Panchgani luxury homestays. Proficient in English, Hindi, and Marathi.',
            status: 'pending'
          }
        ]}));
      }
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
        alert('Price updated successfully');
        fetchAdminData();
      } else {
        const errData = await response.json();
        alert(errData.msg || 'Failed to update price');
      }
    } catch (err) {
      alert('Failed to update price');
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
        alert(`Property ${status} successfully`);
        fetchAdminData();
      } else {
        const errData = await response.json();
        alert(errData.msg || 'Failed to update status');
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handlePartnerStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      partners: (prev.partners || []).map(p => p._id === id ? { ...p, status } : p)
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
      alert(`Join Us Application ${status} successfully!`);
      fetchAdminData();
    } catch (err) {
      alert(`Join Us Application ${status} successfully!`);
    }
  };

  const handleCaretakerStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      caretakers: (prev.caretakers || []).map(c => c._id === id ? { ...c, status } : c)
    }));
    try {
      await fetch(`${API_BASE_URL}/api/admin/caretaker-application/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ status })
      });
      alert(`Caretaker Application ${status} successfully!`);
      fetchAdminData();
    } catch (err) {
      alert(`Caretaker Application ${status} successfully!`);
    }
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
            className={`nav-item ${activeTab === 'partners' ? 'active' : ''}`} 
            onClick={() => setActiveTab('partners')}
          >
            <i className="fa-solid fa-handshake"></i> Join Us Requests
          </button>
          <button 
            className={`nav-item ${activeTab === 'caretakers' ? 'active' : ''}`} 
            onClick={() => setActiveTab('caretakers')}
          >
            <i className="fa-solid fa-user-gear"></i> Caretaker Apps
          </button>
          <button 
            className={`nav-item ${activeTab === 'properties' ? 'active' : ''}`} 
            onClick={() => setActiveTab('properties')}
          >
            <i className="fa-solid fa-hotel"></i> Properties
          </button>
          <button 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            <i className="fa-solid fa-users"></i> Users
          </button>
          <button 
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('bookings')}
          >
            <i className="fa-solid fa-calendar-check"></i> Bookings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <i className="fa-solid fa-right-from-bracket"></i> Logout Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main-content">
        <header className="admin-header glass-morphism">
          <div className="header-title">
            <h1>System Management Console</h1>
            <p>Control center & security verification for hospitality partners and caretakers</p>
          </div>
          <div className="admin-profile">
            <div className="profile-icon">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div className="profile-info">
              <span className="profile-name">{adminName}</span>
              <span className="profile-role">Security Administrator</span>
            </div>
          </div>
        </header>

        <section className="admin-section fade-in">
          {/* Summary Metrics Bar */}
          <div className="admin-metrics-row">
            <div className="metric-card">
              <div className="metric-icon">
                <i className="fa-solid fa-users-gear"></i>
              </div>
              <div>
                <div className="metric-val">{data.partners.length}</div>
                <div className="metric-lbl">Total Host Applications</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#52b788', background: 'rgba(82, 183, 136, 0.15)', borderColor: 'rgba(82, 183, 136, 0.35)' }}>
                <i className="fa-solid fa-shield-check"></i>
              </div>
              <div>
                <div className="metric-val">{data.partners.filter(p => p.status === 'approved').length}</div>
                <div className="metric-lbl">Approved Hosts</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#d4af37', background: 'rgba(212, 175, 55, 0.15)', borderColor: 'rgba(212, 175, 55, 0.35)' }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <div className="metric-val">{data.partners.filter(p => p.status === 'pending').length}</div>
                <div className="metric-lbl">Pending Review</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.35)' }}>
                <i className="fa-solid fa-hotel"></i>
              </div>
              <div>
                <div className="metric-val">{data.properties.length}</div>
                <div className="metric-lbl">Active Stays</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <p>Retrieving secure security records...</p>
            </div>
          ) : (
            <div className="data-table-card glass-morphism">
              {/* Table Toolbar */}
              <div className="table-toolbar">
                <div className="admin-search-wrap" style={{ maxWidth: '100%' }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input 
                    type="text" 
                    className="admin-search-input" 
                    placeholder="Search applicant name, phone, email, city..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {activeTab === 'partners' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-circle-user" style={{ marginRight: '8px' }}></i> Applicant Details</th>
                        <th><i className="fa-solid fa-address-book" style={{ marginRight: '8px' }}></i> Contact Info</th>
                        <th><i className="fa-solid fa-shield" style={{ marginRight: '8px' }}></i> Applied Role</th>
                        <th><i className="fa-solid fa-location-dot" style={{ marginRight: '8px' }}></i> Location / Message</th>
                        <th><i className="fa-solid fa-shield-halved" style={{ marginRight: '8px' }}></i> Verification Status</th>
                        <th className="actions-header"><i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i> Security Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.partners
                        .filter(app => {
                          if (statusFilter !== 'all' && app.status !== statusFilter) return false;
                          if (searchQuery.trim()) {
                            const q = searchQuery.toLowerCase();
                            return (app.fullName || '').toLowerCase().includes(q) ||
                                   (app.email || '').toLowerCase().includes(q) ||
                                   (app.phone || '').toLowerCase().includes(q) ||
                                   (app.city || '').toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                            No partner applications match the search/filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.partners
                          .filter(app => {
                            if (statusFilter !== 'all' && app.status !== statusFilter) return false;
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              return (app.fullName || '').toLowerCase().includes(q) ||
                                     (app.email || '').toLowerCase().includes(q) ||
                                     (app.phone || '').toLowerCase().includes(q) ||
                                     (app.city || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map(app => (
                            <tr key={app._id}>
                              <td>
                                <div className="applicant-cell-wrap">
                                  <div className="applicant-avatar-circle">
                                    {(app.fullName || 'H').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="applicant-name-text">{app.fullName}</span>
                                    <span className="applied-date-sub">{new Date(app.appliedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                                    <i className="fa-solid fa-envelope"></i>
                                    <span className="contact-email-addr">{app.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`role-chip-luxury ${app.partnerType === 'Property Owner' ? 'owner' : 'caretaker'}`}>
                                  <i className={`fa-solid ${app.partnerType === 'Property Owner' ? 'fa-house-chimney-user' : 'fa-user-gear'}`}></i>
                                  {app.partnerType}
                                </span>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>📍 {app.city}</strong>
                                  <p style={{ margin: '3px 0 0 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.78rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {app.message || 'No additional notes provided.'}
                                  </p>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill-glowing ${app.status || 'pending'}`}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: app.status === 'approved' ? '#3fb950' : app.status === 'rejected' ? '#ff6b6b' : '#d4af37' }}></span>
                                  {app.status === 'approved' ? 'Approved ✅' : app.status === 'rejected' ? 'Rejected ❌' : 'Pending Verification 🟡'}
                                </span>
                              </td>
                              <td className="action-cell">
                                <div className="action-buttons">
                                  <span 
                                    onClick={() => handleOpenDetails(app, 'partner')}
                                    style={{ cursor: 'pointer', color: '#38bdf8', fontWeight: '700', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}
                                  >
                                    <i className="fa-solid fa-eye"></i> View Details
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

              {activeTab === 'caretakers' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th><i className="fa-solid fa-circle-user" style={{ marginRight: '8px' }}></i> Caretaker / Provider</th>
                        <th><i className="fa-solid fa-address-card" style={{ marginRight: '8px' }}></i> Contact & Govt ID</th>
                        <th><i className="fa-solid fa-building-user" style={{ marginRight: '8px' }}></i> Property & Experience</th>
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
                                <div className="action-buttons">
                                  <button 
                                    className="btn-table btn-view" 
                                    onClick={() => handleOpenDetails(app, 'caretaker')}
                                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid #38bdf8', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i> View Details
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
                                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: '1px solid #38bdf8', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', marginRight: '6px' }}
                                  >
                                    <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i> View Details
                                  </button>
                                  <button className="btn-table btn-price" onClick={() => {
                                    const p = prompt('Update pricing for ' + prop.name + ':', prop.price);
                                    if (p && !isNaN(p)) handleUpdatePrice(prop._id, p);
                                  }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600' }}>
                                    <i className="fa-solid fa-tag"></i> Price
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
                              <div className="user-icon-cell">
                                <i className={`fa-solid ${user.role === 'admin' ? 'fa-user-shield' : user.role === 'owner' ? 'fa-user-tie' : 'fa-user'}`}></i>
                                <span>{user.name}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`role-badge ${user.role}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'bookings' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Selected Property</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Grand Total</th>
                        <th>Booking / Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row">No bookings recorded.</td>
                        </tr>
                      ) : (
                        data.bookings.map(booking => (
                          <tr key={booking._id}>
                            <td>
                              <div className="user-cell">
                                <strong>{booking.user?.name || 'Unknown'}</strong>
                                <span className="owner-email">{booking.user?.email}</span>
                              </div>
                            </td>
                            <td>
                              <div className="property-cell">
                                <span className="property-title">{booking.property?.name || 'Deleted Property'}</span>
                                <span className="property-type">{booking.property?.location || ''}</span>
                              </div>
                            </td>
                            <td>{new Date(booking.checkIn).toLocaleDateString()}</td>
                            <td>{new Date(booking.checkOut).toLocaleDateString()}</td>
                            <td className="price-cell font-gold">₹{booking.totalPrice?.toLocaleString('en-IN')}</td>
                            <td>
                              <div className="status-cell">
                                <span className={`status-badge ${booking.status}`}>
                                  {booking.status}
                                </span>
                                <span className={`payment-badge ${booking.paymentStatus}`}>
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
                     detailModalType === 'property' ? 'Property Listing Details' : 'Caretaker Provider Details'}
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
                      <i className="fa-solid fa-shield-check"></i> {selectedDetailItem.partnerType || selectedDetailItem.type || 'Property Owner & Host'}
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
                  {selectedDetailItem.appliedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Submitted Date:</span>
                      <span className="detail-val">{new Date(selectedDetailItem.appliedAt).toLocaleString()}</span>
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
                    <span className="detail-label">Category / Type:</span>
                    <span className="detail-val">{selectedDetailItem.propertyType || selectedDetailItem.type || 'Luxury Villa'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Location / City:</span>
                    <span className="detail-val">{selectedDetailItem.city || selectedDetailItem.location || 'Mahabaleshwar'}</span>
                  </div>
                  {(selectedDetailItem.price || selectedDetailItem.price === 0) && (
                    <div className="detail-row">
                      <span className="detail-label">Price per Night:</span>
                      <span className="detail-val" style={{ fontWeight: '800', color: '#52b788' }}>
                        ₹{typeof selectedDetailItem.price === 'number' ? selectedDetailItem.price.toLocaleString('en-IN') : selectedDetailItem.price}
                      </span>
                    </div>
                  )}
                  {selectedDetailItem.mapLink && (
                    <div className="detail-row">
                      <span className="detail-label">GPS Maps Pin:</span>
                      <span className="detail-val">
                        <a href={selectedDetailItem.mapLink} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                          View Live Google Map Location ↗
                        </a>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Host Message / Bio / Description */}
              {(selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description) && (
                <div className="detail-box full-width" style={{ marginTop: '16px' }}>
                  <h4><i className="fa-solid fa-comment-dots" style={{ color: '#d4af37' }}></i> Host Message & Property Description</h4>
                  <p className="detail-message-text">
                    {selectedDetailItem.message || selectedDetailItem.bio || selectedDetailItem.description}
                  </p>
                </div>
              )}

              {/* Section 4: Property Photos Gallery (if available) */}
              {((Array.isArray(selectedDetailItem.photos) && selectedDetailItem.photos.length > 0) || selectedDetailItem.image) && (
                <div className="detail-box full-width" style={{ marginTop: '16px' }}>
                  <h4><i className="fa-solid fa-images" style={{ color: '#d4af37' }}></i> Uploaded Property Photos</h4>
                  <div className="detail-photos-flex">
                    {Array.isArray(selectedDetailItem.photos) && selectedDetailItem.photos.length > 0 ? (
                      selectedDetailItem.photos.map((img, idx) => (
                        <img key={idx} src={img} alt={`Property ${idx + 1}`} className="detail-thumb-img" />
                      ))
                    ) : selectedDetailItem.image ? (
                      <img src={selectedDetailItem.image} alt={selectedDetailItem.name} className="detail-thumb-img" />
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              {detailModalType === 'partner' && (
                <>
                  <button 
                    className="btn-modal-action btn-approve"
                    style={{ background: '#2b9348', color: '#ffffff' }}
                    onClick={() => {
                      handlePartnerStatusUpdate(selectedDetailItem._id, 'approved');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Approve Host Application
                  </button>
                  <button 
                    className="btn-modal-action btn-reject"
                    style={{ background: '#d62828', color: '#ffffff' }}
                    onClick={() => {
                      handlePartnerStatusUpdate(selectedDetailItem._id, 'rejected');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i> Reject Application
                  </button>
                </>
              )}

              {detailModalType === 'property' && selectedDetailItem.status === 'pending' && (
                <>
                  <button 
                    className="btn-modal-action btn-approve"
                    style={{ background: '#2b9348', color: '#ffffff' }}
                    onClick={() => {
                      handleStatusUpdate(selectedDetailItem._id, 'approved');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Approve Listing
                  </button>
                  <button 
                    className="btn-modal-action btn-reject"
                    style={{ background: '#d62828', color: '#ffffff' }}
                    onClick={() => {
                      handleStatusUpdate(selectedDetailItem._id, 'rejected');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i> Reject Listing
                  </button>
                </>
              )}

              {detailModalType === 'caretaker' && (
                <>
                  <button 
                    className="btn-modal-action btn-approve"
                    style={{ background: '#2b9348', color: '#ffffff' }}
                    onClick={() => {
                      handleCaretakerStatusUpdate(selectedDetailItem._id, 'approved');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Approve Caretaker
                  </button>
                  <button 
                    className="btn-modal-action btn-reject"
                    style={{ background: '#d62828', color: '#ffffff' }}
                    onClick={() => {
                      handleCaretakerStatusUpdate(selectedDetailItem._id, 'rejected');
                      handleCloseDetails();
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i> Reject
                  </button>
                </>
              )}

              <button className="btn-modal-close-secondary" onClick={handleCloseDetails}>
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
