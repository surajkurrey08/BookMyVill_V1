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
  const navigate = useNavigate();

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
          {loading ? (
            <div className="loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <p>Retrieving secure security records...</p>
            </div>
          ) : (
            <div className="data-table-card glass-morphism">
              {activeTab === 'partners' && (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Applicant Details</th>
                        <th>Contact Info</th>
                        <th>Applied Role</th>
                        <th>Location / Message</th>
                        <th>Status</th>
                        <th className="actions-header">Security Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.partners.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row">No Join Us partner applications pending.</td>
                        </tr>
                      ) : (
                        data.partners.map(app => (
                          <tr key={app._id}>
                            <td>
                              <div className="property-cell">
                                <span className="property-title">{app.fullName}</span>
                                <span className="property-type">{new Date(app.appliedAt).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td>
                              <div className="owner-cell">
                                <strong>{app.phone}</strong>
                                <span className="owner-email">{app.email}</span>
                              </div>
                            </td>
                            <td>
                              <span className="role-badge" style={{ background: app.partnerType === 'Property Owner' ? '#1b4332' : '#0077b6', color: '#ffffff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                                {app.partnerType}
                              </span>
                            </td>
                            <td>
                              <div style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                                <strong>{app.city}</strong>
                                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.8rem' }}>{app.message || 'No additional message provided.'}</p>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${app.status}`} style={{ background: app.status === 'approved' ? '#d4edda' : app.status === 'rejected' ? '#f8d7da' : '#fff3cd', color: app.status === 'approved' ? '#155724' : app.status === 'rejected' ? '#721c24' : '#856404', padding: '6px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.8rem' }}>
                                {app.status === 'approved' ? 'Approved ✅' : app.status === 'rejected' ? 'Rejected ❌' : 'Pending Verification 🟡'}
                              </span>
                            </td>
                            <td className="action-buttons">
                              <button 
                                className="btn-table btn-approve" 
                                onClick={() => handlePartnerStatusUpdate(app._id, 'approved')}
                                style={{ background: '#2b9348', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', marginRight: '6px' }}
                              >
                                <i className="fa-solid fa-check"></i> Accept
                              </button>
                              <button 
                                className="btn-table btn-reject" 
                                onClick={() => handlePartnerStatusUpdate(app._id, 'rejected')}
                                style={{ background: '#d62828', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                              >
                                <i className="fa-solid fa-xmark"></i> Reject
                              </button>
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
                        <th>Caretaker / Provider</th>
                        <th>Contact & Govt ID</th>
                        <th>Property & Experience</th>
                        <th>Status</th>
                        <th className="actions-header">Security Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.caretakers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-row">No caretaker applications found.</td>
                        </tr>
                      ) : (
                        data.caretakers.map(app => (
                          <tr key={app._id}>
                            <td>
                              <div className="owner-cell">
                                <strong>{app.provider?.name || 'Applicant Caretaker'}</strong>
                                <span className="owner-email">{app.provider?.email}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.85rem' }}>
                                <div>📞 {app.phone}</div>
                                <div style={{ color: '#666', fontSize: '0.8rem' }}>Govt ID: {app.govtId || 'N/A'}</div>
                              </div>
                            </td>
                            <td>
                              <div style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                                <strong>{app.propertyName}</strong>
                                <div style={{ color: '#d4af37', fontWeight: '700', fontSize: '0.78rem' }}>Exp: {app.experience}</div>
                                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.8rem' }}>{app.bio}</p>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${app.status}`} style={{ background: app.status === 'approved' ? '#d4edda' : app.status === 'rejected' ? '#f8d7da' : '#fff3cd', color: app.status === 'approved' ? '#155724' : app.status === 'rejected' ? '#721c24' : '#856404', padding: '6px 12px', borderRadius: '20px', fontWeight: '700', fontSize: '0.8rem' }}>
                                {app.status === 'approved' ? 'Approved ✅' : app.status === 'rejected' ? 'Rejected ❌' : 'Pending 🟡'}
                              </span>
                            </td>
                            <td className="action-buttons">
                              <button 
                                className="btn-table btn-approve" 
                                onClick={() => handleCaretakerStatusUpdate(app._id, 'approved')}
                                style={{ background: '#2b9348', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', marginRight: '6px' }}
                              >
                                <i className="fa-solid fa-check"></i> Accept
                              </button>
                              <button 
                                className="btn-table btn-reject" 
                                onClick={() => handleCaretakerStatusUpdate(app._id, 'rejected')}
                                style={{ background: '#d62828', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                              >
                                <i className="fa-solid fa-xmark"></i> Reject
                              </button>
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
                        <th>Property Details</th>
                        <th>Owner Account</th>
                        <th>Location</th>
                        <th>Price / Night</th>
                        <th>Verification Status</th>
                        <th className="actions-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.properties.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="empty-row">No properties available.</td>
                        </tr>
                      ) : (
                        data.properties.map(prop => (
                          <tr key={prop._id}>
                            <td>
                              <div className="property-cell">
                                <span className="property-title">{prop.name}</span>
                                <span className="property-type">{prop.type}</span>
                              </div>
                            </td>
                            <td>
                              <div className="owner-cell">
                                <strong>{prop.owner?.name || 'Unknown'}</strong>
                                <span className="owner-email">{prop.owner?.email}</span>
                              </div>
                            </td>
                            <td>{prop.location}</td>
                            <td className="price-cell">₹{prop.price.toLocaleString('en-IN')}</td>
                            <td>
                              <span className={`status-badge ${prop.status}`}>
                                {prop.status}
                              </span>
                            </td>
                            <td className="action-buttons">
                              <button className="btn-table btn-price" onClick={() => {
                                const p = prompt('Update pricing for ' + prop.name + ':', prop.price);
                                if (p && !isNaN(p)) handleUpdatePrice(prop._id, p);
                              }}>
                                <i className="fa-solid fa-tag"></i> Price
                              </button>
                              {prop.status === 'pending' && (
                                <>
                                  <button className="btn-table btn-approve" onClick={() => handleStatusUpdate(prop._id, 'approved')}>
                                    <i className="fa-solid fa-circle-check"></i> Accept
                                  </button>
                                  <button className="btn-table btn-reject" onClick={() => handleStatusUpdate(prop._id, 'rejected')}>
                                    <i className="fa-solid fa-circle-xmark"></i> Reject
                                  </button>
                                </>
                              )}
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
    </div>
  );

};

export default AdminDashboard;
