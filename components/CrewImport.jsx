'use client';

import { useState } from 'react';
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react';
import { parseCrewCsv, buildCrewCsvTemplate, CREW_CSV_COLUMNS } from '../lib/crew';

export function CrewImport({ looks, onClose, onImport }) {
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(file);
  }

  function preview() {
    setError('');
    setReport(parseCrewCsv(csv, looks));
  }

  function runImport() {
    const result = parseCrewCsv(csv, looks);
    if (result.records.length === 0) {
      setError('No valid crew rows to import.');
      setReport(result);
      return;
    }
    onImport(result.records);
  }

  function loadTemplate() {
    setCsv(buildCrewCsvTemplate());
    setReport(null);
    setError('');
  }

  return (
    <div className="admin-overlay no-print" onClick={onClose}>
      <div className="admin-panel" style={{ position: 'relative', maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-admin" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <h2>Import Crew (CSV)</h2>
        <p style={{ color: 'var(--muted)', marginTop: -8, fontSize: 13 }}>
          Columns: <code>{CREW_CSV_COLUMNS.join(', ')}</code>. Use look names separated by <code>|</code> in assignedLooks.
        </p>
        <div className="control-group" style={{ marginBottom: 12 }}>
          <label>Paste CSV or load a file</label>
          <textarea
            className="text-area"
            style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 12 }}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={CREW_CSV_COLUMNS.join(',')}
          />
        </div>
        <div className="admin-actions">
          <button type="button" className="btn ghost" onClick={loadTemplate}>Load template</button>
          <label className="btn ghost" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Load .csv
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={loadFile} />
          </label>
          <button type="button" className="btn" onClick={preview}><FileText size={14} /> Validate</button>
          <button type="button" className="btn primary" onClick={runImport} disabled={!csv.trim()}>Import crew</button>
        </div>
        {error && <p style={{ color: 'var(--danger)', fontWeight: 700 }}>{error}</p>}
        {report && (
          <div style={{ marginTop: 14 }}>
            <div className="import-summary">
              <span><CheckCircle2 size={14} /> {report.records.length} valid</span>
              <span className={report.errors.length ? 'bad' : ''}>{report.errors.length} invalid</span>
            </div>
            {report.errors.map((row) => (
              <div key={row.row} className="import-error-row"><strong>Row {row.row}:</strong> {row.message}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
