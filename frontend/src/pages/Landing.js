import React from 'react';

const Landing = ({ onLogin }) => {
  return (
    <div style={{ background: '#fafafa', color: '#18181b', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          body { margin: 0; padding: 0; font-family: 'DM Sans', system-ui, sans-serif; }
          .mono { font-family: 'DM Mono', monospace; }
        `}
      </style>

      {/* Navbar */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #e4e4e7', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: '#7a1a2e', color: 'white', fontWeight: 'bold', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>I</div>
            <span style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.025em' }}>IDA</span>
          </div>
          
          <div style={{ display: 'none', alignItems: 'center', gap: '32px', fontSize: '14px', fontWeight: 500 }}>
            <a href="#features" style={{ color: '#18181b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#7a1a2e'} onMouseOut={e => e.target.style.color = '#18181b'}>Функції</a>
            <a href="#pricing" style={{ color: '#18181b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#7a1a2e'} onMouseOut={e => e.target.style.color = '#18181b'}>Ціни</a>
            <a href="#for-who" style={{ color: '#18181b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#7a1a2e'} onMouseOut={e => e.target.style.color = '#18181b'}>Для кого</a>
            <a href="#demo" style={{ color: '#18181b', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = '#7a1a2e'} onMouseOut={e => e.target.style.color = '#18181b'}>Демо</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onLogin}
              style={{ fontSize: '14px', fontWeight: 500, padding: '10px 24px', borderRadius: '9999px', border: '1px solid #d4d4d8', background: 'transparent', cursor: 'pointer', color: '#18181b', transition: 'background 0.2s' }}
              onMouseOver={e => e.target.style.background = '#fafafa'}
              onMouseOut={e => e.target.style.background = 'transparent'}
            >
              Увійти
            </button>
            <button 
              onClick={onLogin}
              style={{ background: '#7a1a2e', color: 'white', padding: '10px 24px', borderRadius: '9999px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.target.style.background = '#5f1424'}
              onMouseOut={e => e.target.style.background = '#7a1a2e'}
            >
              Почати безкоштовно
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #7a1a2e 0%, #4a0f1c 100%)', color: 'white', padding: '112px 24px' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', padding: '8px 20px', borderRadius: '24px', marginBottom: '32px' }}>
            <span style={{ color: '#fde047' }}>●</span>
            <span className="mono" style={{ fontSize: '14px', letterSpacing: '0.15em' }}>Українська ATS</span>
          </div>
          
          <h1 style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: '32px' }}>
            Рекрутинг,<br />який <span style={{ color: '#e8a0b0' }}>працює</span> на тебе
          </h1>
          
          <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)', maxWidth: '42rem', margin: '0 auto 48px', color: '#e4e4e7', lineHeight: 1.6 }}>
            Сучасна українська система для найму. Кандидати, канбан, інтерв'ю, аналітика та шаблони листів — в одному інтерфейсі.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              onClick={onLogin}
              style={{ background: 'white', color: '#7a1a2e', fontWeight: 600, padding: '16px 40px', borderRadius: '16px', fontSize: '18px', border: 'none', cursor: 'pointer', transition: 'background 0.2s', textAlign: 'center' }}
              onMouseOver={e => e.target.style.background = '#f4f4f5'}
              onMouseOut={e => e.target.style.background = 'white'}
            >
              Почати безкоштовно — 14 днів
            </button>
            <button 
              onClick={() => window.open('#demo', '_self')}
              style={{ border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: 'white', fontWeight: 500, padding: '16px 40px', borderRadius: '16px', fontSize: '18px', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
              onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
            >
              <span>▶</span> Подивитись демо
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
              <div key={i} style={{ background: '#fafafa', border: '1px solid #f4f4f5', borderRadius: '24px', padding: '40px', transition: 'border-color 0.3s', cursor: 'default' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(122,26,46,0.3)'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#f4f4f5'}
              >
                <div style={{ fontSize: '40px', marginBottom: '24px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>{f.title}</h3>
                <p style={{ color: '#52525b', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '96px 24px', background: '#f4f4f5' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '16px' }}>Оберіть свій тариф</h2>
            <p style={{ color: '#52525b' }}>Прості та прозорі тарифи</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', maxWidth: '64rem', margin: '0 auto' }}>
            {/* Starter */}
            <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>STARTER</div>
              <div style={{ fontSize: '30px', fontWeight: 600, color: '#7a1a2e', marginBottom: '32px' }}>Базовий</div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> 3 рекрутера</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> Базовий канбан та аналітика</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> Google інтеграції</li>
              </ul>
              
              <button 
                onClick={onLogin}
                style={{ width: '100%', padding: '16px', border: '1px solid #d4d4d8', borderRadius: '16px', fontWeight: 600, background: 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseOver={e => e.target.style.background = '#fafafa'}
                onMouseOut={e => e.target.style.background = 'transparent'}
              >
                Обрати Starter
              </button>
            </div>

            {/* Growth */}
            <div style={{ background: '#7a1a2e', color: 'white', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', transform: 'scale(1.05)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', background: '#facc15', color: '#7f1d1d', padding: '4px 24px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700 }} className="mono">РЕКОМЕНДУЄМО</div>
              
              <div className="mono" style={{ fontSize: '14px', fontWeight: 500, opacity: 0.75, marginBottom: '8px' }}>GROWTH</div>
              <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '32px' }}>Розширений</div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ До 10 HR</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ Необмежені вакансії</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ Повна аналітика</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>✓ Шаблони листів</li>
              </ul>
              
              <button 
                onClick={onLogin}
                style={{ width: '100%', background: 'white', color: '#7a1a2e', padding: '16px', borderRadius: '16px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Обрати Growth
              </button>
            </div>

            {/* Enterprise */}
            <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>ENTERPRISE</div>
              <div style={{ fontSize: '30px', fontWeight: 600, marginBottom: '32px' }}>Індивідуальний</div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> Необмежена кількість HR</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> Кастомізація системи</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#16a34a' }}>✓</span> Пріоритетна підтримка</li>
              </ul>
              
              <button 
                onClick={() => window.location.href = 'mailto:sales@ida.com'}
                style={{ width: '100%', padding: '16px', border: '1px solid #d4d4d8', borderRadius: '16px', fontWeight: 600, background: 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseOver={e => e.target.style.background = '#fafafa'}
                onMouseOut={e => e.target.style.background = 'transparent'}
              >
                Написати нам
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', background: '#7a1a2e', color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '24px' }}>Готові оптимізувати свій рекрутинг?</h2>
          <p style={{ fontSize: '20px', marginBottom: '40px', color: '#fecaca' }}>14 днів повноцінного доступу безкоштовно</p>
          <button 
            onClick={onLogin}
            style={{ display: 'inline-block', background: 'white', color: '#7a1a2e', fontWeight: 600, padding: '20px 48px', borderRadius: '16px', fontSize: '18px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={e => e.target.style.background = '#f4f4f5'}
            onMouseOut={e => e.target.style.background = 'white'}
          >
            Почати безкоштовний період
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#18181b', color: '#a1a1aa', padding: '64px 24px' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', background: '#7a1a2e', color: 'white', fontWeight: 'bold', fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>I</div>
            <span style={{ fontSize: '30px', fontWeight: 600, color: 'white' }}>IDA</span>
          </div>
          <p className="mono" style={{ fontSize: '14px' }}>Сучасна українська ATS-система</p>
          <div style={{ fontSize: '12px', marginTop: '48px', opacity: 0.5 }}>© 2026 IDA Systems. Усі права захищені.</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;