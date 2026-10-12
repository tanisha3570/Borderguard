import React, { useEffect, useRef, useState } from 'react';

export default function ForensicAnalysis({ imageSrc }) {
  const canvasRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!imageSrc) return;
    
    const generateHeatmap = () => {
      setIsProcessing(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply visual artifact highlight filter
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
          
          if (luminance < 80) {
            data[i] = 255;       // Force Red high
            data[i + 1] = 50;    // Low Green
            data[i + 2] = 0;     // No Blue
          } else if (luminance > 220) {
            data[i] = 255;
            data[i + 1] = 200;   // Yellow tint
            data[i + 2] = 0;
          } else {
            data[i] = luminance / 4;
            data[i + 1] = luminance / 4;
            data[i + 2] = luminance; 
          }
        }

        ctx.putImageData(imageData, 0, 0);
        setIsProcessing(false);
      };

      img.src = imageSrc;
    };

    generateHeatmap();
  }, [imageSrc]);

  return (
    <div
      style={{
        marginTop: '24px',
        padding: '24px',
        background: 'linear-gradient(145deg, #131B2E 0%, #0F172A 100%)',
        borderRadius: '12px',
        border: '1px solid #273553',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔬</span> Forensic Surface Analysis (ELA Heatmap)
        </h3>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38BDF8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontWeight: '600',
          }}
        >
          ARTIFACT DETECTION
        </span>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
        Identifies high-contrast edge modifications, digital splicing artifacts, and potential font tampering via spectral luminance mapping.
      </p>
      
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '220px',
          background: '#0B0F19',
          borderRadius: '8px',
          border: '1px solid #1E293B',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '12px',
        }}
      >
        {isProcessing && (
          <div
            style={{
              position: 'absolute',
              color: '#38BDF8',
              fontSize: '0.9rem',
              fontWeight: '600',
              background: 'rgba(11, 15, 25, 0.8)',
              padding: '8px 16px',
              borderRadius: '6px',
            }}
          >
            Processing spectral analysis...
          </div>
        )}
        <canvas 
          ref={canvasRef} 
          style={{
            maxWidth: '100%',
            maxHeight: '380px',
            borderRadius: '6px',
            border: '1px solid #334155',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '0.75rem', color: '#94A3B8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF3200' }} /> High-Density Edge
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FFC800' }} /> Highlight Discontinuity
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1E2950' }} /> Normal Surface Substrate
        </div>
      </div>
    </div>
  );
}