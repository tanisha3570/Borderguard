import React, { useEffect, useState } from 'react';

export default function AuditLedger({ refreshKey }) {
  const [ledgerData, setLedgerData] = useState({ chainValid: true, ledger: [] });
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    try {
      const response = await fetch('/api/audit-trail');
      const data = await response.json();
      setLedgerData(data);
    } catch (error) {
      console.error('Failed to fetch audit ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refreshKey !== undefined) fetchLedger();
  }, [refreshKey]);

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
          <span>⛓️</span> Cryptographic Audit Ledger (SHA-256)
        </h3>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '0.75rem',
            background: ledgerData.chainValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: ledgerData.chainValid ? '#34D399' : '#FB7185',
            border: ledgerData.chainValid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
            fontWeight: '700',
            letterSpacing: '0.5px',
          }}
        >
          {ledgerData.chainValid ? '✓ LEDGER INTEGRITY VALID' : '⚠️ CHAIN INTEGRITY BREACH'}
        </span>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0 0 16px 0' }}>
        Immutable SQLite-persisted verification record. Each entry is cryptographically chained to prevent historical alteration.
      </p>

      {loading ? (
        <div style={{ color: '#64748B', fontSize: '0.85rem', padding: '16px 0' }}>Loading ledger chain...</div>
      ) : (
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            fontSize: '0.8rem',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            background: '#0B0F19',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #1E293B',
          }}
        >
          {ledgerData.ledger.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: '#64748B', padding: '16px', textAlign: 'center' }}>
              No document verification blocks committed to ledger yet.
            </div>
          ) : (
            ledgerData.ledger.map((block) => (
              <div
                key={block.index}
                style={{
                  borderBottom: '1px solid #1E293B',
                  marginBottom: '10px',
                  paddingBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#38BDF8', fontWeight: '700' }}>
                    BLOCK #{block.index}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: block.status === 'VERIFIED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                      color: block.status === 'VERIFIED' ? '#34D399' : '#FB7185',
                    }}
                  >
                    {block.status}
                  </span>
                </div>

                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                  Timestamp: {block.timestamp}
                </div>

                {block.caseName && (
                  <div style={{ color: '#CBD5E1' }}>
                    Case: <strong>{block.caseName}</strong>{' '}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: block.caseLabel === 'genuine' ? '#34D399' : '#FB7185',
                        fontWeight: '600',
                      }}
                    >
                      ({block.caseLabel?.toUpperCase()})
                    </span>
                  </div>
                )}

                <div style={{ color: '#94A3B8' }}>
                  Biometric Match: {block.data?.biometricMatchScore !== null && block.data?.biometricMatchScore !== undefined ? `${block.data.biometricMatchScore}%` : 'N/A'} · MRZ Parsed: {String(block.data?.mrzDetected)}
                </div>

                <div style={{ color: '#475569', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                  HASH: {block.currentHash}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

