import React, { useEffect, useState } from 'react';

// NEW COMPONENT — this is what was completely missing from the original
// project. It lets you build a small demo database of made-up ID photos,
// each tagged "genuine" or "fake", stored for real in the backend's SQLite
// database + uploads folder. You can then load any of them straight into
// the Scanner to show the pipeline handling a known-good vs. known-bad case.
// ADDED: `extractedMrz` — the structured MRZ data parsed by Scanner.jsx/mrzParser.js
// (name, document number, DOB, expiration, nationality, check digits, etc.).
// When present, it drives the "Extracted from MRZ" panel below and auto-fills
// the name field, so the true, machine-extracted name is what gets used
// instead of the operator having to retype it by hand.
export default function SampleCaseManager({ onLoadCase, activeCaseId, extractedMrz }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', label: 'genuine', notes: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Tracks whether the operator has manually overridden the name field for
  // the *current* document, so auto-fill never clobbers a deliberate edit.
  const [nameTouched, setNameTouched] = useState(false);

  // Auto-fill the name from the MRZ once it's extracted. Resets whenever the
  // MRZ data goes back to null (i.e. a new document was loaded/scanned), so
  // the next document gets its own fresh auto-fill instead of being blocked
  // by an edit made for a previous document.
  useEffect(() => {
    if (!extractedMrz) {
      setNameTouched(false);
      return;
    }
    if (!nameTouched && extractedMrz.fullName) {
      setForm((f) => ({ ...f, name: extractedMrz.fullName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedMrz]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      setCases(data);
    } catch (err) {
      console.error('Failed to load sample cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.file) {
      setError('Choose an image file first.');
      return;
    }
    if (!form.name.trim()) {
      setError('Give this sample a name (e.g. "Rahul Sharma - genuine").');
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('image', form.file);
      body.append('name', form.name.trim());
      body.append('label', form.label);
      body.append('notes', form.notes.trim());

      const res = await fetch('/api/cases', { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      setForm({ name: '', label: 'genuine', notes: '', file: null });
      e.target.reset();
      await fetchCases();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/cases/${id}`, { method: 'DELETE' });
    fetchCases();
  };

  return (
    <div
      style={{
        padding: 20,
        background: 'var(--bg-panel, #131B2E)',
        borderRadius: 10,
        border: '1px solid var(--border-color, #273553)',
        color: '#f8fafc',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Sample Case Database</h3>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>SQLITE PERSISTENCE</span>
      </div>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px 0' }}>
        Manage reference identity records and genuine/fake samples. Load any record into the terminal below to test verification and OCR extraction.
      </p>

      {extractedMrz && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#38bdf8' }}>
              Extracted from OCR / MRZ Analysis
            </h4>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: extractedMrz.allChecksValid ? '#34d399' : '#f87171',
              }}
            >
              {extractedMrz.format} · CHECKSUMS {extractedMrz.allChecksValid ? 'PASS' : 'FLAG'}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 6,
              color: '#cbd5e1',
            }}
          >
            <div><strong style={{ color: '#94a3b8' }}>Name:</strong> {extractedMrz.fullName || '—'}</div>
            <div><strong style={{ color: '#94a3b8' }}>Doc #:</strong> {extractedMrz.documentNumber} {extractedMrz.documentNumberValid !== undefined ? (extractedMrz.documentNumberValid ? '✓' : '✗') : ''}</div>
            <div><strong style={{ color: '#94a3b8' }}>Nationality:</strong> {extractedMrz.nationality}</div>
            <div><strong style={{ color: '#94a3b8' }}>DOB:</strong> {extractedMrz.dateOfBirth?.iso || extractedMrz.dateOfBirth?.raw} {extractedMrz.dateOfBirthValid !== undefined ? (extractedMrz.dateOfBirthValid ? '✓' : '✗') : ''}</div>
            <div><strong style={{ color: '#94a3b8' }}>Expires:</strong> {extractedMrz.expirationDate?.iso || extractedMrz.expirationDate?.raw} {extractedMrz.expirationValid !== undefined ? (extractedMrz.expirationValid ? '✓' : '✗') : ''}</div>
            <div><strong style={{ color: '#94a3b8' }}>Sex:</strong> {extractedMrz.sex}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginBottom: 4 }}>Document Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setForm((f) => ({ ...f, file: e.target.files[0] || null }))}
            style={{ fontSize: 12, color: '#cbd5e1' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginBottom: 4 }}>Name / Identity</label>
          <input
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={form.name}
            onChange={(e) => {
              setNameTouched(true);
              setForm((f) => ({ ...f, name: e.target.value }));
            }}
            style={{
              padding: '8px 10px',
              background: '#0B0F19',
              border: '1px solid #273553',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginBottom: 4 }}>Classification</label>
          <select
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            style={{
              padding: '8px 10px',
              background: '#0B0F19',
              border: '1px solid #273553',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
            }}
          >
            <option value="genuine">Genuine ID</option>
            <option value="fake">Fake / Tampered ID</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginBottom: 4 }}>Notes (optional)</label>
          <input
            type="text"
            placeholder="e.g. altered DOB field"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            style={{
              padding: '8px 10px',
              background: '#0B0F19',
              border: '1px solid #273553',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              width: '100%',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '9px 18px',
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Saving...' : '💾 Save Sample'}
        </button>
      </form>
      {error && <p style={{ color: '#f87171', fontSize: 12.5, margin: '0 0 10px 0' }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading sample cases...</p>
      ) : cases.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#64748b', fontSize: 13 }}>
          No sample cases in database yet — save a test record or use the quick presets in the scanner.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {cases.map((c) => (
            <div
              key={c.id}
              style={{
                width: 170,
                border: c.id === activeCaseId ? '2px solid #38bdf8' : '1px solid #273553',
                borderRadius: 8,
                padding: 10,
                background: '#1A243D',
                boxShadow: c.id === activeCaseId ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
              }}
            >
              <img
                src={c.imageUrl}
                alt={c.name}
                style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, background: '#0b0f19' }}
              />
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.name}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 3,
                  marginTop: 3,
                  fontFamily: 'monospace',
                  color: c.label === 'genuine' ? '#34d399' : '#f87171',
                  background: c.label === 'genuine' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                }}
              >
                {c.label === 'genuine' ? 'GENUINE' : 'FAKE'}
              </div>
              {c.notes && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.notes}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => onLoadCase(c)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 8px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Load
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{
                    fontSize: 11,
                    padding: '5px 8px',
                    background: '#334155',
                    color: '#f87171',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
