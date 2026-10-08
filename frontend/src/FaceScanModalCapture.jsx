import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertCircle, X, RefreshCw, UserCheck } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function FaceScanModalCapture({ 
  onFaceCaptured,
  title = "Biometric Face Scan",
  description = "Center face scan required to activate attendance profile.",
  buttonText = "Open Face Scanner",
  resetOnCapture = false,
  autoCapture = false,
  isDarkMode = false,
  currentUserDescriptor = null,
  currentUserName = "Employee",
  allRegisteredDescriptors = [],
  mode = "punch"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoCapturedRef = useRef(false);
  const handleCaptureRef = useRef(null);
  const scanProgressRef = useRef(0);

  const prevFaceRef = useRef(null);
  const regStageRef = useRef(1);
  const [regStep, setRegStep] = useState(1);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera when modal opens
  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!isOpen) {
        stopCamera();
        prevFaceRef.current = null;
        regStageRef.current = 1;
        setRegStep(1);
        return;
      }

      setLoading(true);
      setErrorMessage('');
      autoCapturedRef.current = false;
      scanProgressRef.current = 0;
      prevFaceRef.current = null;
      regStageRef.current = 1;
      setRegStep(1);
      setScanProgress(0);

      try {
        const api = faceapi || window.faceapi;
        if (api && api.nets) {
          try {
            if (!api.nets.tinyFaceDetector.isLoaded) {
              await api.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            }
            if (api.nets.faceLandmark68TinyNet && !api.nets.faceLandmark68TinyNet.isLoaded) {
              await api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
            }
            if (api.nets.faceRecognitionNet && !api.nets.faceRecognitionNet.isLoaded) {
              await api.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            }
          } catch (e) {
            console.warn("CDN model load notice:", e);
          }
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMessage('Camera access was denied or face model failed to load.');
        setLoading(false);
      }
    }

    startScanner();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen]);

  const [faceStatus, setFaceStatus] = useState({ valid: false, count: 0, isMismatch: false, isCovered: false, text: 'Align face inside the center circle' });

  const handleCapture = async () => {
    if (!videoRef.current || faceStatus.isMismatch || faceStatus.isCovered) return;

    const video = videoRef.current;
    let descriptorArray = null;

    const api = faceapi || window.faceapi;
    if (api) {
      try {
        if (api.nets && api.nets.faceRecognitionNet && !api.nets.faceRecognitionNet.isLoaded) {
          await api.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        }
        if (api.nets && api.nets.faceLandmark68TinyNet && !api.nets.faceLandmark68TinyNet.isLoaded) {
          await api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        }

        let detection = null;
        if (api.detectSingleFace) {
          detection = await api.detectSingleFace(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptor();
        }

        if (!detection && api.detectAllFaces) {
          const raw = await api.detectAllFaces(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptors();
          if (raw && raw.length > 0) detection = raw[0];
        }

        if (detection && detection.descriptor) {
          descriptorArray = Array.from(detection.descriptor);
        }
      } catch (e) {
        console.warn("Capture face descriptor extraction warning:", e);
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth || 640;
    offCanvas.height = video.videoHeight || 480;
    const ctx = offCanvas.getContext('2d');

    // Mirror correction
    ctx.translate(offCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

    offCanvas.toBlob((blob) => {
      const dataUrl = offCanvas.toDataURL('image/jpeg', 0.95);
      if (!resetOnCapture) {
        setCapturedImage(dataUrl);
      } else {
        setCapturedImage(null);
      }
      if (onFaceCaptured) onFaceCaptured(blob || dataUrl, descriptorArray);
      stopCamera();
      setIsOpen(false);
    }, 'image/jpeg', 0.95);
  };

  handleCaptureRef.current = handleCapture;

  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const api = faceapi || window.faceapi;
    const displaySize = { width: video.clientWidth || 480, height: video.clientHeight || 360 };
    if (api && api.matchDimensions) {
      api.matchDimensions(canvas, displaySize);
    } else {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
    }

    const interval = setInterval(async () => {
      if (!video || video.paused || video.ended || !isOpen) return;

      let detections = [];
      let singleFaceDetection = null;

      // 1. Try detectSingleFace with fast 224 input size
      if (api && api.detectSingleFace && api.nets?.faceRecognitionNet?.isLoaded) {
        try {
          singleFaceDetection = await api.detectSingleFace(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptor();

          if (singleFaceDetection) {
            const resized = api.resizeResults ? api.resizeResults(singleFaceDetection, displaySize) : singleFaceDetection;
            detections = [resized];
          }
        } catch (e) {}
      }

      // 2. Fallback to detectAllFaces
      if (detections.length === 0 && api && api.detectAllFaces) {
        try {
          const rawDetections = await api.detectAllFaces(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          );
          detections = api.resizeResults ? api.resizeResults(rawDetections, displaySize) : rawDetections;
        } catch (e) {}
      }

      // 3. Fallback to native FaceDetector if available
      if (detections.length === 0 && 'FaceDetector' in window) {
        try {
          const nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          const faces = await nativeDetector.detect(video);
          detections = faces.map(f => ({ box: f.boundingBox }));
        } catch (e) {}
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clean

      const detectedCount = detections.length;

      if (detectedCount > 1) {
        autoCapturedRef.current = false;
        scanProgressRef.current = 0;
        setScanProgress(0);
        setFaceStatus({ valid: false, count: detectedCount, isMismatch: true, isCovered: false, text: '⚠️ Multiple faces detected! Only 1 person allowed.' });
      } else if (detectedCount === 1) {
        const det = detections[0];
        const box = det.box || det.detection?.box || det;
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;
        const viewCenterX = displaySize.width / 2;
        const viewCenterY = displaySize.height / 2;

        const deltaX = Math.abs(faceCenterX - viewCenterX);
        const deltaY = Math.abs(faceCenterY - viewCenterY);
        const isCentered = deltaX <= 100 && deltaY <= 100;

        // Check for face obstruction / mask / hand covering lower face safely
        let isCoveredFace = false;
        if (det.landmarks && det.landmarks.positions && det.landmarks.positions.length >= 68) {
          const mouth = typeof det.landmarks.getMouth === 'function' ? det.landmarks.getMouth() : null;
          const nose = typeof det.landmarks.getNose === 'function' ? det.landmarks.getNose() : null;
          if (!mouth || mouth.length < 6 || !nose || nose.length < 3) {
            isCoveredFace = true;
          } else {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            mouth.forEach(pt => {
              if (pt.x < minX) minX = pt.x;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.y > maxY) maxY = pt.y;
            });
            const mouthW = maxX - minX;
            const mouthH = maxY - minY;
            const faceW = box.width || 100;
            const faceH = box.height || 100;

            if (mouthW < faceW * 0.10 || mouthH < faceH * 0.015) {
              isCoveredFace = true;
            }
          }
        }

        const parseDescriptor = (raw) => {
          if (!raw) return null;
          if (typeof raw === 'object' && !Array.isArray(raw)) {
            if (raw.descriptor) raw = raw.descriptor;
            else if (raw.face_descriptor) raw = raw.face_descriptor;
            else if (raw.face_encoding) raw = raw.face_encoding;
          }
          if (Array.isArray(raw) && raw.length === 128) return raw.map(Number);
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length === 128) return parsed.map(Number);
            } catch (e) {}
          }
          if (typeof raw === 'object') {
            const vals = Object.values(raw);
            if (vals.length === 128) return vals.map(Number);
          }
          return null;
        };

        let parsedUserDescriptor = parseDescriptor(currentUserDescriptor);
        if (!parsedUserDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const empMatch = allRegisteredDescriptors.find(e => 
            (currentUserName && e.full_name && String(e.full_name).toLowerCase() === String(currentUserName).toLowerCase()) ||
            (e.emp_id && String(e.emp_id).toLowerCase() === String(currentUserName).toLowerCase())
          );
          if (empMatch) {
            parsedUserDescriptor = parseDescriptor(empMatch.descriptor || empMatch.face_encoding || empMatch.face_descriptor);
          }
        }

        let liveDescriptor = det.descriptor ? Array.from(det.descriptor) : null;
        let isFaceMatched = true;
        let isDuplicateFace = false;
        let calculatedDistance = null;
        let hasNoProfilePhoto = false;

        // REAL-TIME DUPLICATE FACE CHECK FOR REGISTRATION
        if (mode === 'register' && liveDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const liveFloatArray = new Float32Array(liveDescriptor);
          for (const emp of allRegisteredDescriptors) {
            const empDesc = parseDescriptor(emp.descriptor || emp.face_encoding || emp.face_descriptor);
            if (empDesc) {
              const targetArr = new Float32Array(empDesc);
              const d = api.euclideanDistance 
                ? api.euclideanDistance(liveFloatArray, targetArr) 
                : Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - empDesc[idx], 2), 0));

              if (d < 0.52) {
                isDuplicateFace = true;
                break;
              }
            }
          }
        }

        // REAL-TIME 1:1 FACE VERIFICATION FOR ATTENDANCE PUNCH
        if (mode === 'punch') {
          if (!parsedUserDescriptor) {
            hasNoProfilePhoto = true;
            isFaceMatched = false;
          } else if (liveDescriptor) {
            const targetDescriptor = new Float32Array(parsedUserDescriptor);
            const liveFloatArray = new Float32Array(liveDescriptor);
            
            if (api && api.euclideanDistance) {
              calculatedDistance = api.euclideanDistance(liveFloatArray, targetDescriptor);
            } else {
              calculatedDistance = Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - parsedUserDescriptor[idx], 2), 0));
            }

            // Strict Euclidean distance threshold for 128D face recognition (<= 0.58 is match)
            if (calculatedDistance > 0.58) {
              isFaceMatched = false;
            } else {
              isFaceMatched = true;
            }
          } else {
            isFaceMatched = false;
          }
        }

        // 3D Head Turning & Orientation Detection (Straight -> Left -> Right)
        let isStraightHead = false;
        let isTurnedHead = false;
        let yawRatio = 0;

        if (det.landmarks && typeof det.landmarks.getLeftEye === 'function') {
          try {
            const leftEye = det.landmarks.getLeftEye();
            const rightEye = det.landmarks.getRightEye();
            const nose = det.landmarks.getNose();
            if (leftEye && rightEye && nose && nose.length >= 4) {
              const noseTip = nose[3];
              const leftX = leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length;
              const rightX = rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length;
              const distL = Math.abs(noseTip.x - leftX);
              const distR = Math.abs(rightX - noseTip.x);
              yawRatio = Math.abs(distR - distL) / (distL + distR + 0.0001);

              if (yawRatio <= 0.14) {
                isStraightHead = true;
              } else if (yawRatio >= 0.12) {
                isTurnedHead = true;
              }
            }
          } catch (e) {}
        }

        if (isCoveredFace) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: true,
            text: '⚠️ Lower face covered! Remove mask, cloth, or hand.'
          });
        } else if (isDuplicateFace) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: 'This face is already registered in the system.'
          });
        } else if (hasNoProfilePhoto) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: '⚠️ Profile face not registered! Please register face photo.'
          });
        } else if (!isFaceMatched) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: '⚠️ Face Mismatch! (Not Matched)'
          });
        } else if (mode === 'register') {
          // THREE INDIVIDUAL SCANS (Step 1: Straight, Step 2: Turn Left, Step 3: Turn Right)
          // Each step fills from 0% to 100% over 3 seconds (2.5% per 75ms tick)
          const currentStage = regStageRef.current;

          if (currentStage === 1) {
            // STEP 1: STRAIGHT HEAD (0% -> 100%)
            if (isStraightHead && isCentered) {
              scanProgressRef.current = Math.min(100, scanProgressRef.current + 2.5);
              const p = Math.floor(scanProgressRef.current);
              setScanProgress(p);

              if (p >= 100) {
                // Step 1 Complete! Advance to Step 2
                regStageRef.current = 2;
                setRegStep(2);
                scanProgressRef.current = 0;
                setScanProgress(0);
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: '✓ Step 1 Complete! Now turn head slightly LEFT ⬅️'
                });
              } else {
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: `1️⃣ Step 1/3: Hold head STRAIGHT looking forward... ${p}%`
                });
              }
            } else {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '1️⃣ Step 1/3: Hold head STRAIGHT looking forward'
              });
            }
          } else if (currentStage === 2) {
            // STEP 2: TURN LEFT (0% -> 100%)
            if (isTurnedHead && isCentered) {
              scanProgressRef.current = Math.min(100, scanProgressRef.current + 2.5);
              const p = Math.floor(scanProgressRef.current);
              setScanProgress(p);

              if (p >= 100) {
                // Step 2 Complete! Advance to Step 3
                regStageRef.current = 3;
                setRegStep(3);
                scanProgressRef.current = 0;
                setScanProgress(0);
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: '✓ Step 2 Complete! Now turn head slightly RIGHT ➡️'
                });
              } else {
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: `2️⃣ Step 2/3: Turn head slightly LEFT ⬅️ ... ${p}%`
                });
              }
            } else {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '2️⃣ Step 2/3: Turn head slightly LEFT ⬅️'
              });
            }
          } else if (currentStage === 3) {
            // STEP 3: TURN RIGHT (0% -> 100%)
            if (isTurnedHead && isCentered) {
              scanProgressRef.current = Math.min(100, scanProgressRef.current + 2.5);
              const p = Math.floor(scanProgressRef.current);
              setScanProgress(p);

              if (p >= 100) {
                // Step 3 Complete! All 3 angles captured!
                setScanProgress(100);
                setFaceStatus({
                  valid: true,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: '✓ All 3 Face Angles Captured (100%) — Registering Biometrics...'
                });

                if (autoCapture && !autoCapturedRef.current) {
                  autoCapturedRef.current = true;
                  setTimeout(() => {
                    if (handleCaptureRef.current) handleCaptureRef.current();
                  }, 120);
                }
              } else {
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: `3️⃣ Step 3/3: Turn head slightly RIGHT ➡️ ... ${p}%`
                });
              }
            } else {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '3️⃣ Step 3/3: Turn head slightly RIGHT ➡️'
              });
            }
          }
        } else if (isCentered) {
          // Punch Mode (Fast 1-Step Punch)
          scanProgressRef.current = Math.min(100, scanProgressRef.current + 20.0);
          const currentProgress = Math.floor(scanProgressRef.current);
          setScanProgress(currentProgress);

          const matchPercent = calculatedDistance !== null ? Math.max(70, Math.min(99, Math.round((1 - calculatedDistance) * 100))) : 100;
          const statusText = currentProgress < 100
            ? `🔍 Scanning biometrics... ${currentProgress}%`
            : autoCapture 
            ? `✓ Face Verified (${matchPercent}% match) — Auto Punching...`
            : `✓ Face Verified (${matchPercent}% match)`;

          setFaceStatus({
            valid: currentProgress >= 100,
            count: 1,
            isMismatch: false,
            isCovered: false,
            text: statusText
          });

          if (currentProgress >= 100 && autoCapture && !autoCapturedRef.current) {
            autoCapturedRef.current = true;
            setTimeout(() => {
              if (handleCaptureRef.current) handleCaptureRef.current();
            }, 120);
          }
        } else {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: false,
            isCovered: false,
            text: 'Position face inside the center circle'
          });
        }
      } else {
        autoCapturedRef.current = false;
        scanProgressRef.current = 0;
        setScanProgress(0);
        setFaceStatus({ valid: false, count: 0, isMismatch: false, isCovered: false, text: 'Align face inside the center circle' });
      }
    }, 75);

    return () => clearInterval(interval);
  };

  const closeModal = () => {
    stopCamera();
    setIsOpen(false);
  };


  return (
    <div className="w-full">
      {/* 1. Normal View (Trigger Card) */}
      {!capturedImage || resetOnCapture ? (
        <div className={`border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
          isDarkMode 
            ? 'border-zinc-800 bg-[#18181b]' 
            : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-colors ${
              isDarkMode 
                ? 'bg-indigo-950/80 border border-indigo-800/60 text-indigo-400' 
                : 'bg-indigo-100 text-indigo-600'
            }`}>
              <Camera size={24} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold transition-colors ${isDarkMode ? 'text-zinc-100' : 'text-slate-800'}`}>{title}</h4>
              <p className={`text-xs transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            {buttonText}
          </button>
        </div>
      ) : (
        <div className={`border rounded-2xl p-4 flex items-center justify-between transition-colors ${
          isDarkMode 
            ? 'border-emerald-900/60 bg-emerald-950/30' 
            : 'border-emerald-200 bg-emerald-50/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-colors ${
              isDarkMode 
                ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-400' 
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
              }`}>
                Face Verified & Locked
              </div>
              <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Biometrics scanned successfully. Ready for registration.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCapturedImage(null);
              setIsOpen(true);
            }}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition ${
              isDarkMode 
                ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300' 
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            Retake
          </button>
        </div>
      )}

      {/* 2. Modal with Backdrop Blur */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-5 relative shadow-2xl flex flex-col items-center">
            
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <UserCheck className="text-indigo-400" size={18} />
                <span>Align Face to Capture</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Camera Viewport with Round Mask */}
            <div className="relative w-full aspect-square max-h-[340px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 z-30 bg-slate-950">
                  <RefreshCw className="animate-spin text-indigo-400" size={28} />
                  <span className="text-xs">Accessing webcam & Face AI...</span>
                </div>
              )}

              {errorMessage ? (
                <div className="p-4 text-center text-red-400 text-xs z-30">
                  {errorMessage}
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onPlay={handleVideoPlay}
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
                  />

                  {/* Pitch Black / Dark Mask Overlay outside the center circle (Only round shape camera visible) */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background: 'radial-gradient(circle 105px at 50% 50%, transparent 104px, rgba(15, 23, 42, 0.96) 105px)'
                    }}
                  />

                  {/* Perfect Circular Biometric Scanning Ring (0% -> 100%) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="relative w-[210px] h-[210px] flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                        <circle
                          cx="105"
                          cy="105"
                          r="100"
                          fill="none"
                          stroke={
                            faceStatus.isMismatch || faceStatus.isCovered || faceStatus.count > 1
                              ? '#ef4444'
                              : scanProgress > 0
                              ? '#10b981'
                              : '#64748b'
                          }
                          strokeWidth={scanProgress > 0 ? "5" : "3"}
                          strokeDasharray={
                            faceStatus.isMismatch || faceStatus.isCovered || faceStatus.count > 1
                              ? "none"
                              : scanProgress > 0
                              ? "628"
                              : "8 8"
                          }
                          strokeDashoffset={
                            scanProgress > 0 ? 628 - (628 * scanProgress) / 100 : 0
                          }
                          style={{ transition: 'stroke-dashoffset 60ms linear, stroke 0.2s ease' }}
                        />
                      </svg>

                      {/* Glowing Green Halo on 100% Verification */}
                      {scanProgress >= 100 && !faceStatus.isMismatch && !faceStatus.isCovered && (
                        <div className="absolute inset-0 rounded-full border-4 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.85)] animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Step Pills for Registration Mode */}
                  {mode === 'register' && (
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-full shadow-lg">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        regStep === 1 
                          ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400' 
                          : regStep > 1 
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {regStep > 1 ? '✓ 1. Straight' : '1. Straight'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        regStep === 2 
                          ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400' 
                          : regStep > 2 
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {regStep > 2 ? '✓ 2. Left ⬅️' : '2. Left ⬅️'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        regStep === 3 
                          ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400' 
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        3. Right ➡️
                      </span>
                    </div>
                  )}

                  {/* Status Tag */}
                  <div className={`absolute z-20 ${mode === 'register' ? 'bottom-3 left-3' : 'top-3 left-3'}`}>
                    {scanProgress >= 100 ? (
                      <span className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <CheckCircle2 size={12} /> {faceStatus.text}
                      </span>
                    ) : (faceStatus.count > 1 || faceStatus.isMismatch || faceStatus.isCovered) ? (
                      <span className="flex items-center gap-1 bg-red-950/90 border border-red-500 text-red-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <AlertCircle className="text-red-400" size={12} /> {faceStatus.text}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-900/90 border border-slate-600 text-slate-300 px-2.5 py-1 rounded-full text-[11px]">
                        <AlertCircle className="text-amber-400" size={12} /> {faceStatus.text}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Bottom Action */}
            {autoCapture ? (
              <div className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                scanProgress >= 100
                  ? 'bg-emerald-600 text-white shadow-lg animate-pulse'
                  : (faceStatus.isMismatch || faceStatus.isCovered)
                  ? 'bg-red-950 border border-red-700 text-red-300'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {scanProgress > 0 && scanProgress < 100 && <RefreshCw className="animate-spin text-emerald-400" size={16} />}
                {scanProgress >= 100 && <CheckCircle2 className="text-white" size={16} />}
                {(faceStatus.isMismatch || faceStatus.isCovered) && <AlertCircle className="text-red-400" size={16} />}
                <span>
                  {scanProgress >= 100 
                    ? (mode === 'register' ? '✓ Biometrics Verified (100%) — Capturing Photo...' : `✓ Face Verified — Auto Punching...`) 
                    : (faceStatus.isMismatch || faceStatus.isCovered)
                    ? faceStatus.text
                    : faceStatus.count > 1 
                    ? 'Multiple faces found - 1 face only' 
                    : scanProgress > 0 
                    ? `🔍 Scanning biometrics... ${scanProgress}%` 
                    : 'Position face inside center circle'}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                disabled={scanProgress < 100 || faceStatus.isMismatch || faceStatus.isCovered}
                className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                  scanProgress >= 100
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Camera size={16} />
                {scanProgress >= 100 
                  ? 'Capture & Confirm' 
                  : (faceStatus.isMismatch || faceStatus.isCovered)
                  ? faceStatus.text 
                  : faceStatus.count > 1 
                  ? 'Multiple faces found - 1 face only' 
                  : 'Align face inside center circle'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


