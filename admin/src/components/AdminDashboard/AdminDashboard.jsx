import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { API_BASE_URL } from '../../config';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('properties');
  const [data, setData] = useState({
    users: [],
    properties: [],
    bookings: []
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
                     activeTab === 'users' ? 'admin/users' : 'bookings/all';
    
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
        console.warn('Expected array but got:', result);
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
            <p>Control center for luxury hospitality network</p>
          </div>
          <div className="admin-profile">
            <div className="profile-icon">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div className="profile-info">
              <span className="profile-name">{adminName}</span>
              <span className="profile-role">Systems Administrator</span>
            </div>
          </div>
        </header>

        <section className="admin-section fade-in">
          {loading ? (
            <div className="loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <p>Retrieving secure ledger records...</p>
            </div>
          ) : (
            <div className="data-table-card glass-morphism">
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
                                    <i className="fa-solid fa-circle-check"></i> Approve
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
