import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

const Landing = ({ onLogin }) => {
  const [activeTheme, setActiveTheme] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeResult, setPromoCodeResult] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);

  // Отримання активної теми та цін
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

  // Перевірка промо-коду
  const verifyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    try {
      const res = await axios.post('/api/promo-codes/verify/', { 
        code: promoCodeInput,
      });
      setPromoCodeResult(res.data);
      if (res.data.valid) {
        setAppliedPromo(res.data);
      }
    } catch (err) {
      setPromoCodeResult({ 
        valid: false, 
        message: err.response?.data?.error || 'Невірний промо-код' 
      });
    }
  };

  // Застосування промо-коду до ціни
  const applyPromoToPrice = (price) => {
    if (appliedPromo && appliedPromo.valid) {
      if (appliedPromo.discount_type === 'percent') {
        return Math.round(price * (100 - appliedPromo.discount_value) / 100);
      } else {
        return Math.max(0, price - appliedPromo.discount_value);
      }
    }
    return price;
  };

  // Отримання ціни для плану
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

  // CSS змінні для теми
  const themeStyles = activeTheme ? {
    '--primary': activeTheme.primary_color,
    '--secondary': activeTheme.secondary_color,
    '--accent': activeTheme.accent_color,
  } : {};

  const heroStyle = activeTheme?.background_image 
    ? { backgroundImage: `url(${activeTheme.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${activeTheme?.primary_color || '#7a1a2e'} 0%, ${activeTheme?.secondary_color || '#4a0f1c'} 100%)` };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        minHeight: '100vh', background: '#fafafa' 
      }}>
        <div style={{ fontSize: '1.2rem', color: '#7a1a2e' }}>Завантаження...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#fafafa', 
      color: '#18181b', 
      minHeight: '100vh', 
      fontFamily: "'DM Sans', system-ui, sans-serif",
      ...themeStyles
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          body { margin: 0; padding: 0; font-family: 'DM Sans', system-ui, sans-serif; }
          .mono { font-family: 'DM Mono', monospace; }
          :root {
            --primary: ${activeTheme?.primary_color || '#7a1a2e'};
            --secondary: ${activeTheme?.secondary_color || '#4a0f1c'};
            --accent: ${activeTheme?.accent_color || '#e8a0b0'};
          }
        `}
      </style>

      {/* Navbar */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #e4e4e7', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '36px', height: '36px', 
              background: activeTheme?.primary_color || '#7a1a2e', 
              color: 'white', fontWeight: 'bold', fontSize: '24px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              borderRadius: '16px' 
            }}>I</div>
            <span style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.025em' }}>IDA</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button 
              onClick={onLogin}
              style={{ fontSize: '14px', fontWeight: 500, padding: '10px 24px', borderRadius: '9999px', border: '1px solid #d4d4d8', background: 'transparent', cursor: 'pointer', color: '#18181b' }}
            >
              Увійти
            </button>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: activeTheme?.primary_color || '#7a1a2e', color: 'white', padding: '10px 24px', borderRadius: '9999px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Почати безкоштовно
            </button>
          </div>
        </div>
      </nav>

      {/* Hero з динамічною темою */}
      <section style={{ ...heroStyle, color: 'white', padding: '112px 24px' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', padding: '8px 20px', borderRadius: '24px', marginBottom: '32px' }}>
            <span style={{ color: activeTheme?.accent_color || '#fde047' }}>●</span>
            <span className="mono" style={{ fontSize: '14px', letterSpacing: '0.15em' }}>Українська ATS</span>
          </div>
          
          <h1 style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '32px' }}>
            Рекрутинг,<br />який <span style={{ color: activeTheme?.accent_color || '#e8a0b0' }}>працює</span> на тебе
          </h1>
          
          <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)', maxWidth: '42rem', margin: '0 auto 48px', color: '#e4e4e7', lineHeight: 1.6 }}>
            Сучасна українська система для найму. Кандидати, канбан, інтерв'ю, аналітика та шаблони листів — в одному інтерфейсі.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'white', color: activeTheme?.primary_color || '#7a1a2e', fontWeight: 600, padding: '16px 40px', borderRadius: '16px', fontSize: '18px', border: 'none', cursor: 'pointer' }}
            >
              Почати безкоштовно — 14 днів
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            {[
              { icon: '👥', title: 'Кандидати', desc: 'Зручна база, фільтри, теги, історія змін статусів, масовий імпорт CSV.' },
              { icon: '📋', title: 'Канбан-дошка', desc: 'Візуальне управління процесом найму. Перетягуй кандидатів між етапами.' },
              { icon: '📅', title: 'Інтерв\'ю', desc: 'Планування, синхронізація з Google Calendar, Meet, історія співбесід.' },
            ].map((f, i) => (
              <div key={i} style={{ background: '#fafafa', border: '1px solid #f4f4f5', borderRadius: '24px', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '24px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>{f.title}</h3>
                <p style={{ color: '#52525b', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing з динамічними цінами та промо-кодами */}
      <section id="pricing" style={{ padding: '96px 24px', background: '#f4f4f5' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '16px' }}>Оберіть свій тариф</h2>
            <p style={{ color: '#52525b' }}>Прості та прозорі тарифи</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', maxWidth: '64rem', margin: '0 auto' }}>
            {/* Starter */}
            {pricing?.starter && (
              <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                {pricing.starter.discount > 0 && (
                  <div style={{ position: 'absolute', top: '-12px', right: '20px', background: '#facc15', color: '#7f1d1d', padding: '4px 16px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                    -{pricing.starter.discount}%
                  </div>
                )}
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>STARTER</div>
                <div style={{ fontSize: '30px', fontWeight: 600, color: activeTheme?.primary_color || '#7a1a2e', marginBottom: '8px' }}>
                  {getPlanPrice('starter')?.monthly} ₴
                  <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>
                </div>
                {pricing.starter.discount > 0 && (
                  <div style={{ fontSize: '12px', color: '#16a34a', marginBottom: '24px' }}>
                    з {getPlanPrice('starter')?.originalMonthly} ₴
                  </div>
                )}
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ {pricing.starter.limits.max_hr} HR</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ {pricing.starter.limits.max_vacancies === 0 ? 'Необмежені' : pricing.starter.limits.max_vacancies} вакансії</li>
                  {pricing.starter.features.analytics && <li>✓ Аналітика</li>}
                  {pricing.starter.features.google_integration && <li>✓ Google інтеграції</li>}
                </ul>
                
                <button 
                  onClick={() => { setSelectedPlan('starter'); setShowPromoModal(true); }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600, background: activeTheme?.primary_color || '#7a1a2e', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  Обрати Starter
                </button>
              </div>
            )}

            {/* Growth */}
            {pricing?.growth && (
              <div style={{ background: activeTheme?.primary_color || '#7a1a2e', color: 'white', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', transform: 'scale(1.02)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', background: '#facc15', color: '#7f1d1d', padding: '4px 24px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700 }} className="mono">РЕКОМЕНДУЄМО</div>
                
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, opacity: 0.75, marginBottom: '8px' }}>GROWTH</div>
                <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '8px' }}>
                  {getPlanPrice('growth')?.monthly} ₴
                  <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>
                </div>
                {pricing.growth.discount > 0 && (
                  <div style={{ fontSize: '12px', color: '#fecaca', marginBottom: '24px' }}>
                    з {getPlanPrice('growth')?.originalMonthly} ₴
                  </div>
                )}
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li>✓ До {pricing.growth.limits.max_hr} HR</li>
                  <li>✓ {pricing.growth.limits.max_vacancies === 0 ? 'Необмежені' : pricing.growth.limits.max_vacancies} вакансії</li>
                  {pricing.growth.features.analytics && <li>✓ Повна аналітика</li>}
                  {pricing.growth.features.email_templates && <li>✓ Шаблони листів</li>}
                  {pricing.growth.features.google_integration && <li>✓ Google інтеграції</li>}
                </ul>
                
                <button 
                  onClick={() => { setSelectedPlan('growth'); setShowPromoModal(true); }}
                  style={{ width: '100%', background: 'white', color: activeTheme?.primary_color || '#7a1a2e', padding: '14px', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  Обрати Growth
                </button>
              </div>
            )}

            {/* Enterprise */}
            {pricing?.enterprise && (
              <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>ENTERPRISE</div>
                <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '24px' }}>Індивідуальний</div>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li>✓ Необмежена кількість HR</li>
                  <li>✓ Кастомізація системи</li>
                  <li>✓ Пріоритетна підтримка</li>
                </ul>
                
                <button 
                  onClick={() => alert('Зв\'яжіться з нами для отримання індивідуальної пропозиції')}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600, border: `1px solid ${activeTheme?.primary_color || '#7a1a2e'}`, background: 'transparent', color: activeTheme?.primary_color || '#7a1a2e', cursor: 'pointer' }}
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
                style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #d4d4d8', flex: 1, minWidth: '200px', fontFamily: 'DM Mono', outline: 'none' }}
              />
              <button
                onClick={verifyPromoCode}
                disabled={!promoCodeInput.trim()}
                style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: activeTheme?.primary_color || '#7a1a2e', color: 'white', fontWeight: 600, cursor: promoCodeInput.trim() ? 'pointer' : 'not-allowed', opacity: promoCodeInput.trim() ? 1 : 0.6 }}
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
      <section style={{ padding: '80px 24px', background: activeTheme?.primary_color || '#7a1a2e', color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '24px' }}>Готові оптимізувати свій рекрутинг?</h2>
          <p style={{ fontSize: '20px', marginBottom: '40px', color: activeTheme?.accent_color || '#fecaca' }}>14 днів повноцінного доступу безкоштовно</p>
          <button 
            onClick={onLogin}
            style={{ display: 'inline-block', background: 'white', color: activeTheme?.primary_color || '#7a1a2e', fontWeight: 600, padding: '20px 48px', borderRadius: '16px', fontSize: '18px', border: 'none', cursor: 'pointer' }}
          >
            Почати безкоштовний період
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#18181b', color: '#a1a1aa', padding: '64px 24px' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', background: activeTheme?.primary_color || '#7a1a2e', color: 'white', fontWeight: 'bold', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>I</div>
            <span style={{ fontSize: '30px', fontWeight: 600, color: 'white' }}>IDA</span>
          </div>
          <p className="mono" style={{ fontSize: '14px' }}>Сучасна українська ATS-система</p>
          <div style={{ fontSize: '12px', marginTop: '48px', opacity: 0.5 }}>© 2026 IDA Systems. Усі права захищені.</div>
        </div>
      </footer>

      {/* Модальне вікно вибору тарифу з промо-кодом */}
      {showPromoModal && selectedPlan && pricing?.[selectedPlan] && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '16px' }}>
              Тариф {selectedPlan === 'starter' ? 'Starter' : selectedPlan === 'growth' ? 'Growth' : 'Enterprise'}
            </h3>
            <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
              {getPlanPrice(selectedPlan)?.monthly} ₴
              <span style={{ fontSize: '14px', fontWeight: 400 }}>/міс</span>
            </div>
            {appliedPromo && (
              <div style={{ fontSize: '14px', color: '#16a34a', marginBottom: '16px' }}>
                Знижка {appliedPromo.discount_value}{appliedPromo.discount_type === 'percent' ? '%' : 'грн'} застосована
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowPromoModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #d4d4d8', background: 'transparent', cursor: 'pointer' }}>Скасувати</button>
              <button onClick={() => { alert('Функція реєстрації буде доступна найближчим часом'); setShowPromoModal(false); }} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTheme?.primary_color || '#7a1a2e', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Продовжити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;