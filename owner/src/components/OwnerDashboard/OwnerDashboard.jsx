import React, { useState, useEffect, lazy, Suspense } from 'react';
import AiAssistant from '../AiAssistant/AiAssistant';
import RoomsAvailability from './RoomsAvailability';
import GuestOperations from './GuestOperations';
import OwnerFinance from './OwnerFinance';
import SalesSnapshot from '../Sales/SalesSnapshot';
// Owner Dashboard Component - Mahabaleshwar Luxury Stays
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, GUEST_SITE_URL } from '../../config';
import './OwnerDashboard.css';

// Sales modules load on first use to keep the dashboard's first paint light.
const SalesDesk = lazy(() => import('../Sales/SalesDesk'));
const OffersAddOns = lazy(() => import('../Sales/OffersAddOns'));
const moduleFallback = <p style={{ color: 'var(--od-muted)' }}>Loading…</p>;

// Guest requirements arrive as plain strings from the API; older records used
// { label, done } objects. Normalise both so the caretaker tab never crashes.
const guestRequirementList = guest => (Array.isArray(guest.specialRequests)
  ? guest.specialRequests
  : (guest.requests || []).map(item => (typeof item === 'string' ? { label: item, done: false } : item)));
const bookingGuestName = booking => booking.user?.name || booking.guest?.name || 'Guest';

const OwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isCardsHidden, setIsCardsHidden] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals & Forms state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const PRESET_AMENITIES = [
    'Private Swimming Pool',
    'Free High-Speed Wi-Fi',
    'Mountain & Valley View',
    'Complimentary Breakfast',
    'Air Conditioning (AC)',
    'Free Private Parking',
    'BBQ & Grilling Setup',
    'Lawn & Private Garden',
    '24/7 Power Backup',
    'Night Bonfire & Campfire',
    'Personal Chef / Caretaker',
    'Equipped Kitchen',
    '24/7 Hot Water',
    'Pet Friendly Stay',
    'Indoor Games & Carrom',
    'CCTV Security'
  ];

  const [customAmenityInput, setCustomAmenityInput] = useState('');

  // Guest stay-pass details shown to the customer on their trip page. Edited
  // separately from the main property form so existing resets stay untouched.
  const emptyStayInfo = { checkInTime: '', checkOutTime: '', wifiName: '', wifiPassword: '', houseRules: '', arrivalNotes: '', foodInfo: '' };
  const [stayInfoForm, setStayInfoForm] = useState(emptyStayInfo);

  const [propertyForm, setPropertyForm] = useState({
    name: '',
    type: 'Villa',
    location: 'Mahabaleshwar',
    price: 15000,
    mapLink: '',
    amenities: [],
    photos: [],
    videos: ''
  });

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    bio: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Search & Filter States
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [propertyFilterType, setPropertyFilterType] = useState('All');
  const [bookingFilterStatus, setBookingFilterStatus] = useState('All');

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!userStr || !token) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(userStr);
    setUser(parsedUser);
    setProfileForm({
      name: parsedUser.name || '',
      phone: parsedUser.phone || '',
      bio: parsedUser.bio || ''
    });

    fetchOwnerData(token);
  }, [navigate]);

  // Caretaker Application State
  const [showCaretakerModal, setShowCaretakerModal] = useState(false);
  const [viewingCaretakerApp, setViewingCaretakerApp] = useState(null);
  const [caretakerApps, setCaretakerApps] = useState([]);
  const [submittingCaretaker, setSubmittingCaretaker] = useState(false);
  const [caretakerForm, setCaretakerForm] = useState({
    propertyId: '',
    propertyName: '',
    propertyAddress: '',
    positionRole: 'Chief Villa Caretaker Host',
    phone: '',
    experience: '3 - 5 Years',
    skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation', '24/7 Gate & Estate Security'],
    govtIdType: 'Aadhaar Card',
    govtId: '',
    bio: ''
  });

  // Caretaker Daily Tasks & Guest Requirements State (fetched from backend, synced with Caretaker Dashboard)
  const [ownerDuties, setOwnerDuties] = useState([]);
  const [ownerGuestReqs, setOwnerGuestReqs] = useState([]);
  const [ownerInventory, setOwnerInventory] = useState([]);
  const [caretakerDataLoading, setCaretakerDataLoading] = useState(true);
  const [assignedCaretaker, setAssignedCaretaker] = useState(null);
  const [touristRegisterList, setTouristRegisterList] = useState([]);
  const [touristFeedbackList, setTouristFeedbackList] = useState([]);
  const [revenueYear, setRevenueYear] = useState('2026');
  const [estOccupancy, setEstOccupancy] = useState(70);
  const [customAvgRate, setCustomAvgRate] = useState(15000);

  // Modals and Form States for Owner Caretaker Task Assignment
  const [showAddTaskModalOwner, setShowAddTaskModalOwner] = useState(false);
  const [showAddReqModalOwner, setShowAddReqModalOwner] = useState(false);
  const [newOwnerTask, setNewOwnerTask] = useState({
    title: '',
    category: 'Housekeeping',
    time: '10:00 AM',
    priority: 'High'
  });
  const [newOwnerGuestReq, setNewOwnerGuestReq] = useState({
    guestId: '',
    label: ''
  });

  // Handlers for Task & Guest Requirement Management
  const handleOwnerAddTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newOwnerTask.title.trim()) return;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE_URL}/caretaker-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({
          title: newOwnerTask.title.trim(),
          category: newOwnerTask.category,
          time: newOwnerTask.time || '10:00 AM',
          priority: newOwnerTask.priority
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to assign task');

      setOwnerDuties(prev => [data, ...prev]);
      setNewOwnerTask({ title: '', category: 'Housekeeping', time: '10:00 AM', priority: 'High' });
      setShowAddTaskModalOwner(false);
      setActionSuccess(`Daily task "${data.title}" assigned to the caretaker.`);
    } catch (err) {
      setError(err.message || 'Failed to assign task to caretaker');
    }
  };

  const handleOwnerDeleteTask = async (id) => {
    if (!window.confirm('Remove this daily task from the caretaker checklist?')) return;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE_URL}/caretaker-tasks/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.msg || 'Failed to remove task');
      }
      setOwnerDuties(prev => prev.filter(d => d.id !== id && d._id !== id));
      setActionSuccess('Task removed from the caretaker checklist.');
    } catch (err) {
      setError(err.message || 'Failed to remove task');
    }
  };

  const handleOwnerAddGuestReqSubmit = async (e) => {
    e.preventDefault();
    if (!newOwnerGuestReq.label.trim()) return;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE_URL}/guest-requirements/${newOwnerGuestReq.guestId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ label: newOwnerGuestReq.label.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to assign requirement');

      setOwnerGuestReqs(prev => prev.map(g => (g.id === newOwnerGuestReq.guestId ? data : g)));
      setNewOwnerGuestReq({ guestId: ownerGuestReqs[0]?.id || '', label: '' });
      setShowAddReqModalOwner(false);
      setActionSuccess('Requirement assigned and synced to the caretaker.');
    } catch (err) {
      setError(err.message || 'Failed to assign guest requirement');
    }
  };

  const handleOwnerDeleteGuestReq = async (guestId, reqIdx) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/guest-requirements/${guestId}/requests/${reqIdx}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.msg || 'Failed to remove requirement');
      }
      setOwnerGuestReqs(prev => prev.map(g => {
        if (g.id !== guestId) return g;
        return { ...g, specialRequests: undefined, requests: guestRequirementList(g).filter((_, idx) => idx !== reqIdx) };
      }));
      setActionSuccess('Guest requirement removed.');
    } catch (err) {
      setError(err.message || 'Failed to remove guest requirement');
    }
  };

  const handleOwnerRestockStock = async (id, amount = 5) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${id}/restock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ quantity: amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to restock item');

      setOwnerInventory(prev => prev.map(item => ((item._id || item.id) === id ? data : item)));
      setActionSuccess('Inventory restocked and updated.');
    } catch (err) {
      setError(err.message || 'Failed to restock inventory item');
    }
  };

  const handleUpdateTouristStatus = async (id, status) => {
    const rawToken = sessionStorage.getItem('token') || localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/^["']|["']$/g, '').trim() : '';
    try {
      const res = await fetch(`${API_BASE_URL}/tourist-register/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setTouristRegisterList(prev => prev.map(t => ((t._id === id || t.id === id) ? updated : t)));
        setActionSuccess(`Tourist guest status updated to ${status}.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openWhatsAppOwnerToCaretaker = (app) => {
    const caretakerPhone = app?.assignedCaretakerPhone || '+91 98901 23456';
    const caretakerName = app?.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)';
    const ownerName = user?.name || 'Property Owner';
    const propertyName = app?.propertyName || 'Villa Estate';

    const msg = `Hello ${caretakerName},\n\nI am ${ownerName}, owner of *${propertyName}*. Reaching out regarding caretaker services & property management.\n- Sent via Mahabaleshwar Owner Portal`;

    let cleanPhone = caretakerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const fetchOwnerData = async (token) => {
    setLoading(true);
    setError('');
    const authToken = token || sessionStorage.getItem('token') || localStorage.getItem('token');

    try {
      // 1. Fetch Owner Properties
      const propRes = await fetch(`${API_BASE_URL}/properties/my-properties`, {
        headers: { 'x-auth-token': authToken }
      });
      if (!propRes.ok) throw new Error('Could not load owner properties. Please sign in again or check the backend.');
      const propData = await propRes.json();
      if (Array.isArray(propData)) {
        setProperties(propData);
      }

      // 2. Fetch Owner Bookings
      const bookRes = await fetch(`${API_BASE_URL}/bookings/owner`, {
        headers: { 'x-auth-token': authToken }
      });
      if (!bookRes.ok) throw new Error('Could not load owner bookings. Please sign in again or check the backend.');
      const bookData = await bookRes.json();
      if (Array.isArray(bookData)) {
        setBookings(bookData);
      }

      // 3. Fetch Caretaker Applications
      const caretakerRes = await fetch(`${API_BASE_URL}/caretaker/my-applications`, {
        headers: { 'x-auth-token': authToken }
      });
      if (caretakerRes.ok) {
        const appsData = await caretakerRes.json();
        if (Array.isArray(appsData)) {
          setCaretakerApps(appsData);
        }
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
      setError('Failed to load dashboard data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }

    fetchCaretakerOpsData(authToken);
  };

  // Fetches the caretaker's assigned profile, daily task checklist, guest
  // requirements, and consumable inventory from the backend.
  const fetchCaretakerOpsData = async (token) => {
    setCaretakerDataLoading(true);
    try {
      const [tasksRes, reqsRes, inventoryRes, profileRes, touristRes, feedbackRes] = await Promise.all([
        fetch(`${API_BASE_URL}/caretaker-tasks/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/guest-requirements/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/inventory/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/caretaker/assigned-profile`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/tourist-register/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/feedback/owner`, { headers: { 'x-auth-token': token } })
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        if (Array.isArray(tasksData)) setOwnerDuties(tasksData);
      }
      if (reqsRes.ok) {
        const reqsData = await reqsRes.json();
        if (Array.isArray(reqsData)) setOwnerGuestReqs(reqsData);
      }
      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        if (Array.isArray(inventoryData)) setOwnerInventory(inventoryData);
      }
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setAssignedCaretaker(profileData || null);
      }
      if (touristRes && touristRes.ok) {
        const touristData = await touristRes.json();
        if (Array.isArray(touristData)) setTouristRegisterList(touristData);
      }
      if (feedbackRes && feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        if (Array.isArray(feedbackData)) setTouristFeedbackList(feedbackData);
      }
    } catch (err) {
      console.error('Error fetching caretaker operations data:', err);
    } finally {
      setCaretakerDataLoading(false);
    }
  };

  const handleCaretakerSubmit = async (e) => {
    e.preventDefault();
    const rawToken = sessionStorage.getItem('token') || localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/^["']|["']$/g, '').trim() : '';
    setError('');
    setActionSuccess('');

    if (!token) {
      setError('Session expired. Please sign in again to submit a caretaker application.');
      return;
    }

    // Strict 10-digit Indian Mobile Validation
    const cleanPhone = (caretakerForm.phone || '').trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Contact Phone Number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    // Govt ID Validation based on type
    const govtType = caretakerForm.govtIdType || 'Aadhaar Card';
    const cleanGovtId = (caretakerForm.govtId || '').trim();

    if (!cleanGovtId) {
      setError(`${govtType} number/details are required.`);
      return;
    }

    if (govtType === 'Aadhaar Card') {
      const cleanAadhaar = cleanGovtId.replace(/\D/g, '');
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setError('Aadhaar Card number must be exactly 12 digits (e.g. 123456789012).');
        return;
      }
    } else if (govtType === 'PAN Card') {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanGovtId.toUpperCase())) {
        setError('PAN Card must be 10 characters formatted as 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).');
        return;
      }
    } else if (govtType === 'Driving License') {
      if (!/^[A-Z0-9]{10,16}$/i.test(cleanGovtId)) {
        setError('Driving License number must be 10 to 16 alphanumeric characters (e.g. MH1220230012345).');
        return;
      }
    } else if (govtType === 'Voter ID Card') {
      if (!/^[A-Z]{3}[0-9]{7}$/i.test(cleanGovtId)) {
        setError('Voter ID Card format must be 3 letters followed by 7 digits (e.g. ABC1234567).');
        return;
      }
    }

    setSubmittingCaretaker(true);

    try {
      const payload = {
        ...caretakerForm,
        phone: cleanPhone,
        services: caretakerForm.skillsRequired || ['Guest Check-in', 'Maintenance'],
        govtId: `${govtType}: ${cleanGovtId.toUpperCase()}`
      };

      const response = await fetch(`${API_BASE_URL}/caretaker/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setActionSuccess(`Caretaker application submitted for "${caretakerForm.propertyName || 'Property'}"! Admin will assign and verify caretaker.`);
        setShowCaretakerModal(false);
        setCaretakerForm({
          propertyId: '',
          propertyName: '',
          phone: '',
          experience: '3+ Years',
          services: ['Guest Check-in', 'Maintenance', 'Housekeeping', '24/7 Security'],
          govtIdType: 'Aadhaar Card',
          govtId: '',
          bio: ''
        });

        const updatedRes = await fetch(`${API_BASE_URL}/caretaker/my-applications`, {
          headers: { 'x-auth-token': token }
        });
        if (updatedRes.ok) {
          const updatedApps = await updatedRes.json();
          if (Array.isArray(updatedApps)) setCaretakerApps(updatedApps);
        }
      } else {
        setError(data.msg || 'Failed to submit caretaker application.');
      }
    } catch (err) {
      setError('Network Error: Could not reach backend server for caretaker request.');
    } finally {
      setSubmittingCaretaker(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    navigate('/login', { replace: true });
    window.location.href = '/login';
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handlePhotoFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    try {
      const base64Images = await Promise.all(files.map(f => convertFileToBase64(f)));
      setPropertyForm(prev => ({
        ...prev,
        photos: [...(Array.isArray(prev.photos) ? prev.photos : []), ...base64Images]
      }));
    } catch (err) {
      console.error('Error reading image files:', err);
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPropertyForm(prev => ({
      ...prev,
      photos: Array.isArray(prev.photos) ? prev.photos.filter((_, idx) => idx !== indexToRemove) : []
    }));
  };

  const handleVideoFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    try {
      const base64Videos = await Promise.all(files.map(f => convertFileToBase64(f)));
      setPropertyForm(prev => ({
        ...prev,
        videos: [...(Array.isArray(prev.videos) ? prev.videos : []), ...base64Videos]
      }));
    } catch (err) {
      console.error('Error reading video files:', err);
    }
  };

  const handleRemoveVideo = (indexToRemove) => {
    setPropertyForm(prev => ({
      ...prev,
      videos: Array.isArray(prev.videos) ? prev.videos.filter((_, idx) => idx !== indexToRemove) : []
    }));
  };

  const handleToggleSelectFeedback = async (fbId) => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/feedback/${fbId}/toggle-select`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      if (res.ok) {
        setTouristFeedbackList(prev => prev.map(item => {
          const idMatches = (item._id === fbId) || (item.id === fbId);
          if (idMatches) {
            return { ...item, selectedForHotelPage: !item.selectedForHotelPage };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error('Failed to toggle feedback selection:', err);
    }
  };

  const handleToggleAmenity = (amenityName) => {
    setPropertyForm(prev => {
      const current = prev.amenities || [];
      const exists = current.includes(amenityName);
      const updated = exists
        ? current.filter(a => a !== amenityName)
        : [...current, amenityName];
      return { ...prev, amenities: updated };
    });
  };

  const handleAddCustomAmenity = (e) => {
    e.preventDefault();
    if (!customAmenityInput.trim()) return;
    const trimmed = customAmenityInput.trim();
    if (!propertyForm.amenities?.includes(trimmed)) {
      setPropertyForm(prev => ({
        ...prev,
        amenities: [...(prev.amenities || []), trimmed]
      }));
    }
    setCustomAmenityInput('');
  };

  // Add / Edit Property Submission
  const handleSaveProperty = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    setError('');
    setActionSuccess('');

    const trimmedPropName = (propertyForm.name || '').trim();
    if (!trimmedPropName || trimmedPropName.length < 3) {
      setError('Property / Villa Name is required and must be at least 3 characters.');
      return;
    }

    const priceNum = Number(propertyForm.price);
    if (!propertyForm.price || isNaN(priceNum) || priceNum <= 0) {
      setError('Expected price per night must be a valid positive number (min ₹1).');
      return;
    }

    if (propertyForm.mapLink && !/^(https?:\/\/)?([\w\d.-]+)+([\w\d\-._~:/?#[\]@!$&'()*+,;=.]+)?$/i.test(propertyForm.mapLink.trim())) {
      setError('Please provide a valid Google Maps location link starting with http:// or https://');
      return;
    }

    const photoList = Array.isArray(propertyForm.photos) ? propertyForm.photos : (propertyForm.photos ? propertyForm.photos.split(',').map(s => s.trim()).filter(Boolean) : []);
    if (!photoList || photoList.length === 0) {
      setError('At least 1 high-resolution property photo is required.');
      return;
    }

    const payload = {
      name: trimmedPropName,
      type: propertyForm.type,
      location: propertyForm.location,
      price: Math.max(1, Math.abs(parseInt(propertyForm.price) || 10000)),
      mapLink: propertyForm.mapLink || '',
      amenities: propertyForm.amenities || [],
      photos: photoList,
      videos: propertyForm.videos ? (Array.isArray(propertyForm.videos) ? propertyForm.videos : propertyForm.videos.split(',').map(s => s.trim()).filter(Boolean)) : [],
      stayInfo: {
        checkInTime: stayInfoForm.checkInTime.trim(),
        checkOutTime: stayInfoForm.checkOutTime.trim(),
        wifiName: stayInfoForm.wifiName.trim(),
        wifiPassword: stayInfoForm.wifiPassword.trim(),
        houseRules: stayInfoForm.houseRules.split('\n').map(r => r.trim()).filter(Boolean),
        arrivalNotes: stayInfoForm.arrivalNotes.trim(),
        foodInfo: stayInfoForm.foodInfo.trim()
      }
    };

    try {
      let url = `${API_BASE_URL}/properties/add`;
      let method = 'POST';

      if (editingProperty) {
        url = `${API_BASE_URL}/properties/${editingProperty._id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to save property');

      setActionSuccess(editingProperty ? 'Property details updated successfully!' : 'Property added successfully! Your new listing is pending Admin Approval before appearing on the public website.');
      setShowAddModal(false);
      setEditingProperty(null);
      setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', amenities: [], photos: [], videos: [] });
      setStayInfoForm(emptyStayInfo);
      fetchOwnerData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditClick = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name || '',
      type: prop.type || 'Villa',
      location: prop.location || 'Mahabaleshwar',
      price: prop.price || 15000,
      mapLink: prop.mapLink || '',
      amenities: prop.amenities || [],
      photos: prop.photos || [],
      videos: prop.videos || []
    });
    const info = prop.stayInfo || {};
    setStayInfoForm({
      checkInTime: info.checkInTime || '', checkOutTime: info.checkOutTime || '',
      wifiName: info.wifiName || '', wifiPassword: info.wifiPassword || '',
      houseRules: (info.houseRules || []).join('\n'), arrivalNotes: info.arrivalNotes || '', foodInfo: info.foodInfo || ''
    });
    setShowAddModal(true);
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm('Are you sure you want to remove this property listing?')) return;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/properties/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        setActionSuccess('Property removed successfully');
        fetchOwnerData(token);
      } else {
        const data = await res.json();
        setError(data.msg || 'Failed to delete property');
      }
    } catch (err) {
      setError('Server error deleting property');
    }
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    let cancelReason = '';

    if (newStatus === 'cancelled') {
      const input = prompt('Please enter the cancellation reason for the guest:');
      if (input === null) return; // Owner pressed cancel on prompt
      cancelReason = input.trim() || 'Cancelled by property owner';
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/status/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status: newStatus, reason: cancelReason })
      });

      if (res.ok) {
        setActionSuccess(`Booking status updated to ${newStatus}`);
        fetchOwnerData(token);
      } else {
        const data = await res.json();
        setError(data.msg || 'Failed to update booking status');
      }
    } catch (err) {
      setError('Error updating booking status');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');

    const trimmedName = (profileForm.name || '').trim();
    if (!trimmedName || trimmedName.length < 3) {
      setError('Owner Name is required and must be at least 3 characters.');
      return;
    }
    if (/\d/.test(trimmedName) || !/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
      setError('Owner Name cannot contain numbers or digits. Please enter alphabetic letters only.');
      return;
    }

    const cleanPhone = (profileForm.phone || '').trim().replace(/\D/g, '');
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Phone number must be a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setProfileSaving(true);
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(profileForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to update profile');

      const updatedUser = { ...user, name: data.name, phone: data.phone, bio: data.bio };
      setUser(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setActionSuccess('Host profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Stats Calculations
  const totalProperties = properties.length;
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => b.paymentStatus === 'paid' && ['live', 'manual'].includes(b.paymentMode) ? sum + (b.totalPrice || 0) : sum, 0);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const paidBookings = bookings.filter(b => b.paymentStatus === 'paid' && ['live', 'manual'].includes(b.paymentMode));
  const thisMonthRevenue = paidBookings.filter(b => {
    const date = new Date(b.paidAt || b.createdAt);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const revenueByMonth = Array.from({ length: 12 }, (_, month) => ({
    name: new Date(new Date().getFullYear(), month, 1).toLocaleDateString('en-IN', { month: 'short' }),
    amount: paidBookings.filter(b => {
      const date = new Date(b.paidAt || b.createdAt);
      return date.getFullYear() === new Date().getFullYear() && date.getMonth() === month;
    }).reduce((sum, b) => sum + (b.totalPrice || 0), 0)
  }));
  const maxMonthlyRevenue = Math.max(1, ...revenueByMonth.map(item => item.amount));

  // Bookings can be created from other tabs (e.g. a converted quotation), so
  // refresh them quietly when the owner returns to a bookings view.
  const refreshBookings = async () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/owner`, { headers: { 'x-auth-token': token } });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setBookings(data);
    } catch (err) {
      console.error('Bookings refresh failed:', err);
    }
  };

  const handleTabChange = (tabName) => {
    if (tabName === 'bookings' || tabName === 'overview') refreshBookings();
    setActiveTab(tabName);
    setPropertySearchQuery('');
    setPropertyFilterType('All');
    setBookingFilterStatus('All');
    setIsDrawerOpen(false);
  };

  return (
    <div className="owner-dashboard-container">
      <div className="owner-dashboard-layout">
        {/* Permanent Left Sidebar Navigation */}
        <aside className={`owner-sidebar ${isDrawerOpen ? 'show-mobile' : ''}`}>
          <div className="sidebar-brand">
            <div className="brand-logo">
              <i className="fa-solid fa-hotel"></i>
            </div>
            <div className="brand-text">
              <h2>MAHABALESHWAR</h2>
              <span>PROPERTY OWNER PORTAL</span>
            </div>
          </div>

          <div className="user-profile-badge">
            <div className="avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="user-info">
              <h4>{user?.name || 'Owner'}</h4>
              <span className="role-tag"><i className="fa-solid fa-circle-check"></i> Verified Host</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => handleTabChange('overview')}
            >
              <i className="fa-solid fa-chart-line"></i> Overview
            </button>
            <button className={`nav-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => handleTabChange('sales')}>
              <i className="fa-solid fa-handshake"></i> Inquiries & Quotes
            </button>
            <button
              className={`nav-btn ${activeTab === 'properties' ? 'active' : ''}`}
              onClick={() => handleTabChange('properties')}
            >
              <i className="fa-solid fa-building-user"></i> Properties
            </button>
            <button
              className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => handleTabChange('bookings')}
            >
              <i className="fa-solid fa-calendar-check"></i> Bookings
            </button>
            <button className={`nav-btn ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => handleTabChange('rooms')}>
              <i className="fa-solid fa-bed"></i> Rooms & Availability
            </button>
            <button className={`nav-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => handleTabChange('operations')}>
              <i className="fa-solid fa-concierge-bell"></i> Guest Operations
            </button>
            <button
              className={`nav-btn ${activeTab === 'tourists' ? 'active' : ''}`}
              onClick={() => handleTabChange('tourists')}
            >
              <i className="fa-solid fa-users-viewfinder"></i> Tourist Register
            </button>
            <button
              className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => handleTabChange('inventory')}
            >
              <i className="fa-solid fa-boxes-stacked"></i> Inventory
            </button>
            <button
              className={`nav-btn ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => handleTabChange('feedback')}
            >
              <i className="fa-solid fa-comments"></i> Feedback
            </button>
            <button
              className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => handleTabChange('analytics')}
            >
              <i className="fa-solid fa-wallet"></i> Payments & Reports
            </button>
            <button className={`nav-btn ${activeTab === 'offers' ? 'active' : ''}`} onClick={() => handleTabChange('offers')}>
              <i className="fa-solid fa-tags"></i> Offers & Add-ons
            </button>
            <button
              className={`nav-btn ${activeTab === 'caretakers' ? 'active' : ''}`}
              onClick={() => handleTabChange('caretakers')}
            >
              <i className="fa-solid fa-user-shield"></i> Caretakers
            </button>
            <button
              className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              <i className="fa-solid fa-user-gear"></i> Profile
            </button>
          </nav>

          <div className="sidebar-footer">
            <a href={GUEST_SITE_URL} className="main-site-btn" target="_blank" rel="noreferrer">
              <i className="fa-solid fa-globe"></i> View Main Site
            </a>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket"></i> Sign Out
            </button>
          </div>
        </aside>

        <div className={`sidebar-backdrop ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>

        {/* Main Content Area */}
        <main className="owner-main-content">
          <header className="content-header single-line-header">
            <div className="header-title-inline">
              <h1 className="header-title-text">
                {activeTab === 'overview' && <><i className="fa-solid fa-gauge-high"></i> Host Overview</>}
                {activeTab === 'sales' && <><i className="fa-solid fa-handshake"></i> Inquiries & Quotes</>}
                {activeTab === 'offers' && <><i className="fa-solid fa-tags"></i> Offers & Add-ons</>}
                {activeTab === 'properties' && <><i className="fa-solid fa-hotel"></i> Properties ({properties.length})</>}
                {activeTab === 'bookings' && <><i className="fa-solid fa-calendar-check"></i> Bookings ({bookings.length})</>}
                {activeTab === 'rooms' && <><i className="fa-solid fa-bed"></i> Rooms & Availability</>}
                {activeTab === 'operations' && <><i className="fa-solid fa-concierge-bell"></i> Guest Operations</>}
                {activeTab === 'caretakers' && <><i className="fa-solid fa-user-shield"></i> Caretaker Tasks & Requests ({caretakerApps.length})</>}
                {activeTab === 'tourists' && <><i className="fa-solid fa-users-viewfinder"></i> Tourist Register</>}
                {activeTab === 'inventory' && <><i className="fa-solid fa-boxes-stacked"></i> Inventory</>}
                {activeTab === 'feedback' && <><i className="fa-solid fa-comments"></i> Feedback</>}
                {activeTab === 'analytics' && <><i className="fa-solid fa-chart-line"></i> Payments & Reports</>}
                {activeTab === 'profile' && <><i className="fa-solid fa-user-gear"></i> Host Profile</>}
              </h1>
              <span className="header-divider">|</span>
              <span className="header-sub-inline">
                {activeTab === 'overview' && `Welcome back, ${user?.name || 'Host'}`}
                {activeTab === 'sales' && 'Leads, follow-ups and quotations'}
                {activeTab === 'offers' && 'Add-ons and promotions'}
                {activeTab === 'properties' && 'Listings & pricing'}
                {activeTab === 'bookings' && 'Reservations'}
                {activeTab === 'rooms' && 'Property-wise room inventory and calendar'}
                {activeTab === 'operations' && 'Arrivals, departures, staff and housekeeping'}
                {activeTab === 'caretakers' && 'Staff allocation & daily duties'}
                {activeTab === 'tourists' && 'Arrivals & headcount'}
                {activeTab === 'inventory' && 'Supplies & restocking'}
                {activeTab === 'feedback' && 'Ratings & reviews'}
                {activeTab === 'analytics' && 'Payment records and expenses'}
                {activeTab === 'profile' && 'Account settings'}
              </span>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="mobile-toggle-btn"
                onClick={() => setIsDrawerOpen(prev => !prev)}
                aria-label="Open navigation menu"
              >
                <i className="fa-solid fa-bars"></i>
              </button>

              <div className="top-profile-badge">
                <div className="avatar-circle">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'O'}
                </div>
                <div className="profile-text-group">
                  <span className="profile-name">{user?.name || 'Property Owner'}</span>
                  <span className="profile-role"><i className="fa-solid fa-shield-check"></i> Host</span>
                </div>
              </div>

              <button
                type="button"
                className="header-logout-btn"
                onClick={handleLogout}
                title="Sign Out of Host Account"
              >
                <i className="fa-solid fa-right-from-bracket"></i> <span>Sign Out</span>
              </button>

              <button
                type="button"
                className="btn-caretaker-emerald"
                onClick={() => {
                  setCaretakerForm({
                    propertyId: properties.length > 0 ? properties[0]._id : '',
                    propertyName: properties.length > 0 ? properties[0].name : '',
                    propertyAddress: properties.length > 0 ? (properties[0].location || 'Mahabaleshwar, Satara') : '',
                    positionRole: 'Chief Villa Caretaker Host',
                    phone: user?.phone || '',
                    experience: '3 - 5 Years',
                    skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation', '24/7 Gate & Estate Security'],
                    govtIdType: 'Aadhaar Card',
                    govtId: '',
                    bio: ''
                  });
                  setShowCaretakerModal(true);
                }}
              >
                <i className="fa-solid fa-user-shield"></i> Request Caretaker
              </button>
              {activeTab === 'properties' && (
                <button
                  type="button"
                  className="btn-primary-gold"
                  onClick={() => {
                    setEditingProperty(null);
                    setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', photos: [], videos: '' });
                    setStayInfoForm(emptyStayInfo);
                    setShowAddModal(true);
                  }}
                >
                  <i className="fa-solid fa-plus"></i> Add Property
                </button>
              )}
            </div>
          </header>

          {/* Global Notifications */}
          {actionSuccess && (
            <div className="alert-box success">
              <i className="fa-solid fa-circle-check"></i> {actionSuccess}
              <button onClick={() => setActionSuccess('')}><i className="fa-solid fa-xmark"></i></button>
            </div>
          )}

          {error && (
            <div className="alert-box error">
              <i className="fa-solid fa-circle-exclamation"></i> {error}
              <button onClick={() => setError('')}><i className="fa-solid fa-xmark"></i></button>
            </div>
          )}

          {loading ? (
            <div className="skeleton-loader-grid">
              <div className="skeleton-card-pulse"></div>
              <div className="skeleton-card-pulse"></div>
              <div className="skeleton-card-pulse"></div>
              <div className="skeleton-card-pulse"></div>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="tab-overview">
                  <SalesSnapshot onOpen={() => handleTabChange('sales')} />
                  {/* High Impact Property Overview Highlight Banner */}
                  {properties.length > 0 && <div className="property-overview-banner glass-morphism">
                    <div className="banner-image-container">
                      <img
                        src={properties[0].photos?.[0] || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80'}
                        alt="Primary Property Banner"
                      />
                      <div className="banner-type-tag">
                        <i className="fa-solid fa-building"></i> {properties[0].type || 'Property'}
                      </div>
                    </div>

                    <div className="banner-details">
                      <div className="banner-header-row">
                        <div>
                          <h2 className="banner-title">{properties[0].name}</h2>
                          <p className="banner-location">
                            <i className="fa-solid fa-location-dot"></i> {properties[0].location}
                            <span className="verified-chip">{properties[0].status}</span>
                          </p>
                        </div>
                      </div>

                      <div className="banner-stats-row">
                        <div className="banner-stat-chip">
                          <div className="chip-icon gold"><i className="fa-solid fa-chart-line"></i></div>
                          <div>
                            <span className="chip-label">Confirmed Bookings</span>
                            <span className="chip-value">{confirmedBookings}</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon emerald"><i className="fa-solid fa-calendar-check"></i></div>
                          <div>
                            <span className="chip-label">Active Reservations</span>
                            <span className="chip-value">{confirmedBookings}</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon blue"><i className="fa-solid fa-indian-rupee-sign"></i></div>
                          <div>
                            <span className="chip-label">Paid bookings this month</span>
                            <span className="chip-value">₹{thisMonthRevenue.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon yellow"><i className="fa-solid fa-users"></i></div>
                          <div>
                            <span className="chip-label">Pending Requests</span>
                            <span className="chip-value">{pendingBookings}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>}

                  {/* Stats Cards Grid */}
                  {!isCardsHidden && (
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon gold"><i className="fa-solid fa-vihara"></i></div>
                        <div className="stat-info">
                          <span className="stat-label">Listed Properties</span>
                          <h3 className="stat-value">{totalProperties}</h3>
                          <span className="stat-sub font-green">Saved properties</span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon emerald"><i className="fa-solid fa-calendar-days"></i></div>
                        <div className="stat-info">
                          <span className="stat-label">Total Reservations</span>
                          <h3 className="stat-value">{totalBookings}</h3>
                          <span className="stat-sub">{pendingBookings} pending confirmation</span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon yellow"><i className="fa-solid fa-indian-rupee-sign"></i></div>
                        <div className="stat-info">
                          <span className="stat-label">Gross Revenue</span>
                          <h3 className="stat-value">₹{totalRevenue.toLocaleString('en-IN')}</h3>
                          <span className="stat-sub font-green">Verified Paid Stays</span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon blue"><i className="fa-solid fa-user-check"></i></div>
                        <div className="stat-info">
                          <span className="stat-label">Host Status</span>
                          <h3 className="stat-value font-gold">Verified</h3>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analytics & Revenue Charts Section */}
                  <div className="revenue-analytics-grid">
                    <div className="chart-card-box glass-morphism">
                      <div className="chart-header">
                        <h3><i className="fa-solid fa-chart-area"></i> Paid Bookings by Month ({new Date().getFullYear()})</h3>
                        <div className="chart-legend">
                          <span><span className="legend-dot gold"></span> Booking value</span>
                        </div>
                      </div>

                      <div className="bar-chart-visual">
                        {revenueByMonth.map((b, i) => (
                          <div key={i} className="chart-bar-column">
                            <div className="bar-track">
                              <div className="bar-fill gold" style={{ height: `${Math.round(b.amount / maxMonthlyRevenue * 100)}%` }} title={`₹${b.amount.toLocaleString('en-IN')}`}></div>
                            </div>
                            <span className="bar-month-label">{b.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="chart-card-box glass-morphism">
                      <div className="chart-header">
                        <h3><i className="fa-solid fa-pie-chart"></i> Booking Status</h3>
                      </div>

                      <div className="progress-meters-list">
                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Confirmed</span>
                            <span className="meter-val">{confirmedBookings}</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill gold" style={{ width: `${totalBookings ? confirmedBookings / totalBookings * 100 : 0}%` }}></div>
                          </div>
                        </div>

                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Paid</span>
                            <span className="meter-val">{paidBookings.length}</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill emerald" style={{ width: `${totalBookings ? paidBookings.length / totalBookings * 100 : 0}%` }}></div>
                          </div>
                        </div>

                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Pending</span>
                            <span className="meter-val">{pendingBookings}</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill blue" style={{ width: `${totalBookings ? pendingBookings / totalBookings * 100 : 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Feed */}
                  <div className="revenue-analytics-grid">
                    <div className="activity-feed-card glass-morphism" style={{ gridColumn: '1 / -1' }}>
                      <div className="chart-header">
                        <h3><i className="fa-solid fa-clock-rotate-left"></i> Recent Reservations</h3>
                      </div>

                      <div className="activity-feed-list">
                        {bookings.length === 0 ? <p>No reservations yet.</p> : bookings.slice(0, 4).map(booking => <div className="activity-item-row" key={booking._id}>
                          <div className="activity-icon-badge emerald"><i className="fa-solid fa-calendar-check"></i></div>
                          <div className="activity-meta"><h4>{booking.status} booking · {bookingGuestName(booking)}</h4><p>{booking.property?.name || 'Property'} · {new Date(booking.checkIn).toLocaleDateString('en-IN')} to {new Date(booking.checkOut).toLocaleDateString('en-IN')}</p></div>
                          <span className="activity-time">{new Date(booking.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Content Section */}
                  <div className="overview-sections-grid">
                    {/* Recent Properties Preview */}
                    <div className="dashboard-card">
                      <div className="card-header">
                        <h3><i className="fa-solid fa-city"></i> Your Top Properties</h3>
                        <button className="text-btn" onClick={() => setActiveTab('properties')}>View All ({properties.length})</button>
                      </div>

                      {properties.length === 0 ? (
                        <div className="empty-state">
                          <i className="fa-solid fa-house-chimney-medical"></i>
                          <p>No properties listed yet.</p>
                          <button className="btn-secondary-sm" onClick={() => setShowAddModal(true)}>Add Your First Villa</button>
                        </div>
                      ) : (
                        <div className="properties-preview-list">
                          {properties.slice(0, 3).map(prop => (
                            <div key={prop._id} className="preview-prop-item">
                              <div className="prop-thumb">
                                {prop.photos && prop.photos.length > 0 ? (
                                  <img src={prop.photos[0]} alt={prop.name} />
                                ) : (
                                  <div className="no-img"><i className="fa-solid fa-image"></i></div>
                                )}
                              </div>
                              <div className="prop-details">
                                <h4>{prop.name}</h4>
                                <p><i className="fa-solid fa-location-dot"></i> {prop.location} • <span className="type-tag">{prop.type}</span></p>
                                <span className="price-tag">₹{prop.price?.toLocaleString('en-IN')} / night</span>
                              </div>
                              <div className="prop-status">
                                <span className={`status-badge ${prop.status}`}>{prop.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Bookings Preview */}
                    <div className="dashboard-card">
                      <div className="card-header">
                        <h3><i className="fa-solid fa-clock-rotate-left"></i> Recent Guest Bookings</h3>
                        <button className="text-btn" onClick={() => setActiveTab('bookings')}>Manage Bookings ({bookings.length})</button>
                      </div>

                      {bookings.length === 0 ? (
                        <div className="empty-state">
                          <i className="fa-solid fa-calendar-xmark"></i>
                          <p>No guest bookings received yet.</p>
                        </div>
                      ) : (
                        <div className="bookings-preview-list">
                          {bookings.slice(0, 4).map(b => (
                            <div key={b._id} className="preview-booking-item">
                              <div className="guest-avatar">
                                {bookingGuestName(b).charAt(0).toUpperCase()}
                              </div>
                              <div className="booking-info">
                                <h4>{bookingGuestName(b)}</h4>
                                <p className="property-title">{b.property?.name || 'Mahabaleshwar Stay'}</p>
                                <span className="dates">
                                  {new Date(b.checkIn).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(b.checkOut).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <div className="booking-right">
                                <span className="price">₹{b.totalPrice?.toLocaleString('en-IN')}</span>
                                <span className={`status-pill ${b.status}`}>{b.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MY PROPERTIES */}
              {activeTab === 'properties' && (
                <div className="tab-properties">
                  {/* Filter & Search Bar */}
                  <div className="portfolio-filter-bar">
                    <div className="search-box-wrap">
                      <i className="fa-solid fa-magnifying-glass"></i>
                      <input
                        type="text"
                        placeholder="Search property by name or location..."
                        value={propertySearchQuery}
                        onChange={(e) => setPropertySearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="type-filter-pills">
                      {['All', 'Villa', 'Hotel', 'Resort', 'Cabin'].map(t => (
                        <button
                          key={t}
                          className={`filter-pill-btn ${propertyFilterType === t ? 'active' : ''}`}
                          onClick={() => setPropertyFilterType(t)}
                        >
                          {t === 'All' ? 'All Types' : t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {properties.length === 0 ? (
                    <div className="empty-state-card glass-morphism">
                      <i className="fa-solid fa-tree-city"></i>
                      <h3>No Properties Listed Yet</h3>
                      <p>Start listing your Mahabaleshwar luxury villas, resorts, or cottages to receive bookings.</p>
                      <button className="btn-primary-gold" onClick={() => setShowAddModal(true)}>Add Property Now</button>
                    </div>
                  ) : (
                    <div className="properties-grid">
                      {properties
                        .filter(p => {
                          const matchesType = propertyFilterType === 'All' || p.type === propertyFilterType;
                          const matchesQuery = !propertySearchQuery ||
                            p.name?.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
                            p.location?.toLowerCase().includes(propertySearchQuery.toLowerCase());
                          return matchesType && matchesQuery;
                        })
                        .map(prop => (
                          <div key={prop._id} className="property-card glass-morphism">
                            <div className="card-image-wrap">
                              {prop.photos && prop.photos.length > 0 ? (
                                <img src={prop.photos[0]} alt={prop.name} />
                              ) : (
                                <div className="image-placeholder">
                                  <i className="fa-solid fa-image"></i> No Photos Uploaded
                                </div>
                              )}
                              <span className={`status-badge ${prop.status}`}>
                                <i className="fa-solid fa-circle"></i> {prop.status === 'approved' ? 'Approved & Live' : 'Pending Admin Approval'}
                              </span>
                              <span className="property-type-overlay">{prop.type}</span>
                            </div>

                            <div className="card-body">
                              <h3>{prop.name}</h3>
                              <p className="location">
                                <i className="fa-solid fa-location-dot"></i> {prop.location}
                              </p>

                              <div className="media-counts">
                                <span><i className="fa-solid fa-camera"></i> {prop.photos ? prop.photos.length : 0} Photos</span>
                                <span><i className="fa-solid fa-video"></i> {prop.videos ? prop.videos.length : 0} Videos</span>
                                {prop.mapLink && (
                                  <span className="gps-active-tag"><i className="fa-solid fa-map-location-dot"></i> Live Map GPS</span>
                                )}
                              </div>

                              {prop.amenities && prop.amenities.length > 0 && (
                                <div className="card-amenities-tags">
                                  {prop.amenities.slice(0, 3).map((am, i) => (
                                    <span key={i} className="amenity-mini-tag"><i className="fa-solid fa-circle-check"></i> {am}</span>
                                  ))}
                                  {prop.amenities.length > 3 && (
                                    <span className="amenity-mini-tag count">+{prop.amenities.length - 3} more</span>
                                  )}
                                </div>
                              )}

                              <div className="price-row">
                                <div className="price-amount-group">
                                  <span className="amount">₹{prop.price?.toLocaleString('en-IN')}</span>
                                  <span className="per-night">/ night</span>
                                </div>
                              </div>

                              <div className="card-actions">
                                <a
                                  href={`${GUEST_SITE_URL}/property/${prop._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-view-live"
                                  title="View on traveler site"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Preview
                                </a>
                                <button
                                  className="btn-edit"
                                  onClick={() => {
                                    setCaretakerForm(prev => ({
                                      ...prev,
                                      propertyId: prop._id,
                                      propertyName: prop.name
                                    }));
                                    setShowCaretakerModal(true);
                                  }}
                                  title="Apply for Caretaker for this property"
                                >
                                  <i className="fa-solid fa-user-shield"></i> Caretaker
                                </button>
                                <button className="btn-edit" onClick={() => handleEditClick(prop)}>
                                  <i className="fa-solid fa-pen-to-square"></i> Edit
                                </button>
                                <button className="btn-delete" onClick={() => handleDeleteProperty(prop._id)}>
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BOOKINGS */}
              {activeTab === 'rooms' && <RoomsAvailability />}
              {activeTab === 'sales' && <Suspense fallback={moduleFallback}><SalesDesk /></Suspense>}
              {activeTab === 'offers' && <Suspense fallback={moduleFallback}><OffersAddOns /></Suspense>}
              {activeTab === 'operations' && <GuestOperations />}
              {activeTab === 'bookings' && (
                <div className="tab-bookings">
                  {/* Booking Filter Bar */}
                  <div className="portfolio-filter-bar" style={{ marginBottom: '20px' }}>
                    <div className="type-filter-pills">
                      <span style={{ fontSize: '0.8rem', color: 'var(--od-muted)', marginRight: '6px' }}><i className="fa-solid fa-filter"></i> Filter Reservations:</span>
                      {['All', 'pending', 'confirmed', 'cancelled'].map(st => (
                        <button
                          key={st}
                          className={`filter-pill-btn ${bookingFilterStatus === st ? 'active' : ''}`}
                          onClick={() => setBookingFilterStatus(st)}
                        >
                          {st === 'All' ? 'All Stays' : st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="empty-state-card glass-morphism">
                      <i className="fa-solid fa-receipt"></i>
                      <h3>No Reservations Yet</h3>
                      <p>Bookings made by travelers for your listed properties will automatically show up here.</p>
                    </div>
                  ) : (
                    <div className="table-responsive glass-morphism">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Guest Details</th>
                            <th>Property & Stay Type</th>
                            <th>Stay Dates</th>
                            <th>Total Revenue</th>
                            <th>Payment Status</th>
                            <th>Booking Status</th>
                            <th>Host Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings
                            .filter(b => bookingFilterStatus === 'All' || b.status === bookingFilterStatus)
                            .map(b => {
                              const checkInDate = new Date(b.checkIn);
                              const checkOutDate = new Date(b.checkOut);
                              const nights = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
                              return (
                                <tr key={b._id}>
                                  <td>
                                    <div className="guest-cell">
                                      <div className="avatar-circle">
                                        {bookingGuestName(b).charAt(0).toUpperCase()}
                                      </div>
                                      <div className="guest-info-text">
                                        <strong>{bookingGuestName(b)}</strong>
                                        <span className="email">{b.user?.email || b.guest?.email}</span>
                                        {(b.user?.phone || b.guest?.phone) && <span className="phone"><i className="fa-solid fa-phone"></i> {b.user?.phone || b.guest?.phone}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="property-stay-cell">
                                      <strong>{b.property?.name || 'Mahabaleshwar Stay'}</strong>
                                      <span className="sub-location"><i className="fa-solid fa-location-dot"></i> {b.property?.location || 'Mahabaleshwar'}</span>
                                      <span className="sub-location">{b.room ? `Room ${b.room.number} · ${b.room.name}` : 'Room not assigned'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="date-cell">
                                      <span className="date-range">
                                        {checkInDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} → {checkOutDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                      </span>
                                      <span className="nights-badge">{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <strong className="price font-gold">₹{b.totalPrice?.toLocaleString('en-IN')}</strong>
                                  </td>
                                  <td>
                                    <span className={`payment-pill ${b.paymentStatus || 'pending'}`}>
                                      <i className="fa-solid fa-shield-check"></i> {b.paymentStatus || 'pending'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-pill ${b.status}`}>
                                      {b.status === 'confirmed' && <i className="fa-solid fa-circle-check"></i>}
                                      {b.status === 'pending' && <i className="fa-solid fa-clock"></i>}
                                      {b.status === 'cancelled' && <i className="fa-solid fa-circle-xmark"></i>}
                                      {b.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="action-buttons-group">
                                      {b.status !== 'confirmed' && (
                                        <button className="btn-action-confirm" onClick={() => handleUpdateBookingStatus(b._id, 'confirmed')}>
                                          <i className="fa-solid fa-check"></i> Confirm
                                        </button>
                                      )}
                                      {b.status !== 'cancelled' && (
                                        <button className="btn-action-cancel" onClick={() => handleUpdateBookingStatus(b._id, 'cancelled')}>
                                          <i className="fa-solid fa-xmark"></i> Cancel
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PAYMENTS & REPORTS */}
              {activeTab === 'analytics' && <OwnerFinance />}

              {/* TAB: CARETAKER HUB (TASKS & REQUESTS IN ONE PAGE) */}
              {activeTab === 'caretakers' && (
                <div className="tab-caretakers">
                  {/* Header Card */}
                  <div className="od-section-header glass-morphism">
                    <div className="od-section-header-left">
                      <div className="od-avatar-round"><i className="fa-solid fa-user-shield"></i></div>
                      <div>
                        <h3><i className="fa-solid fa-user-shield"></i> Caretaker Operations & Staff Hub</h3>
                        <p>Manage caretaker allocation requests sent to Admin, view assigned caretaker profiles, and track daily shift duties & guest requirements.</p>
                      </div>
                    </div>

                    <div className="od-header-btn-group">
                      <button
                        className="btn-pill-gold"
                        onClick={() => {
                          setCaretakerForm({
                            propertyId: properties.length > 0 ? properties[0]._id : '',
                            propertyName: properties.length > 0 ? properties[0].name : '',
                            propertyAddress: properties.length > 0 ? (properties[0].location || 'Mahabaleshwar, Satara') : '',
                            positionRole: 'Chief Villa Caretaker Host',
                            phone: user?.phone || '',
                            experience: '3 - 5 Years',
                            skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation', '24/7 Gate & Estate Security'],
                            govtIdType: 'Aadhaar Card',
                            govtId: '',
                            bio: ''
                          });
                          setShowCaretakerModal(true);
                        }}
                      >
                        <i className="fa-solid fa-paper-plane"></i> Send Request to Admin
                      </button>
                      <button className="btn-pill-emerald" onClick={() => setShowAddTaskModalOwner(true)}>
                        <i className="fa-solid fa-plus-circle"></i> Assign Daily Task
                      </button>
                    </div>
                  </div>

                  {/* Summary Stat Grid */}
                  <div className="od-mini-stats-grid">
                    <div className="od-mini-stat neutral glass-morphism">
                      <div className="lbl">Total Caretaker Requests</div>
                      <div className="val">{caretakerApps.length}</div>
                      <div className="sub">{caretakerApps.filter(a => a.status === 'approved').length} Approved • {caretakerApps.filter(a => a.status === 'pending').length} Pending</div>
                    </div>
                    <div className="od-mini-stat emerald glass-morphism">
                      <div className="lbl">Daily Shift Duties</div>
                      <div className="val">{ownerDuties.length} Tasks</div>
                      <div className="sub">{ownerDuties.filter(d => d.completed).length} Completed • {ownerDuties.filter(d => !d.completed).length} Pending</div>
                    </div>
                    <div className="od-mini-stat amber glass-morphism">
                      <div className="lbl">Guest Special Requests</div>
                      <div className="val">{ownerGuestReqs.reduce((sum, g) => sum + guestRequirementList(g).length, 0)} Total</div>
                      <div className="sub">{ownerGuestReqs.reduce((sum, g) => sum + guestRequirementList(g).filter(r => r.done).length, 0)} Completed</div>
                    </div>
                  </div>

                  {/* SECTION 1: CARETAKER ALLOCATION REQUESTS & PROFILES */}
                  <div className="od-panel glass-morphism" style={{ marginBottom: '28px' }}>
                    <div className="od-panel-head">
                      <div>
                        <h3><i className="fa-solid fa-user-shield"></i> Caretaker Allocation Requests & Profiles</h3>
                        <p>Official requests submitted to Admin and allocated caretaker profile details.</p>
                      </div>
                      <button
                        className="btn-mini-gold"
                        onClick={() => {
                          setCaretakerForm({
                            propertyId: properties.length > 0 ? properties[0]._id : '',
                            propertyName: properties.length > 0 ? properties[0].name : '',
                            propertyAddress: properties.length > 0 ? (properties[0].location || 'Mahabaleshwar, Satara') : '',
                            positionRole: 'Chief Villa Caretaker Host',
                            phone: user?.phone || '',
                            experience: '3 - 5 Years',
                            skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation', '24/7 Gate & Estate Security'],
                            govtIdType: 'Aadhaar Card',
                            govtId: '',
                            bio: ''
                          });
                          setShowCaretakerModal(true);
                        }}
                      >
                        + Request Caretaker
                      </button>
                    </div>

                    {caretakerApps.length === 0 ? (
                      <div className="empty-state-card glass-morphism">
                        <i className="fa-solid fa-user-shield"></i>
                        <h3>No Caretaker Requests Sent Yet</h3>
                        <p>You have not sent any caretaker requests to the Admin Panel. Click below to request dedicated staff for your property stays.</p>
                        <button className="btn-pill-gold" onClick={() => setShowCaretakerModal(true)}>
                          <i className="fa-solid fa-paper-plane"></i> Send Request to Admin Panel
                        </button>
                      </div>
                    ) : (
                      <div className="caretaker-apps-grid">
                        {caretakerApps.map((app, idx) => (
                          <div key={app._id || idx} className="caretaker-app-card glass-morphism">
                            <div>
                              <div className="caretaker-app-card-top">
                                <h4><i className="fa-solid fa-building-user"></i> {app.propertyName}</h4>
                                <span className={`od-status-badge ${app.status === 'approved' ? 'approved' : app.status === 'rejected' ? 'rejected' : 'pending'}`}>
                                  {app.status === 'approved' ? 'Allocated' : app.status === 'rejected' ? 'Rejected' : 'Pending'}
                                </span>
                              </div>

                              <p className="caretaker-app-address">
                                <i className="fa-solid fa-location-dot"></i> {app.propertyAddress || 'Mahabaleshwar, Satara'}
                              </p>

                              <div className="caretaker-app-role-box">
                                <span className="lbl">Requested Role</span>
                                <div className="role">{app.positionRole || 'Chief Caretaker Host'}</div>
                                <div className="exp">Experience: {app.experience || '3 - 5 Years'}</div>
                              </div>

                              {app.assignedCaretakerName && (
                                <div className="caretaker-assigned-box">
                                  <div className="lbl"><i className="fa-solid fa-circle-check"></i> Admin Allocated Caretaker</div>
                                  <div className="name">{app.assignedCaretakerName}</div>
                                  <div className="phone">{app.assignedCaretakerPhone || '+91 98901 23456'}</div>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--od-hairline)' }}>
                              <button className="btn-whatsapp" onClick={() => openWhatsAppOwnerToCaretaker(app)}>
                                <i className="fa-brands fa-whatsapp"></i> WhatsApp Caretaker
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: DAILY SHIFT DUTIES ASSIGNED TO CARETAKER */}
                  <div className="od-panel glass-morphism" style={{ marginBottom: '28px' }}>
                    <div className="od-panel-head">
                      <div>
                        <h3><i className="fa-solid fa-list-check"></i> Daily Shift Tasks Assigned to Caretaker</h3>
                        <p>Caretaker checks off tasks in real-time. Completed items lock automatically.</p>
                      </div>
                      <button className="btn-mini-gold" onClick={() => setShowAddTaskModalOwner(true)}>+ Assign Task</button>
                    </div>

                    <div>
                      {ownerDuties.map(d => (
                        <div key={d.id} className={`task-row ${d.completed ? 'done' : ''}`}>
                          <div className="task-row-left">
                            <span className="task-icon-circle">
                              <i className={`fa-solid ${d.completed ? 'fa-check' : 'fa-clock'}`}></i>
                            </span>
                            <div>
                              <div className="task-title">{d.title}</div>
                              <span className="task-meta">
                                Time: {d.time} • Category: {d.category} • Priority: <strong className={d.priority === 'High' ? 'priority-high' : 'priority-med'}>{d.priority}</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className={`task-status-chip ${d.completed ? 'done' : 'pending'}`}>
                              <i className={`fa-solid ${d.completed ? 'fa-lock' : 'fa-hourglass-half'}`}></i> {d.completed ? 'COMPLETED' : 'PENDING'}
                            </span>
                            <button className="btn-icon-danger" onClick={() => handleOwnerDeleteTask(d.id)} title="Delete Task">
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 3: GUEST STAY REQUIREMENTS & SPECIAL REQUESTS */}
                  <div className="od-panel glass-morphism" style={{ marginBottom: '28px' }}>
                    <div className="od-panel-head">
                      <div>
                        <h3><i className="fa-solid fa-users-gear"></i> Guest Stay Requirements & Special Requests</h3>
                        <p>Assign guest-specific preparation requirements to the Caretaker.</p>
                      </div>
                      <button className="btn-mini-emerald" onClick={() => setShowAddReqModalOwner(true)}>+ Add Requirement</button>
                    </div>

                    <div className="guest-req-grid">
                      {ownerGuestReqs.map(g => (
                        <div key={g.id} className="guest-req-card">
                          <div className="guest-req-card-top">
                            <div>
                              <h4>{g.guestName}</h4>
                              <span className="meta">Booking ID: {g.id} • {g.rooms}</span>
                            </div>
                            <span className="checkin-chip">Check-In: {g.checkIn}</span>
                          </div>

                          <div className="req-checklist-label">Caretaker Checklist</div>
                          {guestRequirementList(g).map((req, idx) => (
                            <div key={idx} className={`req-item ${req.done ? 'done' : ''}`}>
                              <div className="req-item-left">
                                <i className={`fa-solid ${req.done ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: req.done ? 'var(--od-emerald-bright)' : 'var(--od-faint)' }}></i>
                                <span>{req.label}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className={req.done ? 'req-tag-done' : 'req-tag-pending'}>{req.done ? 'DONE' : 'PENDING'}</span>
                                <button className="req-delete-btn" onClick={() => handleOwnerDeleteGuestReq(g.id, idx)} title="Delete Requirement">×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 4: CARETAKER VILLA CONSUMABLE INVENTORY */}
                  <div className="od-panel glass-morphism">
                    <div className="od-panel-head">
                      <div>
                        <h3><i className="fa-solid fa-boxes-stacked"></i> Caretaker Villa Consumable Stock Inventory</h3>
                        <p>Monitor live supplies reported by Caretaker & restock instantly.</p>
                      </div>
                    </div>

                    <div className="inventory-grid">
                      {ownerInventory.map(item => (
                        <div key={item._id || item.id} className={`inventory-item-card ${item.status === 'In Stock' ? '' : 'low'}`}>
                          <div className="inventory-item-top">
                            <h4>{item.itemName || item.item}</h4>
                            <span className={`status ${item.status === 'In Stock' ? 'instock' : 'low'}`}>{item.status}</span>
                          </div>
                          <div className="inventory-qty">{item.quantity ?? item.qty} <span>{item.unit}</span></div>
                          <button className="btn-restock" onClick={() => handleOwnerRestockStock(item._id || item.id, 5)}>
                            <i className="fa-solid fa-cart-plus"></i> Approve +5 Restock
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: TOURIST ARRIVAL REGISTER */}
              {activeTab === 'tourists' && (
                <div className="tab-tourists-register">
                  <div className="od-section-header glass-morphism">
                    <div>
                      <h3><i className="fa-solid fa-users-viewfinder"></i> Tourist Arrival & Headcount Register</h3>
                      <p>Real-time log of registered tourists, expected arrival times, headcount, assigned rooms & Govt ID verification status.</p>
                    </div>
                  </div>

                  <div className="od-mini-stats-grid">
                    <div className="od-mini-stat neutral glass-morphism">
                      <div className="lbl">Total Registered Groups</div>
                      <div className="val">{touristRegisterList.length} Groups</div>
                    </div>
                    <div className="od-mini-stat emerald glass-morphism">
                      <div className="lbl">Currently Arrived</div>
                      <div className="val">{touristRegisterList.filter(t => t.status === 'Arrived').length}</div>
                    </div>
                    <div className="od-mini-stat gold glass-morphism">
                      <div className="lbl">Total Tourist Headcount</div>
                      <div className="val">{touristRegisterList.reduce((sum, t) => sum + (t.adultsCount || 0) + (t.childrenCount || 0), 0)}</div>
                    </div>
                  </div>

                  <div>
                    {touristRegisterList.map(t => (
                      <div key={t._id || t.id} className="tourist-row glass-morphism">
                        <div>
                          <div className="tourist-row-name">
                            <h4>{t.guestName}</h4>
                            <span className={`od-status-badge ${t.status === 'Arrived' ? 'approved' : 'pending'}`}>{t.status}</span>
                          </div>
                          <p className="tourist-row-sub">
                            <i className="fa-solid fa-building"></i> {t.propertyName} &nbsp;•&nbsp; <i className="fa-solid fa-door-closed"></i> {t.roomAssigned}
                          </p>
                          <div className="tourist-row-meta">
                            <span><i className="fa-solid fa-clock"></i> Arrival: <strong>{t.expectedArrivalTime}</strong></span>
                            <span><i className="fa-solid fa-users"></i> Guests: <strong>{t.adultsCount} Adults, {t.childrenCount} Kids</strong></span>
                            <span><i className="fa-solid fa-id-card"></i> Govt ID: <strong>{t.govtIdType || 'Aadhaar'} ({t.idVerified ? 'Verified' : 'Pending'})</strong></span>
                          </div>
                          {t.specialRequests && (
                            <div className="tourist-special-req"><i className="fa-solid fa-star"></i> "{t.specialRequests}"</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: MATERIAL STOCK INVENTORY */}
              {activeTab === 'inventory' && (
                <div className="tab-inventory-stock">
                  <div className="od-section-header glass-morphism">
                    <div>
                      <h3><i className="fa-solid fa-boxes-stacked"></i> Material Stock & Consumables Inventory</h3>
                      <p>Manage property supplies and trigger restock requests for Caretakers.</p>
                    </div>
                  </div>

                  <div className="inventory-grid">
                    {ownerInventory.map(item => (
                      <div key={item._id || item.id} className={`inventory-item-card ${item.status === 'In Stock' ? '' : 'low'}`}>
                        <div className="inventory-item-top">
                          <div>
                            <span className="cat">{item.category || 'Supplies'}</span>
                            <h4>{item.itemName || item.item}</h4>
                          </div>
                          <span className={`status ${item.status === 'In Stock' ? 'instock' : 'low'}`}>{item.status}</span>
                        </div>
                        <div className="inventory-qty">{item.quantity || item.qty} <span>{item.unit}</span></div>
                        <button className="btn-restock" onClick={() => handleOwnerRestockStock(item._id || item.id, 5)}>
                          <i className="fa-solid fa-cart-plus"></i> Restock +5 Units
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: TOURIST FEEDBACK */}
              {activeTab === 'feedback' && (
                <div className="tab-tourist-feedback">
                  <div className="od-section-header glass-morphism">
                    <div>
                      <h3><i className="fa-solid fa-comments"></i> Tourist Feedback & Rating Reviews</h3>
                      <p>Review ratings, stay feedback, and comments submitted by tourists visiting your Mahabaleshwar properties.</p>
                    </div>
                  </div>

                  <div className="feedback-grid">
                    {touristFeedbackList.map(fb => (
                      <div key={fb._id || fb.id} className={`feedback-card ${fb.selectedForHotelPage ? 'featured-card' : ''}`}>
                        <div className="feedback-card-top">
                          <div>
                            <h4>{fb.guestName}</h4>
                            <span className="prop">{fb.propertyName}</span>
                            {fb.selectedForHotelPage && (
                              <span className="featured-badge" style={{ display: 'inline-block', marginLeft: '10px', background: 'rgba(212, 175, 55, 0.2)', color: '#d4af37', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid rgba(212, 175, 55, 0.4)' }}>
                                ★ Featured on Hotel Page
                              </span>
                            )}
                          </div>
                          <div className="feedback-stars">
                            {[...Array(5)].map((_, i) => (
                              <i key={i} className={`fa-solid fa-star${i < fb.rating ? '' : '-o'}`} style={{ color: i < fb.rating ? 'var(--od-gold-bright)' : 'rgba(243,238,226,0.15)' }}></i>
                            ))}
                          </div>
                        </div>
                        <p className="feedback-review">"{fb.reviewText}"</p>
                        {fb.facilitiesUsed && fb.facilitiesUsed.length > 0 && (
                          <div className="feedback-facility-tags">
                            {fb.facilitiesUsed.map((fac, idx) => (
                              <span key={idx} className="feedback-facility-tag">✓ {fac}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(243,238,226,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleToggleSelectFeedback(fb._id || fb.id)}
                            style={{
                              background: fb.selectedForHotelPage ? 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)' : 'rgba(255, 255, 255, 0.08)',
                              color: fb.selectedForHotelPage ? '#1a1a1a' : '#ffffff',
                              border: '1px solid rgba(212, 175, 55, 0.5)',
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.25s ease'
                            }}
                          >
                            <i className={`fa-solid ${fb.selectedForHotelPage ? 'fa-circle-check' : 'fa-circle-plus'}`}></i>
                            {fb.selectedForHotelPage ? 'Selected for Hotel Page' : 'Select for Hotel Page'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: PROFILE */}
              {activeTab === 'profile' && (
                <div className="tab-profile">
                  <div className="profile-card">
                    <h2>Host Profile Settings</h2>
                    <p>Manage your owner identity, contact details and stay policies displayed to travelers.</p>

                    <form onSubmit={handleProfileSubmit} className="profile-form">
                      <div className="form-group">
                        <label>Host Full Name</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Email Address (Account ID)</label>
                        <input type="email" value={user?.email || ''} disabled className="disabled-input" />
                      </div>

                      <div className="form-group">
                        <label>Phone Number for Guest Contacts</label>
                        <input
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                        />
                      </div>

                      <div className="form-group">
                        <label>Host Bio / Welcome Message for Guests</label>
                        <textarea
                          rows="4"
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                          placeholder="Tell guests about your hospitality, luxury amenities and local Mahabaleshwar recommendations..."
                        ></textarea>
                      </div>

                      <button type="submit" className="btn-primary-gold" disabled={profileSaving}>
                        {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* ADD / EDIT PROPERTY MODAL */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editingProperty ? 'Edit Property Details' : 'Register New Property Listing'}</h3>
                <button className="close-btn" onClick={() => setShowAddModal(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>

              <form onSubmit={handleSaveProperty} className="modal-form">
                <div className="form-group">
                  <label>Property Name *</label>
                  <input
                    type="text"
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    placeholder="e.g. Royal Strawberry Heritage Villa"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Property Category</label>
                    <select
                      value={propertyForm.type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                    >
                      <option value="Villa">Luxury Villa</option>
                      <option value="Hotel">Boutique Hotel</option>
                      <option value="Cabin">Private Cabin</option>
                      <option value="Resort">Nature Resort</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Price per Night (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={propertyForm.price}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(1, Math.abs(parseInt(e.target.value) || 1));
                        setPropertyForm({ ...propertyForm, price: val });
                      }}
                      placeholder="15000"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Location / Area *</label>
                  <input
                    type="text"
                    value={propertyForm.location}
                    onChange={(e) => setPropertyForm({ ...propertyForm, location: e.target.value })}
                    placeholder="e.g. Panchgani Road, Mahabaleshwar"
                    required
                  />
                </div>

                <div className="form-group">
                  <label><i className="fa-solid fa-map-location-dot"></i> Google Maps Live Location Link</label>
                  <input
                    type="url"
                    value={propertyForm.mapLink || ''}
                    onChange={(e) => setPropertyForm({ ...propertyForm, mapLink: e.target.value })}
                    placeholder="e.g. https://maps.app.goo.gl/... or https://maps.google.com/?q=..."
                  />
                  <small style={{ color: 'var(--od-muted)', fontSize: '0.78rem', display: 'block' }}>
                    Paste exact Google Maps URL so guests can view live GPS pin & directions on the map.
                  </small>
                </div>

                {/* Provided Stay Amenities & Resources Checklist */}
                <div className="form-group">
                  <label>
                    <i className="fa-solid fa-list-check"></i> Stay Amenities & Provided Resources ({propertyForm.amenities?.length || 0} Selected)
                  </label>
                  <p style={{ color: 'var(--od-muted)', fontSize: '0.8rem', marginTop: '-4px', marginBottom: '10px' }}>
                    Select all resources & amenities provided at your stay for travelers:
                  </p>

                  <div className="amenities-selection-grid">
                    {PRESET_AMENITIES.map((item) => {
                      const isSelected = propertyForm.amenities?.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          className={`amenity-chip-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleAmenity(item)}
                        >
                          <i className={`fa-solid ${isSelected ? 'fa-square-check' : 'fa-square'}`}></i>
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Resource / Amenity Add Input */}
                  <div className="custom-amenity-input-wrap">
                    <input
                      type="text"
                      placeholder="Add custom resource (e.g. Jacuzzi, Strawberry Farm Tour, Bonfire Gazebo)..."
                      value={customAmenityInput}
                      onChange={(e) => setCustomAmenityInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAmenity(e); } }}
                    />
                    <button type="button" className="btn-add-custom-amenity" onClick={handleAddCustomAmenity}>
                      <i className="fa-solid fa-plus"></i> Add Resource
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label><i className="fa-solid fa-camera"></i> Property Photos (Upload Directly)</label>
                  <div className="direct-upload-area">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoFileUpload}
                      id="property-direct-photos"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="property-direct-photos" className="upload-dropzone">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>Select Images from Computer / Mobile</span>
                      <small>Upload PNG, JPG, WEBP • Multiple images supported</small>
                    </label>
                  </div>

                  {Array.isArray(propertyForm.photos) && propertyForm.photos.length > 0 && (
                    <div className="uploaded-thumbnails-grid">
                      {propertyForm.photos.map((img, idx) => (
                        <div key={idx} className="thumb-item">
                          <img src={img} alt={`Upload ${idx + 1}`} />
                          <button
                            type="button"
                            className="btn-remove-photo"
                            onClick={() => handleRemovePhoto(idx)}
                            title="Remove image"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label><i className="fa-solid fa-video"></i> Property HD Video Tours (Upload Directly from Device)</label>
                  <div className="direct-upload-area">
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideoFileUpload}
                      id="property-direct-videos"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="property-direct-videos" className="upload-dropzone">
                      <i className="fa-solid fa-film"></i>
                      <span>Select Video Files from Computer / Mobile</span>
                      <small>Upload MP4, WEBM, MOV • Multiple videos supported</small>
                    </label>
                  </div>

                  {Array.isArray(propertyForm.videos) && propertyForm.videos.length > 0 && (
                    <div className="uploaded-thumbnails-grid" style={{ marginTop: '12px' }}>
                      {propertyForm.videos.map((vid, idx) => (
                        <div key={idx} className="thumb-item" style={{ height: '90px' }}>
                          <video src={vid} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.75)', color: 'var(--od-gold-bright)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
                            <i className="fa-solid fa-circle-play"></i> Video #{idx + 1}
                          </span>
                          <button
                            type="button"
                            className="btn-remove-photo"
                            onClick={() => handleRemoveVideo(idx)}
                            title="Remove video"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Guest stay-pass details — shown to the guest on their trip page */}
                <div className="form-group">
                  <label><i className="fa-solid fa-id-card-clip"></i> Guest Stay Pass Details (shown after booking)</label>
                  <p style={{ color: 'var(--od-muted)', fontSize: '0.78rem', marginTop: '-4px', marginBottom: '10px' }}>
                    Help guests self-serve on arrival. Wi-Fi is only revealed to guests with a confirmed booking. All fields are optional.
                  </p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Check-in time</label>
                      <input type="text" value={stayInfoForm.checkInTime} onChange={(e) => setStayInfoForm({ ...stayInfoForm, checkInTime: e.target.value })} placeholder="e.g. 2:00 PM" maxLength={40} />
                    </div>
                    <div className="form-group">
                      <label>Check-out time</label>
                      <input type="text" value={stayInfoForm.checkOutTime} onChange={(e) => setStayInfoForm({ ...stayInfoForm, checkOutTime: e.target.value })} placeholder="e.g. 11:00 AM" maxLength={40} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Wi-Fi network name</label>
                      <input type="text" value={stayInfoForm.wifiName} onChange={(e) => setStayInfoForm({ ...stayInfoForm, wifiName: e.target.value })} placeholder="e.g. VillaParadise_5G" maxLength={60} />
                    </div>
                    <div className="form-group">
                      <label>Wi-Fi password</label>
                      <input type="text" value={stayInfoForm.wifiPassword} onChange={(e) => setStayInfoForm({ ...stayInfoForm, wifiPassword: e.target.value })} placeholder="Shared only with confirmed guests" maxLength={60} />
                    </div>
                  </div>
                  <label style={{ fontSize: '0.82rem', marginTop: '6px', display: 'block' }}>House rules (one per line)</label>
                  <textarea rows="3" value={stayInfoForm.houseRules} onChange={(e) => setStayInfoForm({ ...stayInfoForm, houseRules: e.target.value })} placeholder={'No loud music after 11 PM\nNo smoking indoors\nPool closes at 9 PM'} />
                  <label style={{ fontSize: '0.82rem', marginTop: '6px', display: 'block' }}>Arrival notes (narrow road, parking, last-mile guidance)</label>
                  <textarea rows="2" value={stayInfoForm.arrivalNotes} onChange={(e) => setStayInfoForm({ ...stayInfoForm, arrivalNotes: e.target.value })} maxLength={1000} placeholder="The last 500m is a narrow road; park near the blue gate and call the caretaker." />
                  <label style={{ fontSize: '0.82rem', marginTop: '6px', display: 'block' }}>Food / meals info</label>
                  <textarea rows="2" value={stayInfoForm.foodInfo} onChange={(e) => setStayInfoForm({ ...stayInfoForm, foodInfo: e.target.value })} maxLength={1000} placeholder="Breakfast included 8–10 AM. Lunch and dinner on request via the caretaker." />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary-gold">
                    {editingProperty ? 'Update Listing' : 'Submit Property Listing'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CARETAKER APPLICATION MODAL */}
        {showCaretakerModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <div>
                  <h3><i className="fa-solid fa-paper-plane"></i> Send Caretaker Request to Admin Panel</h3>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--od-muted)', fontSize: '0.82rem' }}>Submit official request for verified caretakers, housekeepers, and villa staff.</p>
                </div>
                <button className="close-btn" onClick={() => setShowCaretakerModal(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>

              <form onSubmit={handleCaretakerSubmit} className="modal-form">
                {/* Property Selection & Address */}
                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fa-solid fa-hotel"></i> Target Property Name *</label>
                    <select
                      value={caretakerForm.propertyName}
                      onChange={(e) => {
                        const selectedProp = properties.find(p => p.name === e.target.value);
                        setCaretakerForm({
                          ...caretakerForm,
                          propertyName: e.target.value,
                          propertyId: selectedProp ? selectedProp._id : '',
                          propertyAddress: selectedProp ? (selectedProp.location || 'Mahabaleshwar, Satara') : caretakerForm.propertyAddress
                        });
                      }}
                      required
                    >
                      <option value="">Select a Property...</option>
                      <option value="All Managed Stays">All My Managed Properties</option>
                      {properties.map(p => (
                        <option key={p._id} value={p.name}>{p.name} ({p.location})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label><i className="fa-solid fa-location-dot"></i> Property Address / Location *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Metgutad, Panchgani-Mahabaleshwar Highway"
                      value={caretakerForm.propertyAddress}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, propertyAddress: e.target.value })}
                    />
                  </div>
                </div>

                {/* Exact Position & Experience Required */}
                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fa-solid fa-user-tag"></i> Exact Position / Staff Role Required *</label>
                    <select
                      value={caretakerForm.positionRole}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, positionRole: e.target.value })}
                    >
                      <option value="Chief Villa Caretaker Host">Chief Villa Caretaker Host</option>
                      <option value="Senior Estate Manager & Host">Senior Estate Manager & Host</option>
                      <option value="Housekeeping & Linen Supervisor">Housekeeping & Linen Supervisor</option>
                      <option value="Culinary Chef & Dining Host">Culinary Chef & Dining Host</option>
                      <option value="Maintenance & Electrical Technician">Maintenance & Electrical Technician</option>
                      <option value="Night Gate & Security Officer">Night Gate & Security Officer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label><i className="fa-solid fa-award"></i> Caretaker Experience Required *</label>
                    <select
                      value={caretakerForm.experience}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, experience: e.target.value })}
                    >
                      <option value="1 - 3 Years">1 - 3 Years (Junior Staff)</option>
                      <option value="3 - 5 Years">3 - 5 Years (Experienced Caretaker)</option>
                      <option value="5+ Years">5+ Years (Senior Villa Manager)</option>
                    </select>
                  </div>
                </div>

                {/* Required Skills Picker */}
                <div className="form-group">
                  <label><i className="fa-solid fa-list-check"></i> Required Skills & Duties (Click to toggle)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {[
                      'Guest Check-in & Key Handover',
                      'Maharashtrian & Multi-cuisine Cooking',
                      'Housekeeping & Linen Sanitation',
                      'Pool Water Filtration & Chemical Check',
                      'Diesel Generator & Electrical Maintenance',
                      '24/7 Gate & Security Supervision'
                    ].map(skill => {
                      const isSelected = (caretakerForm.skillsRequired || []).includes(skill);
                      return (
                        <button
                          type="button"
                          key={skill}
                          onClick={() => {
                            const currentSkills = caretakerForm.skillsRequired || [];
                            const newSkills = isSelected
                              ? currentSkills.filter(s => s !== skill)
                              : [...currentSkills, skill];
                            setCaretakerForm({ ...caretakerForm, skillsRequired: newSkills });
                          }}
                          className={`amenity-chip-btn ${isSelected ? 'selected' : ''}`}
                          style={{ borderRadius: '999px' }}
                        >
                          <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle'}`}></i>
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contact Phone & Verification Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>Host Phone (10 Digits)</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={caretakerForm.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setCaretakerForm({ ...caretakerForm, phone: val });
                      }}
                    />
                    {caretakerForm.phone && caretakerForm.phone.length > 0 && caretakerForm.phone.length !== 10 && (
                      <small style={{ color: 'var(--od-danger)', fontSize: '0.75rem' }}>
                        Must be 10 digits ({caretakerForm.phone.length}/10)
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Verification ID Type</label>
                    <select
                      value={caretakerForm.govtIdType || 'Aadhaar Card'}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, govtIdType: e.target.value, govtId: '' })}
                    >
                      <option value="Aadhaar Card">Aadhaar Card (12 Digits)</option>
                      <option value="PAN Card">PAN Card (10 Chars)</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID Card">Voter ID Card</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      {caretakerForm.govtIdType === 'PAN Card' ? 'PAN (10 Chars)' : caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType ? 'Aadhaar (12 Digits)' : 'ID Number'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        caretakerForm.govtIdType === 'PAN Card' ? 'e.g. ABCDE1234F' :
                          caretakerForm.govtIdType === 'Driving License' ? 'e.g. MH1220230012345' :
                            'e.g. 123456789012'
                      }
                      maxLength={
                        caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType ? 12 : 16
                      }
                      value={caretakerForm.govtId}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (caretakerForm.govtIdType === 'Aadhaar Card' || !caretakerForm.govtIdType) {
                          val = val.replace(/\D/g, '').slice(0, 12);
                        } else {
                          val = val.toUpperCase().slice(0, 16);
                        }
                        setCaretakerForm({ ...caretakerForm, govtId: val });
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Special Instructions & Staff Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Mention guest check-in preferences, key handling rules, maintenance needs, or special staff requirements..."
                    value={caretakerForm.bio}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, bio: e.target.value })}
                  ></textarea>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancel" onClick={() => setShowCaretakerModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary-gold" disabled={submittingCaretaker}>
                    {submittingCaretaker ? 'Submitting Application...' : 'Submit Caretaker Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW CARETAKER DETAILS CARD MODAL */}
        {viewingCaretakerApp && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '650px' }}>
              <div className="modal-header">
                <div>
                  <span className="verified-chip" style={{ marginBottom: '8px' }}>
                    <i className="fa-solid fa-shield-halved"></i> Caretaker Application Record
                  </span>
                  <h3 style={{ marginTop: '8px' }}>{viewingCaretakerApp.propertyName || 'All Managed Properties'}</h3>
                </div>
                <button className="close-btn" onClick={() => setViewingCaretakerApp(null)}><i className="fa-solid fa-xmark"></i></button>
              </div>

              <div className="modal-form">
                {/* Status Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--od-surface-raised)', border: '1px solid var(--od-hairline)', borderRadius: '16px', padding: '14px 18px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--od-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Application Status</span>
                    <strong style={{ fontSize: '0.95rem', color: viewingCaretakerApp.status === 'approved' ? 'var(--od-emerald-bright)' : 'var(--od-gold-bright)' }}>
                      {viewingCaretakerApp.status === 'approved' ? 'Caretaker Allocated & Assigned' : 'Pending Admin Allocation'}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--od-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Date Submitted</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--od-ivory-dim)', fontFamily: 'var(--od-mono)' }}>
                      {new Date(viewingCaretakerApp.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Allocated Caretaker Staff Banner */}
                {viewingCaretakerApp.status === 'approved' && (
                  <div className="caretaker-assigned-box" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div className="od-avatar-round" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}><i className="fa-solid fa-user-shield"></i></div>
                        <div>
                          <span className="lbl">Admin Allocated Caretaker</span>
                          <strong className="name" style={{ display: 'block', fontSize: '1.02rem' }}>{viewingCaretakerApp.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)'}</strong>
                          <span className="phone" style={{ fontFamily: 'var(--od-mono)' }}>{viewingCaretakerApp.assignedCaretakerPhone || '+91 98901 23456'}</span>
                        </div>
                      </div>
                      <button className="btn-whatsapp" style={{ flex: '0 auto' }} onClick={() => openWhatsAppOwnerToCaretaker(viewingCaretakerApp)}>
                        <i className="fa-brands fa-whatsapp"></i> Chat on WhatsApp
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="caretaker-app-role-box">
                    <span className="lbl"><i className="fa-solid fa-location-dot"></i> Property Address</span>
                    <p style={{ margin: 0, color: 'var(--od-ivory)', fontSize: '0.9rem', fontWeight: '600' }}>{viewingCaretakerApp.propertyAddress || viewingCaretakerApp.city || 'Mahabaleshwar, Satara'}</p>
                  </div>
                  <div className="caretaker-app-role-box">
                    <span className="lbl"><i className="fa-solid fa-user-tag"></i> Required Position / Role</span>
                    <p style={{ margin: 0, color: 'var(--od-gold-bright)', fontSize: '0.9rem', fontWeight: '700' }}>{viewingCaretakerApp.positionRole || 'Chief Villa Caretaker Host'}</p>
                  </div>
                  <div className="caretaker-app-role-box">
                    <span className="lbl"><i className="fa-solid fa-phone"></i> Host Contact Phone</span>
                    <p style={{ margin: 0, color: 'var(--od-emerald-bright)', fontSize: '0.9rem', fontWeight: '700', fontFamily: 'var(--od-mono)' }}>{viewingCaretakerApp.phone}</p>
                  </div>
                  <div className="caretaker-app-role-box">
                    <span className="lbl"><i className="fa-solid fa-award"></i> Caretaker Experience</span>
                    <p style={{ margin: 0, color: 'var(--od-blue)', fontSize: '0.9rem', fontWeight: '700' }}>{viewingCaretakerApp.experience}</p>
                  </div>
                </div>

                {/* Govt ID Verification Details */}
                <div className="caretaker-app-role-box">
                  <span className="lbl"><i className="fa-solid fa-id-card"></i> Govt ID Verification Details</span>
                  <p style={{ margin: 0, color: 'var(--od-ivory)', fontSize: '0.9rem', fontWeight: '600' }}>{viewingCaretakerApp.govtId || 'Provided & Verified by Admin'}</p>
                </div>

                {/* Required Skills & Duties Tags */}
                <div className="caretaker-app-role-box">
                  <span className="lbl"><i className="fa-solid fa-list-check"></i> Required Skills & Duties</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {(Array.isArray(viewingCaretakerApp.skillsRequired) && viewingCaretakerApp.skillsRequired.length > 0 ? viewingCaretakerApp.skillsRequired : viewingCaretakerApp.services || []).map((svc, i) => (
                      <span key={i} className="feedback-facility-tag"><i className="fa-solid fa-check"></i> {svc}</span>
                    ))}
                  </div>
                </div>

                {/* Special Notes */}
                {viewingCaretakerApp.bio && (
                  <div className="caretaker-app-role-box">
                    <span className="lbl"><i className="fa-solid fa-note-sticky"></i> Special Instructions & Staff Notes</span>
                    <p style={{ margin: 0, color: 'var(--od-ivory-dim)', fontSize: '0.85rem', lineHeight: '1.5', fontStyle: 'italic' }}>"{viewingCaretakerApp.bio}"</p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary-gold" onClick={() => setViewingCaretakerApp(null)}>Close Details Card</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OWNER ASSIGN DAILY TASK MODAL */}
        {showAddTaskModalOwner && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3><i className="fa-solid fa-list-check"></i> Assign Daily Task to Caretaker</h3>
                <button className="close-btn" onClick={() => setShowAddTaskModalOwner(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>

              <form onSubmit={handleOwnerAddTaskSubmit} className="modal-form">
                <div className="form-group">
                  <label>Task Title / Description *</label>
                  <input
                    type="text"
                    value={newOwnerTask.title}
                    onChange={(e) => setNewOwnerTask({ ...newOwnerTask, title: e.target.value })}
                    placeholder="e.g. Deep Clean Swimming Pool & Inspect pH Balance"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={newOwnerTask.category}
                      onChange={(e) => setNewOwnerTask({ ...newOwnerTask, category: e.target.value })}
                    >
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Guest Care">Guest Care</option>
                      <option value="Amenities">Amenities</option>
                      <option value="Safety">Safety</option>
                      <option value="Kitchen">Kitchen</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Scheduled Time</label>
                    <input
                      type="text"
                      value={newOwnerTask.time}
                      onChange={(e) => setNewOwnerTask({ ...newOwnerTask, time: e.target.value })}
                      placeholder="10:00 AM"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Task Priority</label>
                  <select
                    value={newOwnerTask.priority}
                    onChange={(e) => setNewOwnerTask({ ...newOwnerTask, priority: e.target.value })}
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <button type="submit" className="btn-primary-gold" style={{ marginTop: '4px' }}>
                  <i className="fa-solid fa-paper-plane"></i> Assign Task to Caretaker Checklist
                </button>
              </form>
            </div>
          </div>
        )}

        {/* OWNER ASSIGN GUEST REQUIREMENT MODAL */}
        {showAddReqModalOwner && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3><i className="fa-solid fa-user-plus"></i> Assign Requirement for Guest Stay</h3>
                <button className="close-btn" onClick={() => setShowAddReqModalOwner(false)}><i className="fa-solid fa-xmark"></i></button>
              </div>

              <form onSubmit={handleOwnerAddGuestReqSubmit} className="modal-form">
                <div className="form-group">
                  <label>Select Guest / Booking *</label>
                  <select
                    value={newOwnerGuestReq.guestId}
                    onChange={(e) => setNewOwnerGuestReq({ ...newOwnerGuestReq, guestId: e.target.value })}
                  >
                    {ownerGuestReqs.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.guestName} ({g.rooms} - ID: {g.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Requirement Details for Caretaker *</label>
                  <input
                    type="text"
                    value={newOwnerGuestReq.label}
                    onChange={(e) => setNewOwnerGuestReq({ ...newOwnerGuestReq, label: e.target.value })}
                    placeholder="e.g. Prepare Welcome Fresh Strawberry Smoothie & Extra Bedding"
                    required
                  />
                </div>

                <button type="submit" className="btn-pill-emerald" style={{ marginTop: '4px', width: '100%', justifyContent: 'center' }}>
                  <i className="fa-solid fa-check"></i> Assign Requirement to Caretaker
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Floating Host AI Assistant */}
      <AiAssistant />
    </div>
  );
};

export default OwnerDashboard;
