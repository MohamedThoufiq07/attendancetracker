import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertCircle, X, RefreshCw, UserCheck } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function FaceScanModalCapture({ 
  onFaceCaptured,
  title = "Biometric Face Scan",
  description = "Center face scan required to activate attendance profile.",
  buttonText = "Open Face Scanner",
  resetOnCapture = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

      try {
        const api = faceapi || window.faceapi;
        if (api && api.nets) {
          try {
            await api.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
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

  const [faceStatus, setFaceStatus] = useState({ valid: false, count: 0, text: 'Align single face in oval frame' });

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

      let detectedCount = 0;
      if (api && api.detectAllFaces) {
        try {
          const detections = await api.detectAllFaces(
            video,
            new api.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })
          );
          detectedCount = detections.length;
        } catch (e) {}
      } else if ('FaceDetector' in window) {
        try {
          const nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          const faces = await nativeDetector.detect(video);
          detectedCount = faces.length;
        } catch (e) {}
      } else if (api && api.detectSingleFace) {
        try {
          const single = await api.detectSingleFace(video, new api.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }));
          detectedCount = single ? 1 : 0;
        } catch (e) {}
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clear (no square rectangles)

      if (detectedCount === 1) {
        setFaceStatus({ valid: true, count: 1, text: '✓ Single Face Verified' });
      } else if (detectedCount > 1) {
        setFaceStatus({ valid: false, count: detectedCount, text: '⚠️ Multiple faces detected! Only 1 face allowed.' });
      } else {
        setFaceStatus({ valid: false, count: 0, text: 'Align single face in oval frame' });
      }
    }, 120);

    return () => clearInterval(interval);
  };

  const handleCapture = () => {
    if (!faceStatus.valid || !videoRef.current) return;

    const video = videoRef.current;
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
      if (onFaceCaptured) onFaceCaptured(blob || dataUrl);
      stopCamera();
      setIsOpen(false);
    }, 'image/jpeg', 0.95);
  };

  const closeModal = () => {
    stopCamera();
    setIsOpen(false);
  };

  return (
    <div className="w-full">
      {/* 1. Normal View (Trigger Card) */}
      {!capturedImage || resetOnCapture ? (
        <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Camera size={24} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            {buttonText}
          </button>
        </div>
      ) : (
        <div className="border border-emerald-200 bg-emerald-50/60 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={capturedImage}
              alt="Profile Face"
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500"
            />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={14} /> Face Verified & Locked
              </div>
              <p className="text-[11px] text-slate-500">Ready to complete employee registration.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
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

                  {/* Perfectly Proportioned Face Oval Overlay (190px x 240px) */}
                  <div className={`absolute w-[190px] h-[240px] rounded-[50%] pointer-events-none transition-all duration-300 ${
                    faceStatus.valid
                      ? 'border-4 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-102'
                      : faceStatus.count > 1
                      ? 'border-4 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                      : 'border-2 border-dashed border-slate-400/80'
                  }`} />


                  {/* Status Tag */}
                  <div className="absolute top-3 left-3 z-10">
                    {faceStatus.valid ? (
                      <span className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <CheckCircle2 size={12} /> {faceStatus.text}
                      </span>
                    ) : faceStatus.count > 1 ? (
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

            {/* Modal Bottom Button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={!faceStatus.valid}
              className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                faceStatus.valid
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Camera size={16} />
              {faceStatus.valid ? 'Capture & Confirm' : faceStatus.count > 1 ? 'Multiple faces found - 1 face only' : 'Align single face in oval frame'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

