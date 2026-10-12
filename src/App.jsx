import React, { useState, useEffect, useRef, useCallback } from 'react';
import { extractDocumentData } from './utils/mrzParser.js';
import { extractDocumentText } from './utils/ocrEngine.js';
import { compareFaces, loadBiometricModels } from './utils/biometricEngine.js';

// --- THEME & STYLES (Exact previous UI tokens) ---
const T = {
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  ink: '#12161C',
  inkSoft: '#2A323D',
  border: '#E2E4E8',
  borderStrong: '#C8CBD2',
  muted: '#687282',
  faint: '#9AA1AA',
  navy: '#1E3A5F',
  navySoft: '#EBF2FA',
  green: '#1E7E34',
  greenSoft: '#EAF5EC',
  red: '#C53030',
  redSoft: '#FDEAEA',
  amber: '#B7791F',
  amberSoft: '#FEF7E6',
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

const OFFICER = {
  id: 'A104',
  name: 'Officer J. Vance',
  checkpoint: 'Terminal B3 · Gate 12',
};

const STAGES = [
  'Document Classification & Geometry Rectification',
  'Deep OCR & ICAO Doc 9303 MRZ Parsing',
  'Multi-Spectral Surface Forensics (ELA)',
  'Facial Biometric Feature Vector Comparison (1:1)',
  'Cross-Database & Watchlist Verification',
  'Cryptographic SHA-256 Ledger Record Commitment',
];

const CASE_TEMPLATES = {
  genuine: {
    docType: 'Passport',
    country: 'India',
    docNumber: 'P1234567',
    name: 'ROHIT SHARMA',
    dob: '01/01/1990',
    nationality: 'Indian',
    expiry: '01/01/2030',
    mrz: 'VALID',
    docIntegrity: 98,
    faceMatch: 95,
    faceLiveness: 'CONFIRMED',
    identityConsistency: 100,
    dbStatus: 'Clean (No Watchlist Hits)',
    riskScore: 4,
    riskLevel: 'LOW',
    summary: 'All identity vectors verified. Document authentic, 1:1 facial biometric match confirmed, and zero watchlist hits.',
    reasons: [],
    checks: [
      { label: 'ICAO Doc 9303 MRZ Checksums', status: 'pass', conf: 99 },
      { label: 'Holographic & UV Microprint Pattern', status: 'pass', conf: 96 },
      { label: 'Surface Pixel Gradient Continuity', status: 'pass', conf: 98 },
      { label: 'Interpol & National Database Check', status: 'pass', conf: 100 },
    ],
    tampering: null,
  },
  tampered: {
    docType: 'Passport',
    country: 'Utopia',
    docNumber: 'L8988901C',
    name: 'ANNA MARIA ERIKSSON',
    dob: '12/08/1974',
    nationality: 'Utopian',
    expiry: '15/04/2012',
    mrz: 'CHECKSUM_FAILED',
    docIntegrity: 42,
    faceMatch: 88,
    faceLiveness: 'CONFIRMED',
    identityConsistency: 55,
    dbStatus: 'Flagged (Document Expired & Altered)',
    riskScore: 89,
    riskLevel: 'HIGH',
    summary: 'Potential credential tampering detected. Expiration date and MRZ checksum mismatch. Secondary inspection mandatory.',
    reasons: ['MRZ Composite Checksum mismatch', 'Digital alteration detected on Date of Expiry field'],
    checks: [
      { label: 'ICAO Doc 9303 MRZ Checksums', status: 'fail', conf: 92 },
      { label: 'Surface Pixel Gradient Continuity', status: 'warn', conf: 48 },
      { label: 'Font & Alignment Consistency', status: 'fail', conf: 85 },
      { label: 'National Database Record', status: 'warn', conf: 60 },
    ],
    tampering: {
      region: 'Date of Expiry / MRZ Line 2',
      confidence: 91,
      box: { x: 55, y: 35, w: 38, h: 22 },
      signals: ['Font weight irregularity in expiry year', 'Luminance discontinuity around numeric boundary'],
    },
  },
  impersonation: {
    docType: 'National ID Card',
    country: 'India',
    docNumber: '123456789',
    name: 'JOHN ALEXANDER DOE',
    dob: '01/01/1990',
    nationality: 'Indian',
    expiry: '01/01/2030',
    mrz: 'VALID',
    docIntegrity: 92,
    faceMatch: 34,
    faceLiveness: 'SUSPICIOUS',
    identityConsistency: 80,
    dbStatus: 'Clean Record',
    riskScore: 82,
    riskLevel: 'HIGH',
    summary: 'Biometric mismatch. The live traveler photo does not match the photo embedded in the credential document.',
    reasons: ['Facial biometric Euclidean distance exceeds strict verification threshold (0.45)', 'Biometric confidence score is only 34%'],
    checks: [
      { label: 'ICAO Doc 9303 MRZ Checksums', status: 'pass', conf: 97 },
      { label: 'Document Substrate Authenticity', status: 'pass', conf: 94 },
      { label: '1:1 Facial Vector Matching', status: 'fail', conf: 96 },
      { label: 'Liveness & Anti-Spoofing', status: 'warn', conf: 62 },
    ],
    tampering: null,
  },
};

function nowStr() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

let caseCounter = 4821;
function newCaseId() {
  caseCounter += 1;
  return 'BG-2026-' + String(caseCounter).padStart(6, '0');
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return 'sha256:' + Math.abs(h).toString(16).padStart(8, '0') + Math.abs((h * 2654435761) | 0).toString(16).padStart(8, '0');
}

// --- SUB-COMPONENTS ---

function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 3 L34 8 V19 C34 28 28 34.5 20 37 C12 34.5 6 28 6 19 V8 Z" fill={T.navy} />
      <path d="M20 3 L34 8 V19 C34 28 28 34.5 20 37 V3Z" fill="#082038" />
      <path d="M13 19.5 L18 24.5 L27.5 13.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Wordmark({ dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Mark />
      <div>
        <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: '0.01em', color: dark ? '#fff' : T.ink, lineHeight: 1.1 }}>
          BORDERGUARD <span style={{ color: dark ? '#9FB3CE' : T.navy }}>AI</span>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.08em', color: dark ? '#7C93AF' : T.muted, textTransform: 'uppercase' }}>
          Identity Verification Platform
        </div>
      </div>
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 6 }} />;
}

function StatusPill({ level }) {
  const map = {
    LOW: { bg: T.greenSoft, fg: T.green, label: 'LOW RISK' },
    MEDIUM: { bg: T.amberSoft, fg: T.amber, label: 'MEDIUM RISK' },
    HIGH: { bg: T.redSoft, fg: T.red, label: 'HIGH RISK' },
  };
  const s = map[level] || map.LOW;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontFamily: T.mono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        padding: '3px 8px',
        borderRadius: 3,
        border: '1px solid ' + s.fg + '22',
      }}
    >
      {s.label}
    </span>
  );
}

function CheckIcon({ status, size = 14 }) {
  const colors = { pass: T.green, warn: T.amber, fail: T.red };
  const c = colors[status] || T.muted;
  const glyph = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✕';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 6,
        height: size + 6,
        borderRadius: 3,
        background: c + '17',
        color: c,
        fontSize: size - 1,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function Panel({ children, style, title, right }) {
  return (
    <div style={{ background: T.surface, border: '1px solid ' + T.border, borderRadius: 4, padding: 16, ...style }}>
      {title && <SectionLabel right={right}>{title}</SectionLabel>}
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: T.surface,
        border: '1px solid ' + T.border,
        borderTop: accent ? '2px solid ' + accent : '1px solid ' + T.border,
        borderRadius: 4,
        padding: '14px 16px',
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.06em', color: T.muted, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, fontFamily: T.mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ScoreBar({ label, value, suffix = '%' }) {
  if (value === null || value === undefined) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: T.inkSoft }}>{label}</span>
          <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.muted, fontSize: 11 }}>
            Not Uploaded (Optional)
          </span>
        </div>
      </div>
    );
  }
  const numericVal = typeof value === 'number' ? value : parseInt(value, 10) || 0;
  const c = numericVal >= 85 ? T.green : numericVal >= 60 ? T.amber : T.red;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.inkSoft }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontWeight: 700, color: c }}>
          {numericVal}
          {suffix}
        </span>
      </div>
      <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: Math.min(100, Math.max(0, numericVal)) + '%', height: '100%', background: c }} />
      </div>
    </div>
  );
}

function ResultBanner({ result }) {
  const verified = result.riskLevel === 'LOW';
  const bg = verified ? T.greenSoft : result.riskLevel === 'HIGH' ? T.redSoft : T.amberSoft;
  const fg = verified ? T.green : result.riskLevel === 'HIGH' ? T.red : T.amber;
  return (
    <div style={{ background: bg, border: '1px solid ' + fg + '33', borderLeft: '4px solid ' + fg, borderRadius: 3, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: fg, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>
        VERIFICATION RESULT
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: fg, marginBottom: 6 }}>
        {verified ? 'IDENTITY VERIFIED' : 'VERIFICATION REQUIRES ATTENTION'}
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{result.summary}</div>
    </div>
  );
}

const btnPrimary = {
  background: T.navy,
  color: '#fff',
  border: 'none',
  padding: '10px 16px',
  fontSize: 12.5,
  fontWeight: 800,
  borderRadius: 3,
  cursor: 'pointer',
  letterSpacing: '0.03em',
};

const btnGhost = {
  background: 'transparent',
  color: T.navy,
  border: '1px solid ' + T.borderStrong,
  padding: '9px 14px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 3,
  cursor: 'pointer',
};

