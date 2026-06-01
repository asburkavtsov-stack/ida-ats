import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

const ThemeManager = ({ isMobile }) => {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [form, setForm] = useState({
    theme_type: 'default',
    name: '',
    primary_color: '#7a1a2e',
    secondary_color: '#4a0f1c',
    accent_color: '#e8a0b0',
    hero_image: '',
    background_image: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchThemes = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/holiday-themes/');
      setThemes(res.data.results || res.data);
    } catch (err) {
      console.error('Помилка завантаження тем:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleActivate = async (themeId) => {
    try {
      await axios.post('/api/holiday-themes/activate/', { theme_id: themeId });
      await fetchThemes();
    } catch (err) {
      console.error('Помилка активації теми:', err);
      alert('Не вдалося активувати тему');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTheme) {
        await axios.patch(`/api/holiday-themes/${editingTheme.id}/`, form);
      } else {
        await axios.post('/api/holiday-themes/', form);
      }
      setShowModal(false);
      setEditingTheme(null);
      setForm({
        theme_type: 'default',
        name: '',
        primary_color: '#7a1a2e',
        secondary_color: '#4a0f1c',
        accent_color: '#e8a0b0',
        hero_image: '',
        background_image: '',
        start_date: '',
        end_date: '',
        is_active: false,
      });
      await fetchThemes();
    } catch (err) {
      console.error('Помилка збереження:', err);
      alert('Не вдалося зберегти тему');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (themeId) => {
    if (!window.confirm('Видалити тему?')) return;
    try {
      await axios.delete(`/api/holiday-themes/${themeId}/`);
      await fetchThemes();
    } catch (err) {
      console.error('Помилка видалення:', err);
      alert('Не вдалося видалити тему');
    }
  };

  const getThemeIcon = (themeType) => {
    const icons = {
      new_year: '🎄',
      halloween: '🎃',
      independence: '💙💛',
      ida_birthday: '🎂',
      default: '🏠',
    };
    return icons[themeType] || '🎨';
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '0' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🎨 LED-теми</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
            Керування тематичним оформленням (Новорічний, Хеллоуїн, День Незалежності, День ІДА)
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTheme(null);
            setForm({
              theme_type: 'default',
              name: '',
              primary_color: '#7a1a2e',
              secondary_color: '#4a0f1c',
              accent_color: '#e8a0b0',
              hero_image: '',
              background_image: '',
              start_date: '',
              end_date: '',
              is_active: false,
            });
            setShowModal(true);
          }}
          style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
        >
          + Додати тему
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {themes.map(theme => (
            <div key={theme.id} style={{
              background: `linear-gradient(135deg, ${theme.primary_color}10, ${theme.secondary_color}10)`,
              border: `2px solid ${theme.is_active ? theme.primary_color : 'var(--border)'}`,
              borderRadius: '16px',
              padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>{getThemeIcon(theme.theme_type)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{theme.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                      {theme.theme_type_display}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: theme.primary_color, border: '1px solid #fff' }} />
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: theme.secondary_color, border: '1px solid #fff' }} />
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: theme.accent_color, border: '1px solid #fff' }} />
                  </div>

                  {theme.is_active ? (
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, background: '#16a34a20', color: '#16a34a' }}>
                      ✓ АКТИВНА
                    </span>
                  ) : (
                    <button
                      onClick={() => handleActivate(theme.id)}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.72rem', cursor: 'pointer' }}
                    >
                      Увімкнути
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingTheme(theme);
                      setForm({
                        theme_type: theme.theme_type,
                        name: theme.name,
                        primary_color: theme.primary_color,
                        secondary_color: theme.secondary_color,
                        accent_color: theme.accent_color,
                        hero_image: theme.hero_image || '',
                        background_image: theme.background_image || '',
                        start_date: theme.start_date?.split('T')[0] || '',
                        end_date: theme.end_date?.split('T')[0] || '',
                        is_active: theme.is_active,
                      });
                      setShowModal(true);
                    }}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    ✏️ Редагувати
                  </button>
                  <button
                    onClick={() => handleDelete(theme.id)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    🗑 Видалити
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
              {editingTheme ? 'Редагувати тему' : 'Нова тема'}
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px' }}>Тип теми</div>
                <select
                  value={form.theme_type}
                  onChange={e => setForm(f => ({ ...f, theme_type: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontFamily: 'DM Sans' }}
                >
                  <option value="new_year">Новорічний 🎄</option>
                  <option value="halloween">Хеллоуїн 🎃</option>
                  <option value="independence">День Незалежності 💙💛</option>
                  <option value="ida_birthday">День народження ІДА 🎂</option>
                  <option value="default">Звичайний 🏠</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px' }}>Назва</div>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontFamily: 'DM Sans' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>Основний колір</div>
                  <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ width: '100%', height: '40px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>Вторинний колір</div>
                  <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} style={{ width: '100%', height: '40px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>Акцентний колір</div>
                  <input type="color" value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} style={{ width: '100%', height: '40px' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>Скасувати</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeManager;