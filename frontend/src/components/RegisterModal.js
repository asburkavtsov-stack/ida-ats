// src/components/RegisterModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #e4e4e7',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  background: '#fafafa',
  color: '#18181b',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const INPUT_ERROR_STYLE = {
  ...INPUT_STYLE,
  border: '1px solid #dc2626',
  background: '#fff5f5',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#3f3f46',
  marginBottom: '6px',
};

const ERROR_MSG_STYLE = {
  fontSize: '12px',
  color: '#dc2626',
  marginTop: '4px',
};

export default function RegisterModal({ onClose, onSuccess, primaryColor = '#7a1a2e' }) {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    organization_name: '',
    plan: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Завантажити пакети
  useEffect(() => {
    axios.get('/api/public/pricing/')
      .then(res => {
        const data = res.data;
        // pricing — об'єкт {free: {...}, growth: {...}, enterprise: {...}}
        const list = Object.entries(data).map(([key, val]) => ({
          key,
          label: val.name || key,
          price: val.monthly,
        }));
        setPlans(list);
        if (list.length > 0) setForm(f => ({ ...f, plan: list[0].key }));
      })
      .catch(() => setPlansError(true))
      .finally(() => setPlansLoading(false));
  }, []);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: '' }));
    setServerError('');
  };

  // Клієнтська валідація
  const validate = () => {
    const e = {};
    if (!form.username.trim()) {
      e.username = "Нік обов'язковий";
    } else if (form.username.length < 3 || form.username.length > 30) {
      e.username = 'Нік: від 3 до 30 символів';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) {
      e.username = 'Тільки латинські літери, цифри, _ та -';
    }

    if (!form.email.trim()) {
      e.email = "Email обов'язковий";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Невірний формат email';
    }

    if (!form.password) {
      e.password = "Пароль обов'язковий";
    } else if (form.password.length < 8) {
      e.password = 'Мінімум 8 символів';
    }

    if (form.password !== form.confirm_password) {
      e.confirm_password = 'Паролі не збігаються';
    }

    if (!form.organization_name.trim()) {
      e.organization_name = "Назва організації обов'язкова";
    } else if (form.organization_name.length < 2) {
      e.organization_name = 'Мінімум 2 символи';
    }

    if (!form.plan) {
      e.plan = "Оберіть пакет";
    }

    return e;
  };

  const handleSubmit = async () => {
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const res = await axios.post('/api/register/', form);
      const { access, refresh } = res.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      onSuccess?.();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        // Серверні помилки полів
        const fieldErrors = {};
        let general = '';
        for (const [key, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val[0] : val;
          if (['username', 'email', 'password', 'confirm_password', 'organization_name', 'plan'].includes(key)) {
            fieldErrors[key] = msg;
          } else {
            general += msg + ' ';
          }
        }
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        if (general) setServerError(general.trim());
      } else {
        setServerError('Помилка реєстрації. Спробуйте ще раз.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ name, label, type = 'text', placeholder }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        style={errors[name] ? INPUT_ERROR_STYLE : INPUT_STYLE}
        onFocus={e => { e.target.style.borderColor = errors[name] ? '#dc2626' : primaryColor; }}
        onBlur={e => { e.target.style.borderColor = errors[name] ? '#dc2626' : '#e4e4e7'; }}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
      />
      {errors[name] && <div style={ERROR_MSG_STYLE}>{errors[name]}</div>}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '20px', padding: '36px',
        width: '100%', maxWidth: '480px', maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '32px', height: '32px', background: primaryColor,
                color: 'white', fontWeight: 'bold', fontSize: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '10px',
              }}>I</div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#18181b' }}>IDA ATS</span>
            </div>
            <p style={{ fontSize: '14px', color: '#71717a', margin: 0 }}>Реєстрація організації</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#a1a1aa', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Секція: акаунт */}
        <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', color: primaryColor, marginBottom: '14px', textTransform: 'uppercase' }}>
          Акаунт адміністратора
        </div>

        <Field name="username" label="Нік (Username)" placeholder="my_company_admin" />
        <Field name="email" label="Email" type="email" placeholder="admin@company.com" />
        <Field name="password" label="Пароль" type="password" placeholder="Мінімум 8 символів" />
        <Field name="confirm_password" label="Підтвердити пароль" type="password" placeholder="Повторіть пароль" />

        {/* Секція: організація */}
        <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', color: primaryColor, margin: '24px 0 14px', textTransform: 'uppercase' }}>
          Організація
        </div>

        <Field name="organization_name" label="Назва організації" placeholder="Назва вашої компанії" />

        {/* Пакет */}
        <div style={{ marginBottom: '24px' }}>
          <label style={LABEL_STYLE}>Пакет послуг</label>
          {plansLoading ? (
            <div style={{ padding: '10px 0', fontSize: '13px', color: '#71717a' }}>Завантаження пакетів...</div>
          ) : plansError || plans.length === 0 ? (
            <div style={{ padding: '10px 0', fontSize: '13px', color: '#dc2626' }}>
              Пакети тимчасово недоступні. Спробуйте пізніше.
            </div>
          ) : (
            <select
              value={form.plan}
              onChange={set('plan')}
              style={{
                ...INPUT_STYLE,
                ...(errors.plan ? { border: '1px solid #dc2626', background: '#fff5f5' } : {}),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2371717a' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                paddingRight: '36px',
              }}
            >
              {plans.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}{p.price > 0 ? ` — ${p.price} грн/міс` : ' — Безкоштовно'}
                </option>
              ))}
            </select>
          )}
          {errors.plan && <div style={ERROR_MSG_STYLE}>{errors.plan}</div>}
        </div>

        {/* Загальна серверна помилка */}
        {serverError && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fecaca',
            borderRadius: '10px', padding: '12px 16px',
            fontSize: '13px', color: '#dc2626', marginBottom: '16px',
          }}>
            {serverError}
          </div>
        )}

        {/* Кнопка */}
        <button
          onClick={handleSubmit}
          disabled={submitting || plansError || (plans.length === 0 && !plansLoading)}
          style={{
            width: '100%', padding: '14px',
            background: submitting ? '#a1a1aa' : primaryColor,
            color: 'white', border: 'none', borderRadius: '12px',
            fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'background 0.15s',
          }}
        >
          {submitting ? 'Реєстрація...' : 'Зареєструватись'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#71717a', marginTop: '16px', marginBottom: 0 }}>
          Вже маєте акаунт?{' '}
          <span
            onClick={onClose}
            style={{ color: primaryColor, cursor: 'pointer', fontWeight: 500 }}
          >
            Увійти
          </span>
        </p>
      </div>
    </div>
  );
}