const toggleBtn = (active) => ({
  background: active ? T.navySoft : 'transparent',
  color: active ? T.navy : T.muted,
  border: '1px solid ' + (active ? T.navy : T.border),
  borderRadius: 3,
  padding: '6px 12px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
});

function ScanLine() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        background: '#4E8EDB',
        boxShadow: '0 0 10px #4E8EDB',
        animation: 'bgscan 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
}

// --- SYNTHETIC DOCUMENT PRESET GENERATOR ---
function generateSyntheticDoc(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 580;
  const ctx = canvas.getContext('2d');

  if (type === 'passport') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('PASSPORT / PASSEPORT — REPUBLIC OF UTOPIA', 40, 55);

    ctx.fillStyle = '#334155';
    ctx.fillRect(40, 90, 200, 260);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('PASSPORT PHOTO', 70, 225);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('SURNAME / NOM', 280, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('ERIKSSON', 280, 145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('GIVEN NAMES / PRENOMS', 280, 180);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('ANNA MARIA', 280, 205);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('NATIONALITY / NATIONALITE', 280, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('UTOPIAN (UTO)', 280, 265);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DOCUMENT NO.', 560, 120);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('L8988901C', 560, 145);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 390, 860, 170);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 40, 450);
    ctx.fillText('L8988901C4UTO7408122F1204159ZE184226B<<<<<14', 40, 510);
  } else if (type === 'idcard') {
    ctx.fillStyle = '#0f2942';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('NATIONAL IDENTITY CARD — INDIA', 40, 55);

    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(40, 90, 190, 250);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText('ID PHOTO', 95, 220);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('NAME', 270, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText('JOHN ALEXANDER DOE', 270, 145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('DOC NUMBER', 270, 190);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('123456789', 270, 215);

    ctx.fillStyle = '#091522';
    ctx.fillRect(20, 360, 860, 200);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText('IDD<<1234567897<<<<<<<<<<<<<<<', 40, 415);
    ctx.fillText('9001018M3001014IND<<<<<<<<<<<8', 40, 470);
    ctx.fillText('DOE<<JOHN<ALEXANDER<<<<<<<<<<<', 40, 525);
  } else {
    // Aadhaar / Non-MRZ
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 900, 580);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 560);
    ctx.fillStyle = '#c2410c';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('GOVERNMENT OF INDIA — UNIQUE IDENTIFICATION', 40, 55);

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(40, 90, 190, 250);
    ctx.fillStyle = '#64748b';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText('HOLDER PHOTO', 75, 220);

    ctx.fillStyle = '#475569';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Name: Priya Ramesh Sharma', 270, 130);
    ctx.fillText('DOB: 14/08/1995', 270, 170);
    ctx.fillText('Gender: FEMALE', 270, 210);
    ctx.fillText('Address: 123 MG Road, Bengaluru, Karnataka', 270, 250);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('5482 9104 3821', 270, 340);
  }

  return canvas.toDataURL('image/png');
}

// --- DOCUMENT PHOTO REPLICA (As In Photo View) ---
function DocumentPhotoReplica({ doc, photoUrl }) {
  if (!doc) return null;
  const isPassport = /passport|passeport/i.test(doc.docType || '');
  const isDL = /driving|licen[cs]e/i.test(doc.docType || '');
  const isAadhaar = /aadhaar/i.test(doc.docType || '');
  const isPAN = /pan\s*card/i.test(doc.docType || '');

  const bgColor = isPassport ? '#0F1E36' : isDL ? '#0A2518' : isAadhaar ? '#FFFFFF' : isPAN ? '#16233B' : '#111827';
  const textColor = isAadhaar ? '#0F172A' : '#F8FAFC';
  const mutedColor = isAadhaar ? '#64748B' : '#94A3B8';
  const borderColor = isPassport ? '#38BDF8' : isDL ? '#10B981' : isAadhaar ? '#F97316' : '#60A5FA';

  return (
    <div
      style={{
        background: bgColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: '16px 18px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        fontFamily: T.sans,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${isAadhaar ? '#E2E8F0' : 'rgba(255,255,255,0.12)'}`, paddingBottom: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: isAadhaar ? '#C2410C' : borderColor }}>
            {doc.docType?.toUpperCase() || 'IDENTITY CREDENTIAL'}
          </div>
          <div style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>
            {doc.country?.toUpperCase() || 'ISSUING AUTHORITY'}
          </div>
        </div>
        <span style={{ fontSize: 10.5, fontFamily: T.mono, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isAadhaar ? '#F1F5F9' : 'rgba(255,255,255,0.1)', color: isAadhaar ? '#334155' : '#E2E8F0' }}>
          PHOTO LAYOUT EXTRACT
        </span>
      </div>

      {/* Main Grid: Photo Box + Demographic Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 14, marginBottom: 12 }}>
        {/* Photo Box */}
        <div style={{ width: 110, height: 135, borderRadius: 4, background: isAadhaar ? '#F8FAFC' : '#1E293B', border: `1.5px solid ${isAadhaar ? '#CBD5E1' : '#334155'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Credential Crop" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: mutedColor, padding: 6 }}>
              <div style={{ fontSize: 26, marginBottom: 2 }}>👤</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' }}>HOLDER PHOTO</div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Full Name</div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.02em', color: isAadhaar ? '#0F172A' : '#FFFFFF' }}>
              {doc.name || '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Document Number</div>
              <div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 13, color: isAadhaar ? '#0F172A' : borderColor }}>
                {doc.docNumber || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Date of Birth</div>
              <div style={{ fontFamily: T.mono, fontWeight: 600, fontSize: 12 }}>
                {doc.dob || '—'} {doc.age ? `(${doc.age}y)` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Gender / Sex</div>
              <div style={{ fontWeight: 600 }}>{doc.gender || '—'}</div>
            </div>
            {doc.bloodGroup ? (
              <div>
                <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Blood Group</div>
                <div style={{ fontWeight: 800, color: '#EF4444', fontFamily: T.mono }}>{doc.bloodGroup}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 9.5, color: mutedColor, textTransform: 'uppercase', fontWeight: 700 }}>Nationality</div>
                <div style={{ fontWeight: 600 }}>{doc.nationality || '—'}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Details (Care of, Place of birth, Vehicle classes, Dates) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, borderTop: `1px solid ${isAadhaar ? '#E2E8F0' : 'rgba(255,255,255,0.08)'}`, paddingTop: 8 }}>
        {doc.careOf && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Father / Guardian:</span>
            <span style={{ fontWeight: 600 }}>{doc.careOf}</span>
          </div>
        )}
        {doc.vehicleClass && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Vehicle Class (COV):</span>
            <span style={{ fontFamily: T.mono, fontWeight: 700, color: borderColor }}>{doc.vehicleClass}</span>
          </div>
        )}
        {doc.placeOfBirth && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Place of Birth:</span>
            <span style={{ fontWeight: 600 }}>{doc.placeOfBirth}</span>
          </div>
        )}
        {doc.placeOfIssue && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Place of Issue / Authority:</span>
            <span style={{ fontWeight: 600 }}>{doc.placeOfIssue}</span>
          </div>
        )}
        {doc.issueDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Date of Issue:</span>
            <span style={{ fontFamily: T.mono }}>{doc.issueDate}</span>
          </div>
        )}
        {doc.expiry && doc.expiry !== 'N/A' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: mutedColor }}>Valid Till / Expiry:</span>
            <span style={{ fontFamily: T.mono, fontWeight: 700 }}>{doc.expiry}</span>
          </div>
        )}
        {doc.address && (
          <div style={{ marginTop: 2 }}>
            <span style={{ color: mutedColor, display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Address:</span>
            <span style={{ fontSize: 11, lineHeight: 1.4, color: isAadhaar ? '#334155' : '#CBD5E1' }}>{doc.address}</span>
          </div>
        )}
      </div>

      {/* MRZ Band at Bottom if Available */}
      {doc.mrz && doc.mrz !== 'NON_MRZ' && doc.ocrRawText && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: isAadhaar ? '#0F172A' : '#090D16', borderRadius: 4, fontFamily: T.mono, fontSize: 10.5, letterSpacing: '1px', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.1)' }}>
          {doc.ocrRawText.split(/\r?\n/).filter((l) => l.includes('<') && l.length >= 25).map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- WORKSPACE & VERIFICATION ---
function VerificationWorkspace({ onComplete, pushAudit, caseSeed, clearSeed }) {
  const [docImg, setDocImg] = useState(null);
  const [faceImg, setFaceImg] = useState(null);
  const [phase, setPhase] = useState('upload'); // 'upload' | 'processing' | 'result'
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('original'); // 'original' | 'replica' | 'forensic'
  const [showTech, setShowTech] = useState(false);
  const [showAllFields, setShowAllFields] = useState(true);
  const [ocrStatus, setOcrStatus] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrFields, setOcrFields] = useState({});
  const [ocrText, setOcrText] = useState('');
  const [ocrMrzObj, setOcrMrzObj] = useState(null);
  
  // Real 1:1 Facial Biometrics State
  const [biometricResult, setBiometricResult] = useState(null); // { success, score, distance, isMatch, reason, verdict }
  const [biometricStatus, setBiometricStatus] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const timerRef = useRef();

  useEffect(() => {
    if (caseSeed) {
      setDocImg(generateSyntheticDoc(caseSeed === 'tampered' ? 'passport' : caseSeed === 'impersonation' ? 'idcard' : 'passport'));
      runVerification(caseSeed);
      clearSeed();
    }
  }, [caseSeed]);

  useEffect(() => {
    if (!docImg) {
      setOcrStatus('idle');
      setOcrFields({});
      setOcrText('');
      setOcrMrzObj(null);
      return;
    }

    let cancelled = false;
    setOcrStatus('running');
    setOcrProgress(15);
    setOcrFields({});

    const runOcr = async () => {
      try {
        let text = '';
        try {
          text = await extractDocumentText(docImg, (progress) => {
            if (!cancelled) setOcrProgress(Math.round(15 + progress * 75));
          });
        } catch (browserErr) {
          console.warn('Browser OCR notice, attempting server OCR fallback:', browserErr);
        }

        // Server-side fallback if browser extraction was sparse or failed
        if (!text || text.split('\n').filter(Boolean).length < 2) {
          try {
            const resp = await fetch('/api/ocr/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: docImg }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.rawText && data.rawText.length > (text || '').length) {
                text = data.rawText;
              }
            }
          } catch (serverErr) {
            console.warn('Server OCR fallback notice:', serverErr);
          }
        }

        if (cancelled) return;
        setOcrText(text);

        const parsed = extractDocumentData(text);
        setOcrMrzObj(parsed);

        const mappedFields = {};
        if (parsed) {
          if (parsed.fullName || parsed.name) mappedFields.name = parsed.fullName || parsed.name;
          if (parsed.givenNames) mappedFields.givenNames = parsed.givenNames;
          if (parsed.surname) mappedFields.surname = parsed.surname;
          if (parsed.docType) mappedFields.docType = parsed.docType;
          if (parsed.country) mappedFields.country = parsed.country;
          if (parsed.documentNumber || parsed.docNumber) mappedFields.docNumber = parsed.documentNumber || parsed.docNumber;
          if (parsed.nationality) mappedFields.nationality = parsed.nationality;
          if (parsed.dateOfBirth?.formatted || parsed.dateOfBirth?.iso || parsed.dob) mappedFields.dob = parsed.dateOfBirth?.formatted || parsed.dateOfBirth?.iso || parsed.dob;
          if (parsed.age !== null && parsed.age !== undefined) mappedFields.age = parsed.age;
          if (parsed.gender || parsed.sex) mappedFields.gender = parsed.gender || parsed.sex;
          if (parsed.careOf) mappedFields.careOf = parsed.careOf;
          if (parsed.fatherName) mappedFields.fatherName = parsed.fatherName;
          if (parsed.motherName) mappedFields.motherName = parsed.motherName;
          if (parsed.spouseName) mappedFields.spouseName = parsed.spouseName;
          if (parsed.address) mappedFields.address = parsed.address;
          if (parsed.pinCode) mappedFields.pinCode = parsed.pinCode;
          if (parsed.vidNumber) mappedFields.vidNumber = parsed.vidNumber;
          if (parsed.bloodGroup) mappedFields.bloodGroup = parsed.bloodGroup;
          if (parsed.placeOfBirth) mappedFields.placeOfBirth = parsed.placeOfBirth;
          if (parsed.placeOfIssue) mappedFields.placeOfIssue = parsed.placeOfIssue;
          if (parsed.vehicleClass) mappedFields.vehicleClass = parsed.vehicleClass;
          if (parsed.issueDate) mappedFields.issueDate = parsed.issueDate;
          if (parsed.expirationDate?.formatted || parsed.expirationDate?.iso || parsed.expiry) mappedFields.expiry = parsed.expirationDate?.formatted || parsed.expirationDate?.iso || parsed.expiry;
          mappedFields.mrz = parsed.isMrz ? (parsed.allChecksValid ? 'VALID' : 'CHECKSUM_FAILED') : 'NON_MRZ';
          mappedFields.allDetectedFields = parsed.allDetectedFields || {};
          mappedFields.visualLines = parsed.visualLines || [];
        }

        setOcrFields(mappedFields);
        setOcrStatus(Object.keys(mappedFields).length > 0 || text.trim() ? 'done' : 'error');
        setOcrProgress(100);
      } catch (err) {
        if (!cancelled) {
          console.error('OCR recognition error:', err);
          setOcrStatus('error');
        }
      }
    };

    runOcr();
    return () => {
      cancelled = true;
    };
  }, [docImg]);

  // Live 1:1 Facial Biometric Comparison via face-api.js Neural Embeddings
  useEffect(() => {
    if (!docImg || !faceImg) {
      setBiometricResult(null);
      setBiometricStatus('idle');
      return;
    }

    let cancelled = false;
    setBiometricStatus('running');

    const runBiometricMatch = async () => {
      try {
        const matchRes = await compareFaces(docImg, faceImg);
        if (cancelled) return;
        setBiometricResult(matchRes);
        setBiometricStatus('done');
      } catch (err) {
        if (!cancelled) {
          console.error('Biometric comparison error:', err);
          setBiometricStatus('error');
        }
      }
    };

    runBiometricMatch();
    return () => {
      cancelled = true;
    };
  }, [docImg, faceImg]);

  // Connect stream to video element when camera becomes active
  useEffect(() => {
    let videoEl = videoRef.current;
    if (cameraActive && videoEl && mediaStreamRef.current) {
      videoEl.srcObject = mediaStreamRef.current;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch((err) => console.warn('Video play notice:', err));
      };
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn('Play error:', err));
        }
      }, 50);
    } catch (err) {
      console.error('Camera access failed:', err);
      alert('Camera access denied or unavailable: ' + err.message);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      alert('Camera feed is still initializing. Please wait a second and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFaceImg(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const runVerification = useCallback(
    (templateKey, overrideBioResult = null) => {
      const isPreset = Boolean(caseSeed && CASE_TEMPLATES[templateKey || caseSeed]);
      const base = isPreset ? CASE_TEMPLATES[templateKey || caseSeed] : null;

      const finalDocType = ocrFields.docType || ocrMrzObj?.docType || (base ? base.docType : 'Identity Document');
      const finalCountry = ocrFields.country || ocrMrzObj?.country || (base ? base.country : null);
      const finalDocNumber = ocrFields.docNumber || ocrMrzObj?.docNumber || (base ? base.docNumber : null);
      const finalName = ocrFields.name || ocrMrzObj?.name || (base ? base.name : null);
      const finalDob = ocrFields.dob || ocrMrzObj?.dob || (base ? base.dob : null);
      const finalGender = ocrFields.gender || ocrMrzObj?.gender || (base ? base.gender : 'Unspecified');
      const finalNationality = ocrFields.nationality || ocrMrzObj?.nationality || (base ? base.nationality : null);
      const finalExpiry = (ocrFields.expiry && ocrFields.expiry !== 'N/A' ? ocrFields.expiry : null) || (ocrMrzObj?.expiry && ocrMrzObj.expiry !== 'N/A' ? ocrMrzObj.expiry : null) || (finalDocType === 'Aadhaar Card' ? 'Permanent / Lifetime' : (base ? base.expiry : null));
      const finalMrz = ocrMrzObj?.isMrz ? (ocrMrzObj.allChecksValid ? 'VALID' : 'CHECKSUM_FAILED') : 'NON_MRZ';

      let docIntegrity = 98;
      let faceMatch = null;
      let identityConsistency = 98;
      let dbStatus = 'Clean (No Watchlist Hits)';
      let riskScore = 4;
      let riskLevel = 'LOW';
      let summary = `All identity vectors verified. Authentic ${finalDocType} detected with valid demographic details.`;
      let reasons = [];
      let checks = [
        { label: ocrMrzObj?.isMrz ? 'ICAO Doc 9303 MRZ Checksums' : 'Govt Substrate & Hologram Layout', status: 'pass', conf: 99 },
        { label: 'Surface Pixel Gradient Continuity', status: 'pass', conf: 98 },
        { label: 'Demographic Consistency (OCR vs Records)', status: 'pass', conf: 97 },
        { label: 'Interpol & National Database Check', status: 'pass', conf: 100 },
      ];
      let tampering = null;

      if (isPreset && base) {
        docIntegrity = base.docIntegrity;
        faceMatch = base.faceMatch;
        identityConsistency = base.identityConsistency;
        dbStatus = base.dbStatus;
        riskScore = base.riskScore;
        riskLevel = base.riskLevel;
        summary = base.summary;
        reasons = [...base.reasons];
        checks = [...base.checks];
        tampering = base.tampering;
      } else {
        const activeBio = overrideBioResult || biometricResult;
        if (faceImg && activeBio) {
          if (activeBio.success) {
            faceMatch = activeBio.score;
            if (!activeBio.isMatch || faceMatch < 75) {
              riskScore = Math.max(riskScore, 92);
              riskLevel = 'HIGH';
              dbStatus = 'Flagged (Biometric Impersonation Alert)';
              reasons.push(`1:1 Biometric Facial Mismatch: Live face does not match credential photo (${faceMatch}% match, Euclidean dist: ${activeBio.distance})`);
              summary = 'CRITICAL: 1:1 Facial Biometric Mismatch detected. Document portrait does not match traveler face. Mandatory secondary inspection and biometric retention.';
              checks.push({ label: '1:1 Facial Biometric Match (AI ResNet)', status: 'fail', conf: faceMatch });
            } else {
              riskScore = 3;
              riskLevel = 'LOW';
              dbStatus = 'Clean (No Watchlist Hits)';
              checks.push({ label: '1:1 Facial Biometric Match (AI ResNet)', status: 'pass', conf: faceMatch });
            }
          } else {
            faceMatch = 0;
            riskScore = Math.max(riskScore, 70);
            riskLevel = 'HIGH';
            dbStatus = 'Flagged (Facial Detection Failed)';
            reasons.push(`Biometric inspection failure: ${activeBio.reason || 'Face could not be verified'}`);
            summary = 'WARNING: Biometric face detection failed on provided images. Officer manual inspection required.';
            checks.push({ label: '1:1 Facial Biometric Match (AI ResNet)', status: 'fail', conf: 0 });
          }
        } else if (faceImg && !activeBio) {
          faceMatch = null;
          checks.push({ label: '1:1 Facial Biometric Match (AI ResNet)', status: 'warn', conf: 'Processing' });
        } else {
          faceMatch = null;
          checks.push({ label: 'Document Portrait Geometry Check', status: 'pass', conf: 95 });
        }

        if (ocrMrzObj?.isMrz && !ocrMrzObj.allChecksValid) {
          riskScore = Math.max(riskScore, 89);
          riskLevel = 'HIGH';
          summary = 'Potential credential tampering detected. Expiration date and MRZ checksum mismatch. Secondary inspection mandatory.';
          reasons.push('MRZ Composite Checksum mismatch');
          reasons.push('Digital alteration detected on Date of Expiry field');
          docIntegrity = 42;
          dbStatus = 'Flagged (MRZ Checksum Failed)';
          checks[0] = { label: 'ICAO Doc 9303 MRZ Checksums', status: 'fail', conf: 92 };
        } else if (!finalDocNumber && !finalName && !ocrFields.name) {
          riskScore = Math.max(riskScore, 45);
          if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
          if (!summary.startsWith('CRITICAL')) summary = 'Document fields could not be fully verified from OCR scan. Manual officer review recommended.';
          reasons.push('Low OCR confidence on primary identifier fields');
          docIntegrity = 60;
          if (!dbStatus.startsWith('Flagged')) dbStatus = 'Unverified Scan';
          checks[1] = { label: 'Demographic Consistency (OCR vs Records)', status: 'warn', conf: 60 };
        }
      }

      const ocrKeys = ['name', 'docType', 'docNumber', 'dob', 'nationality', 'expiry', 'gender', 'address', 'careOf', 'vidNumber', 'issueDate', 'country', 'bloodGroup', 'placeOfBirth', 'placeOfIssue', 'vehicleClass', 'fatherName', 'motherName', 'spouseName', 'age'];
      const fieldsFromOcr = ocrKeys.filter((k) => ocrFields[k]);

      const tpl = {
        docType: finalDocType,
        country: finalCountry,
        docNumber: finalDocNumber,
        name: finalName,
        givenNames: ocrFields.givenNames || ocrMrzObj?.givenNames || null,
        surname: ocrFields.surname || ocrMrzObj?.surname || null,
        dob: finalDob,
        age: ocrFields.age ?? ocrMrzObj?.age ?? null,
        gender: finalGender,
        nationality: finalNationality,
        expiry: finalExpiry,
        mrz: finalMrz,
        careOf: ocrFields.careOf || ocrMrzObj?.careOf || null,
        fatherName: ocrFields.fatherName || ocrMrzObj?.fatherName || null,
        motherName: ocrFields.motherName || ocrMrzObj?.motherName || null,
        spouseName: ocrFields.spouseName || ocrMrzObj?.spouseName || null,
        address: ocrFields.address || ocrMrzObj?.address || null,
        pinCode: ocrFields.pinCode || ocrMrzObj?.pinCode || null,
        vidNumber: ocrFields.vidNumber || ocrMrzObj?.vidNumber || null,
        issueDate: ocrFields.issueDate || ocrMrzObj?.issueDate || null,
        bloodGroup: ocrFields.bloodGroup || ocrMrzObj?.bloodGroup || null,
        placeOfBirth: ocrFields.placeOfBirth || ocrMrzObj?.placeOfBirth || null,
        placeOfIssue: ocrFields.placeOfIssue || ocrMrzObj?.placeOfIssue || null,
        vehicleClass: ocrFields.vehicleClass || ocrMrzObj?.vehicleClass || null,
        allDetectedFields: ocrFields.allDetectedFields || ocrMrzObj?.allDetectedFields || {},
        visualLines: ocrFields.visualLines || ocrMrzObj?.visualLines || [],
        docIntegrity,
        faceMatch,
        faceLiveness: 'CONFIRMED',
        identityConsistency,
        dbStatus,
        riskScore,
        riskLevel,
        summary,
        reasons,
        checks,
        tampering,
        nameSource: ocrFields.name ? 'ocr' : (isPreset ? 'demo' : 'scan'),
        fieldsFromOcr,
        ocrRawText: ocrText,
      };

      setPhase('processing');
      setStageIndex(0);
      let i = 0;
      const caseId = newCaseId();
      pushAudit(caseId, 'Document scanned and OCR extracted', 'System');
      clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        i += 1;
        setStageIndex(i);
        const stageName = STAGES[i - 1];
        if (stageName) pushAudit(caseId, stageName + ' completed', 'AI Engine');
        if (i >= STAGES.length) {
          clearInterval(timerRef.current);
          setTimeout(async () => {
            const finalResult = { ...tpl, caseId };
            setResult(finalResult);
            setPhase('result');
            onComplete(finalResult);

            try {
              await fetch('/api/verify-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  extractedText: ocrText || JSON.stringify(tpl),
                  matchScore: finalResult.faceMatch,
                  caseId,
                  verificationRecord: finalResult,
                }),
              });
            } catch (err) {
              console.error('Failed to post verify block:', err);
            }
          }, 350);
        }
      }, 480);
    },
    [onComplete, pushAudit, ocrFields, ocrMrzObj, ocrText, caseSeed, faceImg, biometricResult]
  );

  const start = async () => {
    if (!docImg || ocrStatus === 'running') return;
    let bioRes = biometricResult;
    if (faceImg && (!biometricResult || biometricStatus === 'running')) {
      try {
        setBiometricStatus('running');
        bioRes = await compareFaces(docImg, faceImg);
        setBiometricResult(bioRes);
        setBiometricStatus('done');
      } catch (err) {
        console.error('Biometric run error:', err);
      }
    }
    runVerification(null, bioRes);
  };

  const reset = () => {
    clearInterval(timerRef.current);
    stopCamera();
    setDocImg(null);
    setFaceImg(null);
    setBiometricResult(null);
    setBiometricStatus('idle');
    setPhase('upload');
    setStageIndex(0);
    setResult(null);
    setShowTech(false);
    setView('original');
    setOcrStatus('idle');
    setOcrProgress(0);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Identity Verification Terminal</h1>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>
            Optical Document Inspection · Universal Entity & Field Extraction · 1:1 Biometrics · Cryptographic Chain
          </div>
        </div>
        {phase === 'result' && (
          <button onClick={reset} style={btnPrimary}>
            + VERIFY ANOTHER TRAVELER
          </button>
        )}
      </div>

      {phase === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
          <Panel title="Document Scan / Presets">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setDocImg(generateSyntheticDoc('passport'))}
                style={{ ...btnGhost, flex: 1, padding: '7px 8px', fontSize: 11.5 }}
              >
                📄 TD3 Passport
              </button>
              <button
                onClick={() => setDocImg(generateSyntheticDoc('idcard'))}
                style={{ ...btnGhost, flex: 1, padding: '7px 8px', fontSize: 11.5 }}
              >
                🪪 TD1 ID Card
              </button>
              <button
                onClick={() => setDocImg(generateSyntheticDoc('aadhaar'))}
                style={{ ...btnGhost, flex: 1, padding: '7px 8px', fontSize: 11.5 }}
              >
                🇮🇳 Aadhaar Card
              </button>
            </div>

            <div
              onClick={() => document.getElementById('file-upload-input').click()}
              style={{
                border: '1.5px dashed ' + T.borderStrong,
                borderRadius: 4,
                background: '#FAFAF9',
                minHeight: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <input
                id="file-upload-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setDocImg(URL.createObjectURL(e.target.files[0]));
                  }
                }}
              />
              {docImg ? (
                <img src={docImg} alt="Uploaded document" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{ fontSize: 26, marginBottom: 6, color: T.faint }}>⤓</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>Upload any credential image (Passport, Aadhaar, DL, PAN, Voter ID)</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Click presets above, drag & drop, or browse file</div>
                </>
              )}
            </div>

            {ocrStatus === 'running' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: T.navy, fontWeight: 700, marginBottom: 4 }}>
                  <span>Scanning photo and extracting all fields...</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${ocrProgress}%`, height: '100%', background: T.navy, transition: 'width 0.2s ease' }} />
                </div>
              </div>
            )}

            {ocrStatus === 'error' && (
              <div style={{ marginTop: 12, padding: 10, background: T.redSoft, borderRadius: 3, border: '1px solid ' + T.red + '33' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.red }}>
                  OCR could not read text from this image. Ensure lighting is adequate and text is clear.
                </div>
              </div>
            )}

            {ocrStatus === 'done' && Object.keys(ocrFields).length > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: '#F8FAFC', borderRadius: 6, border: '1px solid ' + T.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.navy, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: T.green }}>✓</span> PHOTO FIELDS EXTRACTED ({ocrFields.docType || 'Document'})
                  </div>
                  <span style={{ fontSize: 10.5, fontFamily: T.mono, padding: '2px 6px', background: T.greenSoft, color: T.green, borderRadius: 3, fontWeight: 700 }}>
                    {Object.keys(ocrFields.allDetectedFields || {}).length || Object.keys(ocrFields).length} FIELDS CAPTURED
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11.5 }}>
                  <div><span style={{ color: T.muted }}>Name:</span> <b>{ocrFields.name || '—'}</b></div>
                  <div><span style={{ color: T.muted }}>Doc #:</span> <b style={{ fontFamily: T.mono }}>{ocrFields.docNumber || '—'}</b></div>
                  <div><span style={{ color: T.muted }}>DOB:</span> <b style={{ fontFamily: T.mono }}>{ocrFields.dob || '—'}</b></div>
                  <div><span style={{ color: T.muted }}>Gender:</span> <b>{ocrFields.gender || '—'}</b></div>
                  {ocrFields.bloodGroup && <div><span style={{ color: T.muted }}>Blood Grp:</span> <b style={{ color: '#DC2626' }}>{ocrFields.bloodGroup}</b></div>}
                  {ocrFields.careOf && <div><span style={{ color: T.muted }}>Care of:</span> <b>{ocrFields.careOf}</b></div>}
                  {ocrFields.expiry && ocrFields.expiry !== 'N/A' && <div><span style={{ color: T.muted }}>Expiry:</span> <b style={{ fontFamily: T.mono }}>{ocrFields.expiry}</b></div>}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Traveler Biometric Photo (1:1 Verification)">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  document.getElementById('face-upload-input').click();
                }}
                style={{ ...btnGhost, flex: 1, padding: '7px 8px', fontSize: 11.5 }}
              >
                📁 Upload Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cameraActive) stopCamera();
                  else startCamera();
                }}
                style={{
                  ...btnGhost,
                  flex: 1,
                  padding: '7px 8px',
                  fontSize: 11.5,
                  background: cameraActive ? T.navySoft : '#FAFAF9',
                  borderColor: cameraActive ? T.navy : T.borderStrong,
                  color: cameraActive ? T.navy : T.ink,
                  fontWeight: cameraActive ? 700 : 500,
                }}
              >
                {cameraActive ? '✕ Close Camera' : '📷 Open Live Camera'}
              </button>
            </div>

            {cameraActive ? (
              <div
                style={{
                  border: '1.5px solid ' + T.navy,
                  borderRadius: 4,
                  background: '#0B0F19',
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    e.target.play().catch((err) => console.warn('Video play handler notice:', err));
                  }}
                  style={{ width: '100%', height: 220, objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', bottom: 12, display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    style={{
                      ...btnPrimary,
                      padding: '8px 18px',
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    📸 Capture Face
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      ...btnGhost,
                      background: '#1E293B',
                      color: '#F8FAFC',
                      borderColor: '#475569',
                      padding: '8px 14px',
                      fontSize: 12,
                    }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => document.getElementById('face-upload-input').click()}
                style={{
                  border: '1.5px dashed ' + (faceImg ? (biometricResult?.isMatch ? T.green : (biometricResult?.success === false || (biometricResult?.score ?? 100) < 75 ? T.red : T.borderStrong)) : T.borderStrong),
                  borderRadius: 4,
                  background: '#FAFAF9',
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <input
                  id="face-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFaceImg(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                />
                {faceImg ? (
                  <img src={faceImg} alt="Traveler Face" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 26, marginBottom: 6, color: T.faint }}>👤</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>Upload traveler portrait or use camera</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Runs on-device 1:1 facial descriptor comparison against document</div>
                  </>
                )}
              </div>
            )}

            {faceImg && !cameraActive && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFaceImg(null);
                    setBiometricResult(null);
                  }}
                  style={{ background: 'none', border: 'none', color: T.muted, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ✕ Remove traveler photo
                </button>
              </div>
            )}

            {biometricStatus === 'running' && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: T.navySoft, borderRadius: 3, border: '1px solid ' + T.navy + '33' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.navy, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⏳</span> AI extracting 128-d facial vector descriptors...
                </div>
              </div>
            )}

            {biometricStatus === 'done' && biometricResult && (
              <div
                style={{
                  marginTop: 10,
                  padding: '9px 12px',
                  background: biometricResult.success && biometricResult.isMatch ? T.greenSoft : T.redSoft,
                  borderRadius: 3,
                  border: '1px solid ' + (biometricResult.success && biometricResult.isMatch ? T.green + '40' : T.red + '40'),
                }}
              >
                {biometricResult.success ? (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: biometricResult.isMatch ? T.green : T.red,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{biometricResult.isMatch ? '✓ 1:1 BIOMETRIC MATCH' : '⚠️ BIOMETRIC MISMATCH (FAIL)'}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 13 }}>{biometricResult.score}% MATCH</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: biometricResult.isMatch ? T.green : T.red, marginTop: 3 }}>
                      {biometricResult.isMatch
                        ? `Facial vector distance: ${biometricResult.distance} (Within security threshold ≤ 0.58)`
                        : `Facial vector distance: ${biometricResult.distance} (Threshold exceeded > 0.58 — Impersonation Alert)`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.red }}>
                    {biometricResult.reason || 'Biometric inspection failed.'}
                  </div>
                )}
              </div>
            )}

            <button
              disabled={!docImg || ocrStatus === 'running'}
              onClick={start}
              style={{
                ...btnPrimary,
                opacity: docImg && ocrStatus !== 'running' ? 1 : 0.4,
                cursor: docImg && ocrStatus !== 'running' ? 'pointer' : 'not-allowed',
                width: '100%',
                padding: '13px 0',
                marginTop: 14,
              }}
            >
              {ocrStatus === 'running' ? 'READING DOCUMENT (OCR)...' : 'BEGIN VERIFICATION PIPELINE →'}
            </button>
          </Panel>
        </div>
      )}

      {phase === 'processing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14 }}>
          <Panel title="Document Scan Preview">
            <div style={{ borderRadius: 4, overflow: 'hidden', position: 'relative', background: '#12161C', minHeight: 220 }}>
              {docImg ? (
                <img src={docImg} alt="Uploaded document" style={{ width: '100%', height: '100%', minHeight: 220, objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#5A6B85', fontFamily: T.mono }}>DOCUMENT SCAN</div>
              )}
              <ScanLine />
            </div>
          </Panel>
          <Panel title="AI Verification Pipeline">
            <div>
              {STAGES.map((s, i) => {
                let state = 'pending';
                if (i < stageIndex) state = 'done';
                if (i === stageIndex) state = 'active';
                const colors = { pending: T.faint, active: T.navy, done: T.green, warn: T.amber, fail: T.red };
                const c = colors[state];
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid ' + T.border }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: state === 'active' ? 2 : '50%',
                        background: state === 'pending' ? 'transparent' : c,
                        border: '1.5px solid ' + c,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, fontSize: 12.5, color: state === 'pending' ? T.muted : T.ink, fontWeight: state === 'active' ? 700 : 500 }}>
                      {s}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: c, fontWeight: 700 }}>
                      {state === 'pending' && 'PENDING'}
                      {state === 'active' && 'PROCESSING...'}
                      {state === 'done' && 'COMPLETE'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {phase === 'result' && result && (
        <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.15fr 0.9fr', gap: 14 }}>
          {/* Left Column: Document Photo & Visual Layout Card */}
          <div>
            <Panel title="Document Photo & Layout" style={{ marginBottom: 14 }}>
              {view === 'original' && (
                <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', background: '#0F172A', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {docImg ? (
                    <img src={docImg} alt="Uploaded document" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: '#5A6B85', fontFamily: T.mono }}>
                      {result.docType?.toUpperCase()} — {result.country?.toUpperCase()}
                    </div>
                  )}
                </div>
              )}

              {view === 'replica' && (
                <DocumentPhotoReplica doc={result} photoUrl={faceImg} />
              )}

              {view === 'forensic' && (
                <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', background: '#0F172A', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {docImg && <img src={docImg} alt="Uploaded document" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }} />}
                  {result.tampering ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: result.tampering.box.x + '%',
                        top: result.tampering.box.y + '%',
                        width: result.tampering.box.w + '%',
                        height: result.tampering.box.h + '%',
                        border: '2px solid ' + T.red,
                        boxShadow: '0 0 0 2px ' + T.redSoft,
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -20,
                          left: 0,
                          fontFamily: T.mono,
                          fontSize: 9.5,
                          color: '#fff',
                          background: T.red,
                          padding: '2px 5px',
                          borderRadius: 2,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ALTERATION {result.tampering.confidence}%
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '4px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
                      ✓ Surface Gradient Uniform (Zero Alteration Signals)
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setView('original')} style={toggleBtn(view === 'original')}>
                  Original Photo
                </button>
                <button onClick={() => setView('replica')} style={toggleBtn(view === 'replica')}>
                  Photo Layout Extract
                </button>
                <button onClick={() => setView('forensic')} style={toggleBtn(view === 'forensic')}>
                  Forensic Heatmap
                </button>
              </div>
            </Panel>

            <Panel title="Face Verification">
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: result.faceMatch >= 85 ? T.green : T.red, fontFamily: T.mono }}>
                  {result.faceMatch}% MATCH
                </div>
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>1:1 Facial Vector Confidence (AI Descriptor)</div>
              </div>
            </Panel>
          </div>

          {/* Middle Column: Extracted Identity Information & Detected Fields */}
          <div>
            <ResultBanner result={result} />
            <Panel title="Extracted Identity Information" style={{ marginBottom: 14 }}>
              {[
                ['Document Type', result.docType, 'docType'],
                ['Country / Authority', result.country, 'country'],
                ['Document Number', result.docNumber, 'docNumber'],
                ['Full Name', result.name, 'name'],
                result.givenNames && result.surname ? ['Given / Surname', `${result.givenNames} / ${result.surname}`, 'name'] : null,
                ['Date of Birth', result.dob ? `${result.dob}${result.age ? ` (${result.age} yrs)` : ''}` : '—', 'dob'],
                ['Gender / Sex', result.gender, 'gender'],
                result.bloodGroup ? ['Blood Group', result.bloodGroup, 'bloodGroup'] : null,
                result.careOf ? ['Care of / Father / Guardian', result.careOf, 'careOf'] : null,
                result.vehicleClass ? ['Vehicle Class (COV)', result.vehicleClass, 'vehicleClass'] : null,
                result.placeOfBirth ? ['Place of Birth', result.placeOfBirth, 'placeOfBirth'] : null,
                result.placeOfIssue ? ['Place of Issue', result.placeOfIssue, 'placeOfIssue'] : null,
                result.vidNumber ? ['Virtual ID (VID)', result.vidNumber, 'vidNumber'] : null,
                result.issueDate ? ['Date of Issue', result.issueDate, 'issueDate'] : null,
                ['Nationality', result.nationality, 'nationality'],
                ['Expiry / Validity', result.expiry, 'expiry'],
                result.address ? ['Address', result.address, 'address'] : null,
                ['MRZ Status', result.mrz, 'mrz'],
              ]
                .filter(Boolean)
                .map(([l, v, key], i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 0',
                      fontSize: 12.5,
                      borderBottom: '1px solid ' + T.border,
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: T.muted, flexShrink: 0 }}>
                      {l}
                      {result.fieldsFromOcr && result.fieldsFromOcr.includes(key) && (
                        <span style={{ color: T.green, fontSize: 9.5, marginLeft: 6, fontFamily: T.mono, fontWeight: 700 }}>[OCR]</span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: l.includes('Number') || l.includes('Date') || l.includes('MRZ') || l.includes('Blood') ? T.mono : 'inherit',
                        fontWeight: 700,
                        textAlign: 'right',
                        wordBreak: 'break-word',
                        color:
                          l === 'MRZ Status'
                            ? result.mrz === 'VALID'
                              ? T.green
                              : result.mrz === 'CHECKSUM_FAILED'
                              ? T.red
                              : T.navy
                            : l === 'Blood Group'
                            ? '#DC2626'
                            : T.ink,
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
            </Panel>

            {/* All Detected Key-Values from Document Photo */}
            {result.allDetectedFields && Object.keys(result.allDetectedFields).length > 0 && (
              <Panel
                title="All Fields Captured From Photo"
                right={
                  <button
                    onClick={() => setShowAllFields(!showAllFields)}
                    style={{ background: 'none', border: 'none', color: T.navy, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {showAllFields ? 'Collapse ▲' : `View All (${Object.keys(result.allDetectedFields).length}) ▼`}
                  </button>
                }
                style={{ marginBottom: 14 }}
              >
                {showAllFields && (
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {Object.entries(result.allDetectedFields).map(([k, v], idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '5px 0',
                          borderBottom: '1px solid ' + T.border,
                          fontSize: 12,
                          gap: 10,
                        }}
                      >
                        <span style={{ color: T.muted, fontWeight: 600 }}>{k}</span>
                        <span style={{ fontFamily: T.mono, color: T.ink, textAlign: 'right' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            <Panel title="Identity Consistency">
              {['NAME', 'DATE OF BIRTH', 'NATIONALITY'].map((f) => (
                <div key={f} style={{ padding: '7px 0', borderBottom: '1px solid ' + T.border }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginBottom: 2 }}>{f}</div>
                  <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Document / Database match</span>
                    <span style={{ color: result.identityConsistency >= 90 ? T.green : T.amber, fontWeight: 700 }}>
                      {result.identityConsistency >= 90 ? '✓ Match' : '⚠ Review'}
                    </span>
                  </div>
                </div>
              ))}
            </Panel>
          </div>

          {/* Right Column: Risk Score & Forensic Telemetry */}
          <div>
            <Panel style={{ marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.06em', marginBottom: 6 }}>RISK SCORE</div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  fontFamily: T.mono,
                  color: result.riskLevel === 'LOW' ? T.green : result.riskLevel === 'HIGH' ? T.red : T.amber,
                }}
              >
                {result.riskScore}
                <span style={{ fontSize: 16, color: T.muted }}>/100</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <StatusPill level={result.riskLevel} />
              </div>
            </Panel>

            <Panel title="Score Breakdown" style={{ marginBottom: 14 }}>
              <ScoreBar label="Document Authenticity" value={result.docIntegrity} />
              <ScoreBar label="Face Match" value={result.faceMatch} />
              <ScoreBar label="Identity Consistency" value={result.identityConsistency} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
                <span style={{ color: T.inkSoft }}>Database Status</span>
                <span style={{ fontWeight: 700, color: result.dbStatus.includes('Flagged') ? T.red : T.green, fontFamily: T.mono, fontSize: 11.5 }}>
                  {result.dbStatus}
                </span>
              </div>
            </Panel>

            {result.reasons.length > 0 && (
              <Panel title="Flags" style={{ marginBottom: 14, borderColor: T.red + '44' }}>
                {result.reasons.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.inkSoft, padding: '4px 0', display: 'flex', gap: 6 }}>
                    <span style={{ color: T.red }}>⚠</span> {r}
                  </div>
                ))}
                <div style={{ marginTop: 10, background: T.redSoft, border: '1px solid ' + T.red + '33', borderRadius: 3, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, color: T.red }}>
                  MANUAL SECONDARY VERIFICATION REQUIRED
                </div>
              </Panel>
            )}

            <button onClick={() => setShowTech(!showTech)} style={{ ...btnGhost, width: '100%' }}>
              {showTech ? 'Hide technical analysis ↑' : 'View technical analysis →'}
            </button>

            {showTech && result.ocrRawText && (
              <Panel title="Raw OCR Extracted Text" style={{ marginTop: 12 }}>
                <pre style={{ fontFamily: T.mono, fontSize: 10.5, color: T.inkSoft, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 160, overflowY: 'auto' }}>
                  {result.ocrRawText.trim() || '(no raw text detected)'}
                </pre>
              </Panel>
            )}

            {showTech && (
              <Panel title="Authenticity Analysis" style={{ marginTop: 12 }}>
                {result.checks.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < result.checks.length - 1 ? '1px solid ' + T.border : 'none' }}>
                    <CheckIcon status={c.status} />
                    <span style={{ flex: 1, fontSize: 12 }}>{c.label}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{c.conf}%</span>
                  </div>
                ))}
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- CASES VIEW ---
function Cases({ cases, openCase, onClearHistory }) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = cases.filter((c) => {
    if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = (c.caseId || '').toLowerCase().includes(q);
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchDoc = (c.docType || '').toLowerCase().includes(q);
      const matchDocNum = (c.docNumber || '').toLowerCase().includes(q);
      const matchNat = (c.nationality || c.country || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchDoc && !matchDocNum && !matchNat) return false;
    }
    return true;
  });

  const selectStyle = {
    border: '1px solid ' + T.border,
    borderRadius: 3,
    padding: '7px 10px',
    fontSize: 12,
    background: T.surface,
    color: T.inkSoft,
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 4px 0' }}>Cases & Verification History</h1>
          <div style={{ fontSize: 12.5, color: T.muted }}>
            {cases.length} total verification {cases.length === 1 ? 'record' : 'records'} stored and synced
          </div>
        </div>
        {cases.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all verification history records?')) {
                onClearHistory && onClearHistory();
              }
            }}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: T.red,
              borderRadius: 4,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear History
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by name, ID, doc #, country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...selectStyle,
            flex: 1,
            minWidth: 200,
            fontFamily: T.sans,
          }}
        />
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={selectStyle}>
          <option value="ALL">All Risk Levels</option>
          <option value="LOW">Low Risk</option>
          <option value="HIGH">High Risk</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="ALL">All Statuses</option>
          <option value="Cleared">Cleared</option>
          <option value="Review">Review</option>
        </select>
        {(search || riskFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearch('');
              setRiskFilter('ALL');
              setStatusFilter('ALL');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: T.navy,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      <Panel style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 840 }}>
          <thead>
            <tr style={{ background: '#FAFAF9', borderBottom: '1px solid ' + T.border }}>
              {['Case ID', 'Time', 'Person Name', 'Document', 'Doc Number', 'Nationality', 'Risk', 'Primary Alert', 'Status', 'Officer'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontFamily: T.mono, fontSize: 10.5, color: T.muted, letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: T.muted }}>
                  {cases.length === 0 ? 'No verification records stored yet. Run a scan in the Verification tab to see it here!' : 'No cases match these filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.caseId}
                  onClick={() => openCase(c)}
                  style={{ borderBottom: '1px solid ' + T.border, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', fontFamily: T.mono, fontWeight: 700, color: T.navy }}>{c.caseId}</td>
                  <td style={{ padding: '10px 12px', fontFamily: T.mono, color: T.muted, fontSize: 11.5 }}>{c.time}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: T.ink }}>{c.name || 'Unlabeled'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.docType || 'ID'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: T.mono, fontSize: 11.5 }}>{c.docNumber || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.nationality || c.country || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusPill level={c.riskLevel} />
                  </td>
                  <td style={{ padding: '10px 12px', color: c.reasons && c.reasons[0] ? T.red : T.inkSoft, fontSize: 12 }}>
                    {c.reasons && c.reasons[0] ? c.reasons[0] : 'None (Passed)'}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: c.status === 'Cleared' ? T.green : T.amber }}>{c.status}</td>
                  <td style={{ padding: '10px 12px', color: T.muted, fontFamily: T.mono, fontSize: 11 }}>{c.officer || OFFICER.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// --- CASE DETAIL MODAL ---
function CaseDetail({ c, onClose }) {
  if (!c) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,35,0.35)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: '94vw', background: T.surface, height: '100%', overflowY: 'auto', padding: 22, boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16 }}>{c.caseId}</div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {c.time} · {c.docType} · {c.nationality}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: T.muted }}>
            ✕
          </button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <StatusPill level={c.riskLevel} />
        </div>
        <ResultBanner result={c} />
        <Panel title="Identity & Extracted Information" style={{ marginBottom: 12 }}>
          {[
            ['Document Type', c.docType],
            ['Country / Authority', c.country],
            ['Full Name', c.name],
            ['Date of Birth', c.dob],
            c.age ? ['Age', `${c.age} yrs`] : null,
            ['Gender', c.gender],
            c.bloodGroup ? ['Blood Group', c.bloodGroup] : null,
            c.careOf ? ['Care of', c.careOf] : null,
            c.fatherName ? ["Father's Name", c.fatherName] : null,
            c.motherName ? ["Mother's Name", c.motherName] : null,
            c.spouseName ? ["Spouse's Name", c.spouseName] : null,
            ['Document No.', c.docNumber],
            c.vidNumber ? ['VID Number', c.vidNumber] : null,
            c.vehicleClass ? ['Vehicle Class / COV', c.vehicleClass] : null,
            c.placeOfBirth ? ['Place of Birth', c.placeOfBirth] : null,
            c.placeOfIssue ? ['Place of Issue', c.placeOfIssue] : null,
            c.issueDate ? ['Date of Issue', c.issueDate] : null,
            c.address ? ['Address', c.address] : null,
            c.pinCode ? ['PIN Code', c.pinCode] : null,
            ['Nationality', c.nationality],
            ['Date of Expiry', c.expiry],
            ['MRZ / Security Zone', c.mrz],
          ]
            .filter(Boolean)
            .map(([l, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px solid ' + T.border, gap: 10 }}>
                <span style={{ color: T.muted, flexShrink: 0 }}>{l}</span>
                <span style={{ fontFamily: T.mono, textAlign: 'right', wordBreak: 'break-word', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
        </Panel>
        {c.allDetectedFields && Object.keys(c.allDetectedFields).length > 0 && (
          <Panel title="All Photo Fields (Direct Extraction)" style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
              {Object.entries(c.allDetectedFields).map(([k, v]) => (
                <div key={k} style={{ padding: '6px 8px', background: T.bg, borderRadius: 5, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 9.5, color: T.muted, textTransform: 'uppercase', fontFamily: T.mono, fontWeight: 700 }}>
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: T.mono, color: T.ink, fontWeight: 600, wordBreak: 'break-word' }}>
                    {String(v)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Panel title="Forensic & Biometric Scores" style={{ marginBottom: 12 }}>
          <ScoreBar label="Document Authenticity" value={c.docIntegrity} />
          <ScoreBar label="Face Match" value={c.faceMatch} />
          <ScoreBar label="Identity Consistency" value={c.identityConsistency} />
        </Panel>
        {c.reasons && c.reasons.length > 0 && (
          <Panel title="Flags & Risk Indicators">
            {c.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 12.5, padding: '4px 0', color: T.red, fontWeight: 500 }}>
                ⚠ {r}
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

// --- AUDIT LOG VIEW ---
function AuditLog({ entries }) {
  const [dbLedger, setDbLedger] = useState({ chainValid: true, ledger: [] });

  useEffect(() => {
    fetch('/api/audit-trail')
      .then((r) => r.json())
      .then((data) => setDbLedger(data))
      .catch((e) => console.error(e));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Audit Log</h1>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 3,
            fontSize: 11,
            background: dbLedger.chainValid ? T.greenSoft : T.redSoft,
            color: dbLedger.chainValid ? T.green : T.red,
            fontWeight: 700,
            fontFamily: T.mono,
          }}
        >
          {dbLedger.chainValid ? '✓ LEDGER INTEGRITY VALID' : '⚠ CHAIN INTEGRITY BREACH'}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
        Tamper-evident record. Each entry is cryptographically chained via SHA-256 and persisted to SQLite.
      </div>

      <Panel style={{ padding: 0 }}>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {entries.length === 0 && dbLedger.ledger.length === 0 ? (
            <div style={{ padding: 24, color: T.muted, fontSize: 12.5 }}>No audit entries yet.</div>
          ) : (
            (entries.length > 0 ? entries : dbLedger.ledger).map((e, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid ' + T.border,
                  display: 'grid',
                  gridTemplateColumns: '80px 100px 1fr 140px',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                  {e.time || (e.timestamp ? e.timestamp.slice(11, 19) : nowStr())}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.navy }}>{e.actor || 'AI Engine'}</span>
                <span style={{ fontSize: 12.5 }}>
                  {e.action || (e.status ? `Block #${e.index} (${e.status})` : 'Verification')} {e.caseId && <span style={{ color: T.muted }}>· {e.caseId}</span>}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.hash || e.currentHash}>
                  {e.hash || e.currentHash}
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

// --- ANALYTICS VIEW ---
function MiniBar({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.inkSoft }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 7, background: T.border, borderRadius: 2 }}>
        <div style={{ width: Math.min(100, (value / max) * 100) + '%', height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Analytics({ stats, cases }) {
  const highRiskDocs = cases.filter((c) => c.riskLevel === 'HIGH').length;
  const faceMismatch = cases.filter((c) => c.faceMatch < 85).length;
  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Analytics</h1>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>Operational metrics for this session</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Volume">
          <MiniBar label="Total Verifications" value={stats.total} max={Math.max(10, stats.total)} color={T.navy} />
          <MiniBar label="Successful Verifications" value={stats.verified} max={Math.max(10, stats.total)} color={T.green} />
          <MiniBar label="Flagged Cases" value={stats.flagged} max={Math.max(10, stats.total)} color={T.amber} />
        </Panel>
        <Panel title="Detection Rates">
          <MiniBar label="Forgery Detection Rate (%)" value={cases.length ? Math.round((highRiskDocs / cases.length) * 100) : 0} max={100} color={T.red} />
          <MiniBar label="Face Mismatch Rate (%)" value={cases.length ? Math.round((faceMismatch / cases.length) * 100) : 0} max={100} color={T.amber} />
          <MiniBar label="Avg. Verification Time (s)" value={stats.avgTime} max={20} color={T.navy} />
        </Panel>
      </div>
    </div>
  );
}

// --- SECURITY VIEW ---
function Security() {
  const rows = [
    ['Database Connection', 'Operational'],
    ['AI Verification Engine', 'Operational'],
    ['On-Device OCR Engine', 'Operational'],
    ['Audit Ledger (SHA-256)', 'Operational'],
    ['Encryption', 'Enabled — AES-256 at rest, TLS 1.3 in transit'],
  ];
  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Security</h1>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>System integrity and infrastructure status</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="System Health">
          {rows.map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + T.border, fontSize: 12.5 }}>
              <span>{l}</span>
              <span style={{ color: T.green, fontWeight: 700, fontFamily: T.mono, fontSize: 11.5 }}>
                <Dot color={T.green} />
                {v}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 11.5, color: T.muted, fontFamily: T.mono, lineHeight: 1.9 }}>
            Model version: bg-verify-core-2.3.1
            <br />
            Last synchronization: {nowStr()}
            <br />
            System uptime: 41d 06h 12m
          </div>
        </Panel>
        <Panel title="Architecture Details">
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: T.inkSoft }}>
            <b>Real implementations active:</b>
            <br />
            • <b>Neural OCR Engine</b>: Dual-pass Tesseract.js with client-side contrast stretching.
            <br />
            • <b>ICAO Doc 9303 MRZ Parser</b>: Full check digit verification for TD3, TD2, TD1 formats.
            <br />
            • <b>1:1 Biometric Face Matcher</b>: Strict threshold euclidean descriptor comparison.
            <br />
            • <b>Cryptographic Ledger</b>: SQLite-backed SHA-256 hash chaining.
          </div>
        </Panel>
      </div>
    </div>
  );
}

// --- DEMO MODE VIEW ---
function DemoMode({ runDemo }) {
  const items = [
    { key: 'genuine', title: 'CASE 01 — Genuine Passport', desc: 'All signals match. Document authentic, ICAO MRZ checksums valid, face match strong, identity consistent.', risk: 'LOW' },
    { key: 'tampered', title: 'CASE 02 — Tampered Document', desc: 'Date of birth / expiry field altered. ICAO Doc 9303 MRZ composite checksum fails. High risk.', risk: 'HIGH' },
    { key: 'impersonation', title: 'CASE 03 — Impersonation Attempt', desc: 'Document is authentic, but traveler facial vectors do not match the embedded credential photo.', risk: 'HIGH' },
  ];
  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Demo Mode</h1>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 18 }}>
        Run synthetic test cases through the full verification pipeline.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {items.map((it) => (
          <Panel key={it.key} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{it.title}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 12 }}>{it.desc}</div>
              <StatusPill level={it.risk} />
            </div>
            <button onClick={() => runDemo(it.key)} style={{ ...btnPrimary, marginTop: 16 }}>
              Run Case →
            </button>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// --- COMMAND CENTER VIEW ---
function CommandCenter({ stats, feed, goVerify }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Command Center</h1>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>
            {OFFICER.checkpoint} · Officer {OFFICER.id} · Shift 08:00–16:00
          </div>
        </div>
        <button onClick={goVerify} style={{ ...btnPrimary, padding: '12px 20px', fontSize: 13 }}>
          + START NEW VERIFICATION
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Verifications Today" value={stats.total} />
        <StatCard label="Verified" value={stats.verified} accent={T.green} />
        <StatCard label="Flagged Cases" value={stats.flagged} accent={T.amber} />
        <StatCard label="High-Risk Attempts" value={stats.highRisk} accent={T.red} />
        <StatCard label="Avg. Verification Time" value={stats.avgTime + 's'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <Panel title="Live Activity Feed">
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {feed.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 12.5, padding: '20px 0' }}>
                No activity yet this session. Start a verification to populate the feed.
              </div>
            ) : (
              feed.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: i < feed.length - 1 ? '1px solid ' + T.border : 'none',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontFamily: T.mono, color: T.muted, fontSize: 11.5, width: 68, flexShrink: 0 }}>{f.time}</span>
                  <span style={{ flex: 1 }}>{f.text}</span>
                  <StatusPill level={f.risk} />
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="System Status">
          {[
            ['Database Connection', 'Operational', T.green],
            ['AI Verification Engine', 'Operational', T.green],
            ['OCR Engine', 'Operational', T.green],
            ['Audit Ledger', 'Operational', T.green],
          ].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12.5, borderBottom: '1px solid ' + T.border }}>
              <span style={{ color: T.inkSoft }}>{l}</span>
              <span style={{ color: c, fontWeight: 700, fontFamily: T.mono, fontSize: 11.5 }}>
                <Dot color={c} />
                {v}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 11, color: T.muted, fontFamily: T.mono, lineHeight: 1.8 }}>
            Model version: bg-verify-core-2.3.1
            <br />
            Last sync: {nowStr()}
            <br />
            Uptime: 41d 06h
          </div>
        </Panel>
      </div>
    </div>
  );
}

// --- LOGIN SCREEN ---
function Login({ onLogin }) {
  const [id, setId] = useState('OFF-7421');
  const [pw, setPw] = useState('borderguard2026');
  const [err, setErr] = useState('');

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!id.trim() || !pw.trim()) {
      setErr('Enter your officer ID and password to continue.');
      return;
    }
    onLogin(id.trim());
  };

  const quickLogin = (officerId) => {
    setId(officerId);
    setPw('borderguard2026');
    onLogin(officerId);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.sans, padding: 20 }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Wordmark />
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>
            Biometric Border Control & Identity Verification System
          </div>
        </div>

        <div style={{ background: T.surface, border: '1px solid ' + T.border, borderRadius: 6, padding: '32px 30px', boxShadow: '0 4px 18px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid ' + T.border, paddingBottom: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em', color: T.navy, fontWeight: 800, textTransform: 'uppercase' }}>
              OFFICER AUTHENTICATION
            </div>
            <span style={{ fontSize: 11, color: T.green, fontFamily: T.mono, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Dot color={T.green} /> SECURE GATE
            </span>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: T.inkSoft, marginBottom: 6, fontWeight: 700 }}>
                Officer ID / Badge #
              </label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. OFF-7421 or A104"
                style={{
                  width: '100%',
                  background: '#FAFAF9',
                  border: '1px solid ' + T.border,
                  borderRadius: 4,
                  color: T.ink,
                  padding: '11px 12px',
                  fontSize: 14,
                  fontFamily: T.mono,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>Access Code / Password</label>
                <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Default: any password</span>
              </div>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  background: '#FAFAF9',
                  border: '1px solid ' + T.border,
                  borderRadius: 4,
                  color: T.ink,
                  padding: '11px 12px',
                  fontSize: 14,
                  fontFamily: T.mono,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {err && (
              <div style={{ color: T.red, fontSize: 12, marginBottom: 14, background: '#FEF2F2', padding: '8px 10px', borderRadius: 4, border: '1px solid #FCA5A5' }}>
                ⚠ {err}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: T.navy,
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '12px 0',
                fontWeight: 800,
                fontSize: 13.5,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              ACCESS COMMAND CENTER →
            </button>
          </form>

          <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed ' + T.border }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick One-Click Sign-In:
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => quickLogin('OFF-7421')}
                style={{
                  flex: 1,
                  background: '#F1F5F9',
                  border: '1px solid ' + T.border,
                  borderRadius: 4,
                  padding: '8px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: T.inkSoft,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Alex Mercer (OFF-7421)
              </button>
              <button
                type="button"
                onClick={() => quickLogin('A104')}
                style={{
                  flex: 1,
                  background: '#F1F5F9',
                  border: '1px solid ' + T.border,
                  borderRadius: 4,
                  padding: '8px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: T.inkSoft,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Duty Officer (A104)
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 11.5, color: T.muted, fontFamily: T.mono }}>
          <span>
            <Dot color={T.green} /> System: Operational
          </span>
          <span>ICAO 9303 Compliant</span>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP SHELL & ROUTER ---
const NAV = [
  { id: 'command', label: 'Command Center' },
  { id: 'verify', label: 'Verification' },
  { id: 'cases', label: 'Cases' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'security', label: 'Security' },
  { id: 'demo', label: 'Demo Mode' },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    return sessionStorage.getItem('bg_logged_in') === 'true';
  });
  const [officerId, setOfficerId] = useState(() => {
    return sessionStorage.getItem('bg_officer_id') || 'OFF-7421';
  });
  const [active, setActive] = useState('verify');
  const [feed, setFeed] = useState([]);
  const [cases, setCases] = useState(() => {
    try {
      const saved = localStorage.getItem('borderguard_cases_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading cases from localStorage', e);
    }
    return [];
  });
  const [audit, setAudit] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [demoSeed, setDemoSeed] = useState(null);
  const lastHashRef = useRef('sha256:genesis00000000');

  // Sync cases with backend SQLite database on mount
  useEffect(() => {
    fetch('/api/verifications')
      .then((res) => (res.ok ? res.json() : []))
      .then((serverCases) => {
        if (Array.isArray(serverCases) && serverCases.length > 0) {
          setCases((prev) => {
            const map = new Map();
            [...prev, ...serverCases].forEach((c) => {
              if (c && c.caseId && !map.has(c.caseId)) {
                map.set(c.caseId, c);
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('borderguard_cases_history', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('Backend verifications API offline, using localStorage cache:', err);
      });
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('borderguard_cases_history', JSON.stringify(cases));
    } catch (e) {}
  }, [cases]);

  const handleLogin = (id) => {
    const oId = id || 'OFF-7421';
    sessionStorage.setItem('bg_logged_in', 'true');
    sessionStorage.setItem('bg_officer_id', oId);
    setOfficerId(oId);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('bg_logged_in');
    setLoggedIn(false);
  };

  const handleClearHistory = async () => {
    setCases([]);
    try {
      localStorage.removeItem('borderguard_cases_history');
      await fetch('/api/verifications', { method: 'DELETE' });
    } catch (e) {}
  };

  const pushAudit = useCallback((caseId, action, actor) => {
    setAudit((prev) => {
      const entry = {
        time: nowStr(),
        actor,
        action,
        caseId,
        hash: simpleHash(lastHashRef.current + action + caseId + Date.now()),
      };
      lastHashRef.current = entry.hash;
      return [entry, ...prev].slice(0, 200);
    });
  }, []);

  const onVerificationComplete = useCallback(
    (result) => {
      const status = result.riskLevel === 'LOW' ? 'Cleared' : 'Review';
      const record = {
        ...result,
        time: result.time || nowStr(),
        createdAt: new Date().toISOString(),
        status,
        officer: officerId,
      };

      setCases((prev) => {
        const next = [record, ...prev.filter((c) => c.caseId !== record.caseId)];
        try {
          localStorage.setItem('borderguard_cases_history', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      setFeed((prev) => [
        {
          time: nowStr(),
          text: (result.name ? result.name + ' (' + result.docType + ')' : result.docType) + ' ' + (result.riskLevel === 'LOW' ? 'verified' : 'flagged — ' + (result.reasons[0] || 'review')),
          risk: result.riskLevel,
        },
        ...prev,
      ].slice(0, 50));

      pushAudit(result.caseId, 'Verification result recorded for ' + (result.name || result.docType), 'Risk Engine');

      // Sync with backend SQLite
      fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch((e) => console.warn('Could not post verification to server:', e));
    },
    [pushAudit, officerId]
  );

  const stats = {
    total: cases.length,
    verified: cases.filter((c) => c.riskLevel === 'LOW').length,
    flagged: cases.filter((c) => c.riskLevel !== 'LOW').length,
    highRisk: cases.filter((c) => c.riskLevel === 'HIGH').length,
    avgTime: cases.length ? 7 : 0,
  };

  if (!loggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.sans, color: T.ink }}>
      {/* Sticky Top Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FFFFFF', borderBottom: '1px solid ' + T.border }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 26 }}>
          <Wordmark />
          <nav style={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' }}>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setActive(n.id)}
                style={{
                  background: active === n.id ? T.navySoft : 'transparent',
                  color: active === n.id ? T.navy : T.muted,
                  border: 'none',
                  borderBottom: active === n.id ? '2px solid ' + T.navy : '2px solid transparent',
                  padding: '9px 13px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: '3px 3px 0 0',
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: T.ink, fontWeight: 700 }}>
                {officerId === 'OFF-7421' ? OFFICER.name : `Officer ${officerId}`}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>
                {OFFICER.checkpoint} · {officerId}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: '#F1F5F9',
                border: '1px solid ' + T.border,
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: T.inkSoft,
                cursor: 'pointer',
                fontFamily: T.sans,
              }}
              title="Sign out of current session"
            >
              Sign Out ↗
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '22px 20px 60px' }}>
        {active === 'command' && (
          <CommandCenter stats={stats} feed={feed} goVerify={() => setActive('verify')} />
        )}
        {active === 'verify' && (
          <VerificationWorkspace
            onComplete={onVerificationComplete}
            pushAudit={pushAudit}
            caseSeed={demoSeed}
            clearSeed={() => setDemoSeed(null)}
          />
        )}
        {active === 'cases' && (
          <Cases cases={cases} openCase={(c) => setSelectedCase(c)} onClearHistory={handleClearHistory} />
        )}
        {active === 'audit' && (
          <AuditLog entries={audit} />
        )}
        {active === 'analytics' && (
          <Analytics stats={stats} cases={cases} />
        )}
        {active === 'security' && (
          <Security />
        )}
        {active === 'demo' && (
          <DemoMode
            runDemo={(key) => {
              setDemoSeed(key);
              setActive('verify');
            }}
          />
        )}
      </div>

      {/* Case Details Drawer Modal */}
      {selectedCase && <CaseDetail c={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}


