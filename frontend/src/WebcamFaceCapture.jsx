import React, { useRef, useEffect, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function WebcamFaceCapture({ 
  onCaptureSuccess, 
  mode = 'register', // 'register' | 'punch'
  isProcessing = false,
  userName = ''
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Initialize Models and Camera
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log('[FaceEngine] Model Loaded successfully');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
        }
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('[FaceEngine Error]:', err);
        setErrorMessage('Camera or Face AI failed to load. Please allow camera permissions.');
        setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Real-time Detection Loop
  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const displaySize = { width: video.clientWidth || 480, height: video.clientHeight || 360 };
    faceapi.matchDimensions(canvas, displaySize);

    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.35
    });

    const interval = setInterval(async () => {
      if (!video || video.paused || video.ended || (mode === 'register' && capturedPhoto)) return;

      try {
        let detectedCount = 0;
        if (faceapi.detectAllFaces) {
          const detections = await faceapi.detectAllFaces(video, detectorOptions);
          detectedCount = detections.length;
        } else {
          const detection = await faceapi.detectSingleFace(video, detectorOptions);
          detectedCount = detection ? 1 : 0;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clean (no inner square boxes)

        if (detectedCount === 1) {
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
        }
      } catch (e) {
        setFaceDetected(false);
      }
    }, 120);


    return () => clearInterval(interval);
  };

  // 3. Capture Action
  const handleCapture = () => {
    if (!faceDetected || !videoRef.current || isProcessing) return;

    const video = videoRef.current;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth || 640;
    offCanvas.height = video.videoHeight || 480;
    const ctx = offCanvas.getContext('2d');

    // Un-mirror snapshot
    ctx.translate(offCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

    offCanvas.toBlob((blob) => {
      const dataUrl = URL.createObjectURL(blob);
      if (mode === 'register') {
        setCapturedPhoto(dataUrl);
      }
      if (onCaptureSuccess) {
        onCaptureSuccess(blob, dataUrl);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setFaceDetected(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Viewport Frame */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: '24px',
        overflow: 'hidden',
        backgroundColor: '#020617',
        border: '2px solid #334155',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', gap: '12px', zIndex: 20, backgroundColor: 'rgba(15, 23, 42, 0.92)' }}>
            <RefreshCw style={{ width: '32px', height: '32px', color: '#10b981', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Starting Camera & Biometrics...</p>
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#f87171', fontSize: '13px', zIndex: 20 }}>
            {errorMessage}
          </div>
        )}

        {mode === 'register' && capturedPhoto ? (
          <img src={capturedPhoto} alt="Captured Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={handleVideoPlay}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                transform: 'scaleX(-1)'
              }}
            />

            {/* Compact Face Shape Target Oval (165px x 210px) */}
            <div style={{
              position: 'absolute',
              width: '165px',
              height: '210px',
              borderRadius: '50%',
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
              border: faceDetected ? '4px solid #10b981' : '2px dashed rgba(148, 163, 184, 0.6)',
              boxShadow: faceDetected ? '0 0 25px rgba(16, 185, 129, 0.5)' : 'none',
              transform: faceDetected ? 'scale(1.03)' : 'scale(1)'
            }} />




            {/* Dynamic Status Badge */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}>
              {faceDetected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(6, 78, 59, 0.85)', border: '1px solid #10b981', color: '#34d399', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px' }} /> Face Locked & Ready
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #475569', color: '#cbd5e1', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backdropFilter: 'blur(6px)' }}>
                  <AlertCircle style={{ width: '14px', height: '14px', color: '#fbbf24' }} /> Center your face
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action Button */}
      {mode === 'register' && capturedPhoto ? (
        <button
          type="button"
          onClick={handleRetake}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '14px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: '800',
            fontSize: '14px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            border: '1px solid #475569',
            cursor: 'pointer'
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} /> Retake Face Photo
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCapture}
          disabled={!faceDetected || isProcessing}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '16px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: '800',
            fontSize: '15px',
            transition: 'all 0.2s ease',
            border: 'none',
            cursor: faceDetected && !isProcessing ? 'pointer' : 'not-allowed',
            backgroundColor: faceDetected ? '#10b981' : '#cbd5e1',
            color: faceDetected ? '#ffffff' : '#64748b',
            boxShadow: faceDetected ? '0 8px 20px rgba(16, 185, 129, 0.35)' : 'none'
          }}
        >
          {isProcessing ? (
            <>
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
              Verifying Registered Face...
            </>
          ) : mode === 'punch' ? (
            <>
              <UserCheck style={{ width: '20px', height: '20px' }} />
              {faceDetected ? `Punch Attendance for ${userName || 'Logged In User'}` : 'Align Face in Green Box to Punch'}
            </>
          ) : (
            <>
              <Camera style={{ width: '18px', height: '18px' }} />
              {faceDetected ? 'Capture Face Photo' : 'Align Face in Green Box to Capture'}
            </>
          )}
        </button>
      )}
    </div>
  );
}
