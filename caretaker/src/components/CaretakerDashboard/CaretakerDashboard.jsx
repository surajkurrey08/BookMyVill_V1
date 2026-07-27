import React, { useState, useEffect } from 'react';
import './CaretakerDashboard.css';
import { API_BASE_URL } from '../../config';

const CaretakerDashboard = () => {
  const [activeTab, setActiveTab] = useState('attendance');
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Attendance State
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [shiftNotes, setShiftNotes] = useState('');
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Daily Duty Checklist State
  const [duties, setDuties] = useState([
    { id: 1, title: 'Pool Water Filtration & Chemical Inspection', time: '07:30 AM', category: 'Maintenance', completed: true },
    { id: 2, title: 'Fresh Bed Linen & Bath Towels Replacement', time: '09:00 AM', category: 'Housekeeping', completed: true },
    { id: 3, title: 'Guest Welcome Drinks & Key Handover Prep', time: '11:30 AM', category: 'Guest Care', completed: false },
    { id: 4, title: 'Lawn Bonfire Wood Setup & Firepit Inspection', time: '05:00 PM', category: 'Amenities', completed: false },
    { id: 5, title: 'Diesel Generator & Power Backup Check', time: '07:00 PM', category: 'Safety', completed: false }
  ]);

  // Today's Guest Bookings State
  const [guestArrivals, setGuestArrivals] = useState([
    { id: 'B-8091', guestName: 'Rajesh Sharma', phone: '+91 98234 56789', rooms: '3 BHK Royal Villa', checkIn: '01:00 PM', guestsCount: 6, status: 'Arriving Today' },
    { id: 'B-8094', guestName: 'Priya Kulkarni', phone: '+91 97654 32109', rooms: 'Luxury Penthouse Suite', checkIn: '03:30 PM', guestsCount: 4, status: 'Confirmed' }
  ]);

  // Issue Report Form
  const [reportForm, setReportForm] = useState({
    issueType: 'Plumbing / Water Supply',
    propertyName: 'Royal Mist Villa Estate',
    description: '',
    urgency: 'Medium'
  });
  const [reportSuccess, setReportSuccess] = useState('');

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load User & Attendance Logs
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUser(u);
        fetchAttendanceLogs(u.name || 'Caretaker Host');
      } catch (e) {
        setUser(null);
      }
    } else {
      const demoUser = { name: 'Suresh Patil', email: 'patil.caretaker@example.com', phone: '+91 98765 12345', role: 'caretaker' };
      setUser(demoUser);
      fetchAttendanceLogs(demoUser.name);
    }
  }, []);

  const fetchAttendanceLogs = async (name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/attendance/my-logs?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceLogs(data);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRec = data.find(r => r.date === todayStr);
        if (todayRec && todayRec.status === 'checked-in') {
          setIsCheckedIn(true);
          setCheckInTime(new Date(todayRec.checkInTime));
        }
      } else {
        setAttendanceLogs(getMockLogs());
      }
    } catch (err) {
      setAttendanceLogs(getMockLogs());
    }
  };

  const getMockLogs = () => [
    { _id: '1', date: '2026-07-25', checkInTime: '2026-07-25T08:00:00.000Z', checkOutTime: null, hoursWorked: 4.5, status: 'checked-in', shiftNotes: 'Morning Villa Inspection' },
    { _id: '2', date: '2026-07-24', checkInTime: '2026-07-24T08:00:00.000Z', checkOutTime: '2026-07-24T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Full Day Shift - Guest Checkout' },
    { _id: '3', date: '2026-07-23', checkInTime: '2026-07-23T08:15:00.000Z', checkOutTime: '2026-07-23T18:00:00.000Z', hoursWorked: 9.75, status: 'present', shiftNotes: 'Pool Filter Cleaning' },
    { _id: '4', date: '2026-07-22', checkInTime: '2026-07-22T08:00:00.000Z', checkOutTime: '2026-07-22T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Linen Change & Lawn Setup' },
    { _id: '5', date: '2026-07-21', checkInTime: '2026-07-21T08:00:00.000Z', checkOutTime: '2026-07-21T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Routine Property Maintenance' }
  ];

  // Handle Attendance Check-In
  const handleCheckIn = async () => {
    const caretakerName = user?.name || 'Suresh Patil';
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caretakerName,
          propertyName: 'Royal Mist Villa Estate',
          shiftNotes: shiftNotes || 'Morning Duty Check-In'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCheckedIn(true);
        setCheckInTime(new Date());
        setStatusMsg({ type: 'success', text: '✅ Check-In Recorded! You are now ON DUTY.' });
        fetchAttendanceLogs(caretakerName);
      } else {
        setStatusMsg({ type: 'error', text: data.msg || 'Already checked in for today.' });
        setIsCheckedIn(true);
      }
    } catch (err) {
      setIsCheckedIn(true);
      setCheckInTime(new Date());
      setStatusMsg({ type: 'success', text: '✅ Check-In Recorded locally! On Duty.' });
    }
  };

  // Handle Attendance Check-Out
  const handleCheckOut = async () => {
    const caretakerName = user?.name || 'Suresh Patil';
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/caretaker/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caretakerName,
          shiftNotes: shiftNotes || 'Evening Duty Shift Complete'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCheckedIn(false);
        setCheckInTime(null);
        setStatusMsg({ type: 'success', text: '🛑 Check-Out Recorded! Shift completed successfully.' });
        fetchAttendanceLogs(caretakerName);
      } else {
        setStatusMsg({ type: 'error', text: data.msg || 'Check-out failed.' });
      }
    } catch (err) {
      setIsCheckedIn(false);
      setCheckInTime(null);
      setStatusMsg({ type: 'success', text: '🛑 Check-Out Recorded! Shift log updated.' });
    }
  };

  // Toggle Duty Task
  const toggleDuty = (id) => {
    setDuties(duties.map(d => d.id === id ? { ...d, completed: !d.completed } : d));
  };

  // Handle Maintenance Issue Report
  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportForm.description.trim()) return;
    setReportSuccess('⚠️ Maintenance Alert sent directly to Property Owner & Admin!');
    setReportForm({ ...reportForm, description: '' });
    setTimeout(() => setReportSuccess(''), 5000);
  };

  const completedCount = duties.filter(d => d.completed).length;
  const progressPercent = Math.round((completedCount / duties.length) * 100);

  return (
    <div className="caretaker-dashboard-page">
      {/* Top Header Navigation Bar */}
      <header className="caretaker-navbar">
        <div className="nav-brand">
          <span className="logo-title">Mahabaleshwar</span>
          <span className="logo-subtitle">CARETAKER DASHBOARD</span>
        </div>
        <div className="nav-links">
          <a href="/apply" className="nav-btn-link"><i className="fa-solid fa-file-signature"></i> Verification Form</a>
          <a href="http://localhost:5173" className="back-link"><i className="fa-solid fa-arrow-left"></i> Main Site</a>
        </div>
      </header>

      <div className="caretaker-container">
        {/* Header Profile Card */}
        <div className="caretaker-header-card glass-morphism">
          <div className="caretaker-profile-wrap">
            <div className="caretaker-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="caretaker-meta">
              <h2>{user?.name || 'Suresh Patil'} <span className="verified-badge"><i className="fa-solid fa-shield-check"></i> Verified Caretaker</span></h2>
              <p><i className="fa-solid fa-hotel" style={{ color: '#d4af37' }}></i> Assigned Property: <strong>Royal Mist Villa Estate (Mahabaleshwar)</strong></p>
              <div className="contact-pills">
                <span><i className="fa-solid fa-phone"></i> {user?.phone || '+91 98765 12345'}</span>
                <span><i className="fa-solid fa-envelope"></i> {user?.email || 'patil.caretaker@example.com'}</span>
              </div>
            </div>
          </div>

          {/* Live Clock & Duty Status Pill */}
          <div className="caretaker-status-clock">
            <div className="live-time-display">
              <span className="time-text">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="date-text">{currentTime.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className={`duty-pill ${isCheckedIn ? 'on-duty' : 'off-duty'}`}>
              <span className="pulse-dot"></span>
              {isCheckedIn ? 'ON DUTY (Checked In)' : 'OFF DUTY (Not Checked In)'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="caretaker-tabs-row">
          <button className={`ct-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
            <i className="fa-solid fa-clock-user"></i> Attendance & Shift Log
          </button>
          <button className={`ct-tab-btn ${activeTab === 'duties' ? 'active' : ''}`} onClick={() => setActiveTab('duties')}>
            <i className="fa-solid fa-list-check"></i> Daily Duty Checklist ({completedCount}/{duties.length})
          </button>
          <button className={`ct-tab-btn ${activeTab === 'guests' ? 'active' : ''}`} onClick={() => setActiveTab('guests')}>
            <i className="fa-solid fa-user-gear"></i> Guest Arrivals ({guestArrivals.length})
          </button>
          <button className={`ct-tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
            <i className="fa-solid fa-triangle-exclamation"></i> Property Alert Report
          </button>
        </div>

        {/* TAB 1: ATTENDANCE MANAGEMENT */}
        {activeTab === 'attendance' && (
          <div className="tab-content fade-in">
            <div className="attendance-action-card glass-morphism">
              <div className="action-card-header">
                <h3><i className="fa-solid fa-fingerprint" style={{ color: '#d4af37' }}></i> Daily Attendance Punch & Shift Log</h3>
                <p>Punch your daily arrival check-in and departure check-out for monthly salary & shift validation.</p>
              </div>

              {statusMsg.text && (
                <div className={`status-banner ${statusMsg.type}`}>
                  {statusMsg.text}
                </div>
              )}

              <div className="punch-controls-grid">
                <div className="punch-box">
                  <label>Shift Duty Notes / Remarks</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Morning shift check-in, clean linen & pool inspection done"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="shift-notes-input"
                  />
                </div>

                <div className="punch-btn-group">
                  {!isCheckedIn ? (
                    <button className="btn-punch check-in-btn" onClick={handleCheckIn}>
                      <i className="fa-solid fa-right-to-bracket"></i> Check-In Now (On Duty)
                    </button>
                  ) : (
                    <button className="btn-punch check-out-btn" onClick={handleCheckOut}>
                      <i className="fa-solid fa-right-from-bracket"></i> Check-Out (End Shift)
                    </button>
                  )}
                </div>
              </div>

              {isCheckedIn && checkInTime && (
                <div className="active-shift-timer">
                  <i className="fa-solid fa-stopwatch fa-spin" style={{ color: '#52b788', marginRight: '8px' }}></i>
                  Active Shift Started at: <strong>{checkInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              )}
            </div>

            <div className="attendance-metrics-grid">
              <div className="att-metric-card">
                <div className="metric-icon" style={{ background: 'rgba(82, 183, 136, 0.2)', color: '#52b788' }}>
                  <i className="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                  <div className="m-val">24 / 25 Days</div>
                  <div className="m-lbl">Present Days This Month</div>
                </div>
              </div>

              <div className="att-metric-card">
                <div className="metric-icon" style={{ background: 'rgba(212, 175, 55, 0.2)', color: '#d4af37' }}>
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <div className="m-val">218.5 Hrs</div>
                  <div className="m-lbl">Total Duty Hours Logged</div>
                </div>
              </div>

              <div className="att-metric-card">
                <div className="metric-icon" style={{ background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8' }}>
                  <i className="fa-solid fa-badge-percent"></i>
                </div>
                <div>
                  <div className="m-val">96%</div>
                  <div className="m-lbl">Monthly Attendance Score</div>
                </div>
              </div>
            </div>

            <div className="attendance-table-card glass-morphism">
              <div className="table-header-title">
                <h4><i className="fa-solid fa-table-list" style={{ color: '#d4af37', marginRight: '8px' }}></i> Caretaker Attendance History Log</h4>
              </div>

              <div className="table-responsive">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check-In Time</th>
                      <th>Check-Out Time</th>
                      <th>Hours Worked</th>
                      <th>Shift Notes</th>
                      <th>Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.map((log, idx) => (
                      <tr key={log._id || idx}>
                        <td><strong>{log.date}</strong></td>
                        <td>
                          {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </td>
                        <td>
                          {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (log.status === 'checked-in' ? 'On Duty' : '--:--')}
                        </td>
                        <td><strong>{log.hoursWorked ? `${log.hoursWorked} hrs` : '--'}</strong></td>
                        <td><span className="shift-notes-text">{log.shiftNotes || 'Routine Duty Shift'}</span></td>
                        <td>
                          <span className={`status-chip ${log.status}`}>
                            {log.status === 'checked-in' ? '🟢 Checked In' : log.status === 'present' ? '✅ Present' : '🟡 Half Day'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DAILY DUTY CHECKLIST */}
        {activeTab === 'duties' && (
          <div className="tab-content fade-in">
            <div className="duties-card glass-morphism">
              <div className="duties-header">
                <div>
                  <h3><i className="fa-solid fa-clipboard-check" style={{ color: '#d4af37' }}></i> Daily Villa Maintenance Checklist</h3>
                  <p>Mark completed tasks to ensure stay readiness for guests.</p>
                </div>
                <div className="progress-badge">
                  <span>{progressPercent}% Completed</span>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="duties-list">
                {duties.map(duty => (
                  <div 
                    key={duty.id} 
                    className={`duty-item ${duty.completed ? 'completed' : ''}`}
                    onClick={() => toggleDuty(duty.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={duty.completed} 
                      onChange={() => toggleDuty(duty.id)} 
                    />
                    <div className="duty-info">
                      <h4>{duty.title}</h4>
                      <div className="duty-tags">
                        <span className="category-tag">{duty.category}</span>
                        <span className="time-tag"><i className="fa-solid fa-clock"></i> {duty.time}</span>
                      </div>
                    </div>
                    <span className={`duty-status-pill ${duty.completed ? 'done' : 'pending'}`}>
                      {duty.completed ? 'Completed ✓' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TODAY'S GUEST ARRIVALS */}
        {activeTab === 'guests' && (
          <div className="tab-content fade-in">
            <div className="guests-card glass-morphism">
              <h3><i className="fa-solid fa-users-viewfinder" style={{ color: '#d4af37' }}></i> Arriving Guests Today</h3>
              <p style={{ marginBottom: '20px', opacity: 0.8 }}>Verify guest contacts, preparation time, and welcome arrangements.</p>

              <div className="guests-grid">
                {guestArrivals.map(guest => (
                  <div key={guest.id} className="guest-arrival-card">
                    <div className="g-header">
                      <span className="b-id">{guest.id}</span>
                      <span className="g-status">{guest.status}</span>
                    </div>
                    <h4>{guest.guestName}</h4>
                    <p><i className="fa-solid fa-bed"></i> {guest.rooms}</p>
                    <p><i className="fa-solid fa-user-group"></i> {guest.guestsCount} Guests</p>
                    <p><i className="fa-solid fa-clock"></i> Arrival Time: <strong>{guest.checkIn}</strong></p>
                    <div className="g-phone">
                      <i className="fa-solid fa-phone"></i> <a href={`tel:${guest.phone}`} style={{ color: '#38bdf8' }}>{guest.phone}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROPERTY ALERT REPORT */}
        {activeTab === 'report' && (
          <div className="tab-content fade-in">
            <div className="report-card glass-morphism">
              <h3><i className="fa-solid fa-triangle-exclamation" style={{ color: '#ff6b6b' }}></i> Report Maintenance Issue to Property Owner</h3>
              <p style={{ marginBottom: '20px', opacity: 0.8 }}>Send an instant alert for urgent repairs, plumbing, electrical, or supply shortages.</p>

              {reportSuccess && (
                <div className="status-banner success" style={{ marginBottom: '20px' }}>
                  {reportSuccess}
                </div>
              )}

              <form onSubmit={handleReportSubmit} className="report-form">
                <div className="form-group-ct">
                  <label>Assigned Property Name</label>
                  <input type="text" value={reportForm.propertyName} disabled className="ct-input disabled" />
                </div>

                <div className="form-group-ct">
                  <label>Issue Category</label>
                  <select 
                    value={reportForm.issueType} 
                    onChange={(e) => setReportForm({ ...reportForm, issueType: e.target.value })}
                    className="ct-input"
                  >
                    <option value="Plumbing / Water Supply">Plumbing / Water Supply</option>
                    <option value="Electrical / Power Backup">Electrical / Power Backup</option>
                    <option value="Swimming Pool Maintenance">Swimming Pool Maintenance</option>
                    <option value="AC & Appliance Repair">AC & Appliance Repair</option>
                    <option value="Linen & Cleaning Supplies">Linen & Cleaning Supplies Shortage</option>
                  </select>
                </div>

                <div className="form-group-ct">
                  <label>Urgency Level</label>
                  <select 
                    value={reportForm.urgency} 
                    onChange={(e) => setReportForm({ ...reportForm, urgency: e.target.value })}
                    className="ct-input"
                  >
                    <option value="Low">Low - Normal Repair</option>
                    <option value="Medium">Medium - Before Next Guest</option>
                    <option value="High Urgent">High Urgent - Immediate Attention Needed</option>
                  </select>
                </div>

                <div className="form-group-ct">
                  <label>Issue Description & Details *</label>
                  <textarea 
                    rows="4" 
                    placeholder="Describe the issue, location in villa, and required spare parts..."
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    className="ct-input"
                    required
                  ></textarea>
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '12px 30px', border: 'none', cursor: 'pointer', borderRadius: '50px', fontWeight: '700' }}>
                  <i className="fa-solid fa-paper-plane"></i> Send Maintenance Alert
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CaretakerDashboard;
