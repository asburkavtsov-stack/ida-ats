import React, { useState, useEffect, useRef } from 'react';
import axios from 'axiosConfig';

// Сумісний дроп-ін для App.js — ті ж пропси: onLogin, onRegister
const Landing = ({ onLogin, onRegister }) => {
  const [activeTheme, setActiveTheme] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCodeResult, setPromoCodeResult] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const pricingRef = useRef(null);


  // Знімаємо overflow:hidden з body/html поки відкритий лендінг
  useEffect(() => {
    document.body.classList.add('landing-page');
    document.documentElement.classList.add('landing-page');
    return () => {
      document.body.classList.remove('landing-page');
      document.documentElement.classList.remove('landing-page');
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [themeRes, pricingRes] = await Promise.all([
          axios.get('/api/holiday-themes/active/'),
          axios.get('/api/public/pricing/'),
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
        message: err.response?.data?.error || 'Невірний промо-код',
      });
    }
  };

  const applyPromoToPrice = (price) => {
    if (appliedPromo?.valid) {
      if (appliedPromo.discount_type === 'percent') {
        return Math.round(price * (100 - appliedPromo.discount_value) / 100);
      }
      return Math.max(0, Math.round(price - appliedPromo.discount_value));
    }
    return price;
  };

  const getPlanPrice = (planKey) => {
    if (!pricing?.[planKey]) return null;
    const plan = pricing[planKey];
    return {
      monthly: applyPromoToPrice(plan.monthly),
      yearly: applyPromoToPrice(plan.yearly),
      originalMonthly: plan.monthly,
      discount: plan.discount,
      features: plan.features,
      limits: plan.limits,
    };
  };

  const primary = activeTheme?.primary_color || '#7a1a2e';

  const handleOpenRegister = () => onRegister(primary);

  const scrollToPricing = () =>
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });

  const safeBgImage =
    activeTheme?.background_image && /^https?:\/\//.test(activeTheme.background_image)
      ? activeTheme.background_image
      : null;

  const heroStyle = safeBgImage
    ? { backgroundImage: `url(${safeBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(150deg, ${primary} 0%, ${activeTheme?.secondary_color || '#4a0f1c'} 100%)` };

  // ─── Святкові теми ───────────────────────────────────────────────────────────
  const themeContent = {
    halloween: {
      badge: <><span style={{ fontSize: '1.4rem' }}>🎃</span><span style={s.mono}>HALLOWEEN</span></>,
      heading: <>Найстрашніший рекрутинг<br />в Україні</>,
      sub: 'Не бійся — просто наймай найкращих кандидатів.',
      extraBtn: null,
      pricingSubtitle: 'Спеціальна Halloween-знижка діє зараз 🎃',
      footerText: 'З жахливим Halloween! 🎃',
      ctaHeading: 'Готові до жахливо ефективного рекрутингу?',
      navbarBg: '#0a0a0a',
      navbarBorder: 'rgba(255,255,255,0.08)',
      navbarColor: 'white',
    },
    independence: {
      badge: <><span style={{ fontSize: '1.4rem' }}>🇺🇦</span><span style={s.mono}>ДЕНЬ НЕЗАЛЕЖНОСТІ</span></>,
      heading: <>Рекрутинг для<br />сильної та вільної України</>,
      sub: 'У День Незалежності ми пишаємося тим, що допомагаємо будувати потужні команди.',
      extraBtn: (
        <button onClick={() => alert('Слава Україні!')} style={s.btnHeroGhost}>
          Слава Україні! 🇺🇦
        </button>
      ),
      pricingSubtitle: 'Спеціальна пропозиція до Дня Незалежності 🇺🇦',
      footerText: 'Слава Україні! 🇺🇦',
      ctaHeading: 'Готові зміцнити свою команду?',
      navbarBg: 'rgba(255,255,255,0.97)',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    new_year: {
      badge: <><span style={{ fontSize: '1.4rem' }}>🎄</span><span style={s.mono}>НОВОРІЧНА АКЦІЯ</span></>,
      heading: <>Новий рік —<br />нова команда</>,
      sub: 'Зустрічай Новий рік з найкращими кандидатами. Спеціальні пропозиції для вашого рекрутингу.',
      extraBtn: null,
      pricingSubtitle: 'Спеціальні новорічні знижки 🎄',
      footerText: 'З Новим Роком! 🎄✨',
      ctaHeading: 'Розпочни Новий рік з кращим рекрутингом!',
      navbarBg: 'rgba(255,255,255,0.97)',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    ida_birthday: {
      badge: <><span style={{ fontSize: '1.4rem' }}>🎂</span><span style={s.mono}>ДЕНЬ НАРОДЖЕННЯ IDA</span></>,
      heading: <>IDA святкує!<br />А ти наймаєш</>,
      sub: 'У день нашого народження ми даруємо вам спеціальні пропозиції. Святкуємо разом!',
      extraBtn: null,
      pricingSubtitle: 'Святкові пропозиції на честь Дня народження IDA 🎂',
      footerText: 'З Днем народження, IDA! 🎂🎉',
      ctaHeading: 'Святкуй разом з нами!',
      navbarBg: 'rgba(255,255,255,0.97)',
      navbarBorder: '#e4e4e7',
      navbarColor: '#18181b',
    },
    flag_day: {
      badge: <><span style={{ fontSize: '1.4rem' }}>🇺🇦</span><span style={s.mono}>ДЕНЬ ДЕРЖАВНОГО ПРАПОРА</span></>,
      heading: <>Під одним прапором —<br />сильні команди</>,
      sub: 'IDA допомагає українським компаніям збирати найкращі команди під синьо-жовтим прапором.',
      extraBtn: (
        <button onClick={() => alert('Слава Україні!')} style={s.btnHeroGhost}>
          Слава Україні! 🇺🇦
        </button>
      ),
      pricingSubtitle: 'Спеціальна пропозиція до Дня Прапора 🇺🇦',
      footerText: 'Слава Україні! 🇺🇦',
      ctaHeading: 'Готові зміцнити свою команду?',
      navbarBg: '#005BBB',
      navbarBorder: 'rgba(255,255,255,0.2)',
      navbarColor: 'white',
    },
  };

  const defaultContent = {
    badge: null,
    heading: <>Закривайте вакансії<br />швидше. Без хаосу.</>,
    sub: 'Українська ATS з Kanban-дошкою, потужною аналітикою та Google-інтеграціями. Прозорий процес найму — від першого резюме до офера.',
    extraBtn: null,
    pricingSubtitle: 'Оберіть план, що підходить вашій команді',
    footerText: '',
    ctaHeading: 'Готові розпочати?',
    navbarBg: 'rgba(250,250,249,0.97)',
    navbarBorder: '#e5e2de',
    navbarColor: '#18181b',
  };

  const tc = (activeTheme?.name && themeContent[activeTheme.name])
    ? themeContent[activeTheme.name]
    : defaultContent;

  const features = [
    { icon: '📋', title: 'Kanban-дошка', desc: 'Drag-and-drop, власні етапи воронки, масові дії та автоматичні переходи між статусами.' },
    { icon: '📊', title: 'Аналітика', desc: 'Time-to-hire, конверсія по етапах, ефективність кожного рекрутера та джерел трафіку.' },
    { icon: '📅', title: 'Календар інтерв\'ю', desc: 'Синхронізація з Google Calendar, автоматичні нагадування кандидату і рекрутеру.' },
    { icon: '📧', title: 'Email-шаблони', desc: 'Автоматичні листи через Gmail API. Запрошення, відмови, офери — одним кліком.' },
    { icon: '👥', title: 'Управління командою', desc: 'Ролі admin та HR, розмежування доступу до вакансій всередині організації.' },
    { icon: '🔍', title: 'Пошук та фільтри', desc: 'Швидкий пошук по кандидатах, фільтрація по тегах, джерелах і статусах.' },
  ];

  const faqs = [
    { q: 'Скільки часу займає впровадження?', a: '1–3 дні. Ми допомагаємо з імпортом даних і першим онбордингом. Більшість клієнтів починають наступного дня.' },
    { q: 'Чи є мобільний доступ?', a: 'Так. Інтерфейс повністю адаптивний. Мобільна версія підтримує Kanban-дошку, кандидатів і сповіщення.' },
    { q: 'Як працює безкоштовний пробний період?', a: '14 днів повного доступу до Growth — без обмежень і без карти. Після — обираєте тариф або залишаєтесь на Starter.' },
    { q: 'Чи можна імпортувати кандидатів з Excel?', a: 'Так. IDA ATS підтримує імпорт з CSV/Excel. Допомагаємо з міграцією з інших систем індивідуально.' },
    { q: 'Де зберігаються дані?', a: 'На серверах в Європі. Відповідаємо вимогам GDPR і українського законодавства про захист персональних даних.' },
  ];

  // ─── Loader ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf9' }}>
        <div style={{ ...s.mono, fontSize: '13px', color: '#aaa', letterSpacing: '0.15em' }}>
          ЗАВАНТАЖЕННЯ...
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh', background: '#fafaf9' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '60px',
        background: tc.navbarBg,
        borderBottom: `1px solid ${tc.navbarBorder}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: primary, color: 'white', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', flexShrink: 0 }}>I</div>
          <span style={{ fontSize: '17px', fontWeight: 700, color: tc.navbarColor, letterSpacing: '-0.01em' }}>IDA ATS</span>
        </div>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: '28px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
             className="nav-links-desktop">
          {[['#features', 'Можливості'], ['#pricing', 'Тарифи'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: '14px', color: tc.navbarColor === 'white' ? 'rgba(255,255,255,0.75)' : '#555', textDecoration: 'none', transition: 'color 0.15s' }}
               onMouseEnter={e => e.target.style.color = tc.navbarColor}
               onMouseLeave={e => e.target.style.color = tc.navbarColor === 'white' ? 'rgba(255,255,255,0.75)' : '#555'}>
              {label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onLogin} style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${tc.navbarBorder}`, background: 'transparent', color: tc.navbarColor, fontWeight: 500, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
            Увійти
          </button>
          <button onClick={handleOpenRegister} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: primary, color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
            Почати безкоштовно
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header style={{ ...heroStyle, color: 'white', overflow: 'hidden' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: 'clamp(64px, 10vw, 112px) clamp(16px, 4vw, 40px) 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '56px', alignItems: 'flex-end' }}>

          {/* Left col */}
          <div style={{ paddingBottom: '72px' }}>
            {tc.badge && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '5px 16px', marginBottom: '28px' }}>
                {tc.badge}
              </div>
            )}
            <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 50px)', fontWeight: 800, lineHeight: 1.13, letterSpacing: '-0.025em', marginBottom: '20px' }}>
              {tc.heading}
            </h1>
            <p style={{ fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.7, color: 'rgba(255,255,255,0.8)', maxWidth: '440px', marginBottom: '36px' }}>
              {tc.sub}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <button onClick={handleOpenRegister} style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', background: 'white', color: primary, fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Почати 14 днів безкоштовно →
              </button>
              <button onClick={scrollToPricing} style={s.btnHeroGhost}>
                Переглянути тарифи
              </button>
              {tc.extraBtn}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
              {['Без кредитної карти', 'Повний доступ до Pro', 'Налаштування за 1 день'].map(t => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#4ade80', fontSize: '11px' }}>●</span>{t}
                </span>
              ))}
            </div>
          </div>

          {/* Right col — Kanban demo */}
          <div style={{ background: '#f5f2ef', borderRadius: '14px 14px 0 0', padding: '18px 18px 0', boxShadow: '0 -6px 32px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />)}
              <span style={{ ...s.mono, fontSize: '11px', color: '#999', marginLeft: '8px' }}>IDA ATS — Kanban</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { label: 'НОВІ', count: 3, bg: '#fce4e8', clr: '#7a1a2e', cards: [{ name: 'Анна Шевченко', role: 'Senior PM', src: 'Work.ua', srcBg: '#fce4e8' }, { name: 'Олег Бондаренко', role: 'DevOps', src: 'LinkedIn', srcBg: '#fce4e8' }] },
                { label: 'СКРИНІНГ', count: 2, bg: '#fff3e0', clr: '#924d0a', cards: [{ name: 'Іван Коваленко', role: 'Frontend', src: 'DOU', srcBg: '#fff3e0' }] },
                { label: 'СПІВБЕСІДА', count: 1, bg: '#e8f4fd', clr: '#1a5a8a', cards: [{ name: 'Марія Петренко', role: 'UX Designer', src: 'Реферал', srcBg: '#e8f4fd' }] },
                { label: 'ОФЕР', count: 1, bg: '#e8f7ee', clr: '#1a6b3a', cards: [{ name: 'Сергій Лисенко', role: 'Backend', src: 'LinkedIn', srcBg: '#e8f7ee' }] },
              ].map(col => (
                <div key={col.label}>
                  <div style={{ ...s.mono, fontSize: '10px', padding: '5px 8px', borderRadius: '6px', marginBottom: '8px', background: col.bg, color: col.clr }}>
                    {col.label} · {col.count}
                  </div>
                  {col.cards.map(card => (
                    <div key={card.name} style={{ background: 'white', borderRadius: '7px', padding: '9px 10px', marginBottom: '7px', border: '1px solid #e8e4e0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>{card.role}</div>
                      <span style={{ fontSize: '9px', ...s.mono, padding: '2px 6px', borderRadius: '3px', background: card.srcBg, color: col.clr }}>{card.src}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </header>

      {/* ── LOGOS STRIP ── */}
      <div style={{ background: 'white', borderTop: '1px solid #e8e4e0', borderBottom: '1px solid #e8e4e0', padding: '24px clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ ...s.mono, fontSize: '11px', color: '#bbb' }}>НАМ ДОВІРЯЮТЬ</span>
          {['SoftServe','EPAM','GlobalLogic','Ciklum','N-iX','Genesis'].map(n => (
            <span key={n} style={{ fontSize: '14px', fontWeight: 600, color: '#ccc', letterSpacing: '-0.01em' }}>{n}</span>
          ))}
        </div>
      </div>

      {/* ── PROBLEM / SOLUTION ── */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
          <div>
            <div style={{ ...s.label, color: primary }}>ПРОБЛЕМА</div>
            <h2 style={s.sectionTitle}>Традиційний рекрутинг губить таланти і час</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: '36px' }}>
              {[
                { icon: '⏳', title: 'Тижні на рутину', desc: 'Ручне сортування резюме, таблиці Excel та розрізнені чати замість єдиного процесу.' },
                { icon: '📉', title: 'Немає видимості', desc: 'Ви не знаєте, де застряє воронка, хто ефективний і чому кандидати відмовляються.' },
                { icon: '🔄', title: 'Кандидати губляться', desc: 'Без автоматизації та єдиного простору хороші люди зникають між етапами.' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f5f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>{item.title}</h3>
                    <p style={{ fontSize: '14px', color: '#777', lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '36px' }}>
            <div style={{ ...s.mono, fontSize: '11px', color: '#f87171', letterSpacing: '0.12em', marginBottom: '24px' }}>IDA ATS ВИРІШУЄ ЦЕ</div>
            {[
              { title: 'Kanban під ваш процес', desc: 'Динамічні етапи, drag-and-drop, автоматичні переходи та сповіщення.' },
              { title: 'Аналітика воронки в реальному часі', desc: 'Конверсія по етапах, час закриття вакансій, ефективність джерел.' },
              { title: 'Google Workspace + Telegram', desc: 'Календар інтерв\'ю, Gmail, Sheets та автоматичні нагадування.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', fontSize: '10px' }}>
                  <span style={{ color: '#4ade80' }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: 'white', padding: 'clamp(64px, 8vw, 96px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ ...s.label, color: primary, display: 'inline-block' }}>МОЖЛИВОСТІ</div>
            <h2 style={{ ...s.sectionTitle, textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>Все для ефективного найму</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {features.map(f => (
              <div key={f.title} style={{ border: '1px solid #e8e4e0', borderRadius: '14px', padding: '26px', transition: 'border-color 0.2s, transform 0.2s' }}
                   onMouseEnter={e => { e.currentTarget.style.borderColor = '#ccc'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                   onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e4e0'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: '28px', marginBottom: '14px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13px', color: '#777', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: primary, padding: 'clamp(56px, 7vw, 80px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', textAlign: 'center' }}>
          {[
            { val: '14 днів', lbl: 'повний безкоштовний доступ' },
            { val: '1 день', lbl: 'час на впровадження' },
            { val: '−40%', lbl: 'час закриття вакансій' },
            { val: '100%', lbl: 'українська підтримка' },
          ].map(stat => (
            <div key={stat.val}>
              <div style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: 'white', letterSpacing: '-0.03em' }}>{stat.val}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>{stat.lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" ref={pricingRef} style={{ background: '#f5f2ef', padding: 'clamp(64px, 8vw, 96px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ ...s.label, color: primary, display: 'inline-block' }}>ТАРИФИ</div>
            <h2 style={{ ...s.sectionTitle, textAlign: 'center', margin: '0 auto 8px' }}>Прозора ціна без сюрпризів</h2>
            <p style={{ fontSize: '15px', color: '#888' }}>{tc.pricingSubtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '920px', margin: '0 auto', alignItems: 'start' }}>

            {/* Starter */}
            {pricing?.starter && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8e4e0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...s.mono, fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>STARTER</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                  {getPlanPrice('starter')?.monthly === 0 ? '0 ₴' : `${getPlanPrice('starter')?.monthly} ₴`}
                  {getPlanPrice('starter')?.monthly > 0 && <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>/міс</span>}
                </div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>До {pricing.starter.limits?.max_hr || 1} HR, {pricing.starter.limits?.max_vacancies || 5} вакансій</div>
                <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  <li style={s.featureOn}>✓ До {pricing.starter.limits?.max_hr || 1} HR</li>
                  <li style={s.featureOn}>✓ {pricing.starter.limits?.max_vacancies || 5} вакансій</li>
                  <li style={s.featureOn}>✓ Kanban-дошка</li>
                  <li style={s.featureOff}>✗ Аналітика</li>
                  <li style={s.featureOff}>✗ Email-шаблони</li>
                  <li style={s.featureOff}>✗ Google Calendar</li>
                </ul>
                <button onClick={handleOpenRegister} style={{ ...s.btnPlanOutline, borderColor: primary, color: primary }}>
                  Почати безкоштовно
                </button>
              </div>
            )}

            {/* Growth */}
            {pricing?.growth && (
              <div style={{ background: primary, borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 48px -12px rgba(0,0,0,0.3)' }}>
                <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#facc15', color: '#7f1d1d', ...s.mono, fontSize: '10px', fontWeight: 700, padding: '3px 16px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
                  РЕКОМЕНДУЄМО
                </div>
                <div style={{ ...s.mono, fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>GROWTH</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                  {getPlanPrice('growth')?.monthly} ₴
                  <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>/міс</span>
                </div>
                {(pricing.growth.discount > 0 || appliedPromo) && (
                  <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>
                    знижка з {getPlanPrice('growth')?.originalMonthly} ₴
                  </div>
                )}
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>До {pricing.growth.limits?.max_hr} HR, необмежені вакансії</div>
                <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ До {pricing.growth.limits?.max_hr} HR</li>
                  <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ {pricing.growth.limits?.max_vacancies === 0 ? 'Необмежені' : pricing.growth.limits?.max_vacancies} вакансії</li>
                  {pricing.growth.features?.analytics && <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ Повна аналітика</li>}
                  {pricing.growth.features?.email_templates && <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ Email-шаблони</li>}
                  {pricing.growth.features?.google_integration && <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ Google інтеграції</li>}
                  <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ Календар інтерв'ю</li>
                  <li style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>✓ Аудит-лог дій</li>
                </ul>
                <button
                  onClick={() => { setSelectedPlan('growth'); setShowPromoModal(true); }}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'white', color: primary, fontWeight: 700, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
                >
                  Обрати Growth
                </button>
              </div>
            )}

            {/* Enterprise */}
            {pricing?.enterprise && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '32px', border: '1px solid #e8e4e0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...s.mono, fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>ENTERPRISE</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>Індивідуально</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Для великих команд</div>
                <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {['Необмежена кількість HR','Необмежені вакансії','Кастомізація системи','Пріоритетна підтримка','SLA-гарантії','Виділений менеджер'].map(f => (
                    <li key={f} style={s.featureOn}>✓ {f}</li>
                  ))}
                </ul>
                <button
                  onClick={() => alert('Зв\'яжіться: support@ida-ats.com')}
                  style={{ ...s.btnPlanOutline, borderColor: '#d4d4d8', color: '#555' }}
                >
                  Написати нам
                </button>
              </div>
            )}
          </div>

          {/* Promo code */}
          <div style={{ maxWidth: '420px', margin: '40px auto 0', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px' }}>Є промо-код? Знижка застосується до всіх тарифів</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="ПРОМО-КОД"
                value={promoCodeInput}
                onChange={e => { setPromoCodeInput(e.target.value.toUpperCase()); setPromoCodeResult(null); }}
                onKeyDown={e => e.key === 'Enter' && verifyPromoCode()}
                style={{ flex: 1, padding: '11px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', fontFamily: "'DM Mono', monospace", outline: 'none', background: 'white' }}
              />
              <button
                onClick={verifyPromoCode}
                disabled={!promoCodeInput.trim()}
                style={{ padding: '11px 20px', borderRadius: '8px', border: 'none', background: '#1a1a1a', color: 'white', fontSize: '13px', fontWeight: 600, cursor: promoCodeInput.trim() ? 'pointer' : 'not-allowed', opacity: promoCodeInput.trim() ? 1 : 0.5, fontFamily: 'inherit' }}
              >
                Застосувати
              </button>
            </div>
            {promoCodeResult && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: promoCodeResult.valid ? '#16a34a' : '#dc2626' }}>
                {promoCodeResult.valid ? '✓ ' : '✗ '}{promoCodeResult.message}
              </div>
            )}
            {appliedPromo && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#16a34a' }}>
                Знижка {appliedPromo.discount_value}{appliedPromo.discount_type === 'percent' ? '%' : ' грн'} застосована
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ background: 'white', padding: 'clamp(64px, 8vw, 96px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ ...s.label, color: primary, display: 'inline-block' }}>FAQ</div>
            <h2 style={{ ...s.sectionTitle, textAlign: 'center' }}>Часті питання</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ background: '#fafaf9', border: `1px solid ${openFaq === i ? '#ccc' : '#e8e4e0'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', padding: '18px 22px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#1a1a1a' }}>{faq.q}</span>
                  <span style={{ color: '#aaa', fontSize: '20px', flexShrink: 0, marginLeft: '12px', transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 22px 18px', fontSize: '14px', color: '#666', lineHeight: 1.7, borderTop: '1px solid #f0ede9' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#1a1a1a', color: 'white', padding: 'clamp(80px, 10vw, 112px) clamp(16px, 4vw, 40px)', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: '16px' }}>{tc.ctaHeading}</h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.45)', marginBottom: '40px' }}>
            {activeTheme?.accent_color ? <span style={{ color: activeTheme.accent_color }}>14 днів повноцінного доступу безкоштовно</span> : '14 днів повноцінного доступу безкоштовно'}
          </p>
          <button
            onClick={handleOpenRegister}
            style={{ padding: '16px 36px', borderRadius: '12px', background: primary, color: 'white', fontWeight: 700, fontSize: '16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Почати безкоштовний період →
          </button>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginTop: '20px' }}>
            Без карти · Скасування в будь-який момент
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111', color: '#555', padding: 'clamp(48px, 6vw, 64px) clamp(16px, 4vw, 40px) 32px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', paddingBottom: '48px', borderBottom: '1px solid #222' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '26px', height: '26px', background: primary, color: 'white', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px' }}>I</div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>IDA ATS</span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.7 }}>Українська ATS нового покоління.<br />Зроблено в Україні, для українських команд.</p>
            </div>
            {[
              { title: 'ПРОДУКТ', links: [['#features','Можливості'],['#pricing','Тарифи'],['#faq','FAQ']] },
              { title: 'КОМПАНІЯ', links: [['#','Про нас'],['#','Блог'],['#','Контакти']] },
              { title: 'ПІДТРИМКА', links: [['mailto:support@ida-ats.com','support@ida-ats.com'],['#','Документація']] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ ...s.mono, fontSize: '11px', color: '#444', letterSpacing: '0.08em', marginBottom: '16px' }}>{col.title}</div>
                {col.links.map(([href, label]) => (
                  <a key={label} href={href} style={{ display: 'block', fontSize: '13px', color: '#555', textDecoration: 'none', marginBottom: '10px' }}
                     onMouseEnter={e => e.target.style.color = 'white'}
                     onMouseLeave={e => e.target.style.color = '#555'}>
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: '24px', fontSize: '12px', textAlign: 'center' }}>
            © 2026 IDA Systems. {tc.footerText}
          </div>
        </div>
      </footer>

      {/* ── PROMO MODAL ── */}
      {showPromoModal && selectedPlan && pricing?.[selectedPlan] && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setShowPromoModal(false)}
        >
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ ...s.mono, fontSize: '11px', color: '#aaa', marginBottom: '12px' }}>
              {selectedPlan.toUpperCase()}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>
              {getPlanPrice(selectedPlan)?.monthly} ₴
              <span style={{ fontSize: '14px', fontWeight: 400, color: '#888' }}>/міс</span>
            </div>
            {appliedPromo && (
              <div style={{ fontSize: '13px', color: '#16a34a', marginBottom: '16px' }}>
                Знижка {appliedPromo.discount_value}{appliedPromo.discount_type === 'percent' ? '%' : ' грн'} застосована
              </div>
            )}
            <p style={{ fontSize: '14px', color: '#888', marginTop: '12px', lineHeight: 1.6 }}>
              Після реєстрації ви отримаєте 14 днів повного доступу безкоштовно.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button
                onClick={() => { setShowPromoModal(false); setSelectedPlan(null); }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e8e4e0', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', color: '#555' }}
              >
                Скасувати
              </button>
              <button
                onClick={() => { setShowPromoModal(false); setSelectedPlan(null); handleOpenRegister(); }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: primary, color: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}
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

// ─── Shared style tokens ───────────────────────────────────────────────────────
const s = {
  mono: { fontFamily: "'DM Mono', 'Courier New', monospace" },
  label: { fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' },
  sectionTitle: { fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2, color: '#1a1a1a' },
  featureOn: { fontSize: '13px', color: '#444' },
  featureOff: { fontSize: '13px', color: '#ccc' },
  btnPlanOutline: { width: '100%', padding: '13px', borderRadius: '10px', fontWeight: 600, border: '1px solid', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', inherit" },
  btnHeroGhost: { padding: '14px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: 'white', fontWeight: 500, fontSize: '15px', cursor: 'pointer', fontFamily: "'DM Sans', inherit" },
};

export default Landing;