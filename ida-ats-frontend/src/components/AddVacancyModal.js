import React, { useState } from 'react';
import axios from 'axios';

function AddVacancyModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    title: '', department: '', is_active: true,
  });

  const handleChange = e => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = () => {
    if (!form.title) return;
    axios.post('http://127.0.0.1:8000/api/vacancies/', form)
      .then(() => { onAdded(); onClose(); })
      .catch(err => console.error(err));
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const modal = {
    background: 'var(--surface)', borderRadius: '16px',
    width: '440px', boxShadow: 'var(--shadow-lg)',
  };
  const input = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'DM Sans',
    background: 'var(--bg)', outline: 'none',
  };
  const label = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    fontFamily: 'DM Mono', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '6px',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Нова вакансія</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={label}>Назва вакансії</label>
            <input style={input} name="title" placeholder="Python Developer" onChange={handleChange} />
          </div>
          <div>
            <label style={label}>Відділ</label>
            <input style={input} name="department" placeholder="Engineering · Remote" onChange={handleChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} id="is_active" style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor="is_active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Активна вакансія</label>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}>
            Скасувати
          </button>
          <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Створити
          </button>
        </div>

      </div>
    </div>
  );
}

export default AddVacancyModal;