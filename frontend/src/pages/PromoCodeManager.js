import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

const PromoCodeManager = ({ isMobile }) => {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 100,
    is_active: true,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/promo-codes/');
      setPromoCodes(res.data.results || res.data);
    } catch (err) {
      console.error('Помилка завантаження промо-кодів:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingCode) {
        await axios.patch(`/api/promo-codes/${editingCode.id}/`, form);
      } else {
        await axios.post('/api/promo-codes/', form);
      }
      setShowModal(false);
      setEditingCode(null);
      await fetchPromoCodes();
    } catch (err) {
      console.error('Помилка збереження:', err);
      alert('Не вдалося зберегти промо-код');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити промо-код?')) return;
    try {
      await axios.delete(`/api/promo-codes/${id}/`);
      await fetchPromoCodes();
    } catch (err) {
      console.error('Помилка видалення:', err);
      alert('Не вдалося видалити');
    }
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '0' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🎫 Промо-коди</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>Створення та керування промо-кодами для знижок</div>
        </div>
        <button onClick={() => { setEditingCode(null); setForm({ code: generateRandomCode(), discount_type: 'percent', discount_value: 10, max_uses: 100, is_active: true, description: '' }); setShowModal(true); }} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>+ Створити промо-код</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {promoCodes.map(code => (
            <div key={code.id} style={{ background: 'var(--surface)', border: `1px solid ${code.is_active ? '#16a34a40' : 'var(--border)'}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '1.1rem', fontWeight: 700 }}>{code.code}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{code.discount_type === 'percent' ? `${code.discount_value}% знижка` : `${code.discount_value} грн знижка`}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {code.is_active ? <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', background: '#16a34a20', color: '#16a34a' }}>✓ Активний</span> : <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', background: '#fee2e2', color: '#dc2626' }}>✗ Неактивний</span>}
                  <button onClick={() => { setEditingCode(code); setForm({ code: code.code, discount_type: code.discount_type, discount_value: code.discount_value, max_uses: code.max_uses, is_active: code.is_active, description: code.description || '' }); setShowModal(true); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => handleDelete(code.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>{editingCode ? 'Редагувати промо-код' : 'Новий промо-код'}</div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="PROMO2026" style={{ padding: '9px 12px', borderRadius: '8px', fontFamily: 'DM Mono' }} />
              <input type="number" placeholder="Значення знижки" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: parseInt(e.target.value) || 0 }))} style={{ padding: '9px 12px', borderRadius: '8px' }} />
              <input type="number" placeholder="Макс. використань" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: parseInt(e.target.value) || 1 }))} style={{ padding: '9px 12px', borderRadius: '8px' }} />
              <textarea placeholder="Опис" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ padding: '9px 12px', borderRadius: '8px', resize: 'vertical' }} />
              <label><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Активний</label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>Скасувати</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Збереження...' : 'Зберегти'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoCodeManager;