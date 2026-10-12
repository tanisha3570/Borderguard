import React, { useState, useRef, useEffect } from 'react';
import { extractDocumentData } from '../utils/mrzParser';
import { extractDocumentText } from '../utils/ocrEngine';

/**
 * Generates an in-memory synthetic passport or ID card canvas for instant 1-click testing.
 */
function createSyntheticDocument(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 580;
  const ctx = canvas.getContext('2d');

  if (type === 'passport') {
    // Navy passport layout
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);

    // Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillText('PASSPORT / PASSEPORT', 40, 60);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('UTOPIA / REPUBLIQUE DE L\'UTOPIE', 40, 95);

    // Photo placeholder box
    ctx.fillStyle = '#334155';
    ctx.fillRect(40, 130, 200, 260);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 130, 200, 260);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('TRAVELER PHOTO', 65, 265);

    // Labeled fields
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('SURNAME / NOM', 280, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('ERIKSSON', 280, 175);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('GIVEN NAMES / PRENOMS', 280, 215);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('ANNA MARIA', 280, 240);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('NATIONALITY / NATIONALITE', 280, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('UTOPIAN (UTO)', 280, 305);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DATE OF BIRTH', 280, 345);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('12 AUG 1974', 280, 370);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DOCUMENT NO.', 560, 150);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('L8988901C', 560, 175);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('EXPIRATION DATE', 560, 215);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('15 APR 2030', 560, 240);

    // MRZ Zone at bottom (OCR-B / Monospace)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 420, 860, 140);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 420, 860, 140);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "JetBrains Mono", "Courier New", monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 40, 470);
    ctx.fillText('L8988901C4UTO7408122F1204159ZE184226B<<<<<14', 40, 520);
  } else if (type === 'idcard') {
    // TD1 ID Card layout
    ctx.fillStyle = '#0f2942';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('NATIONAL IDENTITY CARD — UTOPIA', 40, 55);

    // Photo
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(40, 90, 190, 250);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText('ID PHOTO', 95, 220);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('CARDHOLDER NAME', 270, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('ANNA MARIA ERIKSSON', 270, 145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DOC NUMBER', 270, 190);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('D23145890', 270, 215);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DATE OF BIRTH', 270, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('12/08/1974', 270, 285);

    // TD1 MRZ (3 lines x 30 chars)
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(20, 370, 860, 185);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText('I<UTOD231458907<<<<<<<<<<<<<<<', 50, 420);
    ctx.fillText('7408122F1204159UTO<<<<<<<<<<<6', 50, 470);
    ctx.fillText('ERIKSSON<<ANNA<MARIA<<<<<<<<<<', 50, 520);
  } else {
    // Non-MRZ Standard ID
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('GOVERNMENT OF INDIA — AADHAAR', 40, 60);

    ctx.fillStyle = '#292524';
    ctx.fillRect(40, 110, 190, 250);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText('PHOTO', 105, 240);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('NAME / HOLDER', 270, 140);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('RAHUL SHARMA', 270, 170);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('DATE OF BIRTH', 270, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('15/08/1992', 270, 250);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('GENDER', 270, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('MALE', 270, 330);

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(40, 420, 820, 100);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(40, 420, 820, 100);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 36px "JetBrains Mono", monospace';
    ctx.fillText('9876 5432 1098', 280, 485);
  }

  return canvas.toDataURL('image/png');
}

export default function Scanner({ imageUrl, onImageUploaded, onTextExtracted, onMrzExtracted }) {
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ stage: 'idle', percent: 0, text: '' });
  const [scanResult, setScanResult] = useState(null);
  const [documentData, setDocumentData] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (imageUrl && imageRef.current) {
      imageRef.current.src = imageUrl;
      setScanResult(null);
      setDocumentData(null);
      setOcrError(null);
      setOcrProgress({ stage: 'idle', percent: 0, text: '' });
    }
  }, [imageUrl]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      imageRef.current.src = url;
      setScanResult(null);
      setDocumentData(null);
      setOcrError(null);
      setOcrProgress({ stage: 'idle', percent: 0, text: '' });
      onImageUploaded && onImageUploaded(url);
    }
  };

  const handleLoadPreset = (type) => {
    const presetUrl = createSyntheticDocument(type);
    if (imageRef.current) {
      imageRef.current.src = presetUrl;
      setScanResult(null);
      setDocumentData(null);
      setOcrError(null);
      setOcrProgress({ stage: 'idle', percent: 0, text: '' });
      onImageUploaded && onImageUploaded(presetUrl);
    }
  };

  const processImage = async () => {
    const currentSrc = imageRef.current?.src || imageUrl;
    if (!currentSrc) return;

    setIsScanning(true);
    setOcrError(null);
    setScanResult(null);
    setDocumentData(null);
    setOcrProgress({ stage: 'preprocessing', percent: 10, text: 'Preprocessing image for contrast & clarity...' });

    try {
      setOcrProgress({ stage: 'initializing', percent: 20, text: 'Initializing on-device OCR engine...' });

      const rawText = await extractDocumentText(currentSrc, (progress, status) => {
        const p = Math.round(20 + progress * 75);
        const label =
          status === 'recognizing text'
            ? `Reading document text (${Math.round(progress * 100)}%)...`
            : 'Initializing on-device OCR engine...';
        setOcrProgress({ stage: 'recognizing', percent: p, text: label });
      });

      const parsed = extractDocumentData(rawText);

      setScanResult(rawText);
      onTextExtracted && onTextExtracted(rawText);

      setDocumentData(parsed);
      onMrzExtracted && onMrzExtracted(parsed);
      setOcrProgress({ stage: 'done', percent: 100, text: 'OCR extraction & document analysis complete.' });
    } catch (error) {
      console.error('OCR scan failed:', error);
      setOcrError(error?.message || 'Failed to read document text. Ensure the image is clear and not blurry.');
      setOcrProgress({ stage: 'error', percent: 0, text: 'Scan failed' });
    } finally {
      setIsScanning(false);
    }
  };

  const hasImage = Boolean(imageUrl || imageRef.current?.src);

  return (
    <div
      className="scanner-container"
      style={{
        background: 'var(--bg-panel, #131B2E)',
        borderRadius: 10,
        border: '1px solid var(--border-color, #273553)',
        padding: 20,
        color: '#f8fafc',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isScanning ? '#38bdf8' : hasImage ? '#10b981' : '#64748b',
              boxShadow: isScanning ? '0 0 10px #38bdf8' : hasImage ? '0 0 8px #10b981' : 'none',
            }}
          />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '0.02em' }}>
            Optical Scanner & MRZ Terminal
          </h2>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#94a3b8' }}>
          TESSERACT v5 · ICAO 9303
        </span>
      </div>

      <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
        Load an identity document to run on-device OCR, extract identity fields, and cryptographically validate MRZ check digits.
      </p>

      {/* Preset Buttons for Quick Testing */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
          QUICK DEMO PRESETS:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleLoadPreset('passport')}
            disabled={isScanning}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📘 Sample Passport (TD3)
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('idcard')}
            disabled={isScanning}
            style={{
              background: '#1e293b',
              color: '#10b981',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🪪 Sample ID Card (TD1)
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('aadhaar')}
            disabled={isScanning}
            style={{
              background: '#1e293b',
              color: '#f59e0b',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📄 Non-MRZ Document
          </button>
        </div>
      </div>

      {/* Upload File Input */}
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            display: 'block',
            padding: '10px 14px',
            background: '#1a243d',
            border: '1.5px dashed #3b82f6',
            borderRadius: 6,
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 12.5,
            color: '#cbd5e1',
            transition: 'background 0.2s',
          }}
        >
          <span>📁 Or upload your own Document Image (PNG, JPG, WEBP)</span>
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Image Preview Window */}
      <div
        style={{
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#0B0F19',
          border: '1px solid #273553',
          minHeight: hasImage ? 200 : 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <img
          ref={imageRef}
          alt="Document scan preview"
          style={{
            maxWidth: '100%',
            maxHeight: 340,
            objectFit: 'contain',
            display: hasImage ? 'block' : 'none',
          }}
        />
        {!hasImage && (
          <div style={{ color: '#475569', fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}>
            [ NO DOCUMENT LOADED — SELECT A PRESET OR UPLOAD ABOVE ]
          </div>
        )}
        {isScanning && (
          <div
            className="scan-line"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(90deg, transparent, #38bdf8, #60a5fa, transparent)',
              boxShadow: '0 0 15px #38bdf8',
              animation: 'bgscan 2s infinite linear',
            }}
          />
        )}
      </div>

      {/* Action Button & Progress Indicator */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={processImage}
          disabled={isScanning || !hasImage}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: isScanning ? '#334155' : hasImage ? 'linear-gradient(135deg, #2563eb, #0284c7)' : '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: isScanning || !hasImage ? 'not-allowed' : 'pointer',
            boxShadow: hasImage && !isScanning ? '0 4px 15px rgba(37, 99, 235, 0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {isScanning ? '⚡ SCANNING & PARSING MRZ...' : '🔍 INITIATE OCR SCAN'}
        </button>
      </div>

      {/* OCR Progress Bar */}
      {isScanning && (
        <div style={{ marginBottom: 14, background: '#1a243d', padding: 10, borderRadius: 6, border: '1px solid #273553' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#38bdf8' }}>
            <span>{ocrProgress.text}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{ocrProgress.percent}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${ocrProgress.percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #38bdf8)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {ocrError && (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 6, background: '#450a0a', border: '1px solid #f87171', color: '#fecaca', fontSize: 13 }}>
          <strong>⚠️ OCR Processing Error:</strong> {ocrError}
        </div>
      )}

      {/* Structured Document Results Panel */}
      {documentData && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 8,
            background: documentData.allChecksValid ? 'rgba(6, 78, 59, 0.3)' : 'rgba(127, 29, 29, 0.3)',
            border: `1px solid ${documentData.allChecksValid ? '#059669' : '#dc2626'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: documentData.allChecksValid ? '#34d399' : '#f87171' }}>
              {documentData.isMrz ? `ICAO MRZ Extracted (${documentData.format})` : `Document Text Extracted (${documentData.docType})`}
            </div>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: 700,
                background: documentData.allChecksValid ? '#065f46' : '#991b1b',
                color: '#fff',
              }}
            >
              {documentData.allChecksValid ? '✓ CHECKSUMS VALID (PASS)' : '✗ CHECKSUM MISMATCH (FLAG)'}
            </span>
          </div>

          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', fontFamily: 'var(--font-sans, sans-serif)' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '6px 0', color: '#94a3b8', width: '38%' }}>Full Name</td>
                <td style={{ padding: '6px 0', fontWeight: 700, color: '#f8fafc' }}>
                  {documentData.fullName || '—'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '6px 0', color: '#94a3b8' }}>Document Number</td>
                <td style={{ padding: '6px 0', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                  {documentData.documentNumber || '—'}{' '}
                  {documentData.documentNumberValid !== undefined && (
                    <span style={{ color: documentData.documentNumberValid ? '#34d399' : '#f87171' }}>
                      {documentData.documentNumberValid ? '✓' : '✗'}
                    </span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '6px 0', color: '#94a3b8' }}>Nationality</td>
                <td style={{ padding: '6px 0', color: '#f8fafc' }}>
                  {documentData.nationality || '—'} {documentData.nationalityCode ? `(${documentData.nationalityCode})` : ''}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '6px 0', color: '#94a3b8' }}>Date of Birth</td>
                <td style={{ padding: '6px 0', fontFamily: 'monospace', color: '#f8fafc' }}>
                  {documentData.dateOfBirth?.iso || documentData.dateOfBirth?.raw || '—'}{' '}
                  {documentData.dateOfBirthValid !== undefined && (
                    <span style={{ color: documentData.dateOfBirthValid ? '#34d399' : '#f87171' }}>
                      {documentData.dateOfBirthValid ? '✓' : '✗'}
                    </span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '6px 0', color: '#94a3b8' }}>Expiration Date</td>
                <td style={{ padding: '6px 0', fontFamily: 'monospace', color: '#f8fafc' }}>
                  {documentData.expirationDate?.iso || documentData.expirationDate?.raw || '—'}{' '}
                  {documentData.expirationValid !== undefined && (
                    <span style={{ color: documentData.expirationValid ? '#34d399' : '#f87171' }}>
                      {documentData.expirationValid ? '✓' : '✗'}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: '#94a3b8' }}>Sex</td>
                <td style={{ padding: '6px 0', color: '#f8fafc' }}>{documentData.sex || '—'}</td>
              </tr>
              {documentData.personalNumber && (
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: '6px 0', color: '#94a3b8' }}>Personal / Optional No.</td>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace', color: '#cbd5e1' }}>
                    {documentData.personalNumber} {documentData.personalNumberValid ? '✓' : '✗'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw OCR Text Toggle */}
      {scanResult && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowRawText(!showRawText)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {showRawText ? 'Hide Raw OCR Output ▲' : 'View Raw OCR Text Lines ▼'}
          </button>
          {showRawText && (
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                background: '#0a0f1d',
                borderRadius: 6,
                border: '1px solid #1e293b',
                color: '#94a3b8',
                fontSize: 11,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {scanResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

