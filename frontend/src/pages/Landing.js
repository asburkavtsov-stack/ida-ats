import React from 'react';

const Landing = ({ onLogin }) => {
  return (
    <div className="bg-zinc-50 text-zinc-900 min-h-screen font-sans">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          body {
            font-family: 'DM Sans', system-ui, sans-serif;
          }
          .mono {
            font-family: 'DM Mono', monospace;
          }
        `}
      </style>

      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#7a1a2e] text-white font-bold text-2xl flex items-center justify-center rounded-2xl">I</div>
            <span className="text-2xl font-semibold tracking-tighter">IDA</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-[#7a1a2e] transition-colors">Функції</a>
            <a href="#pricing" className="hover:text-[#7a1a2e] transition-colors">Ціни</a>
            <a href="#for-who" className="hover:text-[#7a1a2e] transition-colors">Для кого</a>
            <a href="#demo" className="hover:text-[#7a1a2e] transition-colors">Демо</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="text-sm font-medium px-6 py-2.5 rounded-full border hover:bg-zinc-50 transition"
            >
              Увійти
            </button>
            <button 
              onClick={onLogin}
              className="bg-[#7a1a2e] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#5f1424] transition"
            >
              Почати безкоштовно
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-bg text-white py-28" style={{
        background: 'linear-gradient(135deg, #7a1a2e 0%, #4a0f1c 100%)'
      }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2 rounded-3xl mb-8">
            <span className="text-yellow-300">●</span>
            <span className="mono text-sm tracking-widest">Українська ATS</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold leading-tight tracking-tighter mb-8">
            Рекрутинг,<br />який <span className="text-[#e8a0b0]">працює</span> на тебе
          </h1>
          
          <p className="text-xl md:text-2xl max-w-2xl mx-auto text-zinc-200 mb-12">
            Сучасна українська система для найму. Кандидати, канбан, інтерв'ю, аналітика та шаблони листів — в одному інтерфейсі.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onLogin}
              className="bg-white text-[#7a1a2e] font-semibold px-10 py-4 rounded-2xl text-lg hover:bg-zinc-100 transition text-center"
            >
              Почати безкоштовно — 14 днів
            </button>
            <button 
              onClick={() => window.open('#demo', '_self')}
              className="border border-white/50 hover:bg-white/10 font-medium px-10 py-4 rounded-2xl text-lg transition flex items-center justify-center gap-3"
            >
              <i className="fas fa-play"></i> Подивитись демо
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-10 hover:border-[#7a1a2e]/30 transition-all group">
              <div className="text-4xl mb-6">👥</div>
              <h3 className="text-2xl font-semibold mb-3">Кандидати</h3>
              <p className="text-zinc-600">Зручна база, фільтри, теги, історія змін статусів, масовий імпорт CSV.</p>
            </div>

            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-10 hover:border-[#7a1a2e]/30 transition-all group">
              <div className="text-4xl mb-6">📋</div>
              <h3 className="text-2xl font-semibold mb-3">Канбан-дошка</h3>
              <p className="text-zinc-600">Візуальне управління процесом найму. Перетягуй кандидатів між етапами.</p>
            </div>

            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-10 hover:border-[#7a1a2e]/30 transition-all group">
              <div className="text-4xl mb-6">📅</div>
              <h3 className="text-2xl font-semibold mb-3">Інтерв'ю</h3>
              <p className="text-zinc-600">Планування, синхронізація з Google Calendar, Meet, історія співбесід.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-zinc-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Оберіть свій тариф</h2>
            <p className="text-zinc-600">Прості та прозорі тарифи</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-3xl p-8 border border-zinc-200 flex flex-col h-full">
              <div className="mono text-sm font-medium text-zinc-500 mb-2">STARTER</div>
              <div className="text-3xl font-semibold text-[#7a1a2e] mb-8">Базовий</div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> 3 рекрутера</li>
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> Базовий канбан та аналітика</li>
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> Google інтеграції</li>
              </ul>
              
              <button 
                onClick={onLogin}
                className="w-full py-4 border border-zinc-300 rounded-2xl font-semibold hover:bg-zinc-50 transition"
              >
                Обрати Starter
              </button>
            </div>

            {/* Growth */}
            <div className="bg-[#7a1a2e] text-white rounded-3xl p-8 flex flex-col h-full relative scale-105 shadow-xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-red-900 px-6 py-1 rounded-full text-xs font-bold mono">РЕКОМЕНДУЄМО</div>
              
              <div className="mono text-sm font-medium opacity-75 mb-2">GROWTH</div>
              <div className="text-3xl font-semibold mb-8">Розширений</div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3"><i className="fas fa-check"></i> До 10 HR</li>
                <li className="flex items-center gap-3"><i className="fas fa-check"></i> Необмежені вакансії</li>
                <li className="flex items-center gap-3"><i className="fas fa-check"></i> Повна аналітика</li>
                <li className="flex items-center gap-3"><i className="fas fa-check"></i> Шаблони листів</li>
              </ul>
              
              <button 
                onClick={onLogin}
                className="w-full bg-white text-[#7a1a2e] py-4 rounded-2xl font-semibold"
              >
                Обрати Growth
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-3xl p-8 border border-zinc-200 flex flex-col h-full">
              <div className="mono text-sm font-medium text-zinc-500 mb-2">ENTERPRISE</div>
              <div className="text-3xl font-semibold mb-8">Індивідуальний</div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> Необмежена кількість HR</li>
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> Кастомізація системи</li>
                <li className="flex items-center gap-3"><i className="fas fa-check text-green-600"></i> Пріоритетна підтримка</li>
              </ul>
              
              <button 
                onClick={() => window.location.href = 'mailto:sales@ida.com'}
                className="w-full py-4 border border-zinc-300 rounded-2xl font-semibold hover:bg-zinc-50 transition"
              >
                Написати нам
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#7a1a2e] text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6">Готові оптимізувати свій рекрутинг?</h2>
          <p className="text-xl mb-10 text-red-100">14 днів повноцінного доступу безкоштовно</p>
          <button 
            onClick={onLogin}
            className="inline-block bg-white text-[#7a1a2e] font-semibold px-12 py-5 rounded-2xl text-lg hover:bg-zinc-100 transition"
          >
            Почати безкоштовний період
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-400 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex justify-center items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-[#7a1a2e] text-white font-bold text-3xl flex items-center justify-center rounded-2xl">I</div>
            <span className="text-3xl font-semibold text-white">IDA</span>
          </div>
          <p className="mono text-sm">Сучасна українська ATS-система</p>
          <div className="text-xs mt-12 opacity-50">© 2026 IDA Systems. Усі права захищені.</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;