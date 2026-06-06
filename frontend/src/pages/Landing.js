import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

// Landing більше НЕ імпортує RegisterModal — він піднятий в App.js
const Landing = ({ onLogin, onRegister }) => {
  const [activeTheme, setActiveTheme] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeResult, setPromoCodeResult] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [themeRes, pricingRes] = await Promise.all([
          axios.get('/api/holiday-themes/active/'),
          axios.get('/api/public/pricing/')
        ]);
        setActiveTheme(themeRes.data);
        setPricing(pricingRes.data);
      } catch (err) {
        console.error('Помилка завантаження даних:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const verifyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const res = await axios.post('/api/promo-codes/verify/', { code: promoCodeInput });
      setPromoCodeResult(res.data);
      if (res.data.valid) setAppliedPromo(res.data);
    } catch (err) {
      setPromoCodeResult({
        valid: false,
        message: err.response?.data?.error || 'Невірний промо-код'
      });
    }
  };

  const applyPromoToPrice = (price) => {
    if (appliedPromo && appliedPromo.valid) {
      if (appliedPromo.discount_type === 'percent') {
        return Math.round(price * (100 - appliedPromo.discount_value) / 100);
      } else {
        return Math.max(0, Math.round(price - appliedPromo.discount_value));
      }
    }
    return price;
  };

  const getPlanPrice = (planKey) => {
    if (!pricing || !pricing[planKey]) return null;
    const plan = pricing[planKey];
    return {
      monthly: applyPromoToPrice(plan.monthly),
      yearly: applyPromoToPrice(plan.yearly),
      originalMonthly: plan.monthly,
      discount: plan.discount,
      features: plan.features,
      limits: plan.limits
    };
  };

  const primary = activeTheme?.primary_color || '#7a1a2e';

  // Хелпер — виклик реєстрації з передачею поточного кольору теми
  const handleOpenRegister = () => {
    onRegister(primary);
  };

  const safeBgImage = activeTheme?.background_image && /^https?:\/\//.test(activeTheme.background_image)
    ? activeTheme.background_image
    : null;
  const heroStyle = safeBgImage
    ? { backgroundImage: `url(${safeBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${primary} 0%, ${activeTheme?.secondary_color || '#4a0f1c'} 100%)` };

  const themeContent = {
    halloween: {
      badge: <><span style={{ fontSize: '2rem' }}>{'🎃👻'}</span><span className="mono" style={{ fontSize: '14px', letterSpacing: '0.2em' }}>HALLOWEEN</span></>,
      heading: <>Найстрашніший рекрутинг<br />в Україні</>,
      sub: 'Не бійся — просто наймай найкращих кандидатів',
      extraBtn: null,
      pricingSubtitle: 'Спеціальна Halloween-знижка діє зараз 🎃',
      footerText: 'З жахливим Halloween! 🎃',
      ctaHeading: 'Готові до жахливо ефективного рекрутингу?',
      navbarBg: '#000',
      navbarBorder: 'rgba(255,255,255,0.1)',
      navbarColor: 'white',
    },
    independence: {
      badge: <><span style={{ fontSize: '2rem' }}>{'🇺🇦'}</span><span className="mono" style={{ fontSize: '14px', letterSpacing: '0.2em' }}>ДЕНЬ НЕЗАЛЕЖНОСТІ УКРАЇНИ</span></>,
      heading: <>Рекрутинг для<br />сильної та вільної України</>,
      sub: 'У День Незалежності ми пишаємося тим, що допомагаємо українським компаніям будувати потужні команди.',
      extraBtn: <button onClick={() => alert('Слава Україні!')} style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.7)', color: 'white', fontWeight: 600, padding: '16px 40px', borderRadius: '16px', fontSize: '18px', cursor: 'pointer' }}>{'Слава Україні! 🇺🇦'}</button>,
      pricingSubtitle: 'Спеціальна пропозиція до Дня Незалежності 🇺🇦',
      footerText: 'Слава Україні! 🇺🇦',
      ctaHeading: 'Готові зміцнити свою команду?',
      navbarBg: '#fff',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    new_year: {
      badge: <><span style={{ fontSize: '2rem' }}>{'🎄✨'}</span><span className="mono" style={{ fontSize: '14px', letterSpacing: '0.2em' }}>НОВОРІЧНА АКЦІЯ</span></>,
      heading: <>Новий рік —<br />нова команда</>,
      sub: 'Зустрічай Новий рік з найкращими кандидатами. Спеціальні новорічні пропозиції для вашого рекрутингу.',
      extraBtn: null,
      pricingSubtitle: 'Спеціальні новорічні знижки 🎄',
      footerText: 'З Новим Роком! 🎄✨',
      ctaHeading: 'Розпочни Новий рік з кращим рекрутингом!',
      navbarBg: '#fff',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    ida_birthday: {
      badge: <><span style={{ fontSize: '2rem' }}>{'🎂🎉'}</span><span className="mono" style={{ fontSize: '14px', letterSpacing: '0.2em' }}>ДЕНЬ НАРОДЖЕННЯ IDA</span></>,
      heading: <>IDA святкує!<br />А ти наймаєш</>,
      sub: 'У день нашого народження ми даруємо вам спеціальні пропозиції. Святкуємо разом!',
      extraBtn: null,
      pricingSubtitle: 'Святкові пропозиції на честь Дня народження IDA 🎂',
      footerText: 'З Днем народження, IDA! 🎂🎉',
      ctaHeading: 'Святкуй разом з нами!',
      navbarBg: '#fff',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    flag_day: {
      badge: <><span style={{ fontSize: '2rem' }}>{'🇺🇦'}</span><span className="mono" style={{ fontSize: '14px', letterSpacing: '0.2em' }}>ДЕНЬ ДЕРЖАВНОГО ПРАПОРА УКРАЇНИ</span></>,
      heading: <>Під одним прапором —<br />сильні команди</>,
      sub: 'У День Державного Прапора ми святкуємо єдність і гідність. IDA допомагає українським компаніям збирати найкращі команди під синьо-жовтим прапором.',
      extraBtn: <button onClick={() => alert('Слава Україні!')} style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.7)', color: 'white', fontWeight: 600, padding: '16px 40px', borderRadius: '16px', fontSize: '18px', cursor: 'pointer' }}>{'Слава Україні! 🇺🇦'}</button>,
      pricingSubtitle: 'Спеціальна пропозиція до Дня Державного Прапора 🇺🇦',
      footerText: 'Слава Україні! 🇺🇦',
      ctaHeading: 'Готові зміцнити свою команду?',
      navbarBg: '#005BBB',
      navbarBorder: 'rgba(255,255,255,0.2)',
      navbarColor: 'white',
    },
  };

  const defaultContent = {
    badge: null,
    heading: <>Сучасний рекрутинг<br />для вашої команди</>,
    sub: 'IDA ATS — українська система управління кандидатами. Kanban-дошка, аналітика, Google-інтеграції та багато іншого.',
    extraBtn: null,
    pricingSubtitle: 'Оберіть план, що підходить вашій команді',
    footerText: '',
    ctaHeading: 'Готові розпочати?',
    navbarBg: 'rgba(255,255,255,0.95)',
    navbarBorder: '#e4e4e7',
    navbarColor: '#18181b',
  };

  const tc = (activeTheme?.name && themeContent[activeTheme.name]) ? themeContent[activeTheme.name] : defaultContent;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', color: '#71717a', letterSpacing: '0.1em' }}>
          ЗАВАНТАЖЕННЯ...
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', minHeight: '100vh', background: '#fafafa' }}>

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: tc.navbarBg,
        borderBottom: `1px solid ${tc.navbarBorder}`,
        backdropFilter: 'blur(12px)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: primary, color: 'white', fontWeight: 'bold', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>I</div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: tc.navbarColor }}>IDA ATS</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={onLogin}
            style={{ padding: '8px 20px', borderRadius: '10px', border: `1px solid ${tc.navbarBorder}`, background: 'transparent', color: tc.navbarColor, fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}
          >
            Увійти
          </button>
          <button
            onClick={handleOpenRegister}
            style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: primary, color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
          >
            Почати безкоштовно
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...heroStyle, padding: 'clamp(80px, 12vw, 140px) 24px', textAlign: 'center', color: 'white' }}>
        {tc.badge && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: '9999px', padding: '8px 20px', marginBottom: '32px', color: 'white' }}>
            {tc.badge}
          </div>
        )}
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '24px', letterSpacing: '-0.02em' }}>
          {tc.heading}
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', maxWidth: '600px', margin: '0 auto 48px', opacity: 0.9, lineHeight: 1.6 }}>
          {tc.sub}
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenRegister}
            style={{ background: 'white', color: primary, fontWeight: 700, padding: '18px 44px', borderRadius: '16px', fontSize: '17px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
          >
            Почати безкоштовно
          </button>
          <button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 600, padding: '18px 44px', borderRadius: '16px', fontSize: '17px', border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
          >
            Переглянути тарифи
          </button>
          {tc.extraBtn}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) 24px', maxWidth: '80rem', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span className="mono" style={{ fontSize: '12px', letterSpacing: '0.15em', color: primary, textTransform: 'uppercase' }}>Можливості</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, marginTop: '12px', color: '#18181b' }}>Все для ефективного рекрутингу</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {[
            { icon: '📋', title: 'Kanban-дошка', desc: 'Drag-and-drop управління кандидатами по етапах воронки найму' },
            { icon: '📊', title: 'Аналітика', desc: 'Time-to-hire, ефективність HR-команди, конверсія по вакансіях' },
            { icon: '📧', title: 'Email-шаблони', desc: 'Автоматичні листи кандидатам через Google Gmail інтеграцію' },
            { icon: '📅', title: 'Календар інтерв\'ю', desc: 'Синхронізація з Google Calendar, автоматичні нагадування' },
            { icon: '👥', title: 'Управління командою', desc: 'Ролі admin та HR, розмежування доступу всередині організації' },
            { icon: '🔍', title: 'Пошук та фільтри', desc: 'Швидкий пошук по кандидатах, фільтрація по тегах і статусах' },
          ].map(f => (
            <div key={f.title} style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e4e4e7' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#18181b', marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#71717a', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: 'clamp(64px, 8vw, 96px) 24px', background: '#f4f4f5' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span className="mono" style={{ fontSize: '12px', letterSpacing: '0.15em', color: primary, textTransform: 'uppercase' }}>Тарифи</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, marginTop: '12px', color: '#18181b' }}>Прозора ціна</h2>
            <p style={{ color: '#71717a', marginTop: '12px' }}>{tc.pricingSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>

            {/* Starter */}
            {pricing?.starter && (
              <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>STARTER</div>
                <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '24px', color: '#18181b' }}>
                  {getPlanPrice('starter')?.monthly === 0 ? 'Безкоштовно' : `${getPlanPrice('starter')?.monthly} ₴`}
                  {getPlanPrice('starter')?.monthly > 0 && <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#3f3f46' }}>
                  <li>✓ До {pricing.starter.limits?.max_hr || 1} HR</li>
                  <li>✓ {pricing.starter.limits?.max_vacancies || 5} вакансій</li>
                  <li>✓ Kanban-дошка</li>
                  <li style={{ color: '#a1a1aa' }}>✗ Аналітика</li>
                  <li style={{ color: '#a1a1aa' }}>✗ Email-шаблони</li>
                </ul>
                <button
                  onClick={handleOpenRegister}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600, border: `1px solid ${primary}`, background: 'transparent', color: primary, cursor: 'pointer', fontSize: '14px' }}
                >
                  Почати безкоштовно
                </button>
              </div>
            )}

            {/* Growth */}
            {pricing?.growth && (
              <div style={{ background: primary, color: 'white', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', transform: 'scale(1.02)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', background: '#facc15', color: '#7f1d1d', padding: '4px 24px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }} className="mono">РЕКОМЕНДУЄМО</div>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, opacity: 0.75, marginBottom: '8px' }}>GROWTH</div>
                <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '8px' }}>
                  {getPlanPrice('growth')?.monthly} ₴
                  <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>
                </div>
                {(pricing.growth.discount > 0 || appliedPromo) && (
                  <div style={{ fontSize: '12px', color: '#fecaca', marginBottom: '24px' }}>
                    з {getPlanPrice('growth')?.originalMonthly} ₴
                  </div>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <li>✓ До {pricing.growth.limits?.max_hr} HR</li>
                  <li>✓ {pricing.growth.limits?.max_vacancies === 0 ? 'Необмежені' : pricing.growth.limits?.max_vacancies} вакансії</li>
                  {pricing.growth.features?.analytics && <li>✓ Повна аналітика</li>}
                  {pricing.growth.features?.email_templates && <li>✓ Шаблони листів</li>}
                  {pricing.growth.features?.google_integration && <li>✓ Google інтеграції</li>}
                  <li>✓ Календар інтерв'ю</li>
                </ul>
                <button
                  onClick={() => { setSelectedPlan('growth'); setShowPromoModal(true); }}
                  style={{ width: '100%', background: 'white', color: primary, padding: '14px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  Обрати Growth
                </button>
              </div>
            )}

            {/* Enterprise */}
            {pricing?.enterprise && (
              <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>ENTERPRISE</div>
                <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '24px', color: '#18181b' }}>Індивідуальний</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#3f3f46' }}>
                  <li>✓ Необмежена кількість HR</li>
                  <li>✓ Необмежені вакансії</li>
                  <li>✓ Кастомізація системи</li>
                  <li>✓ Пріоритетна підтримка</li>
                  <li>✓ SLA гарантії</li>
                </ul>
                <button
                  onClick={() => alert('Зв\'яжіться з нами: ida@ida-ats.com')}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600, border: `1px solid ${primary}`, background: 'transparent', color: primary, cursor: 'pointer', fontSize: '14px' }}
                >
                  Написати нам
                </button>
              </div>
            )}
          </div>

          {/* Промо-код */}
          <div style={{ maxWidth: '400px', margin: '48px auto 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                type="text"
                placeholder="Введіть промо-код"
                value={promoCodeInput}
                onChange={(e) => { setPromoCodeInput(e.target.value.toUpperCase()); setPromoCodeResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && verifyPromoCode()}
                style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #d4d4d8', flex: 1, minWidth: '200px', fontFamily: 'DM Mono', outline: 'none', background: 'white' }}
              />
              <button
                onClick={verifyPromoCode}
                disabled={!promoCodeInput.trim()}
                style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: primary, color: 'white', fontWeight: 600, cursor: promoCodeInput.trim() ? 'pointer' : 'not-allowed', opacity: promoCodeInput.trim() ? 1 : 0.6 }}
              >
                Застосувати
              </button>
            </div>
            {promoCodeResult && (
              <div style={{ marginTop: '12px', fontSize: '0.85rem', color: promoCodeResult.valid ? '#16a34a' : '#dc2626' }}>
                {promoCodeResult.valid ? '✓ ' : '✗ '}{promoCodeResult.message}
              </div>
            )}
            {appliedPromo && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#16a34a' }}>
                Знижка {appliedPromo.discount_value}{appliedPromo.discount_type === 'percent' ? '%' : ' грн'} застосована до всіх тарифів
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) 24px', background: primary, color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '24px' }}>{tc.ctaHeading}</h2>
          <p style={{ fontSize: '20px', marginBottom: '40px', color: activeTheme?.accent_color || '#fecaca' }}>14 днів повноцінного доступу безкоштовно</p>
          <button
            onClick={handleOpenRegister}
            style={{ display: 'inline-block', background: 'white', color: primary, fontWeight: 700, padding: '20px 48px', borderRadius: '16px', fontSize: '18px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
          >
            Почати безкоштовний період
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#18181b', color: '#a1a1aa', padding: '64px 24px' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', background: primary, color: 'white', fontWeight: 'bold', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>I</div>
            <span style={{ fontSize: '30px', fontWeight: 600, color: 'white' }}>IDA</span>
          </div>
          <p className="mono" style={{ fontSize: '14px' }}>Сучасна українська ATS-система</p>
          <div style={{ fontSize: '12px', marginTop: '48px', opacity: 0.5 }}>© 2026 IDA Systems. {tc.footerText}</div>
        </div>
      </footer>

      {/* Модальне вікно вибору тарифу Growth з промо-кодом */}
      {showPromoModal && selectedPlan && pricing?.[selectedPlan] && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px', fontFamily: 'DM Sans, sans-serif' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '16px', color: '#18181b' }}>
              Тариф {selectedPlan === 'starter' ? 'Starter' : selectedPlan === 'growth' ? 'Growth' : 'Enterprise'}
            </h3>
            <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: '#18181b' }}>
              {getPlanPrice(selectedPlan)?.monthly} ₴
              <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>
            </div>
            {appliedPromo && (
              <div style={{ fontSize: '14px', color: '#16a34a', marginBottom: '16px' }}>
                Знижка {appliedPromo.discount_value}{appliedPromo.discount_type === 'percent' ? '%' : 'грн'} застосована
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => { setShowPromoModal(false); setSelectedPlan(null); }}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #d4d4d8', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Скасувати
              </button>
              <button
                onClick={() => { setShowPromoModal(false); setSelectedPlan(null); handleOpenRegister(); }}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: primary, color: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Зареєструватись
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;