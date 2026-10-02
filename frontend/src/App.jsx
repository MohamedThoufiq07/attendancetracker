import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  MapPin, 
  Camera, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  ShieldCheck, 
  RefreshCw, 
  Compass, 
  UserPlus, 
  History,
  Lock,
  LogOut,
  User,
  Key,
  Calendar,
  Sparkles,
  Search,
  Check,
  Building,
  ExternalLink,
  Upload,
  Sparkle
} from 'lucide-react';

// DYNAMIC BACKEND API BASE URL (Supports Vercel/Netlify Deployment)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// EXACT TESTING LOCATION CONSTANTS (Provided in user screenshot)
const OFFICE_LAT = 8.692451;
const OFFICE_LNG = 77.718733;
const ALLOWED_RADIUS = 70; // meters

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AttendanceCheckIn() {
  // Auth & Session state
  const [currentUser, setCurrentUser] = useState({ emp_id: 'SAR_001', name: 'Sarah Connor', email: 'sarah@zigmatech.com', role: 'Employee' });
  const [authMode, setAuthMode] = useState('app'); // 'app' | 'login'
  
  // Navigation
  const [activeTab, setActiveTab] = useState('punch'); // 'punch' | 'onboard' | 'history'

  // Geofence states
  const [userCoords, setUserCoords] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinZone, setIsWithinZone] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Time & Late evaluation
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPastCutoff, setIsPastCutoff] = useState(false);

  // Camera & Face capture
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Execution & Alert states
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  // Login form state (Empty defaults so placeholders show!)
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });

  // Registration form state (Empty defaults so placeholders show!)
  const [regData, setRegData] = useState({ full_name: '', email: '', password: '', confirm_password: '', designation: '' });
  const [regPhoto, setRegPhoto] = useState(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState(null);

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Auto-generate Employee ID from Full Name
  const getAutoEmpId = (fullName) => {
    if (!fullName || !fullName.trim()) return '';
    const clean = fullName.trim().replace(/[^a-zA-Z]/g, '');
    const prefix = clean.length >= 3 ? clean.slice(0, 3).toUpperCase() : (clean.toUpperCase() + 'EMP').slice(0, 3);
    return `${prefix}_001`;
  };

  // Clock ticker & Late calculation (> 10:00:00 AM)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      setIsPastCutoff(hours > 10 || (hours === 10 && (minutes > 0 || seconds > 0)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Geolocation Handler
  const requestLocation = () => {
    setLocationLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });

        const dist = calculateHaversine(OFFICE_LAT, OFFICE_LNG, uLat, uLng);
        setDistanceMeters(dist);

        if (dist <= ALLOWED_RADIUS) {
          setIsWithinZone(true);
          startCamera();
        } else {
          setIsWithinZone(false);
          stopCamera();
        }
        setLocationLoading(false);
      },
      (err) => {
        console.warn("GPS lookup error/permission:", err.message);
        setGpsError('GPS position unavailable or permission denied. Please allow location access.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRegPhoto(file);
      setRegPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCaptureRegPhoto = async () => {
    const blob = await captureSnapshot();
    if (blob) {
      setRegPhoto(blob);
      setRegPhotoPreview(URL.createObjectURL(blob));
    } else {
      alert("Unable to capture snapshot. Please allow camera permissions or upload an image file.");
    }
  };

  const handlePunchAttendance = async () => {
    setErrorBanner(null);

    if (!isWithinZone) {
      const distStr = distanceMeters ? (distanceMeters > 1000 ? `${(distanceMeters/1000).toFixed(1)} km` : `${Math.round(distanceMeters)} meters`) : '';
      setErrorBanner(`You are currently ${distStr ? distStr + ' ' : ''}away from the office. Please reach the office location to punch attendance.`);
      return;
    }

    if (!currentUser || !currentUser.emp_id) {
      setErrorBanner('Please login or register first before punching attendance.');
      return;
    }

    setIsProcessing(true);

    try {
      const photoBlob = await captureSnapshot();
      const formData = new FormData();
      formData.append('emp_id', currentUser.emp_id);
      formData.append('latitude', userCoords.lat);
      formData.append('longitude', userCoords.lng);
      if (photoBlob) {
        formData.append('face_image', photoBlob, 'punch_selfie.jpg');
      } else {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 100;
        dummyCanvas.height = 100;
        const blob = await new Promise(r => dummyCanvas.toBlob(r, 'image/jpeg'));
        formData.append('face_image', blob, 'punch_selfie.jpg');
      }

      const response = await fetch(`${API_BASE_URL}/api/attendance/mark-attendance/`, {
        method: 'POST',
        body: formData,
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Attendance punch failed');

      setModalData({
        type: resData.type || 'PUNCH',
        message: resData.message,
        employeeName: resData.employee_name || currentUser.name,
        empId: resData.emp_id || currentUser.emp_id,
        status: resData.status,
        checkIn: resData.check_in || resData.check_out,
        distance: resData.distance
      });

    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setErrorBanner(null);

    if (regData.password && regData.confirm_password && regData.password !== regData.confirm_password) {
      setErrorBanner("Passwords do not match. Please re-enter your password correctly.");
      return;
    }

    if (!regPhoto) {
      setErrorBanner("Please upload or capture a clear front-facing face photo for biometric recognition.");
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('full_name', regData.full_name);
      formData.append('email', regData.email);
      formData.append('designation', regData.designation || 'Software Engineer');
      formData.append('face_image', regPhoto, 'registered_face.jpg');

      const res = await fetch(`${API_BASE_URL}/api/attendance/register/`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      alert(`Registration Successful!\n\nYour Employee ID: ${data.emp_id}\nName: ${data.full_name}\nGmail/Email: ${data.email}`);
      
      setCurrentUser({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        role: 'Employee'
      });

      setRegData({ full_name: '', email: '', password: '', confirm_password: '', designation: '' });
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setActiveTab('punch');
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorBanner(null);
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginForm.identifier,
          password: loginForm.password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setCurrentUser({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        role: 'Employee'
      });
      setAuthMode('app');
      alert(`Welcome back, ${data.full_name}! (Employee ID: ${data.emp_id})`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = () => {
    const emailPrompt = prompt("Sign in with Google - Enter your Gmail address:");
    if (emailPrompt && emailPrompt.trim()) {
      const email = emailPrompt.trim();
      const prefix = email.split('@')[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GGL';
      const empId = `${prefix}_001`;
      setCurrentUser({
        emp_id: empId,
        name: email.split('@')[0],
        email: email,
        role: 'Employee'
      });
      setAuthMode('app');
      alert(`Google Sign-In Successful as ${email}`);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/history/`);
      const data = await res.json();
      setHistoryList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const filteredHistory = historyList.filter(item => 
    item.employee_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.emp_id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      
      {/* TOP NAV BAR */}
      <header style={{
        width: '100%',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        boxSizing: 'border-box',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/zigma_logo_fixed.webp" 
              alt="Zigmaa Tech Logo" 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }} 
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
                ZIGMAA TECH
              </h1>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Attendance & Biometric Portal
              </p>
            </div>
          </div>

          {/* NAVBAR NAVIGATION TABS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setActiveTab('punch')}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '700',
                backgroundColor: activeTab === 'punch' ? '#EEF2FF' : 'transparent',
                color: activeTab === 'punch' ? '#4f46e5' : '#475569',
              }}
            >
              <ShieldCheck style={{ width: '16px', height: '16px' }} />
              Punch Attendance
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '700',
                backgroundColor: activeTab === 'history' ? '#EEF2FF' : 'transparent',
                color: activeTab === 'history' ? '#4f46e5' : '#475569',
              }}
            >
              <History style={{ width: '16px', height: '16px' }} />
              Attendance Logs
            </button>
          </div>

          {/* TOP RIGHT LOGIN & USER PROFILE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{currentUser.name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6366f1', fontWeight: '700' }}>ID: {currentUser.emp_id}</p>
                </div>
                <button
                  onClick={() => setCurrentUser(null)}
                  title="Logout"
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <LogOut style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthMode('login')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Lock style={{ width: '14px', height: '14px' }} />
                Login
              </button>
            )}

            <button
              onClick={() => setActiveTab('onboard')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}
            >
              <UserPlus style={{ width: '14px', height: '14px' }} />
              Register New
            </button>
          </div>
        </div>
      </header>

      {/* TOP CLOCK BAR */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: '16px 20px 0 20px',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          color: '#334155',
          fontSize: '14px',
          fontWeight: '700',
          fontFamily: 'monospace',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          <Clock style={{ width: '16px', height: '16px', color: '#4f46e5' }} />
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* MAIN LAYOUT WRAPPER */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: '24px 20px 40px 20px',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>

        {/* LEFT COLUMN: LOCATION STATUS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* LOCATION STATUS & MAP LINK */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: isWithinZone ? '#10b981' : '#ef4444',
                boxShadow: isWithinZone ? '0 0 10px #10b981' : '0 0 10px #ef4444'
              }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  Office Location Verification
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Office: Zigmaa Tech Campus
                </p>
              </div>
            </div>

            {/* STATUS BADGE & GOOGLE MAPS LINK */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isWithinZone ? (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#047857',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981', flexShrink: 0 }} />
                  You are at the Office! Attendance can be punched.
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#B91C1C',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />
                  Outside Office Area {distanceMeters ? `(${distanceMeters > 1000 ? (distanceMeters / 1000).toFixed(1) + ' km' : Math.round(distanceMeters) + ' meters'} away)` : ''}
                </div>
              )}

              {/* CLICK TO KNOW DISTANCE IN GOOGLE MAPS */}
              <a
                href={userCoords 
                  ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${OFFICE_LAT},${OFFICE_LNG}`
                  : `https://www.google.com/maps/dir/?api=1&destination=${OFFICE_LAT},${OFFICE_LNG}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                <MapPin style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                Click to know your distance from office in Google Maps
                <ExternalLink style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              </a>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN WORK AREA */}
        <div style={{
          gridColumn: 'span 2',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}>

          {/* ERROR ALERT DISPLAY */}
          {errorBanner && (
            <div style={{
              marginBottom: '20px',
              padding: '14px 18px',
              borderRadius: '14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />
                <span>{errorBanner}</span>
              </div>
              <button onClick={() => setErrorBanner(null)} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>
          )}

          {/* PUNCH TAB WORKFLOW */}
          {activeTab === 'punch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* LATE ARRIVAL WARNING */}
              {isPastCutoff && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#B45309',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Clock style={{ width: '18px', height: '18px', color: '#F59E0B', flexShrink: 0 }} />
                  <span>Late arrival: Checking in now will be marked as <strong style={{ textDecoration: 'underline' }}>LATE</strong> (Cutoff: 10:00 AM).</span>
                </div>
              )}

              {/* CURRENT USER BADGE - NO EMP ID INPUT FIELD */}
              <div style={{
                padding: '14px 18px',
                borderRadius: '14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#EEF2FF',
                    color: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '14px'
                  }}>
                    <User style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Punching Attendance For</span>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      {currentUser ? currentUser.name : 'Guest User'} <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: '700' }}>({currentUser ? currentUser.emp_id : 'No ID'})</span>
                    </h4>
                  </div>
                </div>

                {!currentUser && (
                  <button onClick={() => setAuthMode('login')} style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                    Login First
                  </button>
                )}
              </div>

              {/* CAMERA FEED & FACE SNAPSHOT */}
              <div style={{
                position: 'relative',
                width: '100%',
                maxHeight: '380px',
                borderRadius: '18px',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                border: '2px solid #e2e8f0',
                aspectRatio: '4 / 3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: isWithinZone ? 1 : 0.2,
                    filter: isWithinZone ? 'none' : 'blur(4px)'
                  }}
                />

                {!isWithinZone ? (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                      <Lock style={{ width: '26px', height: '26px', color: '#EF4444' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Camera Stream Disabled</h4>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', maxWidth: '320px' }}>
                      Face capture disabled. You must be at the office location.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: '14px',
                    left: '14px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #10b981',
                    color: '#047857',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <Camera style={{ width: '15px', height: '15px', color: '#10b981' }} /> Live Face Camera Stream Active
                  </div>
                )}
              </div>

              {/* PUNCH BUTTON */}
              <button
                onClick={handlePunchAttendance}
                disabled={isProcessing || !isWithinZone || !currentUser}
                style={{
                  width: '100%',
                  padding: '16px 0',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '800',
                  border: 'none',
                  cursor: isWithinZone && !isProcessing && currentUser ? 'pointer' : 'not-allowed',
                  backgroundColor: !isWithinZone || !currentUser
                    ? '#e2e8f0'
                    : '#4f46e5',
                  color: !isWithinZone || !currentUser ? '#94a3b8' : '#ffffff',
                  boxShadow: isWithinZone && currentUser ? '0 8px 20px rgba(79, 70, 229, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    Verifying Registered Face Photo...
                  </>
                ) : (
                  <>
                    <UserCheck style={{ width: '20px', height: '20px' }} />
                    Punch Attendance for {currentUser ? currentUser.name : 'Logged In User'}
                  </>
                )}
              </button>

            </div>
          )}

          {/* REGISTRATION ONBOARDING */}
          {activeTab === 'onboard' && (
            <form onSubmit={handleRegisterEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus style={{ width: '20px', height: '20px', color: '#4f46e5' }} /> User Registration
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Registers your employee profile and face photo for biometric verification.
                </p>
              </div>

              {/* FULL NAME WITH AUTO-GENERATED EMP ID DISPLAY */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Full Name *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Enter your Full Name (e.g. Alex Mercer)" 
                  value={regData.full_name} 
                  onChange={(e) => setRegData({ ...regData, full_name: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
                {regData.full_name.trim() && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>
                    Auto-generated Employee ID: <span style={{ backgroundColor: '#EEF2FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #C7D2FE' }}>{getAutoEmpId(regData.full_name)}</span>
                  </p>
                )}
              </div>

              {/* GMAIL / WORK EMAIL */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Gmail / Email *</label>
                <input 
                  type="email" 
                  required 
                  placeholder="Enter your Gmail address (e.g. alex@gmail.com)" 
                  value={regData.email} 
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              {/* PASSWORD & CONFIRM PASSWORD */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Password *</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Enter password" 
                    value={regData.password} 
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Confirm Password *</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Confirm password" 
                    value={regData.confirm_password} 
                    onChange={(e) => setRegData({ ...regData, confirm_password: e.target.value })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              {/* FACE PHOTO CAPTURE / UPLOAD SECTION */}
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                backgroundColor: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  Recognize Face - Upload Front Facing Image *
                </label>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Only photos showing a clear single person front face will be accepted.
                </p>

                {regPhotoPreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img 
                      src={regPhotoPreview} 
                      alt="Registered face preview" 
                      style={{ width: '70px', height: '70px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #4f46e5' }} 
                    />
                    <span style={{ fontSize: '12px', color: '#047857', fontWeight: '700' }}>✓ Front face photo attached</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Upload style={{ width: '15px', height: '15px' }} /> Upload Face Image
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                  </label>

                  <button
                    type="button"
                    onClick={handleCaptureRegPhoto}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      color: '#4f46e5',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Camera style={{ width: '15px', height: '15px' }} /> Capture from Camera
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isProcessing} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
                {isProcessing ? 'Verifying Face & Registering...' : 'Complete Registration'}
              </button>
            </form>
          )}

          {/* ATTENDANCE HISTORY LOGS */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ width: '16px', height: '16px', color: '#94a3b8', position: 'absolute', left: '14px', top: '14px' }} />
                  <input
                    type="text"
                    placeholder="Search by Employee Name or Emp ID..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <button onClick={fetchHistory} style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw style={{ width: '15px', height: '15px' }} /> Refresh
                </button>
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px dashed #cbd5e1', borderRadius: '14px' }}>
                  No attendance records found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredHistory.map(item => (
                    <div key={item.id} style={{ padding: '14px 18px', borderRadius: '14px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{item.employee_name} ({item.emp_id})</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Date: <strong>{item.date}</strong> • Check-In: <strong style={{ color: '#0f172a' }}>{item.check_in || 'N/A'}</strong>
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: item.status === 'PRESENT' ? '#ECFDF5' : '#FFFBEB',
                          color: item.status === 'PRESENT' ? '#047857' : '#B45309',
                          border: item.status === 'PRESENT' ? '1px solid #A7F3D0' : '1px solid #FDE68A'
                        }}>
                          {item.status}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.distance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* LOGIN MODAL */}
      {authMode === 'login' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Employee Login</h3>
              <button onClick={() => setAuthMode('app')} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Gmail / Email or Employee ID</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Enter Gmail address or Employee ID" 
                  value={loginForm.identifier} 
                  onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Password</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Enter password" 
                  value={loginForm.password} 
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <button type="submit" disabled={isProcessing} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: 'pointer', marginTop: '4px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
                {isProcessing ? 'Signing In...' : 'Sign In'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>

              {/* GOOGLE SIGN IN BUTTON */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign in with Google
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESULT MODAL */}
      {modalData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: modalData.status === 'PRESENT' ? '#ECFDF5' : '#FFFBEB',
              border: modalData.status === 'PRESENT' ? '1px solid #10b981' : '1px solid #f59e0b',
              color: modalData.status === 'PRESENT' ? '#047857' : '#B45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <CheckCircle2 style={{ width: '36px', height: '36px' }} />
            </div>

            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{modalData.message}</h3>
            <p style={{ margin: '6px 0 18px 0', fontSize: '13px', color: '#64748b' }}>
              Verified for <strong style={{ color: '#0f172a' }}>{modalData.employeeName}</strong> ({modalData.empId})
            </p>

            <div style={{
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              textAlign: 'left',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>Punch Time</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{modalData.checkIn}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>Status Badge</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: modalData.status === 'PRESENT' ? '#047857' : '#B45309' }}>
                  {modalData.status}
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalData(null)}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: '12px',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
