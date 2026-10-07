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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoCapturedRef = useRef(false);
  const handleCaptureRef = useRef(null);

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
        return;
      }

      setLoading(true);
      setErrorMessage('');
      autoCapturedRef.current = false;

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

  const [faceStatus, setFaceStatus] = useState({ valid: false, count: 0, isMismatch: false, text: 'Align face inside the center oval' });

  const handleCapture = async () => {
    if (!videoRef.current || faceStatus.isMismatch) return;

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
            detections = [singleFaceDetection];
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
        setFaceStatus({ valid: false, count: detectedCount, isMismatch: false, text: '⚠️ Multiple faces detected! Only 1 person allowed.' });
      } else if (detectedCount === 1) {
        const det = detections[0];
        const box = det.box || det.detection?.box || det;
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;
        const viewCenterX = displaySize.width / 2;
        const viewCenterY = displaySize.height / 2;

        const deltaX = Math.abs(faceCenterX - viewCenterX);
        const deltaY = Math.abs(faceCenterY - viewCenterY);
        const isCentered = deltaX <= 110 && deltaY <= 110;

        let liveDescriptor = det.descriptor ? Array.from(det.descriptor) : null;
        let isFaceMatched = true;
        let isDuplicateFace = false;
        let duplicateEmpId = null;
        let calculatedDistance = null;

        // REAL-TIME DUPLICATE FACE CHECK FOR REGISTRATION
        if (mode === 'register' && liveDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const liveFloatArray = new Float32Array(liveDescriptor);
          for (const emp of allRegisteredDescriptors) {
            if (emp.descriptor && Array.isArray(emp.descriptor) && emp.descriptor.length === 128) {
              const targetArr = new Float32Array(emp.descriptor);
              const d = api.euclideanDistance 
                ? api.euclideanDistance(liveFloatArray, targetArr) 
                : Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - emp.descriptor[idx], 2), 0));

              if (d < 0.52) {
                isDuplicateFace = true;
                duplicateEmpId = emp.emp_id;
                break;
              }
            }
          }
        }

        // REAL-TIME 1:1 FACE VERIFICATION FOR ATTENDANCE PUNCH
        if (mode === 'punch' && liveDescriptor && currentUserDescriptor && Array.isArray(currentUserDescriptor) && currentUserDescriptor.length === 128) {
          const targetDescriptor = new Float32Array(currentUserDescriptor);
          const liveFloatArray = new Float32Array(liveDescriptor);
          
          if (api && api.euclideanDistance) {
            calculatedDistance = api.euclideanDistance(liveFloatArray, targetDescriptor);
          } else {
            calculatedDistance = Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - currentUserDescriptor[idx], 2), 0));
          }

          if (calculatedDistance > 0.55) {
            isFaceMatched = false;
          }
        }

        if (isDuplicateFace) {
          autoCapturedRef.current = false;
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            text: `Face already registered under employee ID: ${duplicateEmpId}`
          });
        } else if (!isFaceMatched) {
          autoCapturedRef.current = false;
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            text: 'Face mismatch! Only the registered employee can punch.'
          });
        } else if (isCentered) {
          const matchPercent = calculatedDistance !== null ? Math.round((1 - calculatedDistance) * 100) : 100;
          const statusText = autoCapture 
            ? (mode === 'register' ? '✓ Face Aligned — Auto Capturing Photo...' : `✓ Face Verified (${matchPercent}% match) — Auto Punching...`)
            : (mode === 'register' ? '✓ Face Aligned & Verified' : `✓ Face Verified (${matchPercent}% match)`);

          setFaceStatus({
            valid: true,
            count: 1,
            isMismatch: false,
            text: statusText
          });
          if (autoCapture && !autoCapturedRef.current) {
            autoCapturedRef.current = true;
            setTimeout(() => {
              if (handleCaptureRef.current) handleCaptureRef.current();
            }, 100);
          }
        } else {
          autoCapturedRef.current = false;
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: false,
            text: 'Position face inside the green center oval'
          });
        }
      } else {
        autoCapturedRef.current = false;
        setFaceStatus({ valid: false, count: 0, isMismatch: false, text: 'Align face inside the center oval' });
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
            <img
              src={capturedImage}
              alt="Profile Face"
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500"
            />
            <div>
              <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
              }`}>
                <CheckCircle2 size={14} /> Face Verified & Locked
              </div>
              <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Ready to complete employee registration.</p>
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

            {/* Camera Viewport */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 z-20 bg-slate-950/80">
                  <RefreshCw className="animate-spin text-indigo-400" size={28} />
                  <span className="text-xs">Accessing webcam & Face AI...</span>
                </div>
              )}

              {errorMessage ? (
                <div className="p-4 text-center text-red-400 text-xs z-20">
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

                  {/* Face Target Oval (Green Box for Verified, Red Box for Mismatch / Multiple) */}
                  <div className={`absolute w-[165px] h-[210px] rounded-[50%] pointer-events-none transition-all duration-300 ${
                    faceStatus.valid
                      ? 'border-4 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-102'
                      : (faceStatus.count > 1 || faceStatus.isMismatch)
                      ? 'border-4 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                      : 'border-2 border-dashed border-slate-400/80'
                  }`} />

                  {/* Status Tag */}
                  <div className="absolute top-3 left-3 z-10">
                    {faceStatus.valid ? (
                      <span className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <CheckCircle2 size={12} /> {faceStatus.text}
                      </span>
                    ) : (faceStatus.count > 1 || faceStatus.isMismatch) ? (
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
                faceStatus.valid
                  ? 'bg-emerald-600 text-white shadow-lg animate-pulse'
                  : faceStatus.isMismatch
                  ? 'bg-red-950 border border-red-700 text-red-300'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {faceStatus.valid && <RefreshCw className="animate-spin text-white" size={16} />}
                {faceStatus.isMismatch && <AlertCircle className="text-red-400" size={16} />}
                <span>
                  {faceStatus.valid 
                    ? `✓ ${currentUserName} Verified — Punching Automatically...` 
                    : faceStatus.isMismatch 
                    ? 'Face mismatch! Only the registered employee can punch.' 
                    : faceStatus.count > 1 
                    ? 'Multiple faces found - 1 face only' 
                    : 'Hold still... Auto-punching when aligned'}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!faceStatus.valid || faceStatus.isMismatch}
                className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                  faceStatus.valid
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Camera size={16} />
                {faceStatus.valid 
                  ? 'Capture & Confirm' 
                  : faceStatus.isMismatch 
                  ? 'Face mismatch! Only the registered employee can punch.' 
                  : faceStatus.count > 1 
                  ? 'Multiple faces found - 1 face only' 
                  : 'Align face inside center oval'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


