import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import WebcamFaceCapture from './WebcamFaceCapture';
import FaceScanModalCapture from './FaceScanModalCapture';
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
  Edit3,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  Save
} from 'lucide-react';

// DYNAMIC BACKEND API BASE URL (Supports Vercel/Netlify Deployment)
const defaultProdUrl = 'https://attendancetracker-backend.vercel.app';
const rawApiUrl = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : defaultProdUrl);
const API_BASE_URL = rawApiUrl.trim().replace(/\/+$/, '');
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '299933614033-8hirtt0ghcikkk1cuq857v6vigsg3441.apps.googleusercontent.com';





// EXACT TESTING LOCATION CONSTANTS (Updated from user's specified office location: 8.7892563, 78.117146)
const DEFAULT_OFFICE_LAT = 8.7892563;
const DEFAULT_OFFICE_LNG = 78.117146;
const ALLOWED_RADIUS = 70; // 70 meters strict office geofence




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

  const saveUserSession = (userData, tokens = {}) => {
    setCurrentUser(userData);
    try {
      localStorage.setItem('attendance_user', JSON.stringify(userData));
      if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
      if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
    } catch (e) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setHistoryList([]);
    setActiveTab('punch');
    setAuthMode('login');
    try {
      localStorage.removeItem('attendance_user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } catch (e) {}
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken })
      });
      const data = await res.json();
      if (res.ok && data.access) {
        localStorage.setItem('access_token', data.access);
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
        return data.access;
      }
    } catch (err) {
      console.warn("Session refresh warning:", err);
    }

    // Refresh token expired (30 days) or blacklisted -> redirect to login
    handleLogout();
    setNotificationModal({
      type: 'warning',
      title: 'Session Expired',
      message: 'Your 30-day authentication session has expired. Please log in again.'
    });
    return null;
  };

  
  // Navigation
  const [activeTab, setActiveTab] = useState('punch'); // 'punch' | 'onboard' | 'history' | 'leave' | 'status'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);

  // Custom Dropdown Menus States
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [leaveTypeDropdownOpen, setLeaveTypeDropdownOpen] = useState(false);
  const [hoursDropdownOpen, setHoursDropdownOpen] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-custom-dropdown]')) {
        setMonthDropdownOpen(false);
        setLeaveTypeDropdownOpen(false);
        setHoursDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);
  // Helper function to format full request type label
  const getRequestTypeLabel = (type) => {
    switch (type) {
      case 'CASUAL': return 'Casual Leave';
      case 'SICK': return 'Sick Leave';
      case 'HALF_DAY': return 'Half Day Leave';
      case 'PERMISSION': return 'Permission Request';
      default: return type || 'Leave Request';
    }
  };
  // Pay Slip Pro pitch-black dark theme configuration
  const theme = {
    bg: isDarkMode ? '#09090b' : '#f8fafc',
    headerBg: isDarkMode ? '#09090b' : '#ffffff',
    cardBg: isDarkMode ? '#121215' : '#ffffff',
    cardInnerBg: isDarkMode ? '#18181b' : '#f8fafc',
    border: isDarkMode ? '#27272a' : '#e2e8f0',
    inputBorder: isDarkMode ? '#27272a' : '#cbd5e1',
    inputBg: isDarkMode ? '#18181b' : '#ffffff',
    textPrimary: isDarkMode ? '#f4f4f5' : '#0f172a',
    textSecondary: isDarkMode ? '#a1a1aa' : '#64748b',
    textMuted: isDarkMode ? '#71717a' : '#94a3b8',
    tableHeaderBg: isDarkMode ? '#18181b' : '#f1f5f9',
    tableRowBorder: isDarkMode ? '#1f1f23' : '#f1f5f9',
    mobileNavBg: isDarkMode ? 'rgba(9, 9, 11, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  };

  // Leave & Permission states
  const [leaveForm, setLeaveForm] = useState({
    request_type: 'CASUAL',
    start_date: '',
    end_date: '',
    duration_hours: '2',
    reason: ''
  });
  const [myLeavesList, setMyLeavesList] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const fetchMyLeaves = async () => {
    if (!currentUser || !currentUser.emp_id) return;
    setLoadingLeaves(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/my-leaves/?emp_id=${currentUser.emp_id}`);
      const data = await res.json();
      if (res.ok) {
        setMyLeavesList(data.leave_requests || []);
      }
    } catch (err) {
      console.warn("Error fetching leave requests:", err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setNotificationModal({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please login to submit leave or permission requests.'
      });
      return;
    }
    setIsProcessing(true);

    try {
      const isPermission = leaveForm.request_type === 'PERMISSION';
      const isHalfDay = leaveForm.request_type === 'HALF_DAY';
      const isSingleDate = isPermission || isHalfDay;

      const res = await fetch(`${API_BASE_URL}/api/attendance/leave-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          request_type: leaveForm.request_type,
          start_date: leaveForm.start_date,
          end_date: isSingleDate ? leaveForm.start_date : leaveForm.end_date,
          duration_hours: isPermission ? leaveForm.duration_hours : null,
          reason: leaveForm.reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      setNotificationModal({
        type: 'success',
        title: 'Request Submitted! 📝',
        message: isPermission
          ? `Your ${leaveForm.duration_hours}-hour permission request for ${leaveForm.start_date} has been submitted for approval.`
          : isHalfDay
          ? `Your Half Day Leave request for ${leaveForm.start_date} has been submitted for approval.`
          : `Your ${leaveForm.request_type} request from ${leaveForm.start_date} to ${leaveForm.end_date} has been submitted for approval.`
      });

      setLeaveForm({
        request_type: 'CASUAL',
        start_date: '',
        end_date: '',
        duration_hours: '2',
        reason: ''
      });

      fetchMyLeaves();
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'Submission Failed',
        message: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Geofence states
  const [officeLat, setOfficeLat] = useState(() => parseFloat(localStorage.getItem('OFFICE_LAT')) || DEFAULT_OFFICE_LAT);
  const [officeLng, setOfficeLng] = useState(() => parseFloat(localStorage.getItem('OFFICE_LNG')) || DEFAULT_OFFICE_LNG);
  const [userCoords, setUserCoords] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinZone, setIsWithinZone] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);


  // Time & Late evaluation
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

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
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', designation: '', phone_number: '', joining_date: '', new_password: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Google OAuth Modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state (Empty defaults so placeholders show!)
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });

  // Registration form state (Empty defaults so placeholders show!)
  const [regData, setRegData] = useState({
    full_name: '',
    emp_id: '',
    email: '',
    password: '',
    confirm_password: '',
    designation: '',
    joining_date: '',
    phone_number: ''
  });

  const [regPhoto, setRegPhoto] = useState(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState(null);
  const [regPhotoDescriptor, setRegPhotoDescriptor] = useState(null);
  const [allRegisteredDescriptors, setAllRegisteredDescriptors] = useState([]);
  const [faceValidating, setFaceValidating] = useState(false);
  const [faceValidError, setFaceValidError] = useState(null);

  const fetchRegisteredDescriptors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/registered-descriptors/`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAllRegisteredDescriptors(data);
      }
    } catch (err) {
      console.warn("Error fetching registered descriptors:", err);
    }
  };

  // History & Monthly Payroll state
  const [historyList, setHistoryList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(10);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [isSyncingPayslip, setIsSyncingPayslip] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

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

  const gsiInitializedRef = useRef(false);

  // Initialize Google Identity Services (GSI) & Render official Google Button statically
  useEffect(() => {
    const initGoogleGSI = () => {
      if (window.google?.accounts?.id) {
        try {
          if (!gsiInitializedRef.current) {
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: (response) => {
                if (response && response.credential) {
                  try {
                    const base64Url = response.credential.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(
                      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
                    );
                    const payload = JSON.parse(jsonPayload);
                    if (payload && payload.email) {
                      executeGoogleAuth(payload.email);
                    }
                  } catch (e) {
                    console.error("Error parsing Google OAuth JWT payload:", e);
                  }
                }
              }
            });
            gsiInitializedRef.current = true;
          }

          // Render official Google button statically only if container is empty
          const container = document.getElementById('googleSignInBtnDiv');
          if (container && container.children.length === 0) {
            window.google.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              width: 320,
              text: 'continue_with',
              shape: 'rectangular'
            });
          }
        } catch (err) {
          console.warn("Google Identity Services initialization warning:", err);
        }
      }
    };

    initGoogleGSI();
  }, [authMode]);





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

        const dist = calculateHaversine(lat, lng, officeLat, officeLng);
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
  }, [officeLat, officeLng]);


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

  // Load face-api models on component mount safely
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  useEffect(() => {
    const loadModels = async () => {
      try {
        const api = faceapi || window.faceapi;
        if (api && api.nets) {
          const cdnUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await api.nets.tinyFaceDetector.loadFromUri(cdnUrl);
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.warn("face-api CDN model load notice (using native FaceDetector fallback if available):", err);
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
            setPunchFaceStatus({ count: 1, text: '✓ Single Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            setPunchFaceStatus({ count: detectedBoxes.length, text: '⚠️ Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setPunchFaceStatus({ count: 0, text: 'Searching for face... Keep head straight', isValid: false });
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
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clean (no inner square boxes)

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
            setOnboardFaceStatus({ count: 1, text: '✓ Single Face Verified', isValid: true });
          } else if (detectedBoxes.length > 1) {
            setOnboardFaceStatus({ count: detectedBoxes.length, text: '⚠️ Multiple faces detected! Only 1 face allowed.', isValid: false });
          } else {
            setOnboardFaceStatus({ count: 0, text: 'Searching for face... Keep head straight', isValid: false });
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

  const handlePunchAttendance = async (capturedBlob, liveDescriptor = null) => {
    if (!isWithinZone) {
      const distStr = distanceMeters ? (distanceMeters > 1000 ? `${(distanceMeters/1000).toFixed(1)} km` : `${Math.round(distanceMeters)} meters`) : '';
      setNotificationModal({
        type: 'error',
        title: 'Outside Office Area',
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
      if (liveDescriptor && Array.isArray(liveDescriptor) && liveDescriptor.length === 128) {
        formData.append('face_descriptor', JSON.stringify(liveDescriptor));
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

      setHasCheckedIn(!hasCheckedIn);

    } catch (err) {
      const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      const isPunchRuleNotice = err.message && (
        err.message.includes('already recorded') || 
        err.message.includes('Check-Out') || 
        err.message.includes('Check-In') ||
        err.message.includes('5:30 PM')
      );
      
      setNotificationModal({
        type: 'error',
        title: isFetchError 
          ? 'Server Connection Error' 
          : isPunchRuleNotice 
          ? 'Attendance Punch Notice' 
          : 'Face Verification Failed',
        message: isFetchError 
          ? 'Unable to reach backend server. Please verify server status or connection.' 
          : (err.message || 'Captured face does not match the registered employee photo.')
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

    const hasMinLen = (regData.password || '').length >= 8;
    const hasUpper = /[A-Z]/.test(regData.password || '');
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(regData.password || '');

    if (!hasMinLen || !hasUpper || !hasSpecial) {
      setNotificationModal({
        type: 'error',
        title: 'Weak Password Policy',
        message: 'Password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and at least 1 special character (e.g. !@#$%^&*).'
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

    if (regData.phone_number && regData.phone_number.length !== 10) {
      setNotificationModal({
        type: 'error',
        title: 'Invalid Phone Number',
        message: 'Phone number must contain exactly 10 digits.'
      });
      return;
    }


    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('full_name', regData.full_name);
      formData.append('emp_id', regData.emp_id);
      formData.append('email', regData.email);
      formData.append('password', regData.password);
      formData.append('designation', regData.designation || 'Full Stack Developer');
      if (regData.joining_date) formData.append('joining_date', regData.joining_date);
      if (regData.phone_number) formData.append('phone_number', regData.phone_number);
      formData.append('face_image', regPhoto, 'registered_face.jpg');

      if (regPhotoDescriptor && Array.isArray(regPhotoDescriptor) && regPhotoDescriptor.length === 128) {
        formData.append('face_descriptor', JSON.stringify(regPhotoDescriptor));
      }

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
        face_descriptor: data.face_descriptor || regPhotoDescriptor,
        role: 'Employee'
      }, { access_token: data.access_token, refresh_token: data.refresh_token });


      setRegData({ full_name: '', email: '', password: '', confirm_password: '', designation: '', joining_date: '', phone_number: '' });
      setRegPhoto(null);
      setRegPhotoPreview(null);
      setRegPhotoDescriptor(null);
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
        face_descriptor: data.face_descriptor,
        role: 'Employee'
      }, { access_token: data.access_token, refresh_token: data.refresh_token });

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
          designation: profileForm.designation,
          phone_number: profileForm.phone_number,
          joining_date: profileForm.joining_date,
          new_password: profileForm.new_password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      saveUserSession({
        ...currentUser,
        name: data.full_name,
        email: data.email,
        designation: data.designation,
        phone_number: data.phone_number,
        joining_date: data.joining_date
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

  const executeGoogleAuth = async (emailToAuth) => {
    const email = (emailToAuth || '').trim().toLowerCase();
    if (!email) {
      setNotificationModal({
        type: 'error',
        title: 'Google Sign-In Error',
        message: 'No Google email was provided for authentication.'
      });
      return;
    }

    setGoogleSigningIn(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          password: 'google_oauth_bypass'
        })
      });
      const data = await res.json();

      if (res.ok) {
        saveUserSession({
          emp_id: data.emp_id,
          name: data.full_name,
          email: data.email,
          role: 'Employee'
        }, { access_token: data.access_token, refresh_token: data.refresh_token });

        setGoogleModalOpen(false);
        setAuthMode('app');
        setNotificationModal({
          type: 'success',
          title: 'Google Sign-In Successful!',
          message: `Authenticated via Google as ${data.email} (${data.full_name})\nEmployee ID: ${data.emp_id}`
        });
      } else {
        setNotificationModal({
          type: 'error',
          title: 'Account Not Registered',
          message: `No registered employee account found for '${email}'. Please complete your registration first.`
        });
      }
    } catch (err) {
      console.error("Google Auth error:", err);
      setNotificationModal({
        type: 'error',
        title: 'Authentication Error',
        message: `Unable to verify Google login for '${email}'. Please ensure you are registered.`
      });
    } finally {
      setGoogleSigningIn(false);
    }
  };


  const handleGoogleLogin = () => {
    setAuthMode('app');
    setGoogleModalOpen(true);
  };

  const generateClientMonthlySummary = (year, month, historyRecords = []) => {
    const numDays = new Date(year, month, 0).getDate();
    const today = new Date();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const dayWiseAudit = [];

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    const historyByDate = {};
    (historyRecords || []).forEach(rec => {
      if (rec.date) historyByDate[rec.date] = rec;
    });

    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, month - 1, day);
      if (d > todayEnd) {
        // Skip future dates completely
        continue;
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

      const att = historyByDate[dateStr];

      if (att) {
        if (att.status === 'LATE') lateCount++;
        else presentCount++;

        dayWiseAudit.push({
          date: dateStr,
          day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          check_in: att.check_in || '--:--',
          check_out: att.check_out || '--:--',
          status: att.status || 'PRESENT',
          duration_hours: att.duration_hours || 8,
          distance_m: att.distance_m || 0
        });
      } else {
        const isWeekend = dayOfWeek === 0; // Sunday only

        if (!isWeekend) absentCount++;

        dayWiseAudit.push({
          date: dateStr,
          day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          check_in: '--:--',
          check_out: '--:--',
          status: isWeekend ? 'WEEKEND' : 'ABSENT',
          duration_hours: 0,
          distance_m: 0
        });
      }
    }


    return {
      emp_id: currentUser?.emp_id || 'EMP',
      employee_name: currentUser?.name || 'Employee',
      month,
      year,
      calendar_days: numDays,
      present_count: presentCount,
      late_count: lateCount,
      absent_count: absentCount,
      payable_days: Math.max(0, numDays - absentCount),
      day_wise_audit: dayWiseAudit
    };
  };

  const fetchHistory = async () => {
    if (!currentUser || !currentUser.emp_id) {
      setHistoryList([]);
      return [];
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/history/?emp_id=${currentUser.emp_id}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setHistoryList(list);

      // Automatically sync today's check-in / check-out status
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRecord = list.find(r => r.date === todayStr);
      if (todayRecord && todayRecord.check_in) {
        setHasCheckedIn(!todayRecord.check_out);
      } else {
        setHasCheckedIn(false);
      }

      return list;
    } catch (err) {
      setHistoryList([]);
      return [];
    }
  };

  const fetchMonthlySummary = async (overrideHistory = null) => {
    if (!currentUser || !currentUser.emp_id) return;
    setLoadingSummary(true);
    const records = overrideHistory !== null ? overrideHistory : historyList;

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/monthly-summary/?emp_id=${currentUser.emp_id}&month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();
      if (res.ok && data && data.day_wise_audit && data.day_wise_audit.length > 0) {
        setMonthlySummary(data);
        setLoadingSummary(false);
        return;
      }
    } catch (err) {
      // Use fallback client audit matrix silently
    }

    const fallbackData = generateClientMonthlySummary(selectedYear, selectedMonth, records);
    setMonthlySummary(fallbackData);
    setLoadingSummary(false);
  };


  const handleSyncPayslipPro = async () => {
    if (!currentUser || !currentUser.emp_id) return;
    setIsSyncingPayslip(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/sync-to-payslippro/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: currentUser.emp_id,
          month: selectedMonth,
          year: selectedYear
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PayslipPro sync failed');

      setNotificationModal({
        type: 'success',
        title: 'PayslipPro Sync Complete! 🚀',
        message: data.message || `Attendance data synced to PayslipPro (https://payslippro.sbs) for salary generation!`
      });
    } catch (err) {
      setNotificationModal({
        type: 'error',
        title: 'PayslipPro Sync Error',
        message: err.message
      });
    } finally {
      setIsSyncingPayslip(false);
    }
  };

  useEffect(() => {
    fetchRegisteredDescriptors();
    if ((activeTab === 'leave' || activeTab === 'status') && currentUser) {
      fetchMyLeaves();
    } else if (activeTab === 'history' && currentUser) {
      fetchHistory().then((records) => {
        fetchMonthlySummary(records);
      });
    } else if (currentUser) {
      // Pre-fetch monthly summary
      fetchHistory().then((records) => {
        fetchMonthlySummary(records);
      });
    }
  }, [activeTab, currentUser, selectedMonth, selectedYear]);


  const filteredHistory = historyList.filter(item => 
    item.employee_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.emp_id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.textPrimary,
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      
      {/* TOP NAV BAR */}
      <header className="w-full px-3 sm:px-6 py-2.5 sm:py-3" style={{
        backgroundColor: theme.headerBg,
        borderBottom: `1px solid ${theme.border}`,
        boxSizing: 'border-box',
        boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          {/* BRAND LOGO & TITLE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <img 
              src="/zigma_logo_fixed.webp" 
              alt="Zigmaa Tech Logo" 
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                objectFit: 'contain',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }} 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: theme.textPrimary, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                ZIGMAA TECH
              </h1>
              <p className="hidden sm:block" style={{ margin: 0, fontSize: '10px', fontWeight: '600', color: isDarkMode ? '#818cf8' : '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                Attendance & Biometric Portal
              </p>
            </div>
          </div>

          {/* DESKTOP NAVBAR NAVIGATION TABS */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: '10px' }}>
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
                backgroundColor: activeTab === 'punch' ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                color: activeTab === 'punch' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary,
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
                backgroundColor: activeTab === 'history' ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                color: activeTab === 'history' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary,
              }}
            >
              <History style={{ width: '16px', height: '16px' }} />
              Attendance Logs
            </button>

            <button
              onClick={() => setActiveTab('leave')}
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
                backgroundColor: activeTab === 'leave' ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                color: activeTab === 'leave' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary,
              }}
            >
              <FileText style={{ width: '16px', height: '16px' }} />
              Leave / Permission
            </button>
          </div>

          {/* DESKTOP & MOBILE USER PROFILE & HEADER ICONS (Always on top right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* DARK / LIGHT MODE TOGGLE ICON BUTTON */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.inputBg,
                color: isDarkMode ? '#fbbf24' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              {isDarkMode ? <Sun style={{ width: '18px', height: '18px' }} /> : <Moon style={{ width: '18px', height: '18px' }} />}
            </button>

            {/* NOTIFICATION BELL ICON BUTTON */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                title="Notifications"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.inputBg,
                  color: theme.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}
              >
                <Bell style={{ width: '18px', height: '18px' }} />
                {myLeavesList.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444'
                  }} />
                )}
              </button>

              {/* NOTIFICATION POPUP MENU */}
              {notifMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: '-40px',
                  top: 'calc(100% + 8px)',
                  width: 'min(310px, calc(100vw - 32px))',
                  backgroundColor: theme.cardBg,
                  color: theme.textPrimary,
                  borderRadius: '16px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: isDarkMode ? '0 12px 36px rgba(0,0,0,0.7)' : '0 12px 28px -4px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '14px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800' }}>Notifications</h4>
                    <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: isDarkMode ? '#27272a' : '#EEF2FF', color: isDarkMode ? '#818cf8' : '#4F46E5', padding: '2px 8px', borderRadius: '10px' }}>
                      {myLeavesList.length} updates
                    </span>
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {myLeavesList.length === 0 ? (
                      <div style={{ fontSize: '12px', color: theme.textMuted, textAlign: 'center', padding: '16px' }}>No notifications yet</div>
                    ) : (
                      myLeavesList.slice(0, 5).map((item) => (
                        <div key={item.id} style={{ fontSize: '12px', padding: '10px 12px', borderRadius: '10px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ fontWeight: '800', color: theme.textPrimary, fontSize: '12px' }}>
                              {getRequestTypeLabel(item.request_type)}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              backgroundColor: item.status === 'APPROVED' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'REJECTED' ? (isDarkMode ? '#7f1d1d' : '#FEF2F2') : (isDarkMode ? '#451a03' : '#FFFBEB'),
                              color: item.status === 'APPROVED' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'REJECTED' ? (isDarkMode ? '#fca5a5' : '#DC2626') : (isDarkMode ? '#fde68a' : '#B45309'),
                              border: item.status === 'APPROVED' ? '1px solid #10b981' : item.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid #f59e0b'
                            }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '600' }}>
                            {item.request_type === 'PERMISSION' ? (
                              <>⏱️ Date: {item.start_date} ({item.duration_hours || 2} hrs)</>
                            ) : item.request_type === 'HALF_DAY' ? (
                              <>🌗 Date: {item.start_date} (Half Day)</>
                            ) : (
                              <>📅 {item.start_date} to {item.end_date}</>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.inputBg,
                    color: theme.textPrimary,
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <User style={{ width: '15px', height: '15px', color: isDarkMode ? '#818cf8' : '#4f46e5', flexShrink: 0 }} />
                  {/* On mobile show first name cleanly; on desktop show full name */}
                  <span className="hidden sm:inline whitespace-nowrap">{currentUser.name}</span>
                  <span className="sm:hidden whitespace-nowrap">{currentUser.name ? currentUser.name.split(' ')[0] : 'Profile'}</span>
                  <ChevronDown style={{ width: '13px', height: '13px', color: theme.textSecondary, flexShrink: 0 }} />
                </button>

                {/* USER DROPDOWN MENU */}
                {userMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '200px',
                    backgroundColor: theme.cardBg,
                    borderRadius: '16px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                    padding: '6px'
                  }}>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setProfileForm({
                          full_name: currentUser.name || currentUser.full_name || '',
                          email: currentUser.email || '',
                          designation: currentUser.designation || '',
                          phone_number: currentUser.phone_number || '',
                          joining_date: currentUser.joining_date || '',
                          new_password: ''
                        });
                        setActiveTab('profile');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: theme.textPrimary,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <User style={{ width: '15px', height: '15px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setAuthMode('login')}
                  style={{
                    padding: '8px 14px',
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
                    padding: '8px 14px',
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
                  <span className="hidden sm:inline">Register New</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TOP CLOCK & DATE BAR (SHOW ONLY IN PUNCH ATTENDANCE TAB) */}
      {activeTab === 'punch' && (
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
            gap: '10px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            color: theme.textPrimary,
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '15px', height: '15px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} />
              <span>{`${currentTime.toLocaleDateString('en-US', { weekday: 'short' })}, ${String(currentTime.getDate()).padStart(2, '0')} ${currentTime.toLocaleDateString('en-US', { month: 'short' })} ${currentTime.getFullYear()}`}</span>
            </div>
            <span style={{ color: theme.border, fontWeight: '400' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontSize: '14px' }}>
              <Clock style={{ width: '15px', height: '15px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} />
              <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT WRAPPER */}
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 box-border grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: LOCATION STATUS (SHOW ONLY ON PUNCH ATTENDANCE TAB) */}
        {activeTab === 'punch' && (
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* LOCATION STATUS & MAP LINK */}
            <div style={{
              backgroundColor: theme.cardBg,
              borderRadius: '20px',
              border: `1px solid ${theme.border}`,
              padding: '20px',
              boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.03)'
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
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: theme.textPrimary }}>
                    Office Location Verification
                  </h4>
                </div>
              </div>

              {/* STATUS BADGE & GOOGLE MAPS LINK */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* STATUS BADGE WITH LIVE DISTANCE */}
                {isWithinZone ? (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: isDarkMode ? '#052e16' : '#ECFDF5',
                    border: `1px solid ${isDarkMode ? '#166534' : '#A7F3D0'}`,
                    color: isDarkMode ? '#6ee7b7' : '#047857',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981', flexShrink: 0 }} />
                      <span>You are at the Office! Attendance can be punched.</span>
                    </div>
                    {distanceMeters !== null && (
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#a7f3d0' : '#059669', paddingLeft: '26px' }}>
                        📍 Current Distance: <strong>{distanceMeters < 1000 ? `${distanceMeters.toFixed(1)}m` : `${(distanceMeters / 1000).toFixed(2)}km`}</strong> (Max Allowed: {ALLOWED_RADIUS}m)
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: isDarkMode ? '#450a0a' : '#FEF2F2',
                    border: `1px solid ${isDarkMode ? '#991b1b' : '#FCA5A5'}`,
                    color: isDarkMode ? '#fca5a5' : '#B91C1C',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />
                      <span>Outside Office Location ({ALLOWED_RADIUS}m limit)</span>
                    </div>
                    {distanceMeters !== null ? (
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#f87171' : '#DC2626', paddingLeft: '26px' }}>
                        📍 Distance: <strong>{distanceMeters < 1000 ? `${distanceMeters.toFixed(1)}m` : `${(distanceMeters / 1000).toFixed(2)}km`}</strong> away from office
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#f87171' : '#DC2626', paddingLeft: '26px' }}>
                        Turn on location to detect distance away from office
                      </div>
                    )}
                  </div>
                )}




                {/* CLICK TO KNOW DISTANCE IN GOOGLE MAPS */}
                <a
                  href={userCoords 
                    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${officeLat},${officeLng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${officeLat},${officeLng}`
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
        )}

        {/* RIGHT COLUMN: MAIN WORK AREA (EXPANDS TO FULL WIDTH ON LOGS TAB) */}
        <div className={`${activeTab === 'punch' ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-2xl p-4 sm:p-6 shadow-sm`} style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}>

          {/* ERROR ALERT DISPLAY */}
          {errorBanner && (
            <div style={{
              marginBottom: '20px',
              padding: '14px 18px',
              borderRadius: '14px',
              backgroundColor: isDarkMode ? '#450a0a' : '#FEF2F2',
              border: `1px solid ${isDarkMode ? '#991b1b' : '#FCA5A5'}`,
              color: isDarkMode ? '#fca5a5' : '#991B1B',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
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
              
              {/* LATE ARRIVAL WARNING (ONLY SHOWN IF NOT YET CHECKED IN) */}
              {isPastCutoff && !hasCheckedIn && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '14px',
                  backgroundColor: isDarkMode ? '#451a03' : '#FFFBEB',
                  border: `1px solid ${isDarkMode ? '#92400e' : '#FDE68A'}`,
                  color: isDarkMode ? '#fde68a' : '#B45309',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}>
                  <Clock style={{ width: '18px', height: '18px', color: '#F59E0B', flexShrink: 0 }} />
                  <span>Late arrival: Checking in now will be marked as <strong style={{ textDecoration: 'underline' }}>LATE</strong> (Cutoff: 10:00 AM).</span>
                </div>
              )}

              {/* ALREADY CHECKED IN TODAY BADGE */}
              {hasCheckedIn && (
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '14px',
                  backgroundColor: isDarkMode ? '#052e16' : '#ECFDF5',
                  border: `1px solid ${isDarkMode ? '#166534' : '#A7F3D0'}`,
                  color: isDarkMode ? '#6ee7b7' : '#047857',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981', flexShrink: 0 }} />
                    <span>Check-In recorded for today! Next punch will be <strong style={{ color: isDarkMode ? '#a7f3d0' : '#065f46' }}>Check-Out</strong> (available after 5:30 PM).</span>
                  </div>
                </div>
              )}



              {/* PUNCH ATTENDANCE TRIGGER BUTTON */}
              {isWithinZone ? (
                <FaceScanModalCapture 
                  title="Biometric Punch Verification"
                  description={hasCheckedIn ? "Hold face steady in green oval for automatic check-out." : "Hold face steady in green oval for automatic check-in."}
                  buttonText={hasCheckedIn ? "Check Out" : "Check In"}
                  resetOnCapture={true}
                  autoCapture={true}
                  isDarkMode={isDarkMode}
                  currentUserDescriptor={
                    currentUser?.face_descriptor || 
                    currentUser?.face_encoding || 
                    allRegisteredDescriptors.find(e => 
                      (currentUser?.emp_id && String(e.emp_id).toLowerCase() === String(currentUser.emp_id).toLowerCase()) ||
                      (currentUser?.email && String(e.email).toLowerCase() === String(currentUser.email).toLowerCase())
                    )?.descriptor
                  }
                  currentUserName={currentUser?.name || currentUser?.full_name || 'Employee'}
                  onFaceCaptured={(blob, descriptorArray) => handlePunchAttendance(blob, descriptorArray)} 
                />
              ) : (
                <div style={{
                  width: '100%',
                  padding: '36px 20px',
                  borderRadius: '24px',
                  backgroundColor: isDarkMode ? '#1a1012' : '#FEF2F2',
                  border: `1px solid ${isDarkMode ? '#7f1d1d' : '#FCA5A5'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: isDarkMode ? '#450a0a' : '#FEE2E2',
                    border: `1px solid ${isDarkMode ? '#991b1b' : '#FCA5A5'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px'
                  }}>
                    <Lock style={{ width: '28px', height: '28px', color: '#EF4444' }} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: isDarkMode ? '#fca5a5' : '#991B1B' }}>Camera & Punch Disabled</h4>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: isDarkMode ? '#f87171' : '#7F1D1D', maxWidth: '340px' }}>
                    You are outside the office area. Please reach the office location to access the camera and punch attendance.
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

              {/* FULL NAME AND EMPLOYEE ID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
                    required
                    placeholder="Enter Employee ID (e.g. THO_001)" 
                    value={regData.emp_id} 
                    onChange={(e) => setRegData({ ...regData, emp_id: e.target.value.toUpperCase() })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              {/* EMAIL & DESIGNATION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Email *</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="Enter your email (e.g. alex@company.com)" 
                    value={regData.email} 
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Designation *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Full Stack Developer" 
                    value={regData.designation} 
                    onChange={(e) => setRegData({ ...regData, designation: e.target.value })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              {/* DATE OF JOINING & PHONE NUMBER */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Date of Joining *</label>
                  <input 
                    type="date" 
                    required 
                    value={regData.joining_date} 
                    onChange={(e) => setRegData({ ...regData, joining_date: e.target.value })} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Phone Number</label>
                  <input 
                    type="tel" 
                    maxLength={10}
                    placeholder="e.g. 9876543210" 
                    value={regData.phone_number} 
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setRegData({ ...regData, phone_number: digitsOnly });
                    }} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                  />
                </div>

              </div>

              {/* PASSWORD & CONFIRM PASSWORD WITH EYE TOGGLE */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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


              {/* FACE PHOTO CAPTURE SECTION - CENTERED MODAL CAPTURE */}
              <FaceScanModalCapture 
                title="Biometric Face Scanner"
                description="Align face inside center oval for automatic photo capture."
                buttonText="Capture Profile Photo"
                autoCapture={true}
                mode="register"
                isDarkMode={isDarkMode} 
                allRegisteredDescriptors={allRegisteredDescriptors}
                onFaceCaptured={(blobOrDataUrl, descriptorArray) => {
                  if (descriptorArray && Array.isArray(descriptorArray) && descriptorArray.length === 128) {
                    setRegPhotoDescriptor(descriptorArray);
                  }
                  if (typeof blobOrDataUrl === 'string' && blobOrDataUrl.startsWith('data:')) {
                    setRegPhotoPreview(blobOrDataUrl);
                    try {
                      const parts = blobOrDataUrl.split(';base64,');
                      const contentType = parts[0].split(':')[1];
                      const raw = window.atob(parts[1]);
                      const uInt8Array = new Uint8Array(raw.length);
                      for (let i = 0; i < raw.length; ++i) {
                        uInt8Array[i] = raw.charCodeAt(i);
                      }
                      const blob = new Blob([uInt8Array], { type: contentType });
                      setRegPhoto(blob);
                    } catch (e) {
                      setRegPhoto(new Blob(["dummy"], { type: 'image/jpeg' }));
                    }
                  } else {
                    setRegPhoto(blobOrDataUrl);
                    if (blobOrDataUrl instanceof Blob) {
                      setRegPhotoPreview(URL.createObjectURL(blobOrDataUrl));
                    } else {
                      setRegPhotoPreview(blobOrDataUrl);
                    }
                  }
                }} 
              />

              {faceValidating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#172554' : '#EFF6FF', border: `1px solid ${isDarkMode ? '#1e40af' : '#BFDBFE'}`, color: isDarkMode ? '#93c5fd' : '#1D4ED8', fontSize: '13px', fontWeight: '700' }}>
                  <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  Analyzing camera biometrics for human face...
                </div>
              )}

              {faceValidError && (
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#450a0a' : '#FEF2F2', border: `1px solid ${isDarkMode ? '#991b1b' : '#FCA5A5'}`, color: isDarkMode ? '#fca5a5' : '#B91C1C', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />
                  {faceValidError}
                </div>
              )}

              <button type="submit" disabled={isProcessing || faceValidating || !regPhoto} style={{ padding: '14px 0', borderRadius: '12px', backgroundColor: !regPhoto || faceValidating ? '#cbd5e1' : '#4f46e5', color: !regPhoto || faceValidating ? '#64748b' : '#ffffff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: !regPhoto || faceValidating ? 'not-allowed' : 'pointer', boxShadow: regPhoto ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none' }}>
                {faceValidating ? 'Analyzing Face Biometrics...' : isProcessing ? 'Registering...' : 'Complete Registration'}
              </button>
            </form>
          )}

          {/* ATTENDANCE HISTORY LOGS */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!currentUser ? (
                <div style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px'
                  }}>
                    <Lock style={{ width: '24px', height: '24px' }} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Login Required to View Attendance Logs</h4>
                  <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: '#64748B', maxWidth: '360px' }}>
                    You must be logged into your employee account to view your personal attendance history.
                  </p>
                  <button
                    onClick={() => setAuthMode('login')}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '800',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    Login Now
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Bar Controls: Month Selector & Sync to PayslipPro */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: theme.cardBg, padding: '16px 20px', borderRadius: '18px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(15,23,42,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* CUSTOM SLEEK MONTH SELECTOR DROPDOWN */}
                      <div data-custom-dropdown style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                          style={{
                            padding: '9px 14px',
                            borderRadius: '12px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.inputBorder}`,
                            fontSize: '13px',
                            fontWeight: '700',
                            color: theme.textPrimary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>
                            {`${selectedYear}-${selectedMonth}` === '2026-10' ? 'October 2026' : `${selectedYear}-${selectedMonth}` === '2026-11' ? 'November 2026' : 'December 2026'}
                          </span>
                          <ChevronDown style={{ width: '14px', height: '14px', color: theme.textSecondary, transition: 'transform 0.2s', transform: monthDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>

                        {monthDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            minWidth: '160px',
                            backgroundColor: theme.cardBg,
                            borderRadius: '14px',
                            border: `1px solid ${theme.border}`,
                            boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            padding: '6px',
                            overflow: 'hidden'
                          }}>
                            {[
                              { label: 'October 2026', value: '2026-10' },
                              { label: 'November 2026', value: '2026-11' },
                              { label: 'December 2026', value: '2026-12' }
                            ].map((opt) => {
                              const isSelected = `${selectedYear}-${selectedMonth}` === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    const [y, m] = opt.value.split('-');
                                    setSelectedYear(parseInt(y));
                                    setSelectedMonth(parseInt(m));
                                    setMonthDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                                    color: isSelected ? (isDarkMode ? '#818cf8' : '#4F46E5') : theme.textPrimary,
                                    fontSize: '13px',
                                    fontWeight: isSelected ? '800' : '600',
                                    textAlign: 'left',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.15s ease'
                                  }}
                                >
                                  <span>{opt.label}</span>
                                  {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#818cf8' : '#4F46E5' }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { fetchHistory(); fetchMonthlySummary(); }} style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                      </button>
                    </div>

                    <button
                      onClick={handleSyncPayslipPro}
                      disabled={isSyncingPayslip}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: isSyncingPayslip ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                        opacity: isSyncingPayslip ? 0.7 : 1
                      }}
                    >
                      {isSyncingPayslip ? (
                        <>
                          <RefreshCw style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                          Syncing to PayslipPro...
                        </>
                      ) : (
                        <>
                          <Calendar style={{ width: '15px', height: '15px' }} />
                          Sync with PayslipPro 🚀
                        </>
                      )}
                    </button>
                  </div>

                  {/* Monthly Payroll Summary KPI Metrics Cards */}
                  {loadingSummary ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
                      Loading Monthly Payroll Aggregation...
                    </div>
                  ) : monthlySummary ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.textSecondary, fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🏢 Total Calendar Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: theme.textPrimary }}>
                          {monthlySummary.calendar_days} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Days</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🟢 Present Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>
                          {monthlySummary.present_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Punches</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          ⏰ Late Punches
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#f59e0b' }}>
                          {monthlySummary.late_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Punches</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: theme.cardBg, padding: '16px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          🔴 Absent Days
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#ef4444' }}>
                          {monthlySummary.absent_count} <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>Days</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Day-Wise Audit Matrix Table */}
                  {monthlySummary && monthlySummary.day_wise_audit ? (
                    <div style={{ backgroundColor: theme.cardBg, borderRadius: '16px', border: `1px solid ${theme.border}`, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, fontWeight: '800', fontSize: '13px', color: theme.textPrimary }}>
                        📅 Day-Wise Monthly Attendance Matrix
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ backgroundColor: theme.tableHeaderBg, color: theme.textSecondary, borderBottom: `1px solid ${theme.border}`, fontSize: '12px' }}>
                              <th style={{ padding: '10px 16px' }}>Date</th>
                              <th style={{ padding: '10px 16px' }}>Check-In</th>
                              <th style={{ padding: '10px 16px' }}>Check-Out</th>
                              <th style={{ padding: '10px 16px' }}>Duration</th>
                              <th style={{ padding: '10px 16px' }}>Distance</th>
                              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlySummary.day_wise_audit.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${theme.tableRowBorder}` }}>
                                <td style={{ padding: '12px 16px', fontWeight: '700', color: theme.textPrimary }}>{item.date}</td>
                                <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{item.check_in || '--:--'}</td>
                                <td style={{ padding: '12px 16px', color: theme.textSecondary }}>{item.check_out || '--:--'}</td>
                                <td style={{ padding: '12px 16px', color: theme.textMuted }}>{item.duration_hours > 0 ? `${item.duration_hours} hrs` : '--'}</td>
                                <td style={{ padding: '12px 16px', color: theme.textMuted }}>{item.distance_m ? `${item.distance_m}m` : '--'}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    backgroundColor: item.status === 'PRESENT' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'LATE' ? (isDarkMode ? '#451a03' : '#FFFBEB') : (isDarkMode ? '#7f1d1d' : '#FEF2F2'),
                                    color: item.status === 'PRESENT' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'LATE' ? (isDarkMode ? '#fde68a' : '#B45309') : (isDarkMode ? '#fca5a5' : '#DC2626'),
                                    border: item.status === 'PRESENT' ? '1px solid #10b981' : item.status === 'LATE' ? '1px solid #f59e0b' : '1px solid #ef4444'
                                  }}>
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* LEAVE & PERMISSION TAB WORKFLOW */}
          {activeTab === 'leave' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}` }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText style={{ width: '22px', height: '22px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} /> Leave & Permission Requests
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                  Submit leave or permission requests for admin approval and automatic sync with Pay Slip Pro.
                </p>
              </div>

              {/* REQUEST FORM & STATUS LIST GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                
                {/* SUBMIT LEAVE REQUEST FORM */}
                <form onSubmit={handleLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: theme.textPrimary }}>Submit New Request</h4>

                  {/* CUSTOM REQUEST TYPE DROPDOWN */}
                  <div data-custom-dropdown style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Request Type *</label>
                    <button
                      type="button"
                      onClick={() => setLeaveTypeDropdownOpen(!leaveTypeDropdownOpen)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.inputBorder}`,
                        fontSize: '13px',
                        fontWeight: '700',
                        color: theme.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box'
                      }}
                    >
                      <span>
                        {leaveForm.request_type === 'CASUAL' ? 'Casual Leave' : leaveForm.request_type === 'SICK' ? 'Sick Leave' : leaveForm.request_type === 'HALF_DAY' ? 'Half Day Leave' : 'Permission Request'}
                      </span>
                      <ChevronDown style={{ width: '15px', height: '15px', color: theme.textSecondary, transition: 'transform 0.2s', transform: leaveTypeDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {leaveTypeDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        backgroundColor: theme.cardBg,
                        borderRadius: '12px',
                        border: `1px solid ${theme.border}`,
                        boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                        zIndex: 100,
                        padding: '6px',
                        overflow: 'hidden'
                      }}>
                        {[
                          { label: 'Casual Leave', value: 'CASUAL' },
                          { label: 'Sick Leave', value: 'SICK' },
                          { label: 'Half Day Leave', value: 'HALF_DAY' },
                          { label: 'Permission Request', value: 'PERMISSION' }
                        ].map((opt) => {
                          const isSelected = leaveForm.request_type === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setLeaveForm({ ...leaveForm, request_type: opt.value });
                                setLeaveTypeDropdownOpen(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '9px 12px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                                color: isSelected ? (isDarkMode ? '#818cf8' : '#4F46E5') : theme.textPrimary,
                                fontSize: '13px',
                                fontWeight: isSelected ? '800' : '600',
                                textAlign: 'left',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#818cf8' : '#4F46E5' }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {leaveForm.request_type === 'PERMISSION' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div className="w-full">
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Date *</label>
                        <input
                          type="date"
                          required
                          value={leaveForm.start_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
                          style={{ width: '100%', minWidth: 0, padding: '11px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }}
                        />
                      </div>

                      {/* CUSTOM HOURS REQUIRED DROPDOWN */}
                      <div data-custom-dropdown className="w-full" style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Hours Required *</label>
                        <button
                          type="button"
                          onClick={() => setHoursDropdownOpen(!hoursDropdownOpen)}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            padding: '11px 14px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.inputBorder}`,
                            fontSize: '13px',
                            fontWeight: '700',
                            color: theme.textPrimary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span>{leaveForm.duration_hours} Hour{leaveForm.duration_hours > 1 ? 's' : ''}</span>
                          <ChevronDown style={{ width: '15px', height: '15px', color: theme.textSecondary, transition: 'transform 0.2s', transform: hoursDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>

                        {hoursDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            backgroundColor: theme.cardBg,
                            borderRadius: '12px',
                            border: `1px solid ${theme.border}`,
                            boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            padding: '6px',
                            overflow: 'hidden'
                          }}>
                            {['1', '2', '3'].map((hr) => {
                              const isSelected = String(leaveForm.duration_hours) === hr;
                              return (
                                <button
                                  key={hr}
                                  type="button"
                                  onClick={() => {
                                    setLeaveForm({ ...leaveForm, duration_hours: hr });
                                    setHoursDropdownOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: isSelected ? (isDarkMode ? '#27272a' : '#EEF2FF') : 'transparent',
                                    color: isSelected ? (isDarkMode ? '#818cf8' : '#4F46E5') : theme.textPrimary,
                                    fontSize: '13px',
                                    fontWeight: isSelected ? '800' : '600',
                                    textAlign: 'left',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <span>{hr} Hour{parseInt(hr) > 1 ? 's' : ''}</span>
                                  {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDarkMode ? '#818cf8' : '#4F46E5' }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : leaveForm.request_type === 'HALF_DAY' ? (
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Date *</label>
                      <input
                        type="date"
                        required
                        value={leaveForm.start_date}
                        onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div className="w-full">
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Start Date *</label>
                        <input
                          type="date"
                          required
                          value={leaveForm.start_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                          style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div className="w-full">
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>End Date *</label>
                        <input
                          type="date"
                          required
                          value={leaveForm.end_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                          style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Reason *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Specify reason for request..."
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: isDarkMode ? '#6366f1' : '#4f46e5',
                      color: '#ffffff',
                      fontWeight: '800',
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessing ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>

                {/* MY REQUESTS HISTORY LIST (RESTORED ON RIGHT SIDE FOR DESKTOP ONLY / HIDDEN ON MOBILE) */}
                <div className="hidden md:flex" style={{ flexDirection: 'column', gap: '14px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: theme.textPrimary }}>Recent Requests & Status</h4>
                    <button
                      onClick={fetchMyLeaves}
                      style={{ background: 'none', border: 'none', color: isDarkMode ? '#818cf8' : '#4f46e5', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw style={{ width: '12px', height: '12px' }} /> Refresh
                    </button>
                  </div>

                  {loadingLeaves ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px' }}>Loading requests...</div>
                  ) : myLeavesList.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                      No leave/permission requests submitted yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                      {myLeavesList.map((item) => (
                        <div key={item.id} style={{ padding: '14px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textPrimary }}>{getRequestTypeLabel(item.request_type)}</span>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '800',
                              backgroundColor: item.status === 'APPROVED' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'REJECTED' ? (isDarkMode ? '#7f1d1d' : '#FEF2F2') : (isDarkMode ? '#451a03' : '#FFFBEB'),
                              color: item.status === 'APPROVED' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'REJECTED' ? (isDarkMode ? '#fca5a5' : '#DC2626') : (isDarkMode ? '#fde68a' : '#B45309'),
                              border: item.status === 'APPROVED' ? '1px solid #10b981' : item.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid #f59e0b'
                            }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textSecondary, fontWeight: '600' }}>
                            {item.request_type === 'PERMISSION' ? (
                              <>⏱️ Date: {item.start_date} | Duration: {item.duration_hours || 2} Hours</>
                            ) : item.request_type === 'HALF_DAY' ? (
                              <>🌗 Date: {item.start_date} (Half Day)</>
                            ) : (
                              <>📅 {item.start_date} to {item.end_date}</>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textMuted, fontStyle: 'italic' }}>
                            "{item.reason}"
                          </div>
                          {item.admin_remarks && (
                            <div style={{ fontSize: '11px', color: isDarkMode ? '#818cf8' : '#4f46e5', fontWeight: '700', marginTop: '2px' }}>
                              Admin Note: {item.admin_remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* STATUS TAB WORKFLOW (Dedicated tab for viewing Leave & Permission request status) */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '22px', height: '22px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} /> Leave & Permission Request Status
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                    Real-time status of your submitted leave and permission requests.
                  </p>
                </div>
                <button
                  onClick={fetchMyLeaves}
                  style={{ padding: '8px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#27272a' : '#EEF2FF', border: `1px solid ${theme.border}`, color: isDarkMode ? '#818cf8' : '#4F46E5', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: theme.cardBg, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                {loadingLeaves ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px' }}>Loading requests...</div>
                ) : myLeavesList.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                    No leave/permission requests submitted yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {myLeavesList.map((item) => (
                      <div key={item.id} style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${theme.border}`, backgroundColor: theme.cardInnerBg, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: theme.textPrimary }}>{getRequestTypeLabel(item.request_type)}</span>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '800',
                            backgroundColor: item.status === 'APPROVED' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : item.status === 'REJECTED' ? (isDarkMode ? '#7f1d1d' : '#FEF2F2') : (isDarkMode ? '#451a03' : '#FFFBEB'),
                            color: item.status === 'APPROVED' ? (isDarkMode ? '#a7f3d0' : '#047857') : item.status === 'REJECTED' ? (isDarkMode ? '#fca5a5' : '#DC2626') : (isDarkMode ? '#fde68a' : '#B45309'),
                            border: item.status === 'APPROVED' ? '1px solid #10b981' : item.status === 'REJECTED' ? '1px solid #ef4444' : '1px solid #f59e0b'
                          }}>
                            {item.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '600' }}>
                          {item.request_type === 'PERMISSION' ? (
                            <>⏱️ Date: {item.start_date} | Duration: {item.duration_hours || 2} Hours</>
                          ) : item.request_type === 'HALF_DAY' ? (
                            <>🌗 Date: {item.start_date} (Half Day)</>
                          ) : (
                            <>📅 {item.start_date} to {item.end_date}</>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: theme.textMuted, fontStyle: 'italic', backgroundColor: theme.cardBg, padding: '10px 12px', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                          Reason: "{item.reason}"
                        </div>
                        {item.admin_remarks && (
                          <div style={{ fontSize: '12px', color: isDarkMode ? '#818cf8' : '#4f46e5', fontWeight: '700' }}>
                            Admin Remarks: {item.admin_remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DEDICATED PROFILE & ACCOUNT SETTINGS PAGE TAB */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px 20px', borderRadius: '16px', backgroundColor: theme.cardInnerBg, border: `1px solid ${theme.border}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User style={{ width: '22px', height: '22px', color: isDarkMode ? '#818cf8' : '#4f46e5' }} /> User Profile & Account Settings
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                    View and update your personal employee information and credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('punch')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: isDarkMode ? '#27272a' : '#f1f5f9',
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Back to Portal
                </button>
              </div>

              {/* PROFILE UPDATE FORM CARD */}
              <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                <form
                  onSubmit={handleUpdateProfile}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: theme.cardBg,
                    padding: '24px',
                    borderRadius: '20px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(15,23,42,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: isDarkMode ? '#27272a' : '#EEF2FF',
                      color: isDarkMode ? '#818cf8' : '#4F46E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '18px'
                    }}>
                      {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: theme.textPrimary }}>
                        {currentUser?.name || 'Employee Profile'}
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: theme.textMuted }}>
                        Employee ID: <span style={{ fontWeight: '800', color: isDarkMode ? '#818cf8' : '#4F46E5' }}>{currentUser?.emp_id}</span>
                      </p>
                    </div>
                  </div>

                  {/* FULL NAME & EMPLOYEE ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Full Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Enter Full Name" 
                        value={profileForm.full_name} 
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Employee ID (Read Only)</label>
                      <input 
                        type="text" 
                        disabled
                        value={currentUser ? currentUser.emp_id : ''} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: isDarkMode ? '#1e1e24' : '#f1f5f9', border: `1px solid ${theme.border}`, fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#818cf8' : '#4f46e5', boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* EMAIL & DESIGNATION */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Email Address *</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="employee@company.com" 
                        value={profileForm.email} 
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Designation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Full Stack Developer" 
                        value={profileForm.designation} 
                        onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* DATE OF JOINING & PHONE NUMBER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Date of Joining</label>
                      <input 
                        type="date" 
                        value={profileForm.joining_date} 
                        onChange={(e) => setProfileForm({ ...profileForm, joining_date: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>

                    <div className="w-full">
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Phone Number</label>
                      <input 
                        type="tel" 
                        maxLength={10}
                        placeholder="e.g. 9876543210" 
                        value={profileForm.phone_number} 
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setProfileForm({ ...profileForm, phone_number: digitsOnly });
                        }} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  {/* CHANGE PASSWORD */}
                  <div className="w-full">
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: theme.textSecondary, marginBottom: '6px' }}>Change Password (Leave blank to keep existing)</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showNewPassword ? 'text' : 'password'} 
                        placeholder="Enter new password" 
                        value={profileForm.new_password} 
                        onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                        style={{ width: '100%', minWidth: 0, padding: '12px 42px 12px 14px', borderRadius: '10px', backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, fontSize: '13px', color: theme.textPrimary, boxSizing: 'border-box' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: theme.textSecondary }}
                      >
                        {showNewPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#6366f1' : '#4f46e5',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '800',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Save style={{ width: '16px', height: '16px' }} />
                      {isProcessing ? 'Updating Profile...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (4 TABS for Mobile Screens) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md px-2 py-2.5 z-50 flex items-center justify-around shadow-lg"
        style={{
          backgroundColor: theme.mobileNavBg,
          borderTop: `1px solid ${theme.border}`
        }}
      >
        <button
          onClick={() => setActiveTab('punch')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'punch' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary }}
        >
          <ShieldCheck style={{ width: '20px', height: '20px' }} />
          <span>Punch</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'history' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary }}
        >
          <History style={{ width: '20px', height: '20px' }} />
          <span>Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'leave' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary }}
        >
          <FileText style={{ width: '20px', height: '20px' }} />
          <span>Leave</span>
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className="flex flex-col items-center gap-1 text-[11px] font-bold transition-colors"
          style={{ color: activeTab === 'status' ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textSecondary }}
        >
          <CheckCircle2 style={{ width: '20px', height: '20px' }} />
          <span>Status</span>
        </button>
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
            maxWidth: 'min(400px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            boxSizing: 'border-box'
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.5px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>

              {/* OFFICIAL GOOGLE SIGN IN BUTTON */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
                <div id="googleSignInBtnDiv" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
              </div>

              {/* DONT HAVE AN ACCOUNT ? CREATE ONE */}
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('app');
                    setActiveTab('onboard');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#4f46e5',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Create one
                </button>
              </div>



            </form>
          </div>
        </div>
      )}

      {/* RESULT MODAL */}
      {modalData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '28px',
            textAlign: 'center',
            boxShadow: isDarkMode ? '0 25px 50px rgba(0, 0, 0, 0.7)' : '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: modalData.status === 'PRESENT' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : (isDarkMode ? '#451a03' : '#FFFBEB'),
              border: modalData.status === 'PRESENT' ? `1px solid ${isDarkMode ? '#065f46' : '#10b981'}` : `1px solid ${isDarkMode ? '#92400e' : '#f59e0b'}`,
              color: modalData.status === 'PRESENT' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fde68a' : '#B45309'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <CheckCircle2 style={{ width: '36px', height: '36px' }} />
            </div>

            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: theme.textPrimary }}>{modalData.message}</h3>
            <p style={{ margin: '6px 0 18px 0', fontSize: '13px', color: theme.textSecondary }}>
              Verified for <strong style={{ color: theme.textPrimary }}>{modalData.employeeName}</strong> ({modalData.empId})
            </p>

            <div style={{
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: theme.cardInnerBg,
              border: `1px solid ${theme.border}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              textAlign: 'left',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Punch Time</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: theme.textPrimary }}>{modalData.checkIn}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Status Badge</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '800', color: modalData.status === 'PRESENT' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fde68a' : '#B45309') }}>
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
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(400px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: theme.cardBg,
            borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            padding: '24px',
            textAlign: 'center',
            boxShadow: isDarkMode ? '0 25px 50px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: notificationModal.type === 'success' ? (isDarkMode ? '#064e3b' : '#ECFDF5') : (isDarkMode ? '#450a0a' : '#FEF2F2'),
              border: notificationModal.type === 'success' ? `1px solid ${isDarkMode ? '#065f46' : '#10b981'}` : `1px solid ${isDarkMode ? '#991b1b' : '#ef4444'}`,
              color: notificationModal.type === 'success' ? (isDarkMode ? '#6ee7b7' : '#047857') : (isDarkMode ? '#fca5a5' : '#b91c1c'),
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

            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: theme.textPrimary }}>
              {notificationModal.title}
            </h3>
            
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5', whitespace: 'pre-line' }}>
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



      {/* OFFICIAL GOOGLE IDENTITY SERVICES ONE-TAP MODAL */}
      {googleModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 250,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(420px, 92vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#201a1a',
            color: '#f3f3f3',
            borderRadius: '24px',
            border: '1px solid #3b3030',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            padding: '28px 24px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            {/* GOOGLE SCALLOPED ICON HEADER */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#332929',
              border: '1px solid #4a3b3b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>

            {/* HEADER TEXT */}
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#ffffff', textAlign: 'center' }}>
              Sign in to zigmaatech.vercel.app with google.com
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#a89d9d', textAlign: 'center' }}>
              Choose an account to continue
            </p>

            <div style={{ width: '100%', height: '1px', backgroundColor: '#382d2d', marginBottom: '8px' }} />

            {/* GOOGLE ACCOUNTS LIST */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
              
              {/* ACCOUNT 1: MOHAMED THOUFIQ */}
              <button
                onClick={() => executeGoogleAuth('mdthoufiq0507@gmail.com')}
                disabled={googleSigningIn}
                style={{
                  width: '100%',
                  padding: '12px 8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #332929',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '15px',
                    flexShrink: 0
                  }}>
                    M
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>Mohamed Thoufiq</div>
                    <div style={{ fontSize: '12px', color: '#b8adad' }}>mdthoufiq0507@gmail.com</div>
                  </div>
                </div>
                {googleSigningIn ? (
                  <RefreshCw style={{ width: '16px', height: '16px', color: '#f87171', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <span style={{ color: '#b8adad', fontSize: '14px' }}>▶</span>
                )}
              </button>

              {/* ACCOUNT 2: ARSATH THOUFIQ */}
              <button
                onClick={() => executeGoogleAuth('thoufiqarsath84@gmail.com')}
                disabled={googleSigningIn}
                style={{
                  width: '100%',
                  padding: '12px 8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #332929',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '15px',
                    flexShrink: 0
                  }}>
                    A
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>Arsath Thoufiq</div>
                    <div style={{ fontSize: '12px', color: '#b8adad' }}>thoufiqarsath84@gmail.com</div>
                  </div>
                </div>
                <span style={{ color: '#b8adad', fontSize: '14px' }}>▶</span>
              </button>

              {/* ACCOUNT 3: PEYAN */}
              <button
                onClick={() => executeGoogleAuth('peyansdfgdsf@gmail.com')}
                disabled={googleSigningIn}
                style={{
                  width: '100%',
                  padding: '12px 8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '15px',
                    flexShrink: 0
                  }}>
                    P
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>peyansdfgdsf</div>
                    <div style={{ fontSize: '12px', color: '#b8adad' }}>peyansdfgdsf@gmail.com</div>
                  </div>
                </div>
                <span style={{ color: '#b8adad', fontSize: '14px' }}>▶</span>
              </button>

            </div>

            {/* BOTTOM ACTIONS ROW */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <button
                onClick={() => {
                  const input = prompt("Enter your Google Account email:");
                  if (input && input.trim()) executeGoogleAuth(input.trim());
                }}
                disabled={googleSigningIn}
                style={{
                  padding: '10px 18px',
                  borderRadius: '20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #6b5757',
                  color: '#f87171',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Use a different account
              </button>

              <button
                onClick={() => setGoogleModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #6b5757',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
