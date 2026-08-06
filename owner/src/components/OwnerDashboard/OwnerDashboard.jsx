import React, { useState, useEffect } from 'react';
// Owner Dashboard Component - Mahabaleshwar Luxury Stays
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import './OwnerDashboard.css';

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
        return { ...g, specialRequests: g.specialRequests.filter((_, idx) => idx !== reqIdx) };
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
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to restock item');

      setOwnerInventory(prev => prev.map(item => (item.id === id ? data : item)));
      setActionSuccess('Inventory restocked and updated.');
    } catch (err) {
      setError(err.message || 'Failed to restock inventory item');
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
      const propData = await propRes.json();
      if (Array.isArray(propData)) {
        setProperties(propData);
      }

      // 2. Fetch Owner Bookings
      const bookRes = await fetch(`${API_BASE_URL}/bookings/owner`, {
        headers: { 'x-auth-token': authToken }
      });
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
      const [tasksRes, reqsRes, inventoryRes, profileRes] = await Promise.all([
        fetch(`${API_BASE_URL}/caretaker-tasks/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/guest-requirements/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/inventory/owner`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE_URL}/caretaker/assigned-profile`, { headers: { 'x-auth-token': token } })
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
      videos: propertyForm.videos ? (Array.isArray(propertyForm.videos) ? propertyForm.videos : propertyForm.videos.split(',').map(s => s.trim()).filter(Boolean)) : []
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
  const totalRevenue = bookings.reduce((sum, b) => b.paymentStatus === 'paid' ? sum + (b.totalPrice || 0) : sum, 0);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setPropertySearchQuery('');
    setPropertyFilterType('All');
    setBookingFilterStatus('All');
  };

  return (
    <div className="owner-dashboard-wrapper">
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
            color: '#52b788',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.68rem',
            fontWeight: '700',
            letterSpacing: '3.5px',
            textTransform: 'uppercase',
            opacity: 0.9
          }}>
            PROPERTY OWNER PORTAL
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
            <span style={{ fontSize: '0.65rem', color: '#52b788', letterSpacing: '2px', fontWeight: '700' }}>PROPERTY OWNER DRAWER</span>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.8 }}
          >
            ×
          </button>
        </div>

        <nav className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
          <button
            className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { handleTabChange('overview'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-gauge-high"></i> Host Command Center
          </button>
          <button
            className={`nav-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => { handleTabChange('properties'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-hotel"></i> Property Portfolio ({properties.length})
          </button>
          <button
            className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => { handleTabChange('bookings'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-calendar-check"></i> Guest Bookings ({bookings.length})
          </button>
          <button
            className={`nav-btn ${activeTab === 'caretaker-tasks' ? 'active' : ''}`}
            onClick={() => { handleTabChange('caretaker-tasks'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-list-check"></i> Caretaker & Daily Tasks
          </button>
          <button
            className={`nav-btn ${activeTab === 'caretakers' ? 'active' : ''}`}
            onClick={() => { handleTabChange('caretakers'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-user-shield"></i> Caretaker Requests ({caretakerApps.length})
          </button>
          <button
            className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { handleTabChange('profile'); setIsDrawerOpen(false); }}
          >
            <i className="fa-solid fa-user-gear"></i> Host Profile Settings
          </button>
        </nav>

        <div className="sidebar-footer" style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="logout-btn" onClick={() => { setIsDrawerOpen(false); handleLogout(); }}>
            <i className="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </aside>

      <div className={`owner-dashboard-layout ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
        {/* Sidebar Navigation */}
        {!isSidebarHidden && (
          <aside className="owner-sidebar">
            <div className="owner-profile-mini">
              <div className="avatar-circle font-outfit">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'O'}
              </div>
              <div className="user-info">
                <h4>{user?.name || 'Property Host'}</h4>
                <span className="role-tag"><i className="fa-solid fa-shield-halved"></i> Verified Host</span>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button
                className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleTabChange('overview')}
              >
                <i className="fa-solid fa-chart-line"></i> Dashboard Overview
              </button>
              <button
                className={`nav-btn ${activeTab === 'properties' ? 'active' : ''}`}
                onClick={() => handleTabChange('properties')}
              >
                <i className="fa-solid fa-building-user"></i> My Properties ({totalProperties})
              </button>
              <button
                className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => handleTabChange('bookings')}
              >
                <i className="fa-solid fa-calendar-check"></i> Guest Bookings ({totalBookings})
              </button>
              <button
                className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => handleTabChange('analytics')}
              >
                <i className="fa-solid fa-wallet"></i> Earnings & Financials
              </button>
              <button
                className={`nav-btn ${activeTab === 'caretaker-tasks' ? 'active' : ''}`}
                onClick={() => handleTabChange('caretaker-tasks')}
              >
                <i className="fa-solid fa-list-check"></i> Caretaker & Daily Tasks
              </button>
              <button
                className={`nav-btn ${activeTab === 'caretakers' ? 'active' : ''}`}
                onClick={() => handleTabChange('caretakers')}
              >
                <i className="fa-solid fa-user-shield"></i> Caretaker Requests ({caretakerApps.length})
              </button>
              <button
                className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => handleTabChange('profile')}
              >
                <i className="fa-solid fa-user-gear"></i> Host Profile Settings
              </button>
            </nav>

            <div className="sidebar-footer">
              <a href="http://localhost:5173" className="main-site-btn" target="_blank" rel="noreferrer">
                <i className="fa-solid fa-globe"></i> View Main Site
              </a>
              <button className="logout-btn" onClick={handleLogout}>
                <i className="fa-solid fa-right-from-bracket"></i> Sign Out
              </button>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="owner-main-content">
          {/* Sticky Top Navigation Bar */}
          <div className="owner-top-navbar">
            <div className="top-nav-left">
              <button 
                type="button"
                className="mobile-toggle-btn" 
                onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                title="Toggle Sidebar Navigation"
              >
                <i className="fa-solid fa-bars"></i>
              </button>
              <div className="top-nav-welcome">
                <span className="welcome-greeting">Welcome back, <strong>{user?.name || 'Saroj Naydu'}</strong></span>
                <span className="current-date-badge">
                  <i className="fa-solid fa-calendar-day"></i> {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="top-nav-search">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search properties, bookings, or guest requests..." 
                value={propertySearchQuery}
                onChange={(e) => setPropertySearchQuery(e.target.value)}
              />
              <span className="search-shortcut">⌘K</span>
            </div>

            <div className="top-nav-right">
              <button type="button" className="top-nav-icon-btn" title="Notifications">
                <i className="fa-solid fa-bell"></i>
                <span className="nav-unread-dot">3</span>
              </button>
              <button 
                type="button"
                className="top-nav-icon-btn" 
                title="Quick Caretaker Request" 
                onClick={() => setShowCaretakerModal(true)}
              >
                <i className="fa-solid fa-user-shield"></i>
              </button>
              <button 
                type="button"
                className="top-add-btn" 
                onClick={() => { setEditingProperty(null); setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', photos: [], videos: '' }); setShowAddModal(true); }}
              >
                <i className="fa-solid fa-plus"></i> <span>Add Property</span>
              </button>

              <div className="top-profile-badge">
                <div className="avatar-circle">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="profile-text-group">
                  <span className="profile-name">{user?.name || 'Saroj Naydu'}</span>
                  <span className="profile-role"><i className="fa-solid fa-shield-check"></i> Verified Host</span>
                </div>
              </div>
            </div>
          </div>

          <header className="content-header">
            <div className="header-titles">
              <h1>
                {activeTab === 'overview' && <><i className="fa-solid fa-gauge-high" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Host Command Center</>}
                {activeTab === 'properties' && <><i className="fa-solid fa-hotel" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Property Portfolio ({properties.length})</>}
                {activeTab === 'bookings' && <><i className="fa-solid fa-calendar-check" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Guest Reservations ({bookings.length})</>}
                {activeTab === 'caretaker-tasks' && <><i className="fa-solid fa-list-check" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Caretaker Task & Guest Requirement Center</>}
                {activeTab === 'caretakers' && <><i className="fa-solid fa-user-shield" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Property Caretaker Applications ({caretakerApps.length})</>}
                {activeTab === 'analytics' && <><i className="fa-solid fa-chart-line" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Financial Earnings & Analytics</>}
                {activeTab === 'profile' && <><i className="fa-solid fa-user-gear" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>Host Account Settings</>}
              </h1>
              <p>
                {activeTab === 'overview' && `Welcome back, ${user?.name || 'Owner'}! Track stay performance, guest check-ins & payouts.`}
                {activeTab === 'properties' && `Manage your luxury stay listings, update direct photos, prices and live GPS links.`}
                {activeTab === 'bookings' && `Track check-ins, guest contacts, stay payments, and confirm or reject reservations.`}
                {activeTab === 'caretaker-tasks' && `Assign daily shift duties to caretakers, add guest-specific stay requirements, and monitor real-time completion.`}
                {activeTab === 'caretakers' && `Apply and assign caretakers for your properties, manage guest check-in staff & maintenance.`}
                {activeTab === 'analytics' && `Track direct stay earnings, average reservation value, and monthly host payouts.`}
                {activeTab === 'profile' && `Manage your owner identity, contact details and stay policies displayed to travelers.`}
              </p>
            </div>

            <div className="header-actions">
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
                <i className="fa-solid fa-user-shield"></i> Send Caretaker Request to Admin
              </button>
              {activeTab === 'properties' && (
                <button 
                  type="button"
                  className="btn-primary-gold" 
                  onClick={() => {
                    setEditingProperty(null);
                    setPropertyForm({ name: '', type: 'Villa', location: 'Mahabaleshwar', price: 15000, mapLink: '', photos: [], videos: '' });
                    setShowAddModal(true);
                  }}
                >
                  <i className="fa-solid fa-plus"></i> Add New Property
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
                  {/* High Impact Property Overview Highlight Banner */}
                  <div className="property-overview-banner glass-morphism">
                    <div className="banner-image-container">
                      <img 
                        src={properties.length > 0 && properties[0].photos && properties[0].photos[0] ? properties[0].photos[0] : 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80'} 
                        alt="Primary Property Banner" 
                      />
                      <div className="banner-type-tag">
                        <i className="fa-solid fa-crown"></i> Primary Luxury Estate
                      </div>
                    </div>

                    <div className="banner-details">
                      <div className="banner-header-row">
                        <div>
                          <h2 className="banner-title">{properties.length > 0 ? properties[0].name : 'Ganesh kuj Villa Estate'}</h2>
                          <p className="banner-location">
                            <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-gold)' }}></i> {properties.length > 0 ? properties[0].location : 'Pune & Outskirts, Mahabaleshwar'}
                            <span className="verified-chip"><i className="fa-solid fa-circle-check"></i> Verified Stay</span>
                          </p>
                        </div>
                        <div className="banner-rating-pill">
                          <i className="fa-solid fa-star" style={{ color: 'var(--accent-gold)' }}></i>
                          <span className="rating-score">4.9</span>
                          <span className="rating-count">(124 reviews)</span>
                        </div>
                      </div>

                      <div className="banner-stats-row">
                        <div className="banner-stat-chip">
                          <div className="chip-icon gold"><i className="fa-solid fa-chart-line"></i></div>
                          <div>
                            <span className="chip-label">Occupancy Rate</span>
                            <span className="chip-value">85%</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon emerald"><i className="fa-solid fa-calendar-check"></i></div>
                          <div>
                            <span className="chip-label">Active Reservations</span>
                            <span className="chip-value">{bookings.length > 0 ? bookings.length : '4 Active'}</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon blue"><i className="fa-solid fa-indian-rupee-sign"></i></div>
                          <div>
                            <span className="chip-label">Monthly Payout</span>
                            <span className="chip-value">₹{totalRevenue > 0 ? totalRevenue.toLocaleString('en-IN') : '2,40,000'}</span>
                          </div>
                        </div>

                        <div className="banner-stat-chip">
                          <div className="chip-icon yellow"><i className="fa-solid fa-users"></i></div>
                          <div>
                            <span className="chip-label">Total Guests</span>
                            <span className="chip-value">48 Guests</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards Grid */}
                  {!isCardsHidden && (
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon gold"><i className="fa-solid fa-vihara"></i></div>
                        <div className="stat-info">
                          <span className="stat-label">Listed Properties</span>
                          <h3 className="stat-value">{totalProperties}</h3>
                          <span className="stat-sub font-green">Active in Mahabaleshwar</span>
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
                        <h3><i className="fa-solid fa-chart-area" style={{ color: 'var(--accent-gold)' }}></i> Monthly Revenue Trend</h3>
                        <div className="chart-legend">
                          <span><span className="legend-dot gold"></span> Direct Earnings</span>
                          <span><span className="legend-dot emerald"></span> Occupancy Peak</span>
                        </div>
                      </div>

                      <div className="bar-chart-visual">
                        {[
                          { m: 'Jan', val: 40, col: 'gold' },
                          { m: 'Feb', val: 55, col: 'gold' },
                          { m: 'Mar', val: 70, col: 'emerald' },
                          { m: 'Apr', val: 65, col: 'gold' },
                          { m: 'May', val: 90, col: 'emerald' },
                          { m: 'Jun', val: 80, col: 'emerald' },
                          { m: 'Jul', val: 75, col: 'gold' },
                          { m: 'Aug', val: 95, col: 'emerald' }
                        ].map((b, i) => (
                          <div key={i} className="chart-bar-column">
                            <div className="bar-track">
                              <div className={`bar-fill ${b.col}`} style={{ height: `${b.val}%` }}></div>
                            </div>
                            <span className="bar-month-label">{b.m}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="chart-card-box glass-morphism">
                      <div className="chart-header">
                        <h3><i className="fa-solid fa-pie-chart" style={{ color: 'var(--accent-emerald)' }}></i> Estate Performance Metrics</h3>
                      </div>

                      <div className="progress-meters-list">
                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Occupancy Rate</span>
                            <span className="meter-val">85%</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill gold" style={{ width: '85%' }}></div>
                          </div>
                        </div>

                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Guest Satisfaction</span>
                            <span className="meter-val">98%</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill emerald" style={{ width: '98%' }}></div>
                          </div>
                        </div>

                        <div className="meter-unit">
                          <div className="meter-meta">
                            <span className="meter-title">Caretaker Inventory</span>
                            <span className="meter-val">92%</span>
                          </div>
                          <div className="meter-bar-track">
                            <div className="meter-bar-fill blue" style={{ width: '92%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Feed & Overview Grids */}
                  <div className="revenue-analytics-grid">
                    <div className="activity-feed-card glass-morphism">
                      <div className="chart-header">
                        <h3><i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--accent-gold)' }}></i> Recent Activity Feed</h3>
                        <span className="verified-chip">Live Updates</span>
                      </div>

                      <div className="activity-feed-list">
                        <div className="activity-item-row">
                          <div className="activity-icon-badge emerald"><i className="fa-solid fa-calendar-check"></i></div>
                          <div className="activity-meta">
                            <h4>New Booking Confirmed</h4>
                            <p>Mr. Rajesh Kumar reserved Ganesh kuj Villa Estate for 3 nights.</p>
                          </div>
                          <span className="activity-time">15m ago</span>
                        </div>

                        <div className="activity-item-row">
                          <div className="activity-icon-badge gold"><i className="fa-solid fa-user-shield"></i></div>
                          <div className="activity-meta">
                            <h4>Caretaker Duty Completed</h4>
                            <p>Caretaker Ramesh completed Pool & Garden Linen Sanitation.</p>
                          </div>
                          <span className="activity-time">1h ago</span>
                        </div>

                        <div className="activity-item-row">
                          <div className="activity-icon-badge blue"><i className="fa-solid fa-building-columns"></i></div>
                          <div className="activity-meta">
                            <h4>Bank Payout Settled</h4>
                            <p>Direct payout ₹45,000 processed to registered HDFC Bank account.</p>
                          </div>
                          <span className="activity-time">3h ago</span>
                        </div>

                        <div className="activity-item-row">
                          <div className="activity-icon-badge yellow"><i className="fa-solid fa-wine-glass"></i></div>
                          <div className="activity-meta">
                            <h4>Guest Special Request Added</h4>
                            <p>Complimentary Welcome Drinks & Campfire setup requested for Check-In.</p>
                          </div>
                        </div>
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
                                {b.user?.name ? b.user.name.charAt(0).toUpperCase() : 'G'}
                              </div>
                              <div className="booking-info">
                                <h4>{b.user?.name || 'Guest User'}</h4>
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
                                <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-gold)' }}></i> {prop.location}
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
                                  href={`http://localhost:5173/property/${prop._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-view-live"
                                  title="View on traveler site"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Preview
                                </a>
                                <button
                                  className="btn-edit"
                                  style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}
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
              {activeTab === 'bookings' && (
                <div className="tab-bookings">
                  {/* Booking Filter Bar */}
                  <div className="portfolio-filter-bar" style={{ marginBottom: '20px' }}>
                    <div className="type-filter-pills">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '6px' }}><i className="fa-solid fa-filter" style={{ color: 'var(--accent-gold)' }}></i> Filter Reservations:</span>
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
                                        {b.user?.name ? b.user.name.charAt(0).toUpperCase() : 'G'}
                                      </div>
                                      <div className="guest-info-text">
                                        <strong>{b.user?.name || 'Guest User'}</strong>
                                        <span className="email">{b.user?.email}</span>
                                        {b.user?.phone && <span className="phone"><i className="fa-solid fa-phone"></i> {b.user.phone}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="property-stay-cell">
                                      <strong>{b.property?.name || 'Mahabaleshwar Stay'}</strong>
                                      <span className="sub-location"><i className="fa-solid fa-location-dot"></i> {b.property?.location || 'Mahabaleshwar'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="date-cell">
                                      <span className="date-range">
                                        <i className="fa-solid fa-calendar"></i> {checkInDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} → {checkOutDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                      </span>
                                      <span className="nights-badge">{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <strong className="price font-gold">₹{b.totalPrice?.toLocaleString('en-IN')}</strong>
                                  </td>
                                  <td>
                                    <span className={`payment-pill ${b.paymentStatus || 'paid'}`}>
                                      <i className="fa-solid fa-shield-check"></i> {b.paymentStatus || 'paid'}
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

              {/* TAB 4: ANALYTICS & FINANCIALS */}
              {activeTab === 'analytics' && (
                <div className="tab-analytics">

                  <div className="analytics-summary-cards">
                    <div className="financial-card glass-morphism">
                      <div className="fin-icon gold"><i className="fa-solid fa-wallet"></i></div>
                      <h4>Total Gross Earnings</h4>
                      <h2>₹{totalRevenue.toLocaleString('en-IN')}</h2>
                      <p className="trend-up"><i className="fa-solid fa-arrow-trend-up"></i> +24% vs last month</p>
                    </div>

                    <div className="financial-card glass-morphism">
                      <div className="fin-icon emerald"><i className="fa-solid fa-chart-pie"></i></div>
                      <h4>Average Stay Value</h4>
                      <h2>₹{bookings.length > 0 ? Math.round(totalRevenue / bookings.length).toLocaleString('en-IN') : 0}</h2>
                      <p><i className="fa-solid fa-circle-check"></i> Based on {totalBookings} guest stays</p>
                    </div>

                    <div className="financial-card glass-morphism">
                      <div className="fin-icon blue"><i className="fa-solid fa-building-columns"></i></div>
                      <h4>Bank Payout Status</h4>
                      <h2>₹{totalRevenue.toLocaleString('en-IN')}</h2>
                      <p className="trend-up"><i className="fa-solid fa-shield-halved"></i> Direct Bank Transfer Active</p>
                    </div>
                  </div>

                  {/* Property-by-Property Financial Breakdown */}
                  <div className="financial-breakdown-card glass-morphism">
                    <div className="breakdown-header">
                      <h3><i className="fa-solid fa-money-bill-trend-up" style={{ color: 'var(--accent-gold)' }}></i> Payout & Property Revenue Distribution</h3>
                      <span className="payout-status-badge"><i className="fa-solid fa-circle-check"></i> Auto-settlement active</span>
                    </div>

                    <div className="payout-list">
                      {properties.length === 0 ? (
                        <p className="no-data-text">No property revenue records available.</p>
                      ) : (
                        properties.map(p => {
                          const propBookings = bookings.filter(b => b.property?._id === p._id || b.property?.name === p.name);
                          const propRevenue = propBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
                          const occupancy = Math.min(100, Math.round((propBookings.length / 5) * 100));
                          return (
                            <div key={p._id} className="payout-row-fancy">
                              <div className="payout-prop-thumb">
                                {p.photos && p.photos.length > 0 ? (
                                  <img src={p.photos[0]} alt={p.name} />
                                ) : (
                                  <div className="no-img"><i className="fa-solid fa-building"></i></div>
                                )}
                              </div>

                              <div className="payout-prop-info">
                                <h4>{p.name}</h4>
                                <p><i className="fa-solid fa-location-dot"></i> {p.location} • <span className="type-tag">{p.type}</span></p>
                                <div className="occupancy-bar-wrap">
                                  <div className="occupancy-progress" style={{ width: `${occupancy || 20}%` }}></div>
                                </div>
                              </div>

                              <div className="payout-stats-group">
                                <div className="stat-unit">
                                  <span className="label">Total Stays</span>
                                  <span className="val">{propBookings.length} Bookings</span>
                                </div>
                                <div className="stat-unit">
                                  <span className="label">Gross Earnings</span>
                                  <span className="val gold">₹{propRevenue.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: CARETAKER REQUESTS */}
              {activeTab === 'caretakers' && (
                <div className="tab-caretakers">
                  {/* Header Card */}
                  <div className="glass-morphism" style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(145deg, rgba(27, 38, 44, 0.9) 0%, rgba(15, 23, 30, 0.9) 100%)', border: '1px solid rgba(212, 175, 55, 0.3)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fa-solid fa-user-shield"></i> Caretaker & Staff Allocation Requests
                      </h3>
                      <p style={{ margin: '6px 0 0 0', color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.88rem' }}>
                        Submit official caretaker and property host requests directly to the Admin Panel. Verified staff will be assigned to manage guest check-in, key handover & housekeeping.
                      </p>
                    </div>
                    <button
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
                      style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '12px 22px', borderRadius: '24px', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 16px rgba(212, 175, 55, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <i className="fa-solid fa-paper-plane"></i> Send Request for Caretaker to Admin Panel
                    </button>
                  </div>

                  {/* Summary Stat Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' }}>Total Requests Sent</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff', marginTop: '4px' }}>{caretakerApps.length}</div>
                    </div>
                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>Allocated & Approved</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                        {caretakerApps.filter(a => a.status === 'approved').length}
                      </div>
                    </div>
                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '600', textTransform: 'uppercase' }}>Pending Admin Verification</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
                        {caretakerApps.filter(a => a.status === 'pending').length}
                      </div>
                    </div>
                  </div>

                  {/* Applications List */}
                  {caretakerApps.length === 0 ? (
                    <div className="glass-morphism" style={{ padding: '48px', borderRadius: '20px', textAlign: 'center', border: '1px border-dashed rgba(212, 175, 55, 0.3)' }}>
                      <i className="fa-solid fa-user-shield" style={{ fontSize: '3rem', color: '#d4af37', marginBottom: '16px' }}></i>
                      <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Caretaker Requests Sent Yet</h3>
                      <p style={{ color: 'rgba(255, 255, 255, 0.7)', maxWidth: '480px', margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
                        You have not sent any caretaker requests to the Admin Panel. Click below to request dedicated staff for your property stays.
                      </p>
                      <button
                        onClick={() => setShowCaretakerModal(true)}
                        style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '12px 24px', borderRadius: '24px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-paper-plane"></i> Send Request for Caretaker to Admin Panel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                      {caretakerApps.map((app, idx) => (
                        <div key={app._id || idx} className="glass-morphism" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(160deg, rgba(27,38,44,0.7) 0%, rgba(15,23,30,0.85) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <h4 style={{ margin: 0, color: '#ffd700', fontSize: '1.1rem', fontWeight: '700' }}>
                                <i className="fa-solid fa-building-user" style={{ marginRight: '6px' }}></i> {app.propertyName}
                              </h4>
                              <span style={{
                                background: app.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : app.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: app.status === 'approved' ? '#10b981' : app.status === 'rejected' ? '#ef4444' : '#f59e0b',
                                border: app.status === 'approved' ? '1px solid #10b981' : app.status === 'rejected' ? '1px solid #ef4444' : '1px solid #f59e0b',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                              }}>
                                {app.status === 'approved' ? 'Allocated & Approved' : app.status === 'rejected' ? 'Rejected' : 'Pending Admin Approval'}
                              </span>
                            </div>

                            <p style={{ margin: '0 0 10px 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                              <i className="fa-solid fa-location-dot" style={{ color: '#d4af37', marginRight: '6px' }}></i> {app.propertyAddress || 'Mahabaleshwar, Satara'}
                            </p>

                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px', fontSize: '0.83rem' }}>
                              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Requested Role</div>
                              <div style={{ fontWeight: '700', color: '#ffffff' }}>{app.positionRole || 'Chief Caretaker Host'}</div>
                              <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Experience: {app.experience || '3 - 5 Years'}</div>
                            </div>

                            {app.assignedCaretakerName && (
                              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: '12px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>
                                  <i className="fa-solid fa-circle-check"></i> Admin Allocated Caretaker
                                </div>
                                <div style={{ fontWeight: '800', color: '#ffffff', marginTop: '2px', fontSize: '0.92rem' }}>
                                  {app.assignedCaretakerName}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                  {app.assignedCaretakerPhone || '+91 98901 23456'}
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <button
                              onClick={() => openWhatsAppOwnerToCaretaker(app)}
                              style={{ flex: 1, background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: '#ffffff', border: 'none', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <i className="fa-brands fa-whatsapp"></i> WhatsApp Caretaker
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: CARETAKER DAILY TASKS & GUEST REQUIREMENTS */}
              {activeTab === 'caretaker-tasks' && (
                <div className="tab-caretaker-tasks">
                  {/* Header Profile & Caretaker Status Card */}
                  <div className="glass-morphism" style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(145deg, rgba(27, 38, 44, 0.9) 0%, rgba(15, 23, 30, 0.9) 100%)', border: '1px solid rgba(212, 175, 55, 0.3)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37 0%, #10b981 100%)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '900' }}>
                        <i className="fa-solid fa-user-shield"></i>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Chief Estate Caretaker: Ramesh Pawar
                          <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>SHIFT ON DUTY</span>
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem' }}>
                          Assigned Estate: <strong>Royal Mist Villa Estate</strong> • +91 98901 23456 • Duty Shift: 07:00 AM - 09:00 PM
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setShowAddTaskModalOwner(true)}
                        style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '10px 18px', borderRadius: '20px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <i className="fa-solid fa-plus-circle"></i> Assign New Daily Task
                      </button>
                      <button
                        onClick={() => setShowAddReqModalOwner(true)}
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '20px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <i className="fa-solid fa-user-plus"></i> Add Guest Requirement
                      </button>
                    </div>
                  </div>

                  {/* Summary Stat Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' }}>Daily Shift Tasks</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#ffffff', marginTop: '4px' }}>{ownerDuties.length} Tasks</div>
                      <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>
                        {ownerDuties.filter(d => d.completed).length} Completed • {ownerDuties.filter(d => !d.completed).length} Pending
                      </div>
                    </div>

                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '600', textTransform: 'uppercase' }}>Guest Special Requests</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                        {ownerGuestReqs.reduce((sum, g) => sum + g.specialRequests.length, 0)} Total Reqs
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                        {ownerGuestReqs.reduce((sum, g) => sum + g.specialRequests.filter(r => r.done).length, 0)} Completed by Caretaker
                      </div>
                    </div>

                    <div className="glass-morphism" style={{ padding: '18px', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '600', textTransform: 'uppercase' }}>Caretaker Stock Status</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
                        {ownerInventory.filter(i => i.status !== 'In Stock').length} Low Stock Alert
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                        {ownerInventory.length} Total Inventory Items
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Daily Shift Duties Assigned to Caretaker */}
                  <div className="glass-morphism" style={{ padding: '24px', borderRadius: '18px', background: 'rgba(12,20,18,0.85)', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-list-check"></i> Daily Shift Tasks Assigned to Caretaker
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>
                          Caretaker checks off tasks in real-time. Completed items lock automatically into non-clickable status.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddTaskModalOwner(true)}
                        style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '8px 16px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        + Assign Task
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {ownerDuties.map(d => (
                        <div key={d.id} style={{
                          background: d.completed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                          border: d.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '14px 18px',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <span style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: d.completed ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                              color: d.completed ? '#10b981' : '#a3b18a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem'
                            }}>
                              <i className={`fa-solid ${d.completed ? 'fa-check' : 'fa-clock'}`}></i>
                            </span>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ffffff', textDecoration: d.completed ? 'line-through' : 'none' }}>
                                {d.title}
                              </div>
                              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                                Time: {d.time} • Category: {d.category} • Priority: <strong style={{ color: d.priority === 'High' ? '#ef4444' : '#f59e0b' }}>{d.priority}</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {d.completed ? (
                              <span style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', fontWeight: '800' }}>
                                <i className="fa-solid fa-lock"></i> COMPLETED BY CARETAKER
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', color: '#f59e0b', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', fontWeight: '800' }}>
                                <i className="fa-solid fa-hourglass-half"></i> PENDING CARETAKER
                              </span>
                            )}

                            <button
                              onClick={() => handleOwnerDeleteTask(d.id)}
                              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem' }}
                              title="Delete Task"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Guest-Specific Requirements Assigned to Caretaker */}
                  <div className="glass-morphism" style={{ padding: '24px', borderRadius: '18px', background: 'rgba(12,20,18,0.85)', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-users-gear"></i> Guest Stay Requirements & Special Requests
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>
                          Assign guest-specific preparation requirements (welcome drinks, extra bedding, baby cot, dinner setup) to Caretaker.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddReqModalOwner(true)}
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        + Add Guest Requirement
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                      {ownerGuestReqs.map(g => (
                        <div key={g.id} className="glass-morphism" style={{ padding: '18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20,30,26,0.6)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: '700' }}>{g.guestName}</h4>
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Booking ID: {g.id} • {g.rooms}</span>
                            </div>
                            <span style={{ background: 'rgba(212,175,55,0.2)', border: '1px solid #d4af37', color: '#ffd700', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                              Check-In: {g.checkIn}
                            </span>
                          </div>

                          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffd700', marginBottom: '8px', textTransform: 'uppercase' }}>
                              Caretaker Special Requests Checklist
                            </div>
                            {g.specialRequests.map((req, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: req.done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                                border: req.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                marginBottom: '6px',
                                fontSize: '0.83rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <i className={`fa-solid ${req.done ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: req.done ? '#10b981' : 'rgba(255,255,255,0.4)' }}></i>
                                  <span style={{ color: '#ffffff', textDecoration: req.done ? 'line-through' : 'none' }}>{req.label}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {req.done ? (
                                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800' }}>DONE</span>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: '800' }}>PENDING</span>
                                  )}
                                  <button
                                    onClick={() => handleOwnerDeleteGuestReq(g.id, idx)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '4px' }}
                                    title="Delete Requirement"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Caretaker Stock & Inventory Live Monitor */}
                  <div className="glass-morphism" style={{ padding: '24px', borderRadius: '18px', background: 'rgba(12,20,18,0.85)', border: '1px solid rgba(212,175,55,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-boxes-stacked"></i> Caretaker Villa Consumable Stock Inventory
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>
                          Monitor live supplies reported by Caretaker (Linen, Towels, Mineral Water Cases, Bonfire Wood, LPG Cylinders) & restock instantly.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                      {ownerInventory.map(item => (
                        <div key={item.id} className="glass-morphism" style={{ padding: '16px', borderRadius: '14px', border: item.status === 'In Stock' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(239,68,68,0.4)', background: item.status === 'In Stock' ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.92rem', fontWeight: '700' }}>{item.item}</h4>
                            <span style={{
                              background: item.status === 'In Stock' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                              color: item.status === 'In Stock' ? '#10b981' : '#ef4444',
                              border: item.status === 'In Stock' ? '1px solid #10b981' : '1px solid #ef4444',
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: '800'
                            }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ margin: '10px 0 12px 0', fontSize: '1.4rem', fontWeight: '800', color: '#ffd700' }}>
                            {item.qty} <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', fontWeight: '400' }}>{item.unit}</span>
                          </div>
                          <button
                            onClick={() => handleOwnerRestockStock(item.id, 5)}
                            style={{ width: '100%', background: 'linear-gradient(135deg, #d4af37 0%, #b89628 100%)', color: '#1a1a1a', border: 'none', padding: '8px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <i className="fa-solid fa-cart-plus"></i> Approve +5 Restock
                          </button>
                        </div>
                      ))}
                    </div>
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
                  <label><i className="fa-solid fa-map-location-dot" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Google Maps Live Location Link</label>
                  <input
                    type="url"
                    value={propertyForm.mapLink || ''}
                    onChange={(e) => setPropertyForm({ ...propertyForm, mapLink: e.target.value })}
                    placeholder="e.g. https://maps.app.goo.gl/... or https://maps.google.com/?q=..."
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                    Paste exact Google Maps URL so guests can view live GPS pin & directions on the map.
                  </small>
                </div>

                {/* Provided Stay Amenities & Resources Checklist */}
                <div className="form-group">
                  <label>
                    <i className="fa-solid fa-list-check" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i>
                    Stay Amenities & Provided Resources ({propertyForm.amenities?.length || 0} Selected)
                  </label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '-4px', marginBottom: '10px' }}>
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
                  <label><i className="fa-solid fa-camera" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Property Photos (Upload Directly)</label>
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
                  <label><i className="fa-solid fa-video" style={{ color: 'var(--accent-gold)', marginRight: '6px' }}></i> Property HD Video Tours (Upload Directly from Device)</label>
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
                      <i className="fa-solid fa-film" style={{ color: 'var(--accent-gold)' }}></i>
                      <span>Select Video Files from Computer / Mobile</span>
                      <small>Upload MP4, WEBM, MOV • Multiple videos supported</small>
                    </label>
                  </div>

                  {Array.isArray(propertyForm.videos) && propertyForm.videos.length > 0 && (
                    <div className="uploaded-thumbnails-grid" style={{ marginTop: '12px' }}>
                      {propertyForm.videos.map((vid, idx) => (
                        <div key={idx} className="thumb-item" style={{ height: '90px' }}>
                          <video src={vid} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.75)', color: '#d4af37', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
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
            <div className="modal-content glass-morphism" style={{ maxWidth: '620px', width: '100%', padding: '28px', borderRadius: '24px', background: 'linear-gradient(145deg, #1b262c 0%, #0f171e 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif' }}>
                    <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }}></i> Send Caretaker Request to Admin Panel
                  </h3>
                  <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.85rem' }}>Submit official request for verified caretakers, housekeepers, and villa staff to the Admin Command Center.</p>
                </div>
                <button onClick={() => setShowCaretakerModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer' }}>×</button>
              </div>

              <form onSubmit={handleCaretakerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Property Selection & Address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                      <i className="fa-solid fa-hotel" style={{ marginRight: '6px' }}></i> Target Property Name *
                    </label>
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
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                      required
                    >
                      <option value="" style={{ background: '#1b262c', color: '#fff' }}>Select a Property...</option>
                      <option value="All Managed Stays" style={{ background: '#1b262c', color: '#fff' }}>All My Managed Properties</option>
                      {properties.map(p => (
                        <option key={p._id} value={p.name} style={{ background: '#1b262c', color: '#fff' }}>{p.name} ({p.location})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                      <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> Property Address / Location *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Metgutad, Panchgani-Mahabaleshwar Highway"
                      value={caretakerForm.propertyAddress}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, propertyAddress: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                {/* Exact Position & Experience Required */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                      <i className="fa-solid fa-user-tag" style={{ marginRight: '6px' }}></i> Exact Position / Staff Role Required *
                    </label>
                    <select
                      value={caretakerForm.positionRole}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, positionRole: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    >
                      <option value="Chief Villa Caretaker Host" style={{ background: '#1b262c', color: '#fff' }}>Chief Villa Caretaker Host</option>
                      <option value="Senior Estate Manager & Host" style={{ background: '#1b262c', color: '#fff' }}>Senior Estate Manager & Host</option>
                      <option value="Housekeeping & Linen Supervisor" style={{ background: '#1b262c', color: '#fff' }}>Housekeeping & Linen Supervisor</option>
                      <option value="Culinary Chef & Dining Host" style={{ background: '#1b262c', color: '#fff' }}>Culinary Chef & Dining Host</option>
                      <option value="Maintenance & Electrical Technician" style={{ background: '#1b262c', color: '#fff' }}>Maintenance & Electrical Technician</option>
                      <option value="Night Gate & Security Officer" style={{ background: '#1b262c', color: '#fff' }}>Night Gate & Security Officer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                      <i className="fa-solid fa-award" style={{ marginRight: '6px' }}></i> Caretaker Experience Required *
                    </label>
                    <select
                      value={caretakerForm.experience}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, experience: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    >
                      <option value="1 - 3 Years" style={{ background: '#1b262c', color: '#fff' }}>1 - 3 Years (Junior Staff)</option>
                      <option value="3 - 5 Years" style={{ background: '#1b262c', color: '#fff' }}>3 - 5 Years (Experienced Caretaker)</option>
                      <option value="5+ Years" style={{ background: '#1b262c', color: '#fff' }}>5+ Years (Senior Villa Manager)</option>
                    </select>
                  </div>
                </div>

                {/* Required Skills Picker */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
                    <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i> Required Skills & Duties (Click to toggle)
                  </label>
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
                          style={{
                            background: isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                            border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                            color: isSelected ? '#10b981' : '#cbd5e1',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
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
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Host Phone (10 Digits)</label>
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
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    />
                    {caretakerForm.phone && caretakerForm.phone.length > 0 && caretakerForm.phone.length !== 10 && (
                      <small style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        Must be 10 digits ({caretakerForm.phone.length}/10)
                      </small>
                    )}
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Verification ID Type</label>
                    <select
                      value={caretakerForm.govtIdType || 'Aadhaar Card'}
                      onChange={(e) => setCaretakerForm({ ...caretakerForm, govtIdType: e.target.value, govtId: '' })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    >
                      <option value="Aadhaar Card" style={{ background: '#1b262c', color: '#fff' }}>Aadhaar Card (12 Digits)</option>
                      <option value="PAN Card" style={{ background: '#1b262c', color: '#fff' }}>PAN Card (10 Chars)</option>
                      <option value="Driving License" style={{ background: '#1b262c', color: '#fff' }}>Driving License</option>
                      <option value="Voter ID Card" style={{ background: '#1b262c', color: '#fff' }}>Voter ID Card</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>
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
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#d4af37', marginBottom: '6px' }}>Special Instructions & Staff Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Mention guest check-in preferences, key handling rules, maintenance needs, or special staff requirements..."
                    value={caretakerForm.bio}
                    onChange={(e) => setCaretakerForm({ ...caretakerForm, bio: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem', fontFamily: 'inherit' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button
                    type="submit"
                    disabled={submittingCaretaker}
                    style={{ flex: 1, padding: '14px 20px', borderRadius: '50px', background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)', color: '#1a1a1a', border: 'none', fontWeight: '800', fontSize: '1rem', cursor: submittingCaretaker ? 'not-allowed' : 'pointer' }}
                  >
                    {submittingCaretaker ? 'Submitting Application...' : 'Submit Caretaker Application'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCaretakerModal(false)}
                    style={{ padding: '14px 22px', borderRadius: '50px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW CARETAKER DETAILS CARD MODAL */}
        {viewingCaretakerApp && (
          <div className="modal-overlay">
            <div className="modal-content glass-morphism" style={{ maxWidth: '650px', width: '100%', padding: '28px', borderRadius: '24px', background: 'linear-gradient(145deg, #1b262c 0%, #0f171e 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.75)' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(212, 175, 55, 0.15)', color: '#ffd700', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px' }}>
                    <i className="fa-solid fa-shield-halved"></i> Caretaker Application Record
                  </span>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
                    {viewingCaretakerApp.propertyName || 'All Managed Properties'}
                  </h3>
                </div>
                <button onClick={() => setViewingCaretakerApp(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.8 }}>×</button>
              </div>

              {/* Content Body Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Status Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '14px 18px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Application Status</span>
                    <strong style={{ fontSize: '1rem', color: viewingCaretakerApp.status === 'approved' ? '#52b788' : '#ffd700', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      {viewingCaretakerApp.status === 'approved' ? 'Caretaker Allocated & Assigned' : 'Pending Admin Allocation'}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Date Submitted</span>
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '600' }}>
                      {new Date(viewingCaretakerApp.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Allocated Caretaker Staff Banner */}
                {viewingCaretakerApp.status === 'approved' && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)', border: '1px solid #10b981', borderRadius: '16px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                          <i className="fa-solid fa-user-shield"></i>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#52b788', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>Admin Allocated Caretaker</span>
                          <strong style={{ fontSize: '1.1rem', color: '#ffffff', display: 'block', marginTop: '2px' }}>
                            {viewingCaretakerApp.assignedCaretakerName || 'Suresh Pawar (Certified Caretaker)'}
                          </strong>
                          <span style={{ fontSize: '0.88rem', color: '#ffd700', fontWeight: '700', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-phone"></i> Contact Mobile: {viewingCaretakerApp.assignedCaretakerPhone || '+91 98901 23456'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => openWhatsAppOwnerToCaretaker(viewingCaretakerApp)}
                        style={{
                          background: '#25D366',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '24px',
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)'
                        }}
                      >
                        <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Chat on WhatsApp
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i> Property Address & Location
                    </span>
                    <p style={{ margin: 0, color: '#f2ece4', fontSize: '0.92rem', fontWeight: '600' }}>
                      {viewingCaretakerApp.propertyAddress || viewingCaretakerApp.city || 'Mahabaleshwar, Satara'}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      <i className="fa-solid fa-user-tag" style={{ marginRight: '6px' }}></i> Required Position / Role
                    </span>
                    <p style={{ margin: 0, color: '#ffd700', fontSize: '0.92rem', fontWeight: '700' }}>
                      {viewingCaretakerApp.positionRole || 'Chief Villa Caretaker Host'}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      <i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i> Host Contact Phone
                    </span>
                    <p style={{ margin: 0, color: '#52b788', fontSize: '0.92rem', fontWeight: '700' }}>
                      {viewingCaretakerApp.phone}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      <i className="fa-solid fa-award" style={{ marginRight: '6px' }}></i> Caretaker Experience
                    </span>
                    <p style={{ margin: 0, color: '#38bdf8', fontSize: '0.92rem', fontWeight: '700' }}>
                      {viewingCaretakerApp.experience}
                    </p>
                  </div>
                </div>

                {/* Govt ID Verification Details */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                    <i className="fa-solid fa-id-card" style={{ marginRight: '6px' }}></i> Govt ID Verification Details
                  </span>
                  <p style={{ margin: 0, color: '#ffffff', fontSize: '0.92rem', fontWeight: '600' }}>
                    {viewingCaretakerApp.govtId || 'Provided & Verified by Admin'}
                  </p>
                </div>

                {/* Required Skills & Duties Tags */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                    <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i> Required Skills & Duties
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(Array.isArray(viewingCaretakerApp.skillsRequired) && viewingCaretakerApp.skillsRequired.length > 0 ? viewingCaretakerApp.skillsRequired : viewingCaretakerApp.services || []).map((svc, i) => (
                      <span key={i} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fa-solid fa-check"></i> {svc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Special Notes */}
                {viewingCaretakerApp.bio && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                      <i className="fa-solid fa-note-sticky" style={{ marginRight: '6px' }}></i> Special Instructions & Staff Notes
                    </span>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5', fontStyle: 'italic' }}>
                      "{viewingCaretakerApp.bio}"
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setViewingCaretakerApp(null)}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #b38f28 100%)',
                    color: '#1a1a1a',
                    border: 'none',
                    padding: '10px 26px',
                    borderRadius: '30px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Close Details Card
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OWNER ASSIGN DAILY TASK MODAL */}
        {showAddTaskModalOwner && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3><i className="fa-solid fa-list-check" style={{ color: 'var(--accent-gold)' }}></i> Assign Daily Task to Caretaker</h3>
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

                <button type="submit" className="btn-primary-gold" style={{ marginTop: '14px' }}>
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
                <h3><i className="fa-solid fa-user-plus" style={{ color: '#10b981' }}></i> Assign Requirement for Guest Stay</h3>
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

                <button type="submit" className="btn-primary-gold" style={{ marginTop: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}>
                  <i className="fa-solid fa-check"></i> Assign Requirement to Caretaker
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;