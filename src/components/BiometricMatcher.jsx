import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

// STRICT MATCH THRESHOLD: face-api.js Euclidean distance cutoff (0.45 = strict)
const FACE_MATCH_DISTANCE_THRESHOLD = 0.45;

export default function BiometricMatcher({ documentImageSrc, onMatchScore }) {
  const videoRef = useRef(null);
  const secondImgRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [matchScore, setMatchScore] = useState(null);
  const [systemStatus, setSystemStatus] = useState('Initializing AI Neural Nets...');
  const [mode, setMode] = useState('upload'); // default to upload for easy immediate testing
  const [cameraStarted, setCameraStarted] = useState(false);
  const [secondImageUrl, setSecondImageUrl] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face_detection'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/facial_mapping'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/descriptor_extractor'),
        ]);
        if (cancelled) return;
        setModelsLoaded(true);
        setSystemStatus('Biometric Neural Nets Ready. Select Mode.');
      } catch (err) {
        console.error('Failed to load biometric models:', err);
        if (!cancelled) setSystemStatus('Error loading biometric models');
      }
    };
    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const startWebcam = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play();
        setCameraStarted(true);
        setSystemStatus('Live Biometric Camera Active.');
      })
      .catch((err) => {
        console.error('Camera access denied:', err);
        setSystemStatus('Error: Camera Access Denied');
      });
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setMatchScore(null);
    if (nextMode === 'camera' && !cameraStarted) {
      startWebcam();
    } else {
      setSystemStatus(
        nextMode === 'camera' ? 'Camera ready for facial scan.' : 'Upload secondary photo for 1:1 facial descriptor match.'
      );
    }
  };

  const handleSecondImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSecondImageUrl(URL.createObjectURL(file));
      setMatchScore(null);
    }
  };

  const verifyIdentity = async () => {
    if (!documentImageSrc) return;
    if (mode === 'camera' && !videoRef.current) return;
    if (mode === 'upload' && !secondImageUrl) {
      setSystemStatus('Select or upload a secondary face image.');
      return;
    }

    setIsVerifying(true);
    setSystemStatus('Extracting 128-d facial vector descriptors...');

    try {
      const referenceImage = await faceapi.fetchImage(documentImageSrc);
      const referenceDetection = await faceapi
        .detectSingleFace(referenceImage)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!referenceDetection) {
        setSystemStatus('Error: No face detected in credential document.');
        setIsVerifying(false);
        return;
      }

      let liveDetection;
      if (mode === 'camera') {
        liveDetection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      } else {
        const comparisonImage = await faceapi.fetchImage(secondImageUrl);
        liveDetection = await faceapi.detectSingleFace(comparisonImage).withFaceLandmarks().withFaceDescriptor();
      }

      if (!liveDetection) {
        setSystemStatus(mode === 'camera' ? 'Error: No face detected in live feed.' : 'Error: No face detected in comparison photo.');
        setIsVerifying(false);
        return;
      }

      const distance = faceapi.euclideanDistance(referenceDetection.descriptor, liveDetection.descriptor);
      const threshold = FACE_MATCH_DISTANCE_THRESHOLD;
      let percentage = 0;
      if (distance < threshold) {
        percentage = Math.round((1 - distance / threshold) * 100);
      }

      setMatchScore(percentage);
      onMatchScore && onMatchScore(percentage);
      setSystemStatus(distance < threshold ? '1:1 MATCH VERIFIED' : 'BIOMETRIC MISMATCH (FAIL)');
    } catch (error) {
      console.error(error);
      setSystemStatus('Biometric Verification Error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #131B2E 0%, #0F172A 100%)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #273553',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>👤</span> 1:1 Biometric Facial Verifier
        </h3>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '999px',
            background: modelsLoaded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: modelsLoaded ? '#34D399' : '#FBBF24',
            border: modelsLoaded ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
            fontWeight: '600',
          }}
        >
          {modelsLoaded ? '● AI MODELS ONLINE' : '○ LOADING MODELS...'}
        </span>
      </div>

      <div
        style={{
          padding: '10px 14px',
          background: '#0B0F19',
          borderRadius: '8px',
          border: '1px solid #1E293B',
          fontSize: '0.85rem',
          color: '#94A3B8',
          marginBottom: '16px',
          fontFamily: 'monospace',
        }}
      >
        <span style={{ color: '#38BDF8' }}>STATUS: </span>
        {systemStatus}
      </div>

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => handleModeChange('upload')}
          disabled={!modelsLoaded}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: '6px',
            background: mode === 'upload' ? 'rgba(56, 189, 248, 0.2)' : '#1E293B',
            color: mode === 'upload' ? '#38BDF8' : '#94A3B8',
            border: mode === 'upload' ? '1px solid #38BDF8' : '1px solid #334155',
            fontWeight: '600',
            cursor: modelsLoaded ? 'pointer' : 'not-allowed',
            fontSize: '0.85rem',
          }}
        >
          📁 Secondary Photo
        </button>
        <button
          onClick={() => handleModeChange('camera')}
          disabled={!modelsLoaded}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: '6px',
            background: mode === 'camera' ? 'rgba(56, 189, 248, 0.2)' : '#1E293B',
            color: mode === 'camera' ? '#38BDF8' : '#94A3B8',
            border: mode === 'camera' ? '1px solid #38BDF8' : '1px solid #334155',
            fontWeight: '600',
            cursor: modelsLoaded ? 'pointer' : 'not-allowed',
            fontSize: '0.85rem',
          }}
        >
          📷 Live Webcam
        </button>
      </div>

      {/* Mode Contents */}
      {mode === 'camera' ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#0B0F19',
            border: '1px solid #273553',
            margin: '0 auto 16px',
          }}
        >
          <video ref={videoRef} autoPlay muted style={{ width: '100%', display: 'block' }} />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#0B0F19',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #1E293B',
            marginBottom: '16px',
          }}
        >
          <label style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: '500' }}>
            Select Comparison Subject Photo:
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleSecondImage}
            style={{
              fontSize: '0.85rem',
              color: '#F8FAFC',
            }}
          />
          {secondImageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <img
                ref={secondImgRef}
                src={secondImageUrl}
                alt="Comparison Target"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '2px solid #38BDF8',
                }}
              />
              <span style={{ fontSize: '0.8rem', color: '#34D399' }}>✓ Target loaded & ready for facial embedding match</span>
            </div>
          )}
        </div>
      )}

      {/* Verify Button */}
      <button
        onClick={verifyIdentity}
        disabled={!modelsLoaded || !documentImageSrc || (mode === 'upload' && !secondImageUrl) || isVerifying}
        style={{
          width: '100%',
          padding: '12px',
          background:
            !modelsLoaded || !documentImageSrc || (mode === 'upload' && !secondImageUrl) || isVerifying
              ? '#1E293B'
              : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
          color:
            !modelsLoaded || !documentImageSrc || (mode === 'upload' && !secondImageUrl) || isVerifying
              ? '#64748B'
              : '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor:
            !modelsLoaded || !documentImageSrc || (mode === 'upload' && !secondImageUrl) || isVerifying
              ? 'not-allowed'
              : 'pointer',
          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
          transition: 'all 0.2s ease',
        }}
      >
        {isVerifying ? 'Comparing 128-d Descriptors...' : '⚡ Execute 1:1 Biometric Verification'}
      </button>

      {/* Score Output */}
      {matchScore !== null && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '8px',
            background: matchScore > 50 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: matchScore > 50 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase' }}>Match Confidence</div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: '700',
                color: matchScore > 50 ? '#34D399' : '#FB7185',
              }}
            >
              {matchScore}%
            </div>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: matchScore > 50 ? '#059669' : '#E11D48',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '0.85rem',
              letterSpacing: '0.5px',
            }}
          >
            {matchScore > 50 ? 'PASS: GENUINE' : 'ALERT: IMPOSTOR'}
          </div>
        </div>
      )}
    </div>
  );
}


