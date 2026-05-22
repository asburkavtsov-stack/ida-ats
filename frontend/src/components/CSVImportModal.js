import React, { useState } from 'react';
import api from 'axiosConfig';

function CSVImportModal({ onClose, onAdded }) {
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const parseCSVLine = (line) => {
    const result = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(currentValue.trim().replace(/^"|"$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    result.push(currentValue.trim().replace(/^"|"$/g, ''));
    
    return result;
  };

  const detectColumns = (headers) => {
    const patterns = {
      first_name: [/^first[_ ]?name$/, /^ім['']?я$/i, /^имя$/i, /^name$/i, /^first$/i],
      last_name: [/^last[_ ]?name$/, /^прізвище$/i, /^фамилия$/i, /^surname$/i, /^last$/i],
      email: [/^email$/, /^e-?mail$/, /^пошта$/i, /^електронна\s*пошта$/i],
      phone: [/^phone$/, /^mobile$/, /^tel$/i, /^телефон$/i, /^мобільний$/i, /^phone\s*number$/i],
      vacancy: [/^vacancy$/, /^position$/i, /^вакансія$/i, /^посада$/i, /^role$/i],
      status: [/^status$/, /^статус$/i],
      source: [/^source$/, /^джерело$/i],
      notes: [/^notes$/, /^comment$/i, /^нотатки$/i, /^коментар$/i, /^remarks$/i],
    };
    
    const mapping = {
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      vacancy: null,
      status: null,
      source: null,
      notes: null,
    };
    
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      
      for (const [field, regexes] of Object.entries(patterns)) {
        if (regexes.some(regex => regex.test(lowerHeader))) {
          if (mapping[field] === null) {
            mapping[field] = header;
          }
        }
      }
    }
    
    if (!mapping.first_name) {
      const nameCol = headers.find(h => /^name$/i.test(h));
      if (nameCol) mapping.first_name = nameCol;
    }
    
    return mapping;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Будь ласка, оберіть файл у форматі CSV');
      return;
    }
    
    setImportFile(file);
    previewCSV(file);
  };

  const previewCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) {
        setError('Файл порожній');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      
      const previewRows = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        if (lines[i].trim()) {
          const values = parseCSVLine(lines[i]);
          const row = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          previewRows.push(row);
        }
      }
      
      const columnMapping = detectColumns(headers);
      
      setCsvPreview({
        headers,
        rows: previewRows,
        totalRows: lines.length - 1,
        mapping: columnMapping,
      });
      setError('');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!importFile) {
      setError('Оберіть CSV файл');
      return;
    }
    
    if (!csvPreview?.mapping.first_name || !csvPreview?.mapping.last_name || !csvPreview?.mapping.email) {
      setError(`CSV має містити колонки: first_name, last_name, email. Знайдені: ${csvPreview?.headers?.join(', ') || '—'}`);
      return;
    }
    
    setImporting(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', importFile);
    
    try {
      const response = await api.post('/api/candidates/import_csv/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setImportResult(response.data);
      
      if (response.data.created > 0) {
        onAdded();
      }
    } catch (err) {
      console.error('Помилка імпорту CSV:', err);
      setError(err.response?.data?.error || 'Помилка при імпорті CSV файлу');
    } finally {
      setImporting(false);
    }
  };

  const closeModal = () => {
    setImportFile(null);
    setCsvPreview(null);
    setImportResult(null);
    setError('');
    onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '11px 14px' : '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: isMobile ? '0.9rem' : '0.85rem',
    fontFamily: 'DM Sans',
    background: 'var(--bg)',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'DM Mono',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={closeModal}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: isMobile ? '85vh' : '80vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            📂 Імпорт кандидатів з CSV
          </div>
          <button
            onClick={closeModal}
            aria-label="Закрити"
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {!importResult ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Файл CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ ...inputStyle, padding: '8px' }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '8px', fontFamily: 'DM Mono' }}>
                  Формат: CSV з роздільником кома
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                  Підтримуються колонки: first_name, last_name, email, phone, vacancy, status, source, notes
                </div>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '16px', padding: '8px 12px', background: '#fee2e2', borderRadius: '8px', fontFamily: 'DM Mono' }}>
                  ⚠ {error}
                </div>
              )}

              {csvPreview && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem' }}>
                    🧠 Авторозпізнані колонки:
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '8px',
                    background: 'var(--bg)',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.75rem',
                  }}>
                    <div><span style={{ color: '#16a34a' }}>✓</span> Ім'я: <strong>{csvPreview.mapping.first_name || '—'}</strong></div>
                    <div><span style={{ color: '#16a34a' }}>✓</span> Прізвище: <strong>{csvPreview.mapping.last_name || '—'}</strong></div>
                    <div><span style={{ color: '#16a34a' }}>✓</span> Email: <strong>{csvPreview.mapping.email || '—'}</strong></div>
                    <div><span>📞</span> Телефон: <strong>{csvPreview.mapping.phone || '—'}</strong></div>
                    <div><span>💼</span> Вакансія: <strong>{csvPreview.mapping.vacancy || '—'}</strong></div>
                    <div><span>📌</span> Статус: <strong>{csvPreview.mapping.status || '—'}</strong></div>
                    <div><span>📎</span> Джерело: <strong>{csvPreview.mapping.source || '—'}</strong></div>
                    <div><span>📝</span> Нотатки: <strong>{csvPreview.mapping.notes || '—'}</strong></div>
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.85rem' }}>
                    👁 Прев'ю (перші {csvPreview.rows.length} рядків):
                  </div>
                  <div style={{
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    overflowX: 'auto',
                    fontSize: '0.75rem',
                    marginBottom: '16px',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {csvPreview.headers.slice(0, 5).map((h, idx) => (
                            <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            {csvPreview.headers.slice(0, 5).map((h, colIdx) => (
                              <td key={colIdx} style={{ padding: '8px 12px', color: 'var(--text)' }}>
                                {row[h]?.substring(0, 30)}{row[h]?.length > 30 ? '…' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '16px' }}>
                    📊 Всього рядків у файлі: {csvPreview.totalRows}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={closeModal}
                      style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      style={{ 
                        padding: isMobile ? '10px 18px' : '8px 18px', 
                        borderRadius: '8px', 
                        border: 'none', 
                        background: 'var(--accent)', 
                        color: '#fff', 
                        fontWeight: 600, 
                        cursor: importing ? 'not-allowed' : 'pointer',
                        opacity: importing ? 0.6 : 1,
                      }}
                    >
                      {importing ? '⏳ Імпорт...' : '📤 Імпортувати'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                background: importResult.created > 0 ? '#dcfce7' : (importResult.errors_count > 0 ? '#fee2e2' : '#fef3c7'),
              }}>
                <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '1rem' }}>
                  {importResult.created > 0 ? '✅ Імпорт завершено!' : '⚠️ Імпорт завершено з помилками'}
                </div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <div>✅ Створено: <strong>{importResult.created}</strong></div>
                  <div>⚠️ Дублікатів: <strong>{importResult.duplicates_found || 0}</strong></div>
                  <div>❌ Помилок: <strong>{importResult.errors_count || 0}</strong></div>
                </div>
              </div>

              {importResult.duplicates && importResult.duplicates.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.85rem', color: '#f59e0b' }}>
                    🚫 Пропущені дублікати (рядки {importResult.duplicates.map(d => d.row).join(', ')}):
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {importResult.duplicates.slice(0, 5).map((dup, idx) => (
                      <div key={idx} style={{ 
                        padding: '8px', 
                        background: 'var(--bg)', 
                        borderRadius: '6px', 
                        marginBottom: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid var(--border)',
                      }}>
                        {dup.import_data?.first_name} {dup.import_data?.last_name} — {dup.import_data?.email}
                        <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(збіг за {dup.matched_by})</span>
                      </div>
                    ))}
                    {importResult.duplicates.length > 5 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '4px' }}>
                        ... та ще {importResult.duplicates.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                    ❌ Помилки імпорту:
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {importResult.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} style={{ 
                        padding: '6px 10px', 
                        background: '#fee2e2', 
                        borderRadius: '6px', 
                        marginBottom: '4px',
                        fontSize: '0.72rem',
                        color: '#dc2626',
                      }}>
                        Рядок {err.row}: {err.error}
                      </div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '4px' }}>
                        ... та ще {importResult.errors.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={closeModal}
                  style={{ 
                    padding: isMobile ? '10px 20px' : '8px 20px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: 'var(--accent)', 
                    color: '#fff', 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Готово
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CSVImportModal;
