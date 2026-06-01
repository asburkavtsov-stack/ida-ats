import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

const PricingManager = ({ isMobile }) => {
  const [pricingConfigs, setPricingConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form, setForm] = useState({
    plan: 'starter',
    name: '',
    price_monthly: 0,
    price_yearly: 0,
    discount_percent: 0,
    discount_valid_until: '',
    max_hr: 3,
    max_vacancies: 10,
    has_analytics: false,
    has_email_templates: false,
    has_google_integration: false,
    has_custom_stages: false,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/pricing-config/');
      setPricingConfigs(res.data.results || res.data);
    } catch (err) {
      console.error('Помилка завантаження цін:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingConfig) {
        await axios.patch(`/api/pricing-config/${editingConfig.id}/`, form);
      } else {
        await axios.post('/api/pricing-config/', form);
      }
      setShowModal(false);
      setEditingConfig(null);
      await fetchPricing();
    } catch (err) {
      console.error('Помилка збереження:', err);
      alert('Не вдалося зберегти конфігурацію');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити конфігурацію цін?')) return;
    try {
      await axios.delete(`/api/pricing-config/${id}/`);
      await fetchPricing();
    } catch (err) {
      console.error('Помилка видалення:', err);
      alert('Не вдалося видалити');
    }
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '0' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>💰 Керування цінами та знижками</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
            Налаштування тарифних планів, знижок та лімітів
          </div>
        </div>
        <button onClick={() => { setEditingConfig(null); setShowModal(true); }} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          + Додати тариф
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {pricingConfigs.map(config => (
            <div key={config.id} style={{ background: 'var(--surface)', border: `1px solid ${config.is_active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '16px', padding: '20px', position: 'relative' }}>
              {config.discount_percent > 0 && (
                <div style={{ position: 'absolute', top: '-10px', right: '16px', background: '#facc15', color: '#7f1d1d', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>
                  -{config.discount_percent}%
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{config.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>{config.plan_display}</div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{config.current_price} ₴<span style={{ fontSize: '12px' }}>/міс</span></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button onClick={() => { setEditingConfig(config); setShowModal(true); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>✏️ Редагувати</button>
                <button onClick={() => handleDelete(config.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>🗑 Видалити</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>{editingConfig ? 'Редагувати тариф' : 'Новий тариф'}</div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <input placeholder="Назва" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'DM Sans', outline: 'none' }} />
              <input type="number" placeholder="Ціна за місяць" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: parseFloat(e.target.value) || 0 }))} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'DM Sans', outline: 'none' }} />
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

export default PricingManager;