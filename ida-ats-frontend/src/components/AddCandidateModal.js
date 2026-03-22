import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AddCandidateModal({ onClose, onAdded }) {
  const [vacancies, setVacancies] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', vacancy: '', status: 'new', notes: '',
  });

  useEffect(() => {
    axios.get('/api/vacancies/')
      .then(res => setVacancies(res.data));
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (!form.first_name.trim()) { setError("Ім'я обов'язкове"); return; }
    if (!form.last_name.trim()) { setError('Прізвище обов\'язкове'); return; }
    if (!form.email.trim()) { setError('Email обов\'язковий'); return; }
    if (!form.vacancy) { setError('Оберіть вакансію'); return; }

    axios.post('/api/candidates/', form)
      .then(() => { onAdded(); onClose(); })
      .catch(err => console.error(err));
  };
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const modal = {
    background: 'var(--surface)', borderRadius: '16px',
    width: '480px', boxShadow: 'var(--shadow-lg)',
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
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Новий кандидат</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={label}>Ім'я</label>
              <input style={input} name="first_name" placeholder="Олена" onChange={handleChange} />
            </div>
            <div>
              <label style={label}>Прізвище</label>
              <input style={input} name="last_name" placeholder="Семенова" onChange={handleChange} />
            </div>
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={input} name="email" placeholder="email@gmail.com" onChange={handleChange} />
          </div>
          <div>
            <label style={label}>Телефон</label>
            <input style={input} name="phone" placeholder="+380 XX XXX XX XX" onChange={handleChange} />
          </div>
          <div>
            <label style={label}>Вакансія</label>
            <select style={input} name="vacancy" onChange={handleChange}>
              <option value="">— Обери вакансію —</option>
              {vacancies.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Нотатки</label>
            <textarea style={{ ...input, minHeight: '70px', resize: 'vertical' }} name="notes" placeholder="Коментар..." onChange={handleChange} />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}>
            Скасувати
          </button>
          {error && (
            <div style={{ color: '#dc2626', fontSize: '0.78rem', fontFamily: 'DM Mono', marginBottom: '8px' }}>
              ⚠ {error}
            </div>
          )}
          <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Зберегти
          </button>
        </div>

      </div>
    </div>
  );
}

export default AddCandidateModal;