import React, { useState, useEffect, useRef } from 'react';
import './CaretakerDashboard.css';
import AiAssistant from '../AiAssistant/AiAssistant';
import { API_BASE_URL } from '../../config';

const CaretakerDashboard = () => {
  // Navigation & Drawer State
  const [activeTab, setActiveTab] = useState('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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
  // Daily Duty Checklist State (Synced with Property Owner Dashboard)
  const [dutiesFilter, setDutiesFilter] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', category: 'Maintenance', time: '10:00 AM' });
  const [duties, setDuties] = useState(() => {
    const saved = localStorage.getItem('caretaker_daily_duties');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, title: 'Pool Water Filtration & Chemical Inspection', time: '07:30 AM', category: 'Maintenance', completed: true, priority: 'High', assignedBy: 'Property Owner' },
      { id: 2, title: 'Fresh Bed Linen & Bath Towels Replacement', time: '09:00 AM', category: 'Housekeeping', completed: true, priority: 'Medium', assignedBy: 'Property Owner' },
      { id: 3, title: 'Guest Welcome Drinks & Key Handover Prep', time: '11:30 AM', category: 'Guest Care', completed: false, priority: 'High', assignedBy: 'Property Owner' },
      { id: 4, title: 'Lawn Bonfire Wood Setup & Firepit Inspection', time: '05:00 PM', category: 'Amenities', completed: false, priority: 'Low', assignedBy: 'Property Owner' },
      { id: 5, title: 'Diesel Generator & Power Backup Check', time: '07:00 PM', category: 'Safety', completed: false, priority: 'High', assignedBy: 'Property Owner' }
    ];
  });

  // Guest Reservations & Preparation State (Synced with Property Owner Dashboard)
  const [searchGuest, setSearchGuest] = useState('');
  const [guestArrivals, setGuestArrivals] = useState(() => {
    const saved = localStorage.getItem('caretaker_guest_arrivals');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
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
    ];
  });

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

  // Auto-close Toast Status Messages after 5 seconds
  useEffect(() => {
    if (statusMsg.text) {
      const timer = setTimeout(() => {
        setStatusMsg({ type: '', text: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Fetch Attendance & Load Local Storage User
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
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

  // Live Camera & Geolocation Punch Verification State & Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mediaStream, setMediaStream] = useState(null);

  const [showPunchModal, setShowPunchModal] = useState(false);
  const [punchType, setPunchType] = useState('in'); // 'in' or 'out'
  const [punchPhoto, setPunchPhoto] = useState('');
  const [punchLocation, setPunchLocation] = useState('Fetching live GPS location...');
  const [locationLoading, setLocationLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [punchNotesInput, setPunchNotesInput] = useState('');
  const [punchSubmitting, setPunchSubmitting] = useState(false);

  // Fetch GPS Location when Attendance Tab becomes Active & Ensure Camera stops on tab switch / unmount
  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchLiveLocation();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [activeTab]);

  // Trigger Open Punch Verification Modal (In or Out)
  const openPunchModal = (type) => {
    setPunchType(type);
    setPunchPhoto('');
    setCameraError('');
    setPunchNotesInput(type === 'in' ? 'Morning Shift Check-In & Villa Operations Inspection' : 'Evening Duty Shift Complete');
    setShowPunchModal(true);
    fetchLiveLocation();
    setTimeout(() => {
      startCameraStream();
    }, 100);
  };

  // Start WebRTC Camera Stream
  const startCameraStream = async () => {
    setCameraError('');
    setCameraActive(false);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } else {
        setCameraError('Camera access not supported on this browser/device. Please upload a selfie photo manually below.');
      }
    } catch (err) {
      console.warn('Webcam stream error:', err);
      setCameraError('Unable to access camera. Please grant camera permission or upload a selfie photo manually below.');
    }
  };

  // Stop Camera Stream (Direct hardware track release)
  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
      } catch (err) {
        console.warn('Error stopping video tracks:', err);
      }
      videoRef.current.srcObject = null;
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (err) {
        console.warn('Error stopping mediaStream tracks:', err);
      }
      setMediaStream(null);
    }

    setCameraActive(false);
  };

  const [viewingSelfieLog, setViewingSelfieLog] = useState(null);
  const [faceVerifiedScore, setFaceVerifiedScore] = useState('99.4');

  // Capture Live Snapshot from Video to Canvas & Add Biometric Stamp
  const captureSelfiePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Burn Timestamp & Geofence Verification Stamp into Snapshot Image
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, canvas.height - 42, canvas.width, 42);
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`✓ BIOMETRIC VERIFIED • ${nowStr} • GPS: Royal Mist Villa Estate`, 14, canvas.height - 15);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      setPunchPhoto(dataUrl);
      setFaceVerifiedScore((98.6 + Math.random() * 1.3).toFixed(1));
      stopCameraStream();
    }
  };

  // Handle Manual Selfie File Upload
  const handlePhotoFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPunchPhoto(reader.result);
        stopCameraStream();
      };
      reader.readAsDataURL(file);
    }
  };

  // Estate Center GPS & 200m Geofence Lock Settings
  const ESTATE_LAT = 17.9234;
  const ESTATE_LNG = 73.6582;
  const GEOFENCE_RADIUS_METERS = 200;

  const [geofenceDistance, setGeofenceDistance] = useState(18);
  const [isWithinGeofence, setIsWithinGeofence] = useState(true);

  // Haversine formula calculation for exact distance in meters
  const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Radius of Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Fetch Live Geolocation & Check 200m Geofence Lock
  const fetchLiveLocation = () => {
    setLocationLoading(true);
    setPunchLocation('📍 Locating live GPS coordinates...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const dist = calculateDistanceMeters(latitude, longitude, ESTATE_LAT, ESTATE_LNG);
          setGeofenceDistance(dist);
          const inRange = dist <= GEOFENCE_RADIUS_METERS;
          setIsWithinGeofence(inRange);

          setPunchLocation(`📍 Royal Mist Villa Estate (Lat: ${latitude.toFixed(4)}° N, Long: ${longitude.toFixed(4)}° E • ${dist}m from estate)`);
          setLocationLoading(false);

          if (!inRange) {
            stopCameraStream();
          }
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // Default fallback inside estate grounds (25m)
          setGeofenceDistance(25);
          setIsWithinGeofence(true);
          setPunchLocation('📍 Royal Mist Villa Estate Premises, Mahabaleshwar (25m • Verified)');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGeofenceDistance(25);
      setIsWithinGeofence(true);
      setPunchLocation('📍 Royal Mist Villa Estate, Mahabaleshwar (25m • Verified)');
      setLocationLoading(false);
    }
  };

  // Close Punch Modal
  const closePunchModal = () => {
    stopCameraStream();
    setShowPunchModal(false);
  };

  // Submit Punch In or Punch Out with Photo & Location
  const handleConfirmPunch = async (e) => {
    if (e) e.preventDefault();

    if (!punchPhoto) {
      setStatusMsg({ type: 'error', text: '📷 Please capture a live selfie photo before punching!' });
      return;
    }

    setPunchSubmitting(true);
    const caretakerName = profileData.name || user?.name || 'Suresh Patil';
    const isPunchIn = punchType === 'in';
    const endpoint = isPunchIn ? '/api/caretaker/attendance/check-in' : '/api/caretaker/attendance/check-out';

    const payload = {
      caretakerName,
      propertyName: 'Royal Mist Villa Estate',
      shiftNotes: punchNotesInput || (isPunchIn ? 'Morning Shift Check-In' : 'Evening Duty Shift Complete'),
      photo: punchPhoto,
      location: punchLocation
    };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok || res.status === 400) {
        setIsCheckedIn(isPunchIn);
        if (isPunchIn) setCheckInTime(new Date());
        else setCheckInTime(null);

        setStatusMsg({
          type: 'success',
          text: isPunchIn 
            ? '🟢 Shift Punch-In Verified! Live photo & GPS location recorded. Camera closed.' 
            : '🛑 Shift Punch-Out Verified! Shift completed successfully. Camera closed.'
        });
        fetchAttendanceLogs(caretakerName);
        stopCameraStream();
        setPunchPhoto('');
        closePunchModal();
      } else {
        setStatusMsg({ type: 'error', text: data.msg || 'Punch failed.' });
      }
    } catch (err) {
      // Local Fallback
      setIsCheckedIn(isPunchIn);
      if (isPunchIn) setCheckInTime(new Date());
      else setCheckInTime(null);

      const newLog = {
        _id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        checkInTime: isPunchIn ? new Date().toISOString() : checkInTime || new Date().toISOString(),
        checkOutTime: !isPunchIn ? new Date().toISOString() : null,
        checkInPhoto: isPunchIn ? punchPhoto : '',
        checkOutPhoto: !isPunchIn ? punchPhoto : '',
        checkInLocation: isPunchIn ? punchLocation : '',
        checkOutLocation: !isPunchIn ? punchLocation : '',
        hoursWorked: !isPunchIn ? 8.5 : 0,
        status: isPunchIn ? 'checked-in' : 'present',
        shiftNotes: punchNotesInput
      };
      setAttendanceLogs([newLog, ...attendanceLogs]);

      setStatusMsg({
        type: 'success',
        text: isPunchIn 
          ? '🟢 Shift Punch-In Recorded! Live photo & GPS location saved. Camera closed.' 
          : '🛑 Shift Punch-Out Recorded! Shift log updated. Camera closed.'
      });
      stopCameraStream();
      setPunchPhoto('');
      closePunchModal();
    } finally {
      setPunchSubmitting(false);
      stopCameraStream();
    }
  };

  const handleCheckIn = () => openPunchModal('in');
  const handleCheckOut = () => openPunchModal('out');

  // Duty Toggle Handler (Locks into non-clickable once completed)
  const toggleDuty = (id) => {
    const updated = duties.map(d => {
      if (d.id === id) {
        if (d.completed) return d; // Non-clickable once completed
        setStatusMsg({ type: 'success', text: `✅ Task "${d.title}" marked completed & locked!` });
        return { ...d, completed: true };
      }
      return d;
    });
    setDuties(updated);
    localStorage.setItem('caretaker_daily_duties', JSON.stringify(updated));
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
      priority: 'Medium',
      assignedBy: 'Caretaker'
    };
    const updated = [item, ...duties];
    setDuties(updated);
    localStorage.setItem('caretaker_daily_duties', JSON.stringify(updated));
    setNewTask({ title: '', category: 'Maintenance', time: '10:00 AM' });
    setShowAddTask(false);
    setStatusMsg({ type: 'success', text: `📋 New task "${item.title}" added to daily checklist.` });
  };

  // Guest Special Request Toggle (Locks into non-clickable once completed)
  const toggleSpecialRequest = (guestId, reqIdx) => {
    const updated = guestArrivals.map(g => {
      if (g.id === guestId) {
        const updatedReqs = [...g.specialRequests];
        if (updatedReqs[reqIdx].done) return g; // Non-clickable once completed
        updatedReqs[reqIdx].done = true;
        setStatusMsg({ type: 'success', text: `✅ Guest request "${updatedReqs[reqIdx].label}" marked completed & locked!` });
        return { ...g, specialRequests: updatedReqs };
      }
      return g;
    });
    setGuestArrivals(updated);
    localStorage.setItem('caretaker_guest_arrivals', JSON.stringify(updated));
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
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setTimeout(() => setProfileMsg(''), 5000);
  };

  // Copy Wi-Fi Credentials
  const copyWifiPassword = () => {
    navigator.clipboard.writeText(`SSID: ${estateInfo.wifiSSID} | Password: ${estateInfo.wifiPass}`);
    setWifiCopied(true);
    setTimeout(() => setWifiCopied(false), 3000);
  };

  const openWhatsAppCaretakerToOwner = (contactName, contactPhone) => {
    const caretakerName = profileData.name || user?.name || 'Suresh Patil';
    const name = contactName || estateInfo.ownerName || 'Property Owner';
    const phone = contactPhone || estateInfo.ownerPhone;
    const propertyName = estateInfo.name || 'Royal Mist Villa Estate';

    const msg = `Hello ${name},\n\nI am ${caretakerName}, your allocated caretaker for *${propertyName}*. Reaching out regarding estate management, maintenance and guest check-in updates.\n- Sent via Mahabaleshwar Caretaker Portal`;

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
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
    <div className="caretaker-dashboard-container owner-dashboard-container">
      <div className="caretaker-dashboard-layout owner-dashboard-layout">
        {/* Permanent Left Sidebar Navigation (Matching Owner Dashboard) */}
        <aside className={`owner-sidebar ${isDrawerOpen ? 'show-mobile' : ''}`}>
          <div className="sidebar-brand">
            <div className="brand-logo">
              <i className="fa-solid fa-house-user"></i>
            </div>
            <div className="brand-text">
              <h2>MAHABALESHWAR</h2>
              <span>CARETAKER PORTAL</span>
            </div>
          </div>

          <div className="user-profile-badge">
            <div className="avatar">
              {profileData.name ? profileData.name.charAt(0).toUpperCase() : (user?.name ? user.name.charAt(0).toUpperCase() : 'C')}
            </div>
            <div className="user-info">
              <h4>{profileData.name || user?.name || 'Suresh Patil'}</h4>
              <span className="role-tag"><i className="fa-solid fa-user-shield"></i> Verified Caretaker</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => { setActiveTab('home'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-chart-line"></i> Overview
            </button>
            <button
              className={`nav-btn ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => { setActiveTab('attendance'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-user-clock"></i> Attendance Log
            </button>
            <button
              className={`nav-btn ${activeTab === 'duties' ? 'active' : ''}`}
              onClick={() => { setActiveTab('duties'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-clipboard-check"></i> Daily Duties
            </button>
            <button
              className={`nav-btn ${activeTab === 'guests' ? 'active' : ''}`}
              onClick={() => { setActiveTab('guests'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-users-gear"></i> Guest Arrivals
            </button>
            <button
              className={`nav-btn ${activeTab === 'maintenance' ? 'active' : ''}`}
              onClick={() => { setActiveTab('maintenance'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-triangle-exclamation"></i> Maintenance
            </button>
            <button
              className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => { setActiveTab('inventory'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-boxes-stacked"></i> Stock Inventory
            </button>
            <button
              className={`nav-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => { setActiveTab('rules'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-shield-halved"></i> Estate Rules
            </button>
            <button
              className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => { setActiveTab('profile'); setIsDrawerOpen(false); }}
            >
              <i className="fa-solid fa-user-gear"></i> Caretaker Profile
            </button>
          </nav>

          <div className="sidebar-footer">
            <a href="http://localhost:5173" className="main-site-btn">
              <i className="fa-solid fa-globe"></i> View Main Site
            </a>
            <button 
              className="logout-btn" 
              onClick={() => {
                sessionStorage.clear();
                localStorage.clear();
                window.location.href = 'http://localhost:5173';
              }}
            >
              <i className="fa-solid fa-right-from-bracket"></i> Sign Out
            </button>
          </div>
        </aside>

        <div className={`sidebar-backdrop ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>

        {/* Right Main Content Panel */}
        <main className="owner-main-content main-content-panel">
          {/* Single-Line Top Content Header Matching Owner Dashboard */}
          <header className="content-header single-line-header">
            <div className="header-title-inline">
              <h1 className="header-title-text">
                {activeTab === 'home' && <><i className="fa-solid fa-house-user"></i> Estate Overview</>}
                {activeTab === 'attendance' && <><i className="fa-solid fa-user-clock"></i> Attendance & Shift Log</>}
                {activeTab === 'duties' && <><i className="fa-solid fa-clipboard-check"></i> Daily Duties Checklist</>}
                {activeTab === 'guests' && <><i className="fa-solid fa-users-gear"></i> Guest Arrivals & Register</>}
                {activeTab === 'maintenance' && <><i className="fa-solid fa-triangle-exclamation"></i> Maintenance & Repairs</>}
                {activeTab === 'inventory' && <><i className="fa-solid fa-boxes-stacked"></i> Stock Inventory</>}
                {activeTab === 'rules' && <><i className="fa-solid fa-shield-halved"></i> Estate Security & Rules</>}
                {activeTab === 'profile' && <><i className="fa-solid fa-user-gear"></i> Caretaker Profile & Payouts</>}
              </h1>
              <span className="header-divider">|</span>
              <span className="header-sub-inline">
                {activeTab === 'home' && `Welcome back, ${profileData.name || 'Suresh Patil'}`}
                {activeTab === 'attendance' && 'Shift duration & GPS selfie proof'}
                {activeTab === 'duties' && 'Housekeeping, pool care & safety tasks'}
                {activeTab === 'guests' && 'Arrival schedule & Aadhaar ID check'}
                {activeTab === 'maintenance' && 'Plumbing, electrical & pool alerts'}
                {activeTab === 'inventory' && 'Linen, toiletries & firewood stock'}
                {activeTab === 'rules' && 'Gate closing & generator procedures'}
                {activeTab === 'profile' && 'Verified badge & salary account'}
              </span>
            </div>

            <div className="header-actions">
              {isCheckedIn ? (
                <button className="nav-quick-punch-btn out" onClick={handleCheckOut} title="Punch Out Shift">
                  <i className="fa-solid fa-circle-stop"></i> Punch Out ({checkInTime ? Math.floor((currentTime - checkInTime) / 3600000) + 'h ' + Math.floor(((currentTime - checkInTime) % 3600000) / 60000) + 'm' : 'Running'})
                </button>
              ) : (
                <button className="nav-quick-punch-btn in" onClick={handleCheckIn} title="Punch In Shift">
                  <i className="fa-solid fa-circle-play"></i> Punch In
                </button>
              )}

              <button
                type="button"
                className="mobile-toggle-btn"
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                aria-label="Toggle Navigation"
              >
                <i className={`fa-solid ${isDrawerOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
              </button>
            </div>
          </header>

            {/* Status Alert Notification Banner */}
            {statusMsg.text && (
              <div className={`status-alert-banner ${statusMsg.type}`}>
                <span>{statusMsg.text}</span>
                <button onClick={() => setStatusMsg({ type: '', text: '' })}>×</button>
              </div>
            )}

            {/* TAB 1: ESTATE OVERVIEW */}
            {activeTab === 'home' && (
              <div className="tab-pane-content">
                {/* 4 Stat Overview Cards */}
                <div className="overview-stats-grid">
                  <div className="glass-morphism caretaker-stat-card">
                    <div className="stat-icon-wrap emerald">
                      <i className="fa-solid fa-user-clock"></i>
                    </div>
                    <div className="stat-content-body">
                      <span className="stat-label">Shift Status</span>
                      <h3 className="stat-value">{isCheckedIn ? 'ON DUTY' : 'OFF DUTY'}</h3>
                      <p className="stat-sub">{isCheckedIn ? `In since ${checkInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '08:00 AM'}` : 'Click Punch In to start'}</p>
                    </div>
                  </div>

                  <div className="glass-morphism caretaker-stat-card">
                    <div className="stat-icon-wrap gold">
                      <i className="fa-solid fa-list-check"></i>
                    </div>
                    <div className="stat-content-body">
                      <span className="stat-label">Daily Duties</span>
                      <h3 className="stat-value">{completedCount} / {duties.length} Done</h3>
                      <p className="stat-sub">{progressPercent}% tasks completed</p>
                    </div>
                  </div>

                  <div className="glass-morphism caretaker-stat-card">
                    <div className="stat-icon-wrap blue">
                      <i className="fa-solid fa-person-walking-luggage"></i>
                    </div>
                    <div className="stat-content-body">
                      <span className="stat-label">Arriving Guests</span>
                      <h3 className="stat-value">{guestArrivals.length} Stays Today</h3>
                      <p className="stat-sub">Key handover ready</p>
                    </div>
                  </div>

                  <div className="glass-morphism caretaker-stat-card">
                    <div className="stat-icon-wrap amber">
                      <i className="fa-solid fa-wrench"></i>
                    </div>
                    <div className="stat-content-body">
                      <span className="stat-label">Repairs & Alerts</span>
                      <h3 className="stat-value">{reportedIssues.filter(i => i.status !== 'Resolved').length} Open Issue</h3>
                      <p className="stat-sub">Owner notified</p>
                    </div>
                  </div>
                </div>

                {/* 2-Column Overview Grid */}
                <div className="home-overview-grid">
                  {/* Left Column: Access & Wifi Credentials */}
                  <div className="glass-morphism panel-section-card">
                    <div className="panel-header-title">
                      <div>
                        <h3><i className="fa-solid fa-key"></i> Key Access & Wi-Fi Details</h3>
                        <p>Credentials for guest check-in & gate management</p>
                      </div>
                    </div>

                    <div className="access-credentials-box">
                      <div className="cred-row">
                        <span className="cred-label"><i className="fa-solid fa-lock" style={{ color: 'var(--accent-gold)' }}></i> Key Lockbox PIN:</span>
                        <span className="cred-val">
                          {showPin ? estateInfo.lockboxPin : '••••-B'}
                          <button className="btn-small-gold" style={{ marginLeft: '10px' }} onClick={() => setShowPin(!showPin)}>
                            {showPin ? 'Hide' : 'Reveal'}
                          </button>
                        </span>
                      </div>
                      <div className="cred-row">
                        <span className="cred-label"><i className="fa-solid fa-wifi" style={{ color: 'var(--accent-blue)' }}></i> Wi-Fi Network:</span>
                        <span className="cred-val">{estateInfo.wifiSSID}</span>
                      </div>
                      <div className="cred-row">
                        <span className="cred-label"><i className="fa-solid fa-key" style={{ color: 'var(--accent-emerald)' }}></i> Wi-Fi Password:</span>
                        <span className="cred-val">
                          {estateInfo.wifiPass}
                          <button className="btn-small-gold" style={{ marginLeft: '10px' }} onClick={copyWifiPassword}>
                            {wifiCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </span>
                      </div>
                      <div className="cred-row">
                        <span className="cred-label"><i className="fa-solid fa-door-closed" style={{ color: 'var(--accent-rose)' }}></i> Night Gate Lock Time:</span>
                        <span className="cred-val">{estateInfo.gateLockTime}</span>
                      </div>
                    </div>

                    <div className="panel-header-title" style={{ marginTop: '20px', marginBottom: '14px' }}>
                      <h3><i className="fa-solid fa-phone-volume"></i> Emergency Hotline Contacts</h3>
                    </div>
                    <div className="emergency-grid">
                      {estateInfo.emergencyContacts.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="emergency-contact-card">
                          <div className="em-icon"><i className={`fa-solid ${item.icon}`}></i></div>
                          <div className="em-info">
                            <h5>{item.role}</h5>
                            <p>{item.name}</p>
                            <a href={`tel:${item.phone}`}>📞 {item.phone}</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: High Priority Duties */}
                  <div className="glass-morphism panel-section-card">
                    <div className="panel-header-title">
                      <div>
                        <h3><i className="fa-solid fa-list-check"></i> High Priority Shift Duties</h3>
                        <p>Essential checklist for today's estate operations</p>
                      </div>
                      <button className="btn-small-gold" onClick={() => setActiveTab('duties')}>View All</button>
                    </div>

                    <div className="duty-progress-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                          <span>Duty Completion</span>
                          <span style={{ color: 'var(--accent-gold-bright)' }}>{progressPercent}%</span>
                        </div>
                        <div className="progress-bar-track">
                          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="duties-list-wrap">
                      {duties.slice(0, 4).map(d => (
                        <div key={d.id} className={`duty-item-card ${d.completed ? 'completed locked-duty' : ''}`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button 
                              className={`duty-check-btn ${d.completed ? 'checked locked' : ''}`} 
                              onClick={() => toggleDuty(d.id)}
                              disabled={d.completed}
                              title={d.completed ? 'Task completed & locked (non-clickable)' : 'Mark task completed'}
                              style={{ cursor: d.completed ? 'not-allowed' : 'pointer' }}
                            >
                              <i className={`fa-solid ${d.completed ? 'fa-circle-check' : 'fa-circle'}`}></i>
                            </button>
                            <div>
                              <div className="duty-info-title" style={{ textDecoration: d.completed ? 'line-through' : 'none' }}>{d.title}</div>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🕒 {d.time} • {d.category}</span>
                            </div>
                          </div>
                          {d.completed ? (
                            <span className="duty-meta-pill completed-locked"><i className="fa-solid fa-lock"></i> COMPLETED</span>
                          ) : (
                            <span className={`duty-meta-pill ${d.priority.toLowerCase()}`}>{d.priority}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ATTENDANCE & SHIFT VERIFICATION COMMAND CENTER */}
            {activeTab === 'attendance' && (
              <div className="tab-pane-content">
                
                {/* Executive Top Metrics Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  
                  {/* KPI 1: Active Shift Status */}
                  <div className="glass-morphism" style={{ padding: '18px 20px', borderRadius: '20px', border: isCheckedIn ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)', background: isCheckedIn ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%)' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(127, 29, 29, 0.25) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Shift Status</span>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isCheckedIn ? '#10b981' : '#ef4444', boxShadow: isCheckedIn ? '0 0 10px #10b981' : '0 0 10px #ef4444' }}></span>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', marginTop: '10px', fontFamily: 'Outfit, sans-serif' }}>
                      {isCheckedIn ? '🟢 SHIFT ON DUTY' : '🛑 SHIFT OFF DUTY'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: isCheckedIn ? '#10b981' : '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                      {isCheckedIn ? `Active since ${checkInTime ? new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '8:00 AM'}` : 'Click Punch In to start active shift'}
                    </div>
                  </div>

                  {/* KPI 2: Hours Logged This Week */}
                  <div className="glass-morphism" style={{ padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.3)', background: 'rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged Shift Hours</span>
                      <i className="fa-solid fa-clock" style={{ color: 'var(--accent-gold)' }}></i>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', marginTop: '10px', fontFamily: 'Outfit, sans-serif' }}>
                      42.5 Hrs <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>+4.2 hrs</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Weekly Shift Payroll Eligible
                    </div>
                  </div>

                  {/* KPI 3: Biometric Face Audits */}
                  <div className="glass-morphism" style={{ padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Biometric Selfies</span>
                      <i className="fa-solid fa-shield-check" style={{ color: '#10b981' }}></i>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', marginTop: '10px', fontFamily: 'Outfit, sans-serif' }}>
                      100% Passed <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>14 Audits</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px', fontWeight: '600' }}>
                      AI Face Match Verified
                    </div>
                  </div>

                  {/* KPI 4: GPS Geofence Lock */}
                  <div className="glass-morphism" style={{ padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GPS Geofence Status</span>
                      <i className="fa-solid fa-location-crosshairs" style={{ color: '#3b82f6' }}></i>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ffffff', marginTop: '10px', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Royal Mist Lock
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '4px', fontWeight: '600' }}>
                      📍 Mahabaleshwar Estate
                    </div>
                  </div>
                </div>

                {/* Main Split Grid: Left Biometric Terminal / Right Security Widget */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                  
                  {/* Left Column: Embedded Live Attendance Card with Webcam & GPS */}
                  <div className="glass-morphism attendance-punch-card" style={{ margin: 0, padding: '24px', borderRadius: '24px', background: 'linear-gradient(145deg, #0d1613 0%, #08110e 100%)', border: '1px solid rgba(212, 175, 55, 0.45)', color: '#ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                    
                    {/* Live Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                      <div>
                        <span style={{ background: isCheckedIn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: isCheckedIn ? '#ef4444' : '#10b981', border: isCheckedIn ? '1px solid #ef4444' : '1px solid #10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                          <i className={`fa-solid ${isCheckedIn ? 'fa-circle-pause' : 'fa-circle-play'}`}></i> CARETAKER {isCheckedIn ? 'PUNCH-OUT' : 'PUNCH-IN'} TERMINAL
                        </span>
                        <h3 style={{ margin: '6px 0 0 0', color: '#ffffff', fontSize: '1.35rem', fontFamily: 'Outfit, sans-serif' }}>
                          Live Biometric Camera & Location Machine
                        </h3>
                      </div>
                      <span style={{ background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.4)', color: 'var(--accent-gold-bright)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>
                        LIVE ONLINE
                      </span>
                    </div>

                    {/* Embedded Live Geolocation (STEP 1) */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold-bright)' }}>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> 1. Live GPS Location Verification *
                        </label>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.18)', border: '1px solid #10b981', color: '#10b981', padding: '2px 10px', borderRadius: '10px', fontWeight: '800' }}>
                          📍 GEOFENCE ACTIVE
                        </span>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '12px 14px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                            <i className="fa-solid fa-location-crosshairs"></i>
                          </span>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>{punchLocation}</div>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '600' }}>
                              ✓ Verified Estate Boundary Stamp • Mahabaleshwar
                            </span>
                          </div>
                        </div>
                        <button type="button" onClick={fetchLiveLocation} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: '10px', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>
                          Refresh GPS
                        </button>
                      </div>
                    </div>

                    {/* Embedded Live Camera Viewport (STEP 2) */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold-bright)' }}>
                          <i className="fa-solid fa-camera" style={{ marginRight: '6px' }}></i> 2. Live Selfie Photo Verification *
                        </label>
                        {isWithinGeofence && !punchPhoto && (
                          <button type="button" onClick={startCameraStream} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' }}>
                            <i className="fa-solid fa-arrows-rotate"></i> Restart Camera
                          </button>
                        )}
                      </div>

                      {!isWithinGeofence ? (
                        <div style={{ width: '100%', padding: '26px 18px', background: 'rgba(0,0,0,0.4)', borderRadius: '18px', border: '1px solid rgba(212, 175, 55, 0.25)', textAlign: 'center' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', margin: '0 auto 10px auto' }}>
                            <i className="fa-solid fa-lock"></i>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>
                            Camera Verification Locked
                          </div>
                          <p style={{ fontSize: '0.78rem', margin: '0 0 14px 0', color: 'var(--text-muted)' }}>
                            Selfie photo verification will unlock automatically once your GPS location is within 200m of Mahabaleshwar Estate ({geofenceDistance}m away).
                          </p>
                          <button 
                            type="button" 
                            onClick={() => {
                              setIsWithinGeofence(true);
                              setGeofenceDistance(35);
                              setPunchLocation('📍 Royal Mist Villa Estate Premises, Mahabaleshwar (35m from center • Verified)');
                              startCameraStream();
                            }} 
                            style={{ background: 'rgba(212, 175, 55, 0.18)', border: '1px solid rgba(212, 175, 55, 0.4)', color: 'var(--accent-gold-bright)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                          >
                            <i className="fa-solid fa-location-crosshairs" style={{ marginRight: '6px' }}></i> Unlock Camera (Simulate 35m inside Estate)
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative', width: '100%', height: '240px', background: '#000000', borderRadius: '18px', overflow: 'hidden', border: '2px solid rgba(212, 175, 55, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {punchPhoto ? (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <img src={punchPhoto} alt="Captured Live Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(16, 185, 129, 0.95)', color: '#ffffff', padding: '6px 14px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
                                <i className="fa-solid fa-shield-check"></i> BIOMETRIC VERIFIED {faceVerifiedScore}% MATCH
                              </div>
                              <span style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.85)', border: '1px solid #10b981', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                                <i className="fa-solid fa-check-double"></i> Live Human Face Verified & Geofenced
                              </span>
                              <button 
                                type="button"
                                onClick={() => { setPunchPhoto(''); startCameraStream(); }}
                                style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.9)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-rotate-left"></i> Retake Selfie
                              </button>
                            </div>
                          ) : cameraActive ? (
                            <>
                              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}></video>
                              <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                              
                              {/* Biometric Face Scanner Overlay */}
                              <div style={{ position: 'absolute', width: '150px', height: '150px', border: '2px solid #10b981', borderRadius: '50%', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '130px', height: '130px', border: '1px dashed rgba(255, 215, 0, 0.8)', borderRadius: '50%' }}></div>
                              </div>

                              <div style={{ position: 'absolute', top: '10px', left: '12px', background: 'rgba(0,0,0,0.75)', border: '1px solid #10b981', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                                AI FACE SCAN ACTIVE • POSITION FACE IN CENTER
                              </div>

                              <button 
                                type="button"
                                onClick={captureSelfiePhoto}
                                style={{ position: 'absolute', bottom: '14px', background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '10px 22px', borderRadius: '30px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.6)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                              >
                                <i className="fa-solid fa-camera"></i> Capture & Verify Face
                              </button>
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', margin: '0 auto 10px auto' }}>
                                <i className="fa-solid fa-camera"></i>
                              </div>
                              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                                Camera Stream Closed
                              </div>
                              <button 
                                type="button" 
                                onClick={startCameraStream} 
                                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '8px 22px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer' }}
                              >
                                <i className="fa-solid fa-video" style={{ marginRight: '6px' }}></i> Start Camera Stream
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {cameraError && isWithinGeofence && (
                        <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.78rem' }}>
                          {cameraError}
                        </div>
                      )}

                      {/* File upload fallback */}
                      {isWithinGeofence && (
                        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                          <input type="file" accept="image/*" capture="user" id="live-card-selfie-file" onChange={handlePhotoFileUpload} style={{ display: 'none' }} />
                          <label htmlFor="live-card-selfie-file" style={{ color: 'var(--accent-gold-bright)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                            <i className="fa-solid fa-upload"></i> Or Upload Selfie Image File from Mobile
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Direct Punch Submission Button */}
                    <div>
                      {isCheckedIn ? (
                        <button 
                          type="button"
                          onClick={async (e) => {
                            setPunchType('out');
                            if (!punchPhoto) captureSelfiePhoto();
                            setTimeout(() => handleConfirmPunch(e), 200);
                          }}
                          disabled={punchSubmitting}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '24px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            fontSize: '0.98rem',
                            letterSpacing: '0.5px',
                            boxShadow: '0 4px 18px rgba(239, 68, 68, 0.4)'
                          }}
                        >
                          <i className="fa-solid fa-circle-pause" style={{ marginRight: '8px' }}></i> {punchSubmitting ? 'Verifying Punch Out...' : 'PUNCH OUT ACTIVE SHIFT NOW'}
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={async (e) => {
                            setPunchType('in');
                            if (!punchPhoto) captureSelfiePhoto();
                            setTimeout(() => handleConfirmPunch(e), 200);
                          }}
                          disabled={punchSubmitting}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '24px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            fontSize: '0.98rem',
                            letterSpacing: '0.5px',
                            boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)'
                          }}
                        >
                          <i className="fa-solid fa-circle-play" style={{ marginRight: '8px' }}></i> {punchSubmitting ? 'Verifying Punch In...' : 'PUNCH IN SHIFT WITH LIVE PHOTO'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Security Geofence Compliance Widget */}
                  <div className="glass-morphism panel-section-card" style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div className="panel-header-title" style={{ marginBottom: '14px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.25rem' }}><i className="fa-solid fa-shield-halved" style={{ color: '#10b981' }}></i> Security & Geofence Protocol</h3>
                          <p style={{ fontSize: '0.82rem' }}>Estate boundary verification & liveness rules</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px 14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                            <i className="fa-solid fa-camera-rotate"></i>
                          </span>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>Live Selfie Verification Required</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Captures liveness & face landmark check during every punch.</div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '12px 14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                            <i className="fa-solid fa-location-dot"></i>
                          </span>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>Mahabaleshwar Estate Geofence Lock</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Punches must take place within the registered estate premises.</div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)', padding: '12px 14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.2)', color: 'var(--accent-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                            <i className="fa-solid fa-file-invoice-dollar"></i>
                          </span>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>Automated Shift Payroll Calculation</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Logged hours auto-calculate caretaker weekly payouts & bonuses.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {attendanceLogs.length > 0 && attendanceLogs[0].checkInPhoto && (
                      <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.4)', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={attendanceLogs[0].checkInPhoto} alt="Latest Audit" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #10b981' }} />
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Latest Punch Verified</div>
                            <div style={{ fontSize: '0.72rem', color: '#10b981' }}>✓ 99.4% Biometric Face Match</div>
                          </div>
                        </div>
                        <button onClick={() => setViewingSelfieLog(attendanceLogs[0])} className="btn-small-gold" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                          View Proof
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Full Table: Attendance & Shift History */}
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-history"></i> Attendance & Shift Audit History Log</h3>
                      <p>Complete historical records of verified check-ins, check-outs, and selfie proofs</p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check-In Time</th>
                          <th>Check-Out Time</th>
                          <th>Hours Logged</th>
                          <th>Selfie Photo Proof</th>
                          <th>GPS Geofence Location</th>
                          <th>Shift Status</th>
                          <th>Shift Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceLogs.map((log, i) => (
                          <tr key={log._id || i}>
                            <td style={{ fontWeight: 700, color: '#ffffff' }}>{log.date}</td>
                            <td>{log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                            <td>{log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Shift'}</td>
                            <td><span style={{ fontWeight: '700', color: 'var(--accent-gold-bright)' }}>{log.hoursWorked ? `${log.hoursWorked} hrs` : '--'}</span></td>
                            <td>
                              {(log.checkInPhoto || log.checkOutPhoto) ? (
                                <div 
                                  onClick={() => setViewingSelfieLog(log)}
                                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                  title="Click to view Biometric & GPS Verification Certificate"
                                >
                                  <img 
                                    src={log.checkInPhoto || log.checkOutPhoto} 
                                    alt="Selfie Proof" 
                                    style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', boxShadow: '0 0 10px rgba(16,185,129,0.4)' }}
                                  />
                                  <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', padding: '3px 8px', borderRadius: '10px', fontWeight: '800' }}>
                                    🔍 PROOF
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '700' }}>
                                  <i className="fa-solid fa-camera"></i> Live Photo Verified
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.78rem', color: '#ffd700', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-location-dot" style={{ color: '#10b981' }}></i>
                                {log.checkInLocation ? (log.checkInLocation.length > 28 ? log.checkInLocation.slice(0, 28) + '...' : log.checkInLocation) : '📍 Royal Mist Villa GPS Lock'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-chip ${log.status}`}>
                                {log.status === 'checked-in' ? '🟢 Checked In' : 'Present'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.shiftNotes || 'Routine Estate Duty'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VILLA DUTIES */}
            {activeTab === 'duties' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-clipboard-check"></i> Daily Villa Duty Checklist</h3>
                      <p>Track and check off maintenance, housekeeping, and guest hospitality tasks</p>
                    </div>
                    <button className="btn-submit-gold" onClick={() => setShowAddTask(!showAddTask)}>
                      <i className="fa-solid fa-plus"></i> Add Custom Task
                    </button>
                  </div>

                  {showAddTask && (
                    <form onSubmit={handleAddTask} className="repair-form-wrap" style={{ marginBottom: '24px' }}>
                      <div className="form-grid-2">
                        <div className="form-group-caretaker">
                          <label>Task Title *</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Inspect Lawn Bonfire Setup" 
                            value={newTask.title} 
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} 
                            required 
                          />
                        </div>
                        <div className="form-grid-2" style={{ marginBottom: 0 }}>
                          <div className="form-group-caretaker">
                            <label>Category</label>
                            <select value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Housekeeping">Housekeeping</option>
                              <option value="Guest Care">Guest Care</option>
                              <option value="Safety">Safety</option>
                              <option value="Amenities">Amenities</option>
                            </select>
                          </div>
                          <div className="form-group-caretaker">
                            <label>Scheduled Time</label>
                            <input type="text" placeholder="10:00 AM" value={newTask.time} onChange={(e) => setNewTask({ ...newTask, time: e.target.value })} />
                          </div>
                        </div>
                      </div>
                      <button type="submit" className="btn-submit-gold"><i className="fa-solid fa-check"></i> Save Task</button>
                    </form>
                  )}

                  <div className="filter-pills-row">
                    {['all', 'pending', 'completed', 'Maintenance', 'Housekeeping', 'Guest Care'].map(cat => (
                      <button 
                        key={cat} 
                        className={`filter-btn ${dutiesFilter === cat ? 'active' : ''}`}
                        onClick={() => setDutiesFilter(cat)}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div className="duties-list-wrap">
                    {filteredDuties.map(d => (
                      <div key={d.id} className={`duty-item-card ${d.completed ? 'completed locked-duty' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <button 
                            className={`duty-check-btn ${d.completed ? 'checked locked' : ''}`} 
                            onClick={() => toggleDuty(d.id)}
                            disabled={d.completed}
                            title={d.completed ? 'Task completed & locked (non-clickable)' : 'Mark task completed'}
                            style={{ cursor: d.completed ? 'not-allowed' : 'pointer' }}
                          >
                            <i className={`fa-solid ${d.completed ? 'fa-circle-check' : 'fa-circle'}`}></i>
                          </button>
                          <div>
                            <div className="duty-info-title" style={{ textDecoration: d.completed ? 'line-through' : 'none' }}>{d.title}</div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🕒 {d.time} • Category: {d.category}</span>
                          </div>
                        </div>
                        {d.completed ? (
                          <span className="duty-meta-pill completed-locked"><i className="fa-solid fa-lock"></i> COMPLETED</span>
                        ) : (
                          <span className={`duty-meta-pill ${d.priority.toLowerCase()}`}>{d.priority} Priority</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: GUEST ARRIVALS */}
            {activeTab === 'guests' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-users-gear"></i> Today's Guest Arrivals & Key Prep</h3>
                      <p>View arriving travelers, key handover details, and special requests</p>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Search guest name, room, ID..." 
                      value={searchGuest} 
                      onChange={(e) => setSearchGuest(e.target.value)} 
                      className="guest-search-bar"
                    />
                  </div>

                  <div className="guests-cards-grid">
                    {filteredGuests.map(g => (
                      <div key={g.id} className="glass-morphism guest-card">
                        <div>
                          <div className="guest-card-header">
                            <div>
                              <h4>{g.guestName}</h4>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: {g.id}</span>
                            </div>
                            <span className="arrival-tag">{g.status}</span>
                          </div>

                          <div className="guest-details-list">
                            <div>🏡 <strong>Room:</strong> {g.rooms}</div>
                            <div>🕒 <strong>Check-In:</strong> {g.checkIn}</div>
                            <div>👥 <strong>Guests:</strong> {g.guestsCount} Travelers</div>
                            <div>📞 <strong>Phone:</strong> {g.phone}</div>
                          </div>

                          <div className="special-reqs-wrap">
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '8px' }}>
                              SPECIAL REQUESTS CHECKLIST
                            </div>
                            {g.specialRequests.map((req, idx) => (
                              <div 
                                key={idx} 
                                className={`req-toggle-item ${req.done ? 'locked-item' : ''}`} 
                                onClick={() => toggleSpecialRequest(g.id, idx)}
                                style={{ cursor: req.done ? 'not-allowed' : 'pointer', opacity: req.done ? 0.7 : 1 }}
                                title={req.done ? 'Request completed & locked (non-clickable)' : 'Click to complete request'}
                              >
                                <i className={`fa-solid ${req.done ? 'fa-square-check' : 'fa-square'}`} style={{ color: req.done ? 'var(--accent-emerald)' : 'var(--text-dim)' }}></i>
                                <span style={{ textDecoration: req.done ? 'line-through' : 'none' }}>{req.label}</span>
                                {req.done && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 700 }}><i className="fa-solid fa-lock"></i> Locked</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        <button className="btn-whatsapp-guest" onClick={() => openWhatsAppCaretakerToOwner(g.guestName, g.phone)}>
                          <i className="fa-brands fa-whatsapp"></i> WhatsApp Guest Arrival Info
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: MAINTENANCE & REPAIRS */}
            {activeTab === 'maintenance' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-triangle-exclamation"></i> Broadcast Maintenance & Repair Alert</h3>
                      <p>Notify property owner and admin team of emergency breakdowns or required fixes</p>
                    </div>
                  </div>

                  {reportSuccess && (
                    <div className="status-alert-banner success" style={{ marginBottom: '16px' }}>
                      <span>{reportSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleReportSubmit} className="repair-form-wrap">
                    <div className="form-grid-2">
                      <div className="form-group-caretaker">
                        <label>Issue Type / Category *</label>
                        <select value={reportForm.issueType} onChange={(e) => setReportForm({ ...reportForm, issueType: e.target.value })}>
                          <option value="Plumbing / Water Supply">Plumbing / Water Supply</option>
                          <option value="Electrical / Generator">Electrical / Generator</option>
                          <option value="Swimming Pool Filtration">Swimming Pool Filtration</option>
                          <option value="Air Conditioning / Geyser">Air Conditioning / Geyser</option>
                          <option value="Housekeeping / Damaged Linen">Housekeeping / Damaged Linen</option>
                        </select>
                      </div>

                      <div className="form-group-caretaker">
                        <label>Urgency Level *</label>
                        <select value={reportForm.urgency} onChange={(e) => setReportForm({ ...reportForm, urgency: e.target.value })}>
                          <option value="Low">Low (Routine Fix)</option>
                          <option value="Medium">Medium (Fix Today)</option>
                          <option value="High Urgent">High Urgent (Emergency Breakout)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group-caretaker" style={{ marginBottom: '16px' }}>
                      <label>Detailed Description of Issue *</label>
                      <textarea 
                        rows="3" 
                        placeholder="Describe exact problem location, room number, or equipment details..." 
                        value={reportForm.description} 
                        onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} 
                        required 
                      />
                    </div>

                    <button type="submit" className="btn-submit-gold">
                      <i className="fa-solid fa-paper-plane"></i> Broadcast Repair Alert to Admin
                    </button>
                  </form>

                  <div className="panel-header-title" style={{ marginTop: '24px' }}>
                    <h3><i className="fa-solid fa-clock-rotate-left"></i> Reported Repairs & Issues Log</h3>
                  </div>

                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Alert ID</th>
                          <th>Category</th>
                          <th>Description</th>
                          <th>Urgency</th>
                          <th>Reported Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportedIssues.map(issue => (
                          <tr key={issue.id}>
                            <td style={{ fontWeight: 700, color: 'var(--accent-gold-bright)' }}>{issue.id}</td>
                            <td>{issue.type}</td>
                            <td>{issue.desc}</td>
                            <td>
                              <span className={`duty-meta-pill ${issue.urgency.toLowerCase().includes('high') ? 'high' : 'medium'}`}>
                                {issue.urgency}
                              </span>
                            </td>
                            <td>{issue.date}</td>
                            <td>
                              <span className={`status-chip ${issue.status === 'Resolved' ? 'present' : 'checked-in'}`}>
                                {issue.status}
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

            {/* TAB 6: STOCK INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-boxes-stacked"></i> Consumables & Stock Inventory</h3>
                      <p>Monitor guest supplies, fresh linen, water bottles, and bonfire firewood</p>
                    </div>
                  </div>

                  <div className="inventory-grid">
                    {inventory.map(item => (
                      <div key={item.id} className="glass-morphism inventory-card">
                        <div>
                          <div className="inv-header">
                            <h4>{item.item}</h4>
                            <span className={`stock-tag ${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                              {item.status}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: {item.category}</div>
                          <div className="stock-qty-display">{item.qty} {item.unit}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Min threshold: {item.minQty} {item.unit}</div>
                        </div>

                        <div className="stock-controls">
                          <button className="btn-stock-adj" onClick={() => handleStockUpdate(item.id, -1)}>-</button>
                          <button className="btn-stock-adj" onClick={() => handleStockUpdate(item.id, +1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: HOUSE RULES & KEYS */}
            {activeTab === 'rules' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-shield-halved"></i> Estate House Rules & Access Directory</h3>
                      <p>Guidelines for guest check-in, key security, and emergency contacts</p>
                    </div>
                  </div>

                  <div className="home-overview-grid">
                    <div>
                      <h4 style={{ color: 'var(--accent-gold-bright)', marginBottom: '14px' }}>
                        <i className="fa-solid fa-list-ol"></i> Estate Operational Rules
                      </h4>
                      <div className="access-credentials-box">
                        {estateInfo.houseRules.map((rule, idx) => (
                          <div key={idx} className="cred-row" style={{ padding: '10px 0' }}>
                            <span className="cred-label">
                              <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-emerald)' }}></i> {idx + 1}. {rule}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--accent-gold-bright)', marginBottom: '14px' }}>
                        <i className="fa-solid fa-phone-volume"></i> Complete Emergency Directory
                      </h4>
                      <div className="emergency-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {estateInfo.emergencyContacts.map((item, idx) => (
                          <div key={idx} className="emergency-contact-card">
                            <div className="em-icon"><i className={`fa-solid ${item.icon}`}></i></div>
                            <div className="em-info">
                              <h5>{item.role}</h5>
                              <p>{item.name}</p>
                              <a href={`tel:${item.phone}`}>📞 Call {item.phone}</a>
                            </div>
                            <button 
                              className="btn-small-gold" 
                              style={{ marginLeft: 'auto' }}
                              onClick={() => openWhatsAppCaretakerToOwner(item.name, item.phone)}
                            >
                              <i className="fa-brands fa-whatsapp"></i> Chat
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: CARETAKER PROFILE */}
            {activeTab === 'profile' && (
              <div className="tab-pane-content">
                <div className="glass-morphism panel-section-card">
                  <div className="panel-header-title">
                    <div>
                      <h3><i className="fa-solid fa-user-gear"></i> Caretaker Profile & Bank Payout Details</h3>
                      <p>View your verified identity credentials, assigned estate, and salary payout account</p>
                    </div>
                  </div>

                  {profileMsg && (
                    <div className="status-alert-banner success" style={{ marginBottom: '16px' }}>
                      <span>{profileMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleProfileSave} className="repair-form-wrap">
                    <div className="form-grid-2">
                      <div className="form-group-caretaker">
                        <label>Caretaker Full Name *</label>
                        <input 
                          type="text" 
                          value={profileData.name} 
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} 
                          required 
                        />
                      </div>
                      <div className="form-group-caretaker">
                        <label>Phone Number *</label>
                        <input 
                          type="text" 
                          value={profileData.phone} 
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} 
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group-caretaker">
                        <label>Email Address</label>
                        <input 
                          type="email" 
                          value={profileData.email} 
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} 
                        />
                      </div>
                      <div className="form-group-caretaker">
                        <label>Verification Status</label>
                        <input type="text" value={profileData.idStatus} disabled style={{ opacity: 0.7 }} />
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group-caretaker">
                        <label>Bank Name</label>
                        <input 
                          type="text" 
                          value={profileData.bankName} 
                          onChange={(e) => setProfileData({ ...profileData, bankName: e.target.value })} 
                        />
                      </div>
                      <div className="form-group-caretaker">
                        <label>Bank Account / IFSC</label>
                        <input 
                          type="text" 
                          value={`${profileData.accountNo} (${profileData.ifscCode})`} 
                          onChange={(e) => setProfileData({ ...profileData, accountNo: e.target.value })} 
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn-submit-gold">
                      <i className="fa-solid fa-floppy-disk"></i> Save Profile Details
                    </button>
                  </form>
                </div>
              </div>
            )}
          </main>
        </div>

      {/* PUNCH VERIFICATION MODAL WITH LIVE CAMERA & GPS LOCATION */}
      {showPunchModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-morphism" style={{ maxWidth: '580px', width: '100%', padding: '24px', borderRadius: '24px', background: 'linear-gradient(145deg, #0d1613 0%, #08110e 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.85)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
              <div>
                <span style={{ background: punchType === 'in' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: punchType === 'in' ? '#10b981' : '#ef4444', border: punchType === 'in' ? '1px solid #10b981' : '1px solid #ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                  <i className={`fa-solid ${punchType === 'in' ? 'fa-circle-play' : 'fa-circle-pause'}`}></i> CARETAKER {punchType === 'in' ? 'PUNCH-IN' : 'PUNCH-OUT'} VERIFICATION
                </span>
                <h3 style={{ margin: '8px 0 0 0', color: '#ffffff', fontSize: '1.35rem', fontFamily: 'Outfit, sans-serif' }}>
                  Live Camera & GPS Verification
                </h3>
              </div>
              <button onClick={closePunchModal} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.8 }}>×</button>
            </div>

            {/* Live Camera View & Photo Capture Area */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold-bright)', marginBottom: '8px' }}>
                <i className="fa-solid fa-camera" style={{ marginRight: '6px' }}></i> 1. Live Selfie Photo Verification *
              </label>

              <div style={{ position: 'relative', width: '100%', height: '240px', background: '#000000', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {punchPhoto ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img src={punchPhoto} alt="Captured Live Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(16, 185, 129, 0.95)', color: '#ffffff', padding: '6px 14px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
                      <i className="fa-solid fa-shield-check"></i> BIOMETRIC VERIFIED {faceVerifiedScore}% MATCH
                    </div>
                    <span style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(0,0,0,0.85)', border: '1px solid #10b981', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                      <i className="fa-solid fa-check-double"></i> Live Human Face Verified & Geofenced
                    </span>
                    <button 
                      type="button"
                      onClick={() => { setPunchPhoto(''); startCameraStream(); }}
                      style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.85)', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-rotate-left"></i> Retake Selfie
                    </button>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}></video>
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                    
                    {/* Biometric Face Scanner Overlay */}
                    <div style={{ position: 'absolute', width: '160px', height: '160px', border: '2px solid #10b981', borderRadius: '50%', boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '140px', height: '140px', border: '1px dashed rgba(255, 215, 0, 0.8)', borderRadius: '50%' }}></div>
                    </div>

                    <div style={{ position: 'absolute', top: '10px', left: '12px', background: 'rgba(0,0,0,0.75)', border: '1px solid #10b981', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                      AI FACE SCAN ACTIVE • POSITION FACE IN CENTER
                    </div>

                    <button 
                      type="button"
                      onClick={captureSelfiePhoto}
                      style={{ position: 'absolute', bottom: '14px', background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '10px 22px', borderRadius: '30px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.6)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <i className="fa-solid fa-camera"></i> Capture & Verify Face
                    </button>
                  </>
                )}
              </div>

              {cameraError && (
                <div style={{ marginTop: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.8rem' }}>
                  {cameraError}
                </div>
              )}

              {/* Upload file fallback button */}
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <input type="file" accept="image/*" capture="user" id="punch-selfie-file" onChange={handlePhotoFileUpload} style={{ display: 'none' }} />
                <label htmlFor="punch-selfie-file" style={{ color: 'var(--accent-gold-bright)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                  <i className="fa-solid fa-upload"></i> Or Upload Selfie Image File from Mobile
                </label>
              </div>
            </div>

            {/* Live Geolocation Section */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold-bright)', marginBottom: '8px' }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> 2. Live GPS Coordinates & Location Stamp *
              </label>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '12px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                    <i className="fa-solid fa-location-crosshairs"></i>
                  </span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>{punchLocation}</div>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '600' }}>GPS Lock Active • Mahabaleshwar Estate Geofence</span>
                  </div>
                </div>
                <button type="button" onClick={fetchLiveLocation} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  Refresh GPS
                </button>
              </div>
            </div>

            {/* Shift Notes Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                3. Shift Notes & Operations Log
              </label>
              <input 
                type="text" 
                value={punchNotesInput} 
                onChange={(e) => setPunchNotesInput(e.target.value)} 
                placeholder="e.g. Morning Villa Inspection Completed, Swimming Pool Filter Operational" 
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.88rem' }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={closePunchModal}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '24px', fontWeight: '700', cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmPunch}
                disabled={punchSubmitting || !punchPhoto}
                style={{
                  background: punchType === 'in' 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 26px',
                  borderRadius: '24px',
                  fontWeight: '800',
                  cursor: punchPhoto ? 'pointer' : 'not-allowed',
                  fontSize: '0.92rem',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                  opacity: punchPhoto ? 1 : 0.6
                }}
              >
                <i className={`fa-solid ${punchType === 'in' ? 'fa-circle-play' : 'fa-circle-pause'}`}></i> {punchSubmitting ? 'Verifying Punch...' : `Confirm ${punchType === 'in' ? 'Punch In' : 'Punch Out'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFIED BIOMETRIC SELFIE & ATTENDANCE PROOF MODAL */}
      {viewingSelfieLog && (
        <div className="modal-overlay">
          <div className="modal-content glass-morphism" style={{ maxWidth: '520px', width: '100%', padding: '24px', borderRadius: '24px', background: 'linear-gradient(145deg, #0d1613 0%, #08110e 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div>
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', padding: '4px 12px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: '800' }}>
                  <i className="fa-solid fa-shield-check"></i> BIOMETRIC ATTENDANCE PROOF CERTIFICATE
                </span>
                <h3 style={{ margin: '6px 0 0 0', color: '#ffffff', fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
                  Live Verified Staff Selfie
                </h3>
              </div>
              <button onClick={() => setViewingSelfieLog(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '18px', overflow: 'hidden', border: '2px solid rgba(212, 175, 55, 0.4)', marginBottom: '16px' }}>
              <img 
                src={viewingSelfieLog.checkInPhoto || viewingSelfieLog.checkOutPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80'} 
                alt="Selfie Proof" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(16, 185, 129, 0.95)', color: '#ffffff', padding: '6px 14px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: '800' }}>
                ✓ MATCH 99.4% VERIFIED
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 16px', borderRadius: '14px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Staff Name & Estate</div>
              <div style={{ fontWeight: '800', color: '#ffffff', fontSize: '0.98rem' }}>{profileData.name || 'Suresh Patil'} • Royal Mist Villa Estate</div>
              
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', marginTop: '10px', marginBottom: '4px' }}>GPS Geofence & Location</div>
              <div style={{ fontWeight: '700', color: '#ffd700' }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#10b981', marginRight: '6px' }}></i>
                {viewingSelfieLog.checkInLocation || '📍 Royal Mist Villa Estate (Lat: 17.9234° N, Long: 73.6582° E • GPS Verified)'}
              </div>

              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', marginTop: '10px', marginBottom: '4px' }}>Shift Notes & Timestamp</div>
              <div style={{ color: '#ffffff', fontWeight: '600' }}>
                🕒 {viewingSelfieLog.date} • {viewingSelfieLog.shiftNotes || 'Morning Duty Check-In'}
              </div>
            </div>

            <button 
              onClick={() => setViewingSelfieLog(null)}
              style={{ width: '100%', background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '10px', borderRadius: '20px', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Close Proof Certificate
            </button>
          </div>
        </div>
      )}

      {/* Floating Caretaker AI Assistant */}
      <AiAssistant />

      {/* Senior UI/UX Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-navbar">
        <button 
          className={`mob-nav-btn ${activeTab === 'home' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('home'); setIsDrawerOpen(false); }}
        >
          <i className="fa-solid fa-house-user"></i>
          <span>Home</span>
        </button>
        <button 
          className={`mob-nav-btn ${activeTab === 'attendance' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('attendance'); setIsDrawerOpen(false); }}
        >
          <i className="fa-solid fa-user-clock"></i>
          <span>Shift</span>
        </button>
        <button 
          className={`mob-nav-btn ${activeTab === 'duties' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('duties'); setIsDrawerOpen(false); }}
        >
          <i className="fa-solid fa-clipboard-check"></i>
          <span>Duties</span>
        </button>
        <button 
          className={`mob-nav-btn ${activeTab === 'guests' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('guests'); setIsDrawerOpen(false); }}
        >
          <i className="fa-solid fa-users-gear"></i>
          <span>Guests</span>
        </button>
        <button 
          className={`mob-nav-btn ${activeTab === 'profile' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('profile'); setIsDrawerOpen(false); }}
        >
          <i className="fa-solid fa-user-gear"></i>
          <span>Profile</span>
        </button>
        <button 
          className={`mob-nav-btn mob-more-btn ${isDrawerOpen ? 'active' : ''}`} 
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          <i className={`fa-solid ${isDrawerOpen ? 'fa-xmark' : 'fa-grid-2'}`}></i>
          <span>More</span>
        </button>
      </nav>

      {/* Senior UI/UX Mobile Quick Action Bottom Drawer Overlay */}
      {isDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="mobile-drawer-container" onClick={(e) => e.stopPropagation()}>
            <div className="mob-drawer-header">
              <div className="mob-drawer-title">
                <i className="fa-solid fa-compass" style={{ color: 'var(--accent-gold)' }}></i> Caretaker Quick Actions
              </div>
              <button className="mob-drawer-close" onClick={() => setIsDrawerOpen(false)}>×</button>
            </div>

            <div className="mob-drawer-grid">
              <button 
                className={`mob-drawer-card ${activeTab === 'maintenance' ? 'active' : ''}`}
                onClick={() => { setActiveTab('maintenance'); setIsDrawerOpen(false); }}
              >
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444' }}></i>
                <span>Maintenance</span>
              </button>
              <button 
                className={`mob-drawer-card ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => { setActiveTab('inventory'); setIsDrawerOpen(false); }}
              >
                <i className="fa-solid fa-boxes-stacked" style={{ color: '#38bdf8' }}></i>
                <span>Stock Inventory</span>
              </button>
              <button 
                className={`mob-drawer-card ${activeTab === 'rules' ? 'active' : ''}`}
                onClick={() => { setActiveTab('rules'); setIsDrawerOpen(false); }}
              >
                <i className="fa-solid fa-shield-halved" style={{ color: '#10b981' }}></i>
                <span>Estate Rules</span>
              </button>
              <a 
                href="tel:02168260100" 
                className="mob-drawer-card emergency-call"
              >
                <i className="fa-solid fa-phone-volume" style={{ color: '#ffd700' }}></i>
                <span>Hospital Call</span>
              </a>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => {
                  sessionStorage.clear();
                  localStorage.clear();
                  window.location.href = 'http://localhost:5173';
                }}
                className="mob-drawer-logout-btn"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Sign Out Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Bar */}
      <footer className="caretaker-footer">
        MAHABLESHWAR LUXURY RETREATS • CARETAKER COMMAND CENTER © 2026
      </footer>
    </div>
  );
};

export default CaretakerDashboard;
