import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import WebcamFaceCapture from './WebcamFaceCapture';
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
  Sparkle,
  Eye,
  EyeOff,
  ChevronDown,
  Edit3
} from 'lucide-react';

// DYNAMIC BACKEND API BASE URL (Supports Vercel/Netlify Deployment)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// EXACT TESTING LOCATION CONSTANTS (Updated from Google Maps screenshot: Kareem Shop area)
const OFFICE_LAT = 8.6928686;
const OFFICE_LNG = 77.7180183;
const ALLOWED_RADIUS = 300; // meters (Expanded testing radius)

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
  // Auth & Session state (Defaults to null - loads from localStorage if logged in)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('attendance_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('app'); // 'app' | 'login'

  const saveUserSession = (userData) => {
    setCurrentUser(userData);
    try {
      localStorage.setItem('attendance_user', JSON.stringify(userData));
    } catch (e) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('attendance_user');
    } catch (e) {}
  };
  
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
  const [punchCameraActive, setPunchCameraActive] = useState(false);
  const [onboardCameraActive, setOnboardCameraActive] = useState(false);
  const punchVideoRef = useRef(null);
  const punchCanvasRef = useRef(null);
  const onboardVideoRef = useRef(null);
  const onboardCanvasRef = useRef(null);

  // Execution & Alert states
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [notificationModal, setNotificationModal] = useState(null); // Custom popup modal { title, message, type: 'success' | 'error' | 'warning' }

  // User Profile & Dropdown menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', new_password: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state (Empty defaults so placeholders show!)
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });

  // Registration form state (Empty defaults so placeholders show!)
  const [regData, setRegData] = useState({ full_name: '', email: '', password: '', confirm_password: '', designation: '' });
  const [regPhoto, setRegPhoto] = useState(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState(null);
  const [faceValidating, setFaceValidating] = useState(false);
  const [faceValidError, setFaceValidError] = useState(null);

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

  // Real-time GPS Geolocation Tracker
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setLocationLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserCoords({ lat, lng });

        const dist = calculateHaversine(lat, lng, OFFICE_LAT, OFFICE_LNG);
        setDistanceMeters(dist);
        setIsWithinZone(dist <= ALLOWED_RADIUS);
        setLocationLoading(false);
        setGpsError(null);
      },
      (error) => {
        setGpsError("Location access denied or unavailable.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const startPunchCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      if (punchVideoRef.current) {
        punchVideoRef.current.srcObject = stream;
        setPunchCameraActive(true);
      }
    } catch (err) {
      setPunchCameraActive(false);
    }
  };

  const startOnboardCamera = async () => {
    try {
      setOnboardCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setTimeout(() => {
        if (onboardVideoRef.current) {
          onboardVideoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      alert("Unable to access camera: " + err.message);
      setOnboardCameraActive(false);
    }
  };

  const capturePunchSnapshot = () => {
    if (!punchVideoRef.current || !punchCanvasRef.current) return null;
    const canvas = punchCanvasRef.current;
    const video = punchVideoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const captureOnboardSnapshot = () => {
    if (!onboardVideoRef.current || !onboardCanvasRef.current) return null;
    const canvas = onboardCanvasRef.current;
    const video = onboardVideoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  useEffect(() => {
    if (activeTab === 'punch' && isWithinZone) {
      startPunchCamera();
    }
  }, [activeTab, isWithinZone]);

  // Face recognition & live bounding box overlay state
  const [punchFaceStatus, setPunchFaceStatus] = useState({ count: 0, text: 'Scanning for face...', isValid: false });
  const [onboardFaceStatus, setOnboardFaceStatus] = useState({ count: 0, text: 'Scanning for face...', isValid: false });
  const punchOverlayCanvasRef = useRef(null);
  const onboardOverlayCanvasRef = useRef(null);

  // Load face-api models on component mount
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  useEffect(() => {
    const loadModels = async () => {
      try {
        const api = faceapi || window.faceapi;
        if (api && api.nets) {
          await api.nets.tinyFaceDetector.loadFromUri('/models');
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.warn("face-api model loading error:", err);
      }
    };
    loadModels();
  }, []);

  // Real-time canvas detection loop for webcam feeds
  useEffect(() => {
    let animId;
    let isDetectorSupported = 'FaceDetector' in window;
    let nativeFaceDetector = isDetectorSupported ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 }) : null;

    const detectFacesLoop = async () => {
      const api = faceapi || window.faceapi;

      // 1. Process Punch Camera Stream Overlay
      if (activeTab === 'punch' && punchCameraActive && punchVideoRef.current && punchOverlayCanvasRef.current) {
        const video = punchVideoRef.current;
        const canvas = punchOverlayCanvasRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let detectedBoxes = [];
          if (api && api.detectAllFaces && isModelLoaded) {
            try {
              const detections = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
              detectedBoxes = detections.map(d => d.box);
            } catch (e) {}
          } else if (nativeFaceDetector) {
            try {
              const faces = await nativeFaceDetector.detect(video);
              detectedBoxes = faces.map(f => f.boundingBox);
            } catch (e) {}
          }

          if (detectedBoxes.length === 1) {
            const box = detectedBoxes[0];
            // Draw Dynamic Green Bounding Box (#22c55e / #10b981)
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#22c55e';
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw Label Tag Badge over box
            ctx.fillStyle = '#22c55e';
            const labelText = currentUser ? `✓ Verified: ${currentUser.name}` : '✓ Face Verified';
            ctx.font = 'bold 14px sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillRect(box.x, Math.max(0, box.y - 28), textWidth + 16, 26);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, box.x + 8, Math.max(18, box.y - 10));

            setPunchFaceStatus({ count: 1, text: '✓ Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            detectedBoxes.forEach(box => {
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#ef4444';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            });
            setPunchFaceStatus({ count: detectedBoxes.length, text: 'Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setPunchFaceStatus({ count: 0, text: 'Searching for face... Keep your head straight', isValid: false });
          }
        }
      }

      // 2. Process Registration Camera Stream Overlay
      if (activeTab === 'onboard' && onboardCameraActive && onboardVideoRef.current && onboardOverlayCanvasRef.current) {
        const video = onboardVideoRef.current;
        const canvas = onboardOverlayCanvasRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let detectedBoxes = [];
          if (api && api.detectAllFaces && isModelLoaded) {
            try {
              const detections = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
              detectedBoxes = detections.map(d => d.box);
            } catch (e) {}
          } else if (nativeFaceDetector) {
            try {
              const faces = await nativeFaceDetector.detect(video);
              detectedBoxes = faces.map(f => f.boundingBox);
            } catch (e) {}
          }

          if (detectedBoxes.length === 1) {
            const box = detectedBoxes[0];
            // Draw Dynamic Green Bounding Box
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#22c55e';
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw Label Tag Badge over box
            ctx.fillStyle = '#22c55e';
            const labelText = regData.full_name ? `✓ Verified: ${regData.full_name}` : '✓ Face Verified';
            ctx.font = 'bold 14px sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillRect(box.x, Math.max(0, box.y - 28), textWidth + 16, 26);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelText, box.x + 8, Math.max(18, box.y - 10));

            setOnboardFaceStatus({ count: 1, text: '✓ Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            detectedBoxes.forEach(box => {
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#ef4444';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            });
            setOnboardFaceStatus({ count: detectedBoxes.length, text: 'Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setOnboardFaceStatus({ count: 0, text: 'Searching for face... Keep your head straight', isValid: false });
          }
        }
      }

      animId = requestAnimationFrame(detectFacesLoop);
    };

    animId = requestAnimationFrame(detectFacesLoop);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, punchCameraActive, onboardCameraActive, currentUser, regData.full_name, isModelLoaded]);

  const verifyAndSetPhoto = async (fileOrBlob) => {
    setFaceValidating(true);
    setFaceValidError(null);
    setErrorBanner(null);

    try {
      const formData = new FormData();
      formData.append('face_image', fileOrBlob, 'face_check.jpg');

      const res = await fetch(`${API_BASE_URL}/api/attendance/verify-face/`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        const msg = data.error || "No human face detected. Only photos showing a human face are accepted.";
        setRegPhoto(null);
        setRegPhotoPreview(null);
        setFaceValidError(msg);
        return;
      }

      setRegPhoto(fileOrBlob);
      setRegPhotoPreview(URL.createObjectURL(fileOrBlob));
      setFaceValidError(null);
    } catch (err) {
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setFaceValidError('Face validation error: ' + err.message);
    } finally {
      setFaceValidating(false);
    }
  };

  const handleCaptureRegPhoto = async () => {
    if (!onboardCameraActive) {
      await startOnboardCamera();
    }
    const blob = await captureOnboardSnapshot();
    if (blob) {
      verifyAndSetPhoto(blob);
    } else {
      alert("Unable to capture snapshot. Please ensure your camera permission is allowed.");
    }
  };

  const handlePunchAttendance = async (capturedBlob) => {
    setErrorBanner(null);

    if (!isWithinZone) {
      const distStr = distanceMeters ? (distanceMeters > 1000 ? `${(distanceMeters/1000).toFixed(1)} km` : `${Math.round(distanceMeters)} meters`) : '';
      setNotificationModal({
        type: 'error',
        title: 'Outside Office Geofence',
        message: `You are currently ${distStr ? distStr + ' ' : ''}away from the office. Please reach the office location to punch attendance.`
      });
      return;
    }

    if (!currentUser || !currentUser.emp_id) {
      setNotificationModal({
        type: 'error',
        title: 'Login Required',
        message: 'Please login or register first before punching attendance.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const photoBlob = capturedBlob || await capturePunchSnapshot();
      const formData = new FormData();
      formData.append('emp_id', currentUser.emp_id);
      formData.append('latitude', userCoords.lat);
      formData.append('longitude', userCoords.lng);
      if (photoBlob) {
        formData.append('face_image', photoBlob, 'punch_selfie.jpg');
      }

      const response = await fetch(`${API_BASE_URL}/api/attendance/mark-attendance/`, {
        method: 'POST',
        body: formData,
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Attendance punch failed');
      }

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
      setNotificationModal({
        type: 'error',
        title: 'Face Verification Failed',
        message: err.message || 'Captured face does not match the registered employee photo. Verification failed.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setErrorBanner(null);

    if (regData.password && regData.confirm_password && regData.password !== regData.confirm_password) {
      setNotificationModal({
        type: 'error',
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please re-enter your password correctly.'
      });
      return;
    }

    if (!regPhoto) {
      setNotificationModal({
        type: 'error',
        title: 'Face Photo Required',
        message: 'Please capture a clear face photo using the camera before registering.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('full_name', regData.full_name);
      formData.append('email', regData.email);
      formData.append('password', regData.password);
      formData.append('designation', regData.designation || 'Software Engineer');
      formData.append('face_image', regPhoto, 'registered_face.jpg');

      const res = await fetch(`${API_BASE_URL}/api/attendance/register/`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      saveUserSession({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        role: 'Employee'
      });

      setRegData({ full_name: '', email: '', password: '', confirm_password: '', designation: '' });
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setActiveTab('punch');

      setNotificationModal({
        type: 'success',
        title: 'Registration Successful!',
        message: `Welcome, ${data.full_name}!\nEmployee ID: ${data.emp_id}\nEmail: ${data.email}`
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Registration Error',
        message: err.message
      });
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

      saveUserSession({
        emp_id: data.emp_id,
        name: data.full_name,
        email: data.email,
        role: 'Employee'
      });
      setAuthMode('app');
      
      setNotificationModal({
        type: 'success',
        title: 'Login Successful!',
        message: `Welcome back, ${data.full_name}!\n(Employee ID: ${data.emp_id})`
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Authentication Failed',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/update-profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          full_name: profileForm.full_name,
          email: profileForm.email,
          new_password: profileForm.new_password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      saveUserSession({
        ...currentUser,
        name: data.full_name,
        email: data.email
      });

      setProfileModalOpen(false);
      setNotificationModal({
        type: 'success',
        title: 'Profile Updated!',
        message: 'Your profile details have been saved successfully.'
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Update Error',
        message: err.message
      });
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
      saveUserSession({
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
          width: '100%',
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

          {/* TOP RIGHT LOGIN & USER PROFILE DROPDOWN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <User style={{ width: '16px', height: '16px', color: '#4f46e5' }} />
                  {currentUser.name}
                  <ChevronDown style={{ width: '14px', height: '14px', color: '#64748b' }} />
                </button>

                {/* USER DROPDOWN MENU */}
                {userMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '200px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                    padding: '6px'
                  }}>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setProfileForm({ full_name: currentUser.name || '', email: currentUser.email || '', new_password: '' });
                        setProfileModalOpen(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#334155',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <Edit3 style={{ width: '15px', height: '15px', color: '#4f46e5' }} />
                      View & Edit Profile
                    </button>

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#ef4444',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <LogOut style={{ width: '15px', height: '15px', color: '#ef4444' }} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* TOP CLOCK BAR */}
      <div style={{
        width: '100%',
        padding: '16px 32px 0 32px',
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
        padding: '24px 32px 40px 32px',
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
                      {currentUser ? currentUser.name : 'Guest User'}
                    </h4>
                  </div>
                </div>

                {!currentUser && (
                  <button onClick={() => setAuthMode('login')} style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                    Login First
                  </button>
                )}
              </div>

              {/* WEBCAM FACE CAPTURE FOR PUNCH ATTENDANCE */}
              {isWithinZone ? (
                <WebcamFaceCapture
                  mode="punch"
                  onCaptureSuccess={(blob) => handlePunchAttendance(blob)}
                  isProcessing={isProcessing}
                  userName={currentUser ? currentUser.name : 'Logged In User'}
                />
              ) : (
                <div style={{
                  width: '100%',
                  padding: '36px 20px',
                  borderRadius: '24px',
                  backgroundColor: '#FEF2F2',
                  border: '2px solid #FCA5A5',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px'
                  }}>
                    <Lock style={{ width: '28px', height: '28px', color: '#EF4444' }} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#991B1B' }}>Camera & Punch Disabled</h4>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#7F1D1D', maxWidth: '340px' }}>
                    You are outside the office geofence. Please reach the office location to access the camera and punch attendance.
                  </p>
                </div>
              )}

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

              {/* FULL NAME AND EMPLOYEE ID SIDE BY SIDE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Employee ID *</label>
                  <input 
                    type="text" 
                    readOnly
                    placeholder="Auto-generated ID" 
                    value={getAutoEmpId(regData.full_name) || 'Emp ID'} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F1F5F9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800', color: '#4f46e5', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Email *</label>
                <input 
                  type="email" 
                  required 
                  placeholder="Enter your email address (e.g. alex@company.com)" 
                  value={regData.email} 
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              {/* PASSWORD & CONFIRM PASSWORD WITH EYE TOGGLE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showRegPassword ? 'text' : 'password'} 
                      required 
                      placeholder="Enter password" 
                      value={regData.password} 
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })} 
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                    >
                      {showRegPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Confirm Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      required 
                      placeholder="Confirm password" 
                      value={regData.confirm_password} 
                      onChange={(e) => setRegData({ ...regData, confirm_password: e.target.value })} 
                      style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                    >
                      {showConfirmPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* FACE PHOTO CAPTURE SECTION - WEBCAM ONLY */}
              <div style={{
                padding: '18px',
                borderRadius: '16px',
                backgroundColor: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Camera style={{ width: '18px', height: '18px', color: '#4f46e5' }} /> Recognize Face - Live Webcam Capture *
                  </label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Capture a clear front-facing portrait using your device webcam.
                  </p>
                </div>

                <WebcamFaceCapture onCaptureSuccess={(blob, dataUrl) => {
                  setRegPhoto(blob);
                  setRegPhotoPreview(dataUrl);
                }} />

                {faceValidating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: '13px', fontWeight: '700' }}>
                    <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Analyzing camera biometrics for human face...
                  </div>
                )}

                {faceValidError && (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />
                    {faceValidError}
                  </div>
                )}
              </div>

              <button type="submit" disabled={isProcessing || faceValidating || !regPhoto} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: !regPhoto || faceValidating ? '#cbd5e1' : '#4f46e5', color: !regPhoto || faceValidating ? '#64748b' : '#ffffff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: !regPhoto || faceValidating ? 'not-allowed' : 'pointer', boxShadow: regPhoto ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none' }}>
                {faceValidating ? 'Analyzing Face Biometrics...' : isProcessing ? 'Registering...' : 'Complete Registration'}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Email or Employee ID</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Enter Email or Employee ID" 
                  value={loginForm.identifier} 
                  onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showLoginPassword ? 'text' : 'password'} 
                    required 
                    placeholder="Enter password" 
                    value={loginForm.password} 
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                    style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showLoginPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </div>
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

      {/* CUSTOM PROFESSIONAL POPUP MODAL (REPLACES BROWSER ALERT) */}
      {notificationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: notificationModal.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              border: notificationModal.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
              color: notificationModal.type === 'success' ? '#047857' : '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              {notificationModal.type === 'success' ? (
                <CheckCircle2 style={{ width: '32px', height: '32px', color: '#10b981' }} />
              ) : (
                <AlertTriangle style={{ width: '32px', height: '32px', color: '#ef4444' }} />
              )}
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              {notificationModal.title}
            </h3>
            
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5', whitespace: 'pre-line' }}>
              {notificationModal.message}
            </p>

            <button
              onClick={() => setNotificationModal(null)}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: '12px',
                backgroundColor: notificationModal.type === 'success' ? '#10b981' : '#4f46e5',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: notificationModal.type === 'success' ? '0 4px 14px rgba(16, 185, 129, 0.3)' : '0 4px 14px rgba(79, 70, 229, 0.3)'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {profileModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 style={{ width: '20px', height: '20px', color: '#4f46e5' }} /> Edit User Profile
              </h3>
              <button onClick={() => setProfileModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Employee ID</label>
                <input 
                  type="text" 
                  disabled
                  value={currentUser ? currentUser.emp_id : ''} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800', color: '#4f46e5', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={profileForm.full_name} 
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Email *</label>
                <input 
                  type="email" 
                  required 
                  value={profileForm.email} 
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Change Password (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPassword ? 'text' : 'password'} 
                    placeholder="Enter new password to change" 
                    value={profileForm.new_password} 
                    onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                    style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showNewPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '700', fontSize: '13px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{ flex: 1, padding: '12px 0', borderRadius: '10px', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '800', fontSize: '13px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
