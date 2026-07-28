import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../Footer/Footer';
import './CaretakerDashboard.css';
import { API_BASE_URL } from '../../config';

const CaretakerDashboard = () => {
  // Navigation & Drawer State
  const [activeTab, setActiveTab] = useState('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Show/Hide Lockbox PIN & Wi-Fi Copy Feedback
  const [showPin, setShowPin] = useState(false);
  const [wifiCopied, setWifiCopied] = useState(false);

  // Profile & Payout Form State (Persisted in localStorage)
  const [profileData, setProfileData] = useState({
    name: 'Suresh Patil',
    phone: '+91 98765 12345',
    email: 'patil.caretaker@example.com',
    address: 'Plot 42, Panchgani-Mahabaleshwar Highway, Satara, Maharashtra - 412806',
    experience: '6 Years in Villa Caretaking',
    assignedProperty: 'Royal Mist Villa Estate (Mahabaleshwar)',
    idStatus: 'Verified (Aadhaar & Police Verification Done)',
    emergencyContact: 'Sunita Patil (Wife) - +91 98222 11009',
    bankName: 'HDFC Bank Ltd',
    accountNo: '•••• •••• 9081',
    ifscCode: 'HDFC0000214',
    workingHours: '08:00 AM - 07:00 PM (Day Shift)'
  });
  const [profileMsg, setProfileMsg] = useState('');

  // Estate Home Overview & Emergency Info
  const estateInfo = {
    name: 'Royal Mist Villa Estate',
    location: 'Metgutad, Panchgani-Mahabaleshwar Road, Mahabaleshwar',
    ownerName: 'Vikramaditya Roy',
    ownerPhone: '+91 98111 22334',
    wifiSSID: 'RoyalMist_Guest_5G',
    wifiPass: 'Mahabaleshwar@2026',
    lockboxPin: '8091-B',
    totalBedrooms: 5,
    maxCapacity: 15,
    gateLockTime: '10:30 PM',
    emergencyContacts: [
      { role: 'Property Owner', name: 'Vikramaditya Roy', phone: '+91 98111 22334', icon: 'fa-user-tie' },
      { role: 'Local Electrician', name: 'Ramesh Kumar', phone: '+91 97222 33445', icon: 'fa-bolt' },
      { role: 'Plumber & Tanker', name: 'Ganesh Patil', phone: '+91 96333 44556', icon: 'fa-faucet' },
      { role: 'Medical Emergency', name: 'Mahabaleshwar Rural Hospital', phone: '02168-260100', icon: 'fa-truck-medical' },
      { role: 'Local Police Station', name: 'Mahabaleshwar Police', phone: '100 / 02168-260333', icon: 'fa-shield-halved' }
    ],
    houseRules: [
      'Lock main entrance gate by 10:30 PM daily.',
      'Check diesel generator fuel level twice a week.',
      'Ensure swimming pool filtration operates from 07:00 AM - 09:00 AM.',
      'Extinguish lawn bonfire firepit completely before midnight.',
      'Collect guest Aadhaar copy & log check-in time in register.'
    ]
  };

  // Attendance Punch & Log State
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [shiftNotes, setShiftNotes] = useState('');
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [logFilter, setLogFilter] = useState('all');

  // Daily Duty Checklist State
  const [dutiesFilter, setDutiesFilter] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', category: 'Maintenance', time: '10:00 AM' });
  const [duties, setDuties] = useState([
    { id: 1, title: 'Pool Water Filtration & Chemical Inspection', time: '07:30 AM', category: 'Maintenance', completed: true, priority: 'High' },
    { id: 2, title: 'Fresh Bed Linen & Bath Towels Replacement', time: '09:00 AM', category: 'Housekeeping', completed: true, priority: 'Medium' },
    { id: 3, title: 'Guest Welcome Drinks & Key Handover Prep', time: '11:30 AM', category: 'Guest Care', completed: false, priority: 'High' },
    { id: 4, title: 'Lawn Bonfire Wood Setup & Firepit Inspection', time: '05:00 PM', category: 'Amenities', completed: false, priority: 'Low' },
    { id: 5, title: 'Diesel Generator & Power Backup Check', time: '07:00 PM', category: 'Safety', completed: false, priority: 'High' }
  ]);

  // Guest Reservations & Preparation State
  const [searchGuest, setSearchGuest] = useState('');
  const [guestArrivals, setGuestArrivals] = useState([
    {
      id: 'B-8091',
      guestName: 'Rajesh Sharma',
      phone: '+91 98234 56789',
      rooms: '3 BHK Royal Villa',
      checkIn: '01:00 PM',
      checkOut: '28 Jul 2026',
      guestsCount: 6,
      status: 'Arriving Today',
      specialRequests: [
        { label: 'Welcome Drinks Prepared', done: true },
        { label: 'Extra Linen Pack Provided', done: true },
        { label: 'Pool Heated & Cleaned', done: false }
      ]
    },
    {
      id: 'B-8094',
      guestName: 'Priya Kulkarni',
      phone: '+91 97654 32109',
      rooms: 'Luxury Penthouse Suite',
      checkIn: '03:30 PM',
      checkOut: '30 Jul 2026',
      guestsCount: 4,
      status: 'Confirmed',
      specialRequests: [
        { label: 'Baby Cot Installed', done: false },
        { label: 'BBQ Firepit Wood Arranged', done: false }
      ]
    },
    {
      id: 'B-8102',
      guestName: 'Anil Deshmukh',
      phone: '+91 99887 76655',
      rooms: 'Valley View Cottage 2',
      checkIn: '05:00 PM',
      checkOut: '29 Jul 2026',
      guestsCount: 2,
      status: 'In Transit',
      specialRequests: [
        { label: 'Candlelight Dinner Prep', done: false }
      ]
    }
  ]);

  // Maintenance Alerts & Repairs State
  const [reportForm, setReportForm] = useState({
    issueType: 'Plumbing / Water Supply',
    propertyName: 'Royal Mist Villa Estate',
    description: '',
    urgency: 'Medium'
  });
  const [reportSuccess, setReportSuccess] = useState('');
  const [reportedIssues, setReportedIssues] = useState([
    { id: 'ALT-101', type: 'Plumbing', property: 'Royal Mist Villa', desc: 'Main motor water pressure low in bathroom 2', urgency: 'High Urgent', date: '2026-07-27', status: 'In Progress' },
    { id: 'ALT-098', type: 'Electrical', property: 'Royal Mist Villa', desc: 'Garden pathway light bulb replacement needed', urgency: 'Low', date: '2026-07-24', status: 'Resolved' }
  ]);

  // Consumables Stock Inventory State
  const [inventory, setInventory] = useState([
    { id: 'INV-1', item: 'Fresh Linen & Pillow Covers', category: 'Housekeeping', qty: 28, unit: 'Sets', status: 'In Stock', minQty: 10 },
    { id: 'INV-2', item: 'Luxury Bath Towels', category: 'Housekeeping', qty: 45, unit: 'Pieces', status: 'In Stock', minQty: 15 },
    { id: 'INV-3', item: 'Mineral Water Bottled Cases', category: 'Guest Care', qty: 4, unit: 'Boxes', status: 'Low Stock', minQty: 5 },
    { id: 'INV-4', item: 'Bonfire Dry Firewood', category: 'Amenities', qty: 2, unit: 'Bundles', status: 'Low Stock', minQty: 3 },
    { id: 'INV-5', item: 'Commercial LPG Cylinder', category: 'Kitchen', qty: 1, unit: 'Units', status: 'Reorder Needed', minQty: 2 }
  ]);

  // Live Clock Interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Attendance & Load Local Storage User
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUser(u);
        setProfileData(prev => ({
          ...prev,
          name: u.name || prev.name,
          email: u.email || prev.email,
          phone: u.phone || prev.phone
        }));
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
    { _id: '1', date: '2026-07-28', checkInTime: new Date().toISOString(), checkOutTime: null, hoursWorked: 2.5, status: 'checked-in', shiftNotes: 'Morning Villa Inspection & Pool Prep' },
    { _id: '2', date: '2026-07-27', checkInTime: '2026-07-27T08:00:00.000Z', checkOutTime: '2026-07-27T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Guest Checkout & Full Deep Clean' },
    { _id: '3', date: '2026-07-26', checkInTime: '2026-07-26T08:15:00.000Z', checkOutTime: '2026-07-26T18:00:00.000Z', hoursWorked: 9.75, status: 'present', shiftNotes: 'Pool Water Filtration Maintenance' },
    { _id: '4', date: '2026-07-25', checkInTime: '2026-07-25T08:00:00.000Z', checkOutTime: '2026-07-25T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Linen Replacement & Garden Bonfire Setup' },
    { _id: '5', date: '2026-07-24', checkInTime: '2026-07-24T08:00:00.000Z', checkOutTime: '2026-07-24T18:00:00.000Z', hoursWorked: 10.0, status: 'present', shiftNotes: 'Routine Estate Security Check' }
  ];

  // Check-In Punch Handler
  const handleCheckIn = async () => {
    const caretakerName = profileData.name || user?.name || 'Suresh Patil';
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
        setStatusMsg({ type: 'success', text: '🟢 Check-In Recorded! Your active duty shift has started.' });
        fetchAttendanceLogs(caretakerName);
      } else {
        setStatusMsg({ type: 'error', text: data.msg || 'Already checked in for today.' });
        setIsCheckedIn(true);
      }
    } catch (err) {
      setIsCheckedIn(true);
      setCheckInTime(new Date());
      setStatusMsg({ type: 'success', text: '🟢 Check-In Recorded locally! Shift ON DUTY.' });
    }
  };

  // Check-Out Punch Handler
  const handleCheckOut = async () => {
    const caretakerName = profileData.name || user?.name || 'Suresh Patil';
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
        setStatusMsg({ type: 'success', text: '🛑 Check-Out Recorded! Shift log completed successfully.' });
        fetchAttendanceLogs(caretakerName);
      } else {
        setStatusMsg({ type: 'error', text: data.msg || 'Check-out failed.' });
      }
    } catch (err) {
      setIsCheckedIn(false);
      setCheckInTime(null);
      setStatusMsg({ type: 'success', text: '🛑 Check-Out Recorded! Shift marked complete.' });
    }
  };

  // Duty Toggle Handler
  const toggleDuty = (id) => {
    setDuties(duties.map(d => d.id === id ? { ...d, completed: !d.completed } : d));
  };

  // Add Duty Handler
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const item = {
      id: Date.now(),
      title: newTask.title,
      category: newTask.category,
      time: newTask.time || '10:00 AM',
      completed: false,
      priority: 'Medium'
    };
    setDuties([item, ...duties]);
    setNewTask({ title: '', category: 'Maintenance', time: '10:00 AM' });
    setShowAddTask(false);
  };

  // Guest Special Request Toggle
  const toggleSpecialRequest = (guestId, reqIdx) => {
    setGuestArrivals(guestArrivals.map(g => {
      if (g.id === guestId) {
        const updatedReqs = [...g.specialRequests];
        updatedReqs[reqIdx].done = !updatedReqs[reqIdx].done;
        return { ...g, specialRequests: updatedReqs };
      }
      return g;
    }));
  };

  // Maintenance Alert Submission
  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportForm.description.trim()) return;
    const newAlert = {
      id: `ALT-${Math.floor(100 + Math.random() * 900)}`,
      type: reportForm.issueType.split('/')[0].trim(),
      property: reportForm.propertyName,
      desc: reportForm.description,
      urgency: reportForm.urgency,
      date: new Date().toISOString().split('T')[0],
      status: 'Open'
    };
    setReportedIssues([newAlert, ...reportedIssues]);
    setReportSuccess('⚡ Maintenance Alert broadcasted directly to Property Owner & Admin!');
    setReportForm({ ...reportForm, description: '' });
    setTimeout(() => setReportSuccess(''), 5000);
  };

  // Stock Quantity Update Handler
  const handleStockUpdate = (id, delta) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        let newStatus = 'In Stock';
        if (newQty === 0) newStatus = 'Reorder Needed';
        else if (newQty <= item.minQty) newStatus = 'Low Stock';
        return { ...item, qty: newQty, status: newStatus };
      }
      return item;
    }));
  };

  // Save Profile Details
  const handleProfileSave = (e) => {
    e.preventDefault();
    setProfileMsg('✅ Caretaker Profile Details Updated Successfully!');
    const updatedUser = { ...user, name: profileData.name, phone: profileData.phone, email: profileData.email };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setTimeout(() => setProfileMsg(''), 4000);
  };

  // Copy Wi-Fi Credentials
  const copyWifiPassword = () => {
    navigator.clipboard.writeText(`SSID: ${estateInfo.wifiSSID} | Password: ${estateInfo.wifiPass}`);
    setWifiCopied(true);
    setTimeout(() => setWifiCopied(false), 3000);
  };

  const completedCount = duties.filter(d => d.completed).length;
  const progressPercent = duties.length > 0 ? Math.round((completedCount / duties.length) * 100) : 0;

  const filteredDuties = duties.filter(d => {
    if (dutiesFilter === 'completed') return d.completed;
    if (dutiesFilter === 'pending') return !d.completed;
    if (dutiesFilter !== 'all') return d.category === dutiesFilter;
    return true;
  });

  const filteredGuests = guestArrivals.filter(g => 
    g.guestName.toLowerCase().includes(searchGuest.toLowerCase()) ||
    g.rooms.toLowerCase().includes(searchGuest.toLowerCase()) ||
    g.id.toLowerCase().includes(searchGuest.toLowerCase())
  );

  return (
    <div className="caretaker-dashboard-page">
      {/* Stable Top Sticky Header Navbar */}
      <header className="caretaker-navbar">
        <div className="nav-brand">
          <button 
            className="menu-toggle-btn" 
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            aria-label="Toggle Slide Menu"
            title="Menu Drawer (Left Side)"
          >
            <i className={`fa-solid ${isDrawerOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
          <div className="brand-badge-icon"><i className="fa-solid fa-user-shield"></i></div>
          <div>
            <span className="logo-title">Mahabaleshwar Caretaker</span>
            <span className="logo-subtitle">OPERATIONS COMMAND CENTER</span>
          </div>
        </div>

        <div className="nav-center-status">
          <div className="live-clock-pill">
            <i className="fa-solid fa-clock-rotate-left live-icon"></i>
            <span className="time-val">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="date-val">{currentTime.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="nav-links">
          <button onClick={() => navigate('/caretaker-apply')} className="nav-btn-link">
            <i className="fa-solid fa-file-contract"></i> Verification Form
          </button>
          <button onClick={() => navigate('/')} className="back-link">
            <i className="fa-solid fa-arrow-left"></i> Home Page
          </button>
        </div>
      </header>

      {/* Slide-out Drawer Overlay */}
      {isDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}></div>
      )}

      {/* Off-Canvas Slide Drawer Menu (Left Side) */}
      <aside className={`slide-drawer-menu ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-user-info">
            <div className="drawer-avatar">{profileData.name.charAt(0).toUpperCase()}</div>
            <div>
              <h4>{profileData.name}</h4>
              <span className="drawer-role"><i className="fa-solid fa-circle-check"></i> Caretaker Host</span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav className="drawer-nav">
          <div className="drawer-section-title">COMMAND NAVIGATION</div>
          <button className={`drawer-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-house-user"></i> Estate Home Overview
          </button>
          <button className={`drawer-nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => { setActiveTab('attendance'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-user-clock"></i> Attendance & Shift Log
          </button>
          <button className={`drawer-nav-item ${activeTab === 'duties' ? 'active' : ''}`} onClick={() => { setActiveTab('duties'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-clipboard-check"></i> Villa Duties Checklist
          </button>
          <button className={`drawer-nav-item ${activeTab === 'guests' ? 'active' : ''}`} onClick={() => { setActiveTab('guests'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-users-gear"></i> Today's Guest Arrivals
          </button>
          <button className={`drawer-nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => { setActiveTab('report'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-wrench"></i> Maintenance Alert Desk
          </button>
          <button className={`drawer-nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-boxes-packing"></i> Consumables Stock Tracker
          </button>
          <button className={`drawer-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setIsDrawerOpen(false); }}>
            <i className="fa-solid fa-circle-user"></i> My Caretaker Profile
          </button>

          <div className="drawer-section-title" style={{ marginTop: '24px' }}>QUICK ACTIONS</div>
          <button onClick={() => { navigate('/caretaker-apply'); setIsDrawerOpen(false); }} className="drawer-link-item">
            <i className="fa-solid fa-file-contract"></i> Verification Form
          </button>
          <button onClick={() => { navigate('/'); setIsDrawerOpen(false); }} className="drawer-link-item">
            <i className="fa-solid fa-globe"></i> Return to Main Website
          </button>
        </nav>
      </aside>

      <div className="caretaker-container">
        
        {/* Dashboard 2-Column Main Layout with Permanent Left Navigation Card */}
        <div className="dashboard-main-layout">
          
          {/* Permanent Left Sidebar Navigation Card */}
          <aside className="left-sidebar-menu-card glass-morphism">
            <div className="sidebar-profile-badge">
              <div className="sb-avatar">{profileData.name.charAt(0).toUpperCase()}</div>
              <div>
                <h4 className="sb-name">{profileData.name}</h4>
                <span className="sb-role"><i className="fa-solid fa-shield-check"></i> Caretaker Host</span>
              </div>
            </div>

            <hr className="sb-divider" />

            <div className="sb-section-title">COMMAND MENU</div>
            <nav className="sb-nav-list">
              <button className={`sb-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                <i className="fa-solid fa-house-user"></i>
                <span>Estate Home</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                <i className="fa-solid fa-user-clock"></i>
                <span>Attendance Log</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'duties' ? 'active' : ''}`} onClick={() => setActiveTab('duties')}>
                <i className="fa-solid fa-clipboard-check"></i>
                <span>Villa Duties</span>
                <span className="sb-badge">{completedCount}/{duties.length}</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'guests' ? 'active' : ''}`} onClick={() => setActiveTab('guests')}>
                <i className="fa-solid fa-users-gear"></i>
                <span>Guest Arrivals</span>
                <span className="sb-badge gold">{guestArrivals.length}</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
                <i className="fa-solid fa-wrench"></i>
                <span>Maintenance Alerts</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
                <i className="fa-solid fa-boxes-packing"></i>
                <span>Stock Tracker</span>
              </button>
              <button className={`sb-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <i className="fa-solid fa-circle-user"></i>
                <span>My Profile</span>
              </button>
            </nav>

            <hr className="sb-divider" />

            <div className="sb-section-title">QUICK LINKS</div>
            <div className="sb-quick-links">
              <button onClick={() => navigate('/caretaker-apply')} className="sb-link-item">
                <i className="fa-solid fa-file-contract"></i> Verification Form
              </button>
              <button onClick={() => navigate('/')} className="sb-link-item">
                <i className="fa-solid fa-globe"></i> Main Website
              </button>
            </div>
          </aside>

          {/* Main Workspace Content Area */}
          <main className="dashboard-content-area">
            
            {/* KPI Stat Overview Grid */}
            <div className="kpi-metrics-grid">
              <div className="kpi-card glass-morphism" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
                <div className="kpi-icon emerald">
                  <i className="fa-solid fa-house-chimney"></i>
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Assigned Estate</span>
                  <h3 className="kpi-value" style={{ fontSize: '1.15rem' }}>Royal Mist Villa</h3>
                  <span className="kpi-subtext positive"><i className="fa-solid fa-shield-check"></i> 5 BHK Stay</span>
                </div>
              </div>

              <div className="kpi-card glass-morphism" onClick={() => setActiveTab('attendance')} style={{ cursor: 'pointer' }}>
                <div className="kpi-icon cyan">
                  <i className="fa-solid fa-stopwatch"></i>
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Logged Shift Hours</span>
                  <h3 className="kpi-value">218.5 <small>hrs</small></h3>
                  <span className="kpi-subtext positive">96% Score</span>
                </div>
              </div>

              <div className="kpi-card glass-morphism" onClick={() => setActiveTab('duties')} style={{ cursor: 'pointer' }}>
                <div className="kpi-icon gold">
                  <i className="fa-solid fa-list-check"></i>
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Daily Duty Tasks</span>
                  <h3 className="kpi-value">{completedCount}/{duties.length}</h3>
                  <span className="kpi-subtext gold-text">{progressPercent}% Done</span>
                </div>
              </div>

              <div className="kpi-card glass-morphism" onClick={() => setActiveTab('guests')} style={{ cursor: 'pointer' }}>
                <div className="kpi-icon indigo">
                  <i className="fa-solid fa-user-clock"></i>
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Guest Arrivals</span>
                  <h3 className="kpi-value">{guestArrivals.length} <small>groups</small></h3>
                  <span className="kpi-subtext"><i className="fa-solid fa-door-open"></i> Stay Ready</span>
                </div>
              </div>
            </div>

            {/* TAB PANELS */}
            
            {/* TAB 0: ESTATE HOME (HOME DESK) */}
            {activeTab === 'home' && (
              <div className="tab-content fade-in">
                <div className="estate-home-grid">
                  
                  {/* Estate Showcase Card */}
                  <div className="estate-hero-card glass-morphism">
                    <div className="estate-badge-top">
                      <span className="badge-luxury"><i className="fa-solid fa-crown"></i> Premium Villa Estate</span>
                      <span className="badge-status">Active Management</span>
                    </div>
                    <h3>{estateInfo.name}</h3>
                    <p className="estate-loc"><i className="fa-solid fa-location-dot icon-accent"></i> {estateInfo.location}</p>

                    <div className="estate-specs-row">
                      <div className="spec-pill"><i className="fa-solid fa-bed"></i> {estateInfo.totalBedrooms} Luxury BHK</div>
                      <div className="spec-pill"><i className="fa-solid fa-users"></i> Up to {estateInfo.maxCapacity} Guests</div>
                      <div className="spec-pill"><i className="fa-solid fa-water-ladder"></i> Private Pool</div>
                      <div className="spec-pill"><i className="fa-solid fa-fire"></i> Bonfire Lawn</div>
                      <div className="spec-pill"><i className="fa-solid fa-lock"></i> Gate Lock: {estateInfo.gateLockTime}</div>
                    </div>

                    {/* Key Lockbox & Wi-Fi Essentials Box */}
                    <div className="essentials-grid">
                      <div className="essential-card glass-subcard">
                        <div className="ess-icon"><i className="fa-solid fa-key icon-gold"></i></div>
                        <div>
                          <span className="ess-lbl">Main Gate Lockbox PIN</span>
                          <div className="ess-val-row">
                            <strong className="ess-val">{showPin ? estateInfo.lockboxPin : '••••-•'}</strong>
                            <button className="btn-toggle-pin" onClick={() => setShowPin(!showPin)} title="Toggle PIN Visibility">
                              <i className={`fa-solid ${showPin ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="essential-card glass-subcard">
                        <div className="ess-icon"><i className="fa-solid fa-wifi text-emerald"></i></div>
                        <div>
                          <span className="ess-lbl">Villa Wi-Fi Credentials</span>
                          <strong className="ess-val">{estateInfo.wifiSSID}</strong>
                          <div className="ess-val-row" style={{ marginTop: '2px' }}>
                            <span className="ess-sub">Pass: {estateInfo.wifiPass}</span>
                            <button className="btn-toggle-pin" onClick={copyWifiPassword} title="Copy Wi-Fi Details">
                              <i className={`fa-solid ${wifiCopied ? 'fa-check text-emerald' : 'fa-copy'}`}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* House Rules & Caretaker Standing Orders */}
                    <div className="rules-box glass-subcard">
                      <h4><i className="fa-solid fa-clipboard-list icon-gold"></i> Caretaker Standing Operations & Guidelines:</h4>
                      <ul>
                        {estateInfo.houseRules.map((rule, idx) => (
                          <li key={idx}><i className="fa-solid fa-circle-check text-emerald"></i> {rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Emergency Directory Card */}
                  <div className="emergency-directory-card glass-morphism">
                    <h3><i className="fa-solid fa-phone-volume text-rose"></i> Emergency Directory & Owner Desk</h3>
                    <p className="subtext">Direct 1-tap contacts for estate emergencies and local technicians.</p>

                    <div className="emergency-contacts-list">
                      {estateInfo.emergencyContacts.map((contact, idx) => (
                        <div key={idx} className="em-contact-item glass-subcard">
                          <div className="em-icon">
                            <i className={`fa-solid ${contact.icon}`}></i>
                          </div>
                          <div className="em-info">
                            <span className="em-role">{contact.role}</span>
                            <h4 className="em-name">{contact.name}</h4>
                            <a href={`tel:${contact.phone}`} className="em-phone">
                              <i className="fa-solid fa-phone"></i> {contact.phone}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 1: ATTENDANCE MANAGEMENT */}
            {activeTab === 'attendance' && (
              <div className="tab-content fade-in">
                <div className="attendance-action-card glass-morphism">
                  <div className="action-card-header">
                    <div>
                      <h3><i className="fa-solid fa-fingerprint icon-gold"></i> Caretaker Attendance Punch Desk</h3>
                      <p>Record your daily arrival check-in and departure check-out for verified shift logs and payroll processing.</p>
                    </div>
                    <div className={`duty-pill large ${isCheckedIn ? 'on-duty' : 'off-duty'}`}>
                      <span className="pulse-dot"></span>
                      {isCheckedIn ? 'Active Duty Session' : 'Shift Inactive'}
                    </div>
                  </div>

                  {statusMsg.text && (
                    <div className={`status-banner ${statusMsg.type}`}>
                      {statusMsg.text}
                    </div>
                  )}

                  <div className="punch-controls-grid">
                    <div className="punch-box">
                      <label><i className="fa-solid fa-pen-to-square"></i> Shift Remarks / Duty Notes</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Morning shift arrival, estate gates unlocked, pool inspection completed..."
                        value={shiftNotes}
                        onChange={(e) => setShiftNotes(e.target.value)}
                        className="shift-notes-input"
                      />
                    </div>

                    <div className="punch-btn-group">
                      {!isCheckedIn ? (
                        <button className="btn-punch check-in-btn" onClick={handleCheckIn}>
                          <i className="fa-solid fa-right-to-bracket"></i> Punch Check-In (On Duty)
                        </button>
                      ) : (
                        <button className="btn-punch check-out-btn" onClick={handleCheckOut}>
                          <i className="fa-solid fa-right-from-bracket"></i> Punch Check-Out (End Shift)
                        </button>
                      )}
                    </div>
                  </div>

                  {isCheckedIn && checkInTime && (
                    <div className="active-shift-timer glass-subcard">
                      <div className="timer-content">
                        <i className="fa-solid fa-stopwatch fa-spin pulse-green"></i>
                        <div>
                          <strong>Active Shift Running</strong>
                          <p>Started check-in at {checkInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                        </div>
                      </div>
                      <span className="shift-badge-active">Verified On Location</span>
                    </div>
                  )}
                </div>

                {/* Attendance History Table */}
                <div className="attendance-table-card glass-morphism" style={{ marginTop: '24px' }}>
                  <div className="table-header-title">
                    <div>
                      <h4><i className="fa-solid fa-clock-rotate-left icon-gold"></i> Monthly Attendance History Log</h4>
                      <p>Verified timestamps for payroll calculation</p>
                    </div>

                    <div className="table-filter-tabs">
                      <button className={`filter-btn ${logFilter === 'all' ? 'active' : ''}`} onClick={() => setLogFilter('all')}>All Logs</button>
                      <button className={`filter-btn ${logFilter === 'checked-in' ? 'active' : ''}`} onClick={() => setLogFilter('checked-in')}>On Duty</button>
                      <button className={`filter-btn ${logFilter === 'present' ? 'active' : ''}`} onClick={() => setLogFilter('present')}>Present</button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="ct-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check-In Time</th>
                          <th>Check-Out Time</th>
                          <th>Shift Duration</th>
                          <th>Shift Duty Notes</th>
                          <th>Attendance Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceLogs
                          .filter(log => logFilter === 'all' || log.status === logFilter)
                          .map((log, idx) => (
                            <tr key={log._id || idx}>
                              <td><strong className="date-highlight">{log.date}</strong></td>
                              <td>
                                <span className="time-pill">
                                  <i className="fa-solid fa-arrow-down-to-bracket text-emerald"></i>{' '}
                                  {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                              </td>
                              <td>
                                <span className="time-pill">
                                  <i className="fa-solid fa-arrow-up-from-bracket text-amber"></i>{' '}
                                  {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (log.status === 'checked-in' ? 'On Duty Now' : '--:--')}
                                </span>
                              </td>
                              <td><strong>{log.hoursWorked ? `${log.hoursWorked} hrs` : '--'}</strong></td>
                              <td><span className="shift-notes-text">{log.shiftNotes || 'Routine Caretaker Duty'}</span></td>
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
                      <h3><i className="fa-solid fa-list-check icon-gold"></i> Villa Daily Maintenance & Operation Checklist</h3>
                      <p>Complete daily inspection and guest preparation tasks to maintain 5-star villa standards.</p>
                    </div>

                    <div className="duties-actions-group">
                      <button className="btn-add-task" onClick={() => setShowAddTask(!showAddTask)}>
                        <i className="fa-solid fa-plus-circle"></i> {showAddTask ? 'Close Task Form' : 'Add Custom Task'}
                      </button>

                      <div className="progress-badge">
                        <span className="prog-title">{progressPercent}% Completed ({completedCount}/{duties.length})</span>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add New Duty Form Modal/Dropdown */}
                  {showAddTask && (
                    <form onSubmit={handleAddTask} className="add-task-form glass-subcard">
                      <h4><i className="fa-solid fa-plus text-emerald"></i> Create New Quick Duty Task</h4>
                      <div className="form-inline-grid">
                        <input 
                          type="text" 
                          placeholder="Task description (e.g. Clean outdoor terrace furniture...)" 
                          value={newTask.title} 
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          className="ct-input"
                          required 
                        />
                        <select 
                          value={newTask.category} 
                          onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                          className="ct-input"
                        >
                          <option value="Maintenance">Maintenance</option>
                          <option value="Housekeeping">Housekeeping</option>
                          <option value="Guest Care">Guest Care</option>
                          <option value="Amenities">Amenities</option>
                          <option value="Safety">Safety</option>
                        </select>
                        <input 
                          type="text" 
                          placeholder="Scheduled Time (e.g. 02:00 PM)" 
                          value={newTask.time} 
                          onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                          className="ct-input"
                        />
                        <button type="submit" className="btn-save-task">
                          <i className="fa-solid fa-check"></i> Save Duty Task
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Category Filter Pills */}
                  <div className="category-filter-bar">
                    <button className={`cat-btn ${dutiesFilter === 'all' ? 'active' : ''}`} onClick={() => setDutiesFilter('all')}>All Tasks ({duties.length})</button>
                    <button className={`cat-btn ${dutiesFilter === 'pending' ? 'active' : ''}`} onClick={() => setDutiesFilter('pending')}>Pending Tasks ({duties.length - completedCount})</button>
                    <button className={`cat-btn ${dutiesFilter === 'completed' ? 'active' : ''}`} onClick={() => setDutiesFilter('completed')}>Done ({completedCount})</button>
                    <button className={`cat-btn ${dutiesFilter === 'Maintenance' ? 'active' : ''}`} onClick={() => setDutiesFilter('Maintenance')}>Maintenance</button>
                    <button className={`cat-btn ${dutiesFilter === 'Housekeeping' ? 'active' : ''}`} onClick={() => setDutiesFilter('Housekeeping')}>Housekeeping</button>
                    <button className={`cat-btn ${dutiesFilter === 'Guest Care' ? 'active' : ''}`} onClick={() => setDutiesFilter('Guest Care')}>Guest Care</button>
                    <button className={`cat-btn ${dutiesFilter === 'Amenities' ? 'active' : ''}`} onClick={() => setDutiesFilter('Amenities')}>Amenities</button>
                  </div>

                  <div className="duties-list">
                    {filteredDuties.map(duty => (
                      <div 
                        key={duty.id} 
                        className={`duty-item ${duty.completed ? 'completed' : ''}`}
                        onClick={() => toggleDuty(duty.id)}
                      >
                        <div className="duty-checkbox-wrap">
                          <input 
                            type="checkbox" 
                            checked={duty.completed} 
                            onChange={() => toggleDuty(duty.id)} 
                          />
                        </div>
                        <div className="duty-info">
                          <h4>{duty.title}</h4>
                          <div className="duty-tags">
                            <span className={`category-tag ${duty.category.toLowerCase().replace(/\s+/g, '-')}`}>{duty.category}</span>
                            <span className="time-tag"><i className="fa-regular fa-clock"></i> {duty.time}</span>
                            {duty.priority && (
                              <span className={`priority-tag ${duty.priority.toLowerCase()}`}>
                                {duty.priority} Priority
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="duty-status-column">
                          <span className={`duty-status-pill ${duty.completed ? 'done' : 'pending'}`}>
                            {duty.completed ? '✓ Completed' : '⏳ Pending Action'}
                          </span>
                        </div>
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
                  <div className="guests-header">
                    <div>
                      <h3><i className="fa-solid fa-users-viewfinder icon-gold"></i> Arriving Guest Reservations & Stay Readiness</h3>
                      <p>Review contact details, arrival times, and guest custom requests before check-in.</p>
                    </div>

                    <div className="guest-search-box">
                      <i className="fa-solid fa-magnifying-glass search-icon"></i>
                      <input 
                        type="text" 
                        placeholder="Search by guest name, room or ID..." 
                        value={searchGuest}
                        onChange={(e) => setSearchGuest(e.target.value)}
                        className="guest-search-input"
                      />
                    </div>
                  </div>

                  <div className="guests-grid">
                    {filteredGuests.map(guest => (
                      <div key={guest.id} className="guest-arrival-card glass-subcard">
                        <div className="g-header">
                          <span className="b-id">{guest.id}</span>
                          <span className={`g-status-badge ${guest.status.toLowerCase().replace(/\s+/g, '-')}`}>{guest.status}</span>
                        </div>
                        
                        <h4 className="guest-name"><i className="fa-solid fa-circle-user icon-gold"></i> {guest.guestName}</h4>
                        
                        <div className="guest-details-list">
                          <p><i className="fa-solid fa-door-closed icon-accent"></i> Room: <strong>{guest.rooms}</strong></p>
                          <p><i className="fa-solid fa-users icon-accent"></i> Party Size: <strong>{guest.guestsCount} Guests</strong></p>
                          <p><i className="fa-solid fa-clock icon-accent"></i> Expected Arrival: <strong className="time-highlight">{guest.checkIn}</strong></p>
                          <p><i className="fa-solid fa-calendar-day icon-accent"></i> Check-Out: <strong>{guest.checkOut}</strong></p>
                        </div>

                        {guest.specialRequests && guest.specialRequests.length > 0 && (
                          <div className="special-req-section">
                            <h5><i className="fa-solid fa-sparkles icon-gold"></i> Stay Preparation Checklist:</h5>
                            {guest.specialRequests.map((req, rIdx) => (
                              <label key={rIdx} className="req-checkbox-item" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={req.done} 
                                  onChange={() => toggleSpecialRequest(guest.id, rIdx)} 
                                />
                                <span className={req.done ? 'strikethrough' : ''}>{req.label}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="g-actions-footer">
                          <a href={`tel:${guest.phone}`} className="btn-call-guest">
                            <i className="fa-solid fa-phone"></i> Call Guest ({guest.phone})
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PROPERTY MAINTENANCE & ALERT DESK */}
            {activeTab === 'report' && (
              <div className="tab-content fade-in">
                <div className="report-layout-grid">
                  
                  {/* Report Form */}
                  <div className="report-card glass-morphism">
                    <h3><i className="fa-solid fa-triangle-exclamation text-rose"></i> Report Maintenance Issue to Property Owner</h3>
                    <p className="subtext">Broadcast urgent repair alerts for plumbing, electrical, pool, or supply issues directly to owner & admin.</p>

                    {reportSuccess && (
                      <div className="status-banner success">
                        {reportSuccess}
                      </div>
                    )}

                    <form onSubmit={handleReportSubmit} className="report-form">
                      <div className="form-group-ct">
                        <label>Assigned Property Estate</label>
                        <input type="text" value={reportForm.propertyName} disabled className="ct-input disabled" />
                      </div>

                      <div className="form-group-ct">
                        <label>Issue Category *</label>
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
                          <option value="Estate Furniture Damage">Estate Furniture Damage</option>
                        </select>
                      </div>

                      <div className="form-group-ct">
                        <label>Urgency Level *</label>
                        <select 
                          value={reportForm.urgency} 
                          onChange={(e) => setReportForm({ ...reportForm, urgency: e.target.value })}
                          className="ct-input"
                        >
                          <option value="Low">Low - Routine Maintenance</option>
                          <option value="Medium">Medium - Before Next Guest Check-In</option>
                          <option value="High Urgent">High Urgent - Immediate Attention Needed!</option>
                        </select>
                      </div>

                      <div className="form-group-ct">
                        <label>Issue Description & Location *</label>
                        <textarea 
                          rows="4" 
                          placeholder="Describe exact details, room number, broken components..."
                          value={reportForm.description}
                          onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                          className="ct-input"
                          required
                        ></textarea>
                      </div>

                      <button type="submit" className="btn-send-alert">
                        <i className="fa-solid fa-paper-plane"></i> Broadcast Alert to Owner
                      </button>
                    </form>
                  </div>

                  {/* Reported Issues Tracker Card */}
                  <div className="issues-tracker-card glass-morphism">
                    <h3><i className="fa-solid fa-list-timeline icon-gold"></i> Active Property Alert History</h3>
                    <p className="subtext">Status tracking for raised issues</p>

                    <div className="issues-list">
                      {reportedIssues.map(issue => (
                        <div key={issue.id} className="issue-item-card glass-subcard">
                          <div className="issue-header">
                            <span className="issue-id">{issue.id}</span>
                            <span className={`urgency-badge ${issue.urgency.toLowerCase().replace(/\s+/g, '-')}`}>{issue.urgency}</span>
                          </div>
                          <h4 className="issue-type"><i className="fa-solid fa-wrench icon-gold"></i> {issue.type} Issue</h4>
                          <p className="issue-desc">{issue.desc}</p>
                          <div className="issue-footer">
                            <span className="issue-date"><i className="fa-regular fa-calendar"></i> Reported: {issue.date}</span>
                            <span className={`issue-status-pill ${issue.status.toLowerCase().replace(/\s+/g, '-')}`}>{issue.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 5: VILLA INVENTORY & STOCK TRACKER */}
            {activeTab === 'inventory' && (
              <div className="tab-content fade-in">
                <div className="inventory-card glass-morphism">
                  <div className="inventory-header">
                    <div>
                      <h3><i className="fa-solid fa-boxes-packing icon-gold"></i> Villa Inventory & Consumables Stock Desk</h3>
                      <p>Monitor essential guest supplies and update stock counts in real-time.</p>
                    </div>

                    <div className="inventory-summary-pills">
                      <span className="inv-badge in-stock"><i className="fa-solid fa-check"></i> In Stock ({inventory.filter(i => i.status === 'In Stock').length})</span>
                      <span className="inv-badge low-stock"><i className="fa-solid fa-triangle-exclamation"></i> Low Stock ({inventory.filter(i => i.status === 'Low Stock').length})</span>
                      <span className="inv-badge reorder"><i className="fa-solid fa-circle-exclamation"></i> Reorder ({inventory.filter(i => i.status === 'Reorder Needed').length})</span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="ct-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Available Quantity</th>
                          <th>Minimum Threshold</th>
                          <th>Stock Level Status</th>
                          <th>Quick Stock Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map(item => (
                          <tr key={item.id}>
                            <td><strong>{item.item}</strong></td>
                            <td><span className="category-tag">{item.category}</span></td>
                            <td>
                              <span className="qty-val">{item.qty} {item.unit}</span>
                            </td>
                            <td>{item.minQty} {item.unit}</td>
                            <td>
                              <span className={`stock-status-pill ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>
                              <div className="qty-controls">
                                <button className="btn-qty" onClick={() => handleStockUpdate(item.id, -1)}>-</button>
                                <span className="qty-display">{item.qty}</span>
                                <button className="btn-qty" onClick={() => handleStockUpdate(item.id, 1)}>+</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: CARETAKER PROFILE DESK */}
            {activeTab === 'profile' && (
              <div className="tab-content fade-in">
                <div className="profile-desk-grid">
                  
                  {/* Profile Identity Card */}
                  <div className="profile-identity-card glass-morphism">
                    <div className="avatar-large-wrap">
                      <div className="avatar-large">{profileData.name.charAt(0).toUpperCase()}</div>
                      <span className="status-dot-online"></span>
                    </div>

                    <h3>{profileData.name}</h3>
                    <p className="profile-role-title"><i className="fa-solid fa-user-shield text-emerald"></i> Senior Estate Caretaker</p>

                    <div className="verification-badge-box">
                      <i className="fa-solid fa-shield-check icon-gold"></i>
                      <div>
                        <strong>Govt ID Verified</strong>
                        <p>{profileData.idStatus}</p>
                      </div>
                    </div>

                    <div className="profile-stats-list">
                      <div className="p-stat-item">
                        <span>Assigned Estate</span>
                        <strong>{profileData.assignedProperty}</strong>
                      </div>
                      <div className="p-stat-item">
                        <span>Duty Shift</span>
                        <strong>{profileData.workingHours}</strong>
                      </div>
                      <div className="p-stat-item">
                        <span>Experience</span>
                        <strong>{profileData.experience}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Editable Profile Information Form */}
                  <div className="profile-form-card glass-morphism">
                    <h3><i className="fa-solid fa-user-pen icon-gold"></i> Personal & Payout Information Desk</h3>
                    <p className="subtext">Update contact details, emergency reference, and salary bank information.</p>

                    {profileMsg && (
                      <div className="status-banner success">
                        {profileMsg}
                      </div>
                    )}

                    <form onSubmit={handleProfileSave} className="profile-editor-form">
                      <div className="form-grid-2col">
                        <div className="form-group-ct">
                          <label>Full Name *</label>
                          <input 
                            type="text" 
                            value={profileData.name} 
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            className="ct-input"
                            required 
                          />
                        </div>

                        <div className="form-group-ct">
                          <label>Mobile Number *</label>
                          <input 
                            type="text" 
                            value={profileData.phone} 
                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                            className="ct-input"
                            required 
                          />
                        </div>

                        <div className="form-group-ct">
                          <label>Email Address</label>
                          <input 
                            type="email" 
                            value={profileData.email} 
                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                            className="ct-input"
                          />
                        </div>

                        <div className="form-group-ct">
                          <label>Hospitality Experience</label>
                          <input 
                            type="text" 
                            value={profileData.experience} 
                            onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                            className="ct-input"
                          />
                        </div>
                      </div>

                      <div className="form-group-ct">
                        <label>Residential Address (Satara / Mahabaleshwar)</label>
                        <input 
                          type="text" 
                          value={profileData.address} 
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                          className="ct-input"
                        />
                      </div>

                      <div className="form-group-ct">
                        <label>Emergency Contact Reference</label>
                        <input 
                          type="text" 
                          value={profileData.emergencyContact} 
                          onChange={(e) => setProfileData({ ...profileData, emergencyContact: e.target.value })}
                          className="ct-input"
                        />
                      </div>

                      <hr className="divider-line" />

                      <h4 className="section-subtitle"><i className="fa-solid fa-building-columns icon-accent"></i> Salary Payout Bank Details</h4>
                      
                      <div className="form-grid-2col">
                        <div className="form-group-ct">
                          <label>Bank Name</label>
                          <input 
                            type="text" 
                            value={profileData.bankName} 
                            onChange={(e) => setProfileData({ ...profileData, bankName: e.target.value })}
                            className="ct-input"
                          />
                        </div>

                        <div className="form-group-ct">
                          <label>Bank Account Number</label>
                          <input 
                            type="text" 
                            value={profileData.accountNo} 
                            onChange={(e) => setProfileData({ ...profileData, accountNo: e.target.value })}
                            className="ct-input"
                          />
                        </div>

                        <div className="form-group-ct">
                          <label>IFSC Code</label>
                          <input 
                            type="text" 
                            value={profileData.ifscCode} 
                            onChange={(e) => setProfileData({ ...profileData, ifscCode: e.target.value })}
                            className="ct-input"
                          />
                        </div>
                      </div>

                      <button type="submit" className="btn-save-profile">
                        <i className="fa-solid fa-floppy-disk"></i> Update Profile & Save
                      </button>
                    </form>
                  </div>

                </div>
              </div>
            )}

          </main>
        </div>

      </div>

      <Footer />
    </div>
  );
};

export default CaretakerDashboard;
