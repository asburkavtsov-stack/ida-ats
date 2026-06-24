import React, { useState, useEffect, useRef } from 'react';
import axios from 'axiosConfig';
import toast from 'react-hot-toast';


const BetaLanding = ({ onLogin, onRegister }) => {
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    team_size: '',
    current_tool: '',
    comment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [betaOpen, setBetaOpen] = useState(true); // з API
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const formRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Landing scroll behavior (як у Landing.js)
  useEffect(() => {
    document.body.classList.add('landing-page');
    document.documentElement.classList.add('landing-page');
    document.body.classList.remove('app-shell');
    document.documentElement.classList.remove('app-shell');
    return () => {
      document.body.classList.remove('landing-page');
      document.documentElement.classList.remove('landing-page');
      document.body.classList.add('app-shell');
      document.documentElement.classList.add('app-shell');
    };
  }, []);

  // Перевіряємо чи відкрита бета
  useEffect(() => {
    axios.get('/api/public/beta-status/')
      .then(res => setBetaOpen(res.data.beta_open))
      .catch(() => setBetaOpen(true)); // fallback — показуємо форму
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_name || !form.email) {
      toast.error('Заповніть обов\'язкові поля');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/public/beta-apply/', form);
      setSubmitted(true);
      toast.success('Заявку отримано! Ми зв\'яжемося з вами найближчим часом.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Помилка при відправці. Спробуйте ще раз.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Styles (inline, як у проекті) ──────────────────────────────────────────
  const s = {
    page: {
      background: 'var(--bg, #fff)',
      color: 'var(--text, #1a1a1a)',
      fontFamily: 'DM Sans, sans-serif',
      minHeight: '100vh',
    },
    nav: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: isMobile ? '16px 20px' : '20px 60px',
      borderBottom: '1px solid var(--border, #e5e7eb)',
      background: 'var(--surface, #fff)',
      position: 'sticky', top: 0, zIndex: 100,
    },
    logo: {
      fontFamily: 'DM Mono, monospace', fontWeight: 700,
      fontSize: isMobile ? '1rem' : '1.1rem',
      color: 'var(--accent, #7a1a2e)',
      letterSpacing: '-0.5px',
    },
    navBtn: {
      padding: '8px 18px', borderRadius: '8px',
      border: '1px solid var(--border, #e5e7eb)',
      background: 'transparent', color: 'var(--text, #1a1a1a)',
      cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.85rem',
    },
    hero: {
      padding: isMobile ? '60px 20px 40px' : '100px 60px 60px',
      maxWidth: '900px', margin: '0 auto', textAlign: 'center',
    },
    betaBadge: {
      display: 'inline-block',
      padding: '5px 14px', borderRadius: '20px',
      background: '#7a1a2e15', color: '#7a1a2e',
      fontSize: '0.72rem', fontFamily: 'DM Mono', fontWeight: 600,
      letterSpacing: '0.5px', textTransform: 'uppercase',
      marginBottom: '24px', border: '1px solid #7a1a2e30',
    },
    h1: {
      fontSize: isMobile ? '2rem' : '3rem',
      fontWeight: 800, lineHeight: 1.15,
      marginBottom: '20px', letterSpacing: '-1px',
    },
    accent: { color: '#7a1a2e' },
    sub: {
      fontSize: isMobile ? '1rem' : '1.2rem',
      color: 'var(--muted, #6b7280)',
      marginBottom: '36px', lineHeight: 1.6,
      maxWidth: '640px', margin: '0 auto 36px',
    },
    ctaBtn: {
      display: 'inline-block',
      padding: isMobile ? '14px 28px' : '16px 36px',
      borderRadius: '12px', border: 'none',
      background: '#7a1a2e', color: '#fff',
      fontSize: isMobile ? '0.95rem' : '1.05rem',
      fontWeight: 700, cursor: 'pointer',
      fontFamily: 'DM Sans',
      boxShadow: '0 4px 24px #7a1a2e40',
      transition: 'transform 0.15s, box-shadow 0.15s',
    },
    section: {
      padding: isMobile ? '48px 20px' : '80px 60px',
      maxWidth: '960px', margin: '0 auto',
    },
    sectionTitle: {
      fontSize: isMobile ? '1.5rem' : '2rem',
      fontWeight: 800, marginBottom: '12px',
      letterSpacing: '-0.5px',
    },
    sectionSub: {
      color: 'var(--muted, #6b7280)', fontSize: '0.95rem',
      marginBottom: '40px',
    },
    card: {
      background: 'var(--surface, #f9fafb)',
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: '16px', padding: '24px',
    },
    input: {
      width: '100%', padding: '11px 14px',
      borderRadius: '10px', border: '1px solid var(--border, #e5e7eb)',
      background: 'var(--bg, #fff)', color: 'var(--text, #1a1a1a)',
      fontFamily: 'DM Sans', fontSize: '0.9rem', outline: 'none',
      boxSizing: 'border-box',
    },
    label: {
      fontSize: '0.78rem', color: 'var(--muted, #6b7280)',
      marginBottom: '6px', display: 'block', fontFamily: 'DM Mono',
    },
    required: { color: '#7a1a2e', marginLeft: '2px' },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '16px',
    },
  };

  // ─── Pain points ────────────────────────────────────────────────────────────
  const pains = [
    { icon: '📊', text: '5 рекрутерів — 5 окремих таблиць, і ніхто не знає де що' },
    { icon: '🚪', text: 'Пішов топ-рекрутер — пішла база кандидатів разом з ним' },
    { icon: '🔁', text: 'Одного кандидата відправили на ту саму вакансію двічі' },
    { icon: '🔍', text: '«Де той резюме з минулого місяця?» — пошуки по Telegram і Notion' },
    { icon: '⏱', text: 'Закрити одну вакансію — три тижні email-ланцюжків і нарад' },
  ];

  // ─── How it works ───────────────────────────────────────────────────────────
  const steps = [
    {
      n: '01',
      title: 'Централізуй базу',
      desc: 'Всі кандидати, вакансії і контакти — в одному місці. Хто б не пішов — база залишається.',
    },
    {
      n: '02',
      title: 'Рухай по воронці',
      desc: 'Канбан-дошка зі стадіями. Один drag — кандидат переходить далі, всі бачать де він.',
    },
    {
      n: '03',
      title: 'Закривай швидше',
      desc: 'Автосповіщення, шаблони листів, фільтри. Менше рутини — більше закритих вакансій.',
    },
  ];

  // ─── Offer points ───────────────────────────────────────────────────────────
  const offers = [
    { icon: '🎯', text: 'Доступ до системи на 3 місяці безкоштовно' },
    { icon: '👥', text: 'До 5 HR-акаунтів для вашої команди' },
    { icon: '💬', text: 'Пряма лінія з командою — ваш фідбек формує продукт' },
    { icon: '🔒', text: 'Ваші дані — ваші. GDPR, безпека, конфіденційність' },
    { icon: '🚀', text: 'Пріоритетний доступ до нових функцій після бети' },
  ];

  return (
    <div style={s.page}>

      {/* ── Nav ── */}
      <nav style={s.nav}>
        <div style={s.logo}>IDA ATS</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {onLogin && (
            <button style={s.navBtn} onClick={onLogin}>Увійти</button>
          )}
          <button
            style={{ ...s.navBtn, background: '#7a1a2e', color: '#fff', border: 'none', fontWeight: 600 }}
            onClick={scrollToForm}
          >
            Взяти участь
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={s.hero}>
        <div style={s.betaBadge}>🔒 Закрита бета · Обмежена кількість місць</div>
        <h1 style={s.h1}>
          Усі клієнти, вакансії й кандидати —<br />
          <span style={s.accent}>в одній базі.</span><br />
          Без хаосу між таблицями.
        </h1>
        <p style={s.sub}>
          Рекрутингові агенції закривають вакансії в <strong>3–5 разів швидше</strong> коли
          вся команда працює в одній системі, а не в п'яти різних Google Sheets.
        </p>
        <button style={s.ctaBtn} onClick={scrollToForm}>
          Подати заявку на бету →
        </button>
        <p style={{ marginTop: '16px', fontSize: '0.78rem', color: 'var(--muted, #6b7280)', fontFamily: 'DM Mono' }}>
          Відповідаємо протягом 24 годин · Без оплати · Без зобов'язань
        </p>
      </div>

      {/* ── Problem ── */}
      <div style={{ background: 'var(--surface, #f9fafb)', padding: isMobile ? '48px 0' : '80px 0' }}>
        <div style={s.section}>
          <p style={{ ...s.betaBadge, display: 'inline-block', marginBottom: '16px' }}>😤 Впізнаєш?</p>
          <h2 style={s.sectionTitle}>Чому рекрутинг-агенції<br />губляться у власних таблицях</h2>
          <p style={s.sectionSub}>Це не твоя вина — це відсутність нормального інструменту.</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            {pains.map((p, i) => (
              <div key={i} style={{
                ...s.card,
                display: 'flex', alignItems: 'flex-start', gap: '16px',
                padding: '16px 20px',
              }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.icon}</span>
                <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div style={s.section}>
        <p style={{ ...s.betaBadge, display: 'inline-block', marginBottom: '16px' }}>⚙️ Рішення</p>
        <h2 style={s.sectionTitle}>Як працює IDA ATS</h2>
        <p style={s.sectionSub}>Три кроки — і вся команда в одній системі.</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: '20px',
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              ...s.card,
              borderTop: '3px solid #7a1a2e',
              position: 'relative',
            }}>
              <div style={{
                fontFamily: 'DM Mono', fontSize: '2rem', fontWeight: 700,
                color: '#7a1a2e20', lineHeight: 1, marginBottom: '12px',
              }}>
                {step.n}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>{step.title}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--muted, #6b7280)', lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Offer ── */}
      <div style={{ background: 'var(--surface, #f9fafb)', padding: isMobile ? '48px 0' : '80px 0' }}>
        <div style={s.section}>
          <p style={{ ...s.betaBadge, display: 'inline-block', marginBottom: '16px' }}>🎁 Умови бети</p>
          <h2 style={s.sectionTitle}>Що ти отримуєш<br />як бета-учасник</h2>
          <p style={s.sectionSub}>Реальний доступ до продукту в обмін на твій фідбек.</p>
          <div style={{ display: 'grid', gap: '12px', maxWidth: '600px' }}>
            {offers.map((o, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{o.icon}</span>
                <span style={{ fontSize: '0.95rem' }}>{o.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scarcity ── */}
      <div style={{ ...s.section, textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7a1a2e08, #7a1a2e18)',
          border: '2px solid #7a1a2e30',
          borderRadius: '20px', padding: isMobile ? '32px 24px' : '48px 60px',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏰</div>
          <h2 style={{ ...s.sectionTitle, marginBottom: '12px' }}>Лише 20 агенцій у першій хвилі</h2>
          <p style={{ color: 'var(--muted, #6b7280)', fontSize: '0.95rem', marginBottom: '28px', lineHeight: 1.6 }}>
            Ми відбираємо учасників вручну — щоб кожному приділити увагу й зібрати якісний фідбек.
            Якщо заявок більше ніж місць — решта потрапляє до листа очікування.
          </p>
          <button style={s.ctaBtn} onClick={scrollToForm}>
            Подати заявку зараз
          </button>
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ background: 'var(--surface, #f9fafb)', padding: isMobile ? '48px 0 64px' : '80px 0 100px' }}>
        <div style={{ ...s.section, maxWidth: '680px' }} ref={formRef}>
          <p style={{ ...s.betaBadge, display: 'inline-block', marginBottom: '16px' }}>📋 Заявка</p>
          <h2 style={{ ...s.sectionTitle, marginBottom: '8px' }}>Залишити заявку на бету</h2>
          <p style={{ ...s.sectionSub, marginBottom: '32px' }}>
            Заповни форму — ми зв'яжемося протягом 24 годин.
          </p>

          {!betaOpen ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontWeight: 700, marginBottom: '8px' }}>Реєстрацію тимчасово закрито</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--muted, #6b7280)' }}>
                Ми вже набрали учасників для поточної хвилі. Залишайся на зв'язку!
              </div>
            </div>
          ) : submitted ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '48px 40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>Заявку отримано!</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted, #6b7280)', lineHeight: 1.6 }}>
                Ми розглянемо її і надішлемо відповідь на <strong>{form.email}</strong> протягом 24 годин.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={s.card}>
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>Назва агенції<span style={s.required}>*</span></label>
                  <input
                    style={s.input} placeholder="Recruitment Pro"
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={s.label}>Ваше ім'я<span style={s.required}>*</span></label>
                  <input
                    style={s.input} placeholder="Іванна Петренко"
                    value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={s.label}>Email<span style={s.required}>*</span></label>
                  <input
                    style={s.input} type="email" placeholder="ivanna@agency.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={s.label}>Телефон</label>
                  <input
                    style={s.input} placeholder="+380 99 123 45 67"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={s.label}>Скільки рекрутерів у команді?</label>
                  <select
                    style={s.input}
                    value={form.team_size}
                    onChange={e => setForm(f => ({ ...f, team_size: e.target.value }))}
                  >
                    <option value="">Обери варіант</option>
                    <option value="1-2">1–2 людини</option>
                    <option value="3-5">3–5 людей</option>
                    <option value="6-10">6–10 людей</option>
                    <option value="11+">11+ людей</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Зараз ви використовуєте...</label>
                  <select
                    style={s.input}
                    value={form.current_tool}
                    onChange={e => setForm(f => ({ ...f, current_tool: e.target.value }))}
                  >
                    <option value="">Обери варіант</option>
                    <option value="google_sheets">Google Sheets / Excel</option>
                    <option value="notion">Notion / Airtable</option>
                    <option value="trello">Trello / Jira</option>
                    <option value="ats">Інша ATS система</option>
                    <option value="nothing">Нічого системного</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={s.label}>Коментар (необов'язково)</label>
                <textarea
                  style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
                  placeholder="Що зараз найбільше болить у рекрутингу вашої агенції?"
                  value={form.comment}
                  onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...s.ctaBtn,
                  marginTop: '20px', width: '100%',
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Відправляємо...' : 'Подати заявку →'}
              </button>
              <p style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--muted, #6b7280)', textAlign: 'center', fontFamily: 'DM Mono' }}>
                Без спаму. Тільки відповідь по заявці.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '24px 60px', borderTop: '1px solid var(--border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted, #6b7280)' }}>
          © 2025 IDA ATS — Recruitment OS для агенцій
        </div>
        {onLogin && (
          <button style={{ ...s.navBtn, fontSize: '0.78rem' }} onClick={onLogin}>
            Вже є доступ? Увійти →
          </button>
        )}
      </div>
    </div>
  );
};

export default BetaLanding;