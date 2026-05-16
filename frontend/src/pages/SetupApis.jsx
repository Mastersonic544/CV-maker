import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usersClient } from '../api/client';
import { Key, CheckCircle2, ArrowRight, Eye, EyeOff, Loader2, ExternalLink, Lock } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const KEY_META = {
  LINKEDIN_EMAIL: {
    hint: 'Your LinkedIn login email — enables job scraping and Easy Apply.',
    url: 'https://linkedin.com',
    required: false,
  },
  LINKEDIN_PASSWORD: {
    hint: 'Stored encrypted locally. Never transmitted. Required for Easy Apply.',
    url: 'https://linkedin.com',
    required: false,
  },
  BREVO_SMTP_USER: {
    hint: 'Brevo SMTP login for emailing applications directly.',
    url: 'https://app.brevo.com',
    required: false,
  },
  BREVO_SMTP_PASSWORD: {
    hint: 'Find this in Brevo → SMTP and API → SMTP Keys.',
    url: 'https://app.brevo.com',
    required: false,
  },
};

const SetupApis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const userId = location.state?.userId || localStorage.getItem('cvmaker_active_user');

  const [keys, setKeys] = useState([]);
  const [values, setValues] = useState({});
  const [show, setShow] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { navigate('/select-profile', { replace: true }); return; }
    usersClient.getApiKeysMeta(userId)
      .then(data => {
        setKeys(data);
        const init = {};
        data.forEach(k => { init[k.key] = ''; });
        setValues(init);
      })
      .finally(() => setLoading(false));
  }, [userId, navigate]);

  const handleFinish = async () => {
    setSaving(true);
    const results = {};
    for (const k of keys) {
      const val = (values[k.key] || '').trim();
      if (!val) continue;
      try {
        await usersClient.setApiKey(userId, k.key, val);
        results[k.key] = true;
      } catch {
        results[k.key] = false;
      }
    }
    setDone(results);
    setSaving(false);
    navigate('/dashboard', { replace: true });
  };

  const filledCount = Object.values(values).filter(v => v.trim()).length;

  if (loading) return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--cv-bg)' }}
    >
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  const KeyCard = ({ k }) => {
    const meta = KEY_META[k.key] || {};
    const isPassword = k.key.toLowerCase().includes('password') || k.key.toLowerCase().includes('token') || k.key.toLowerCase().includes('key');
    const val = values[k.key] || '';
    const filled = !!val.trim();

    return (
      <div
        className="p-4 transition-all duration-200"
        style={{
          background: filled ? 'rgba(var(--cv-cyan-rgb), 0.03)' : 'var(--cv-card-bg)',
          border: `1px solid ${filled ? 'rgba(var(--cv-cyan-rgb), 0.35)' : 'var(--cv-border)'}`,
          borderLeft: `2px solid ${meta.required ? 'var(--cv-cyan)' : 'var(--cv-border)'}`,
        }}
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="font-syne"
                style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '-0.01em', color: 'var(--cv-text)' }}
              >
                {k.label}
              </p>
              <span
                className="font-dm px-1.5 py-0.5"
                style={{
                  fontSize: '0.5rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: meta.required ? 'var(--cv-cyan)' : 'var(--cv-muted)',
                  background: meta.required ? 'rgba(var(--cv-cyan-rgb), 0.08)' : 'var(--cv-card-bg)',
                  border: `1px solid ${meta.required ? 'rgba(var(--cv-cyan-rgb), 0.25)' : 'var(--cv-border)'}`,
                }}
              >
                {meta.required ? 'Required' : 'Optional'}
              </span>
            </div>
            <p
              className="font-dm mt-1"
              style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.55)', lineHeight: 1.55 }}
            >
              {meta.hint}
            </p>
            <p
              className="font-dm mt-1.5"
              style={{
                fontSize: '0.55rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(var(--cv-text-rgb), 0.28)',
              }}
            >
              {k.key}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {filled && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />}
            {!filled && meta.url && (
              <a
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 transition-colors"
                style={{
                  color: 'var(--cv-muted)',
                  border: '1px solid var(--cv-border)',
                }}
                title="Get your key"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="relative">
          <input
            type={show[k.key] ? 'text' : (isPassword ? 'password' : 'text')}
            value={val}
            onChange={e => setValues(prev => ({ ...prev, [k.key]: e.target.value }))}
            placeholder={k.is_set ? '(configured. leave blank to keep)' : `Paste your ${k.label}`}
            className="cv-input pr-10 font-dm"
            style={{ fontSize: '0.72rem' }}
          />
          {isPassword && (
            <button
              onClick={() => setShow(prev => ({ ...prev, [k.key]: !prev[k.key] }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--cv-muted)' }}
            >
              {show[k.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-16 relative"
      style={{
        background: 'var(--cv-bg)',
        fontFamily: "'DM Mono', monospace",
        color: 'var(--cv-text)',
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(var(--cv-cyan-rgb), 0.07) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: 'radial-gradient(ellipse 60% 70% at 50% 30%, rgba(0,0,0,0.7), transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 50% 30%, rgba(0,0,0,0.7), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-lg cv-reveal">
        {/* Brand */}
        <div className="flex items-center justify-center mb-3">
          <span
            className="font-syne"
            style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--cv-text)' }}
          >
            CV<span style={{ color: 'var(--cv-cyan)' }}>.</span>MAKER
          </span>
        </div>

        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            {t('setup_phase')}
          </span>
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
        </div>

        {/* Title */}
        <div className="text-center mb-3">
          <div
            className="inline-flex items-center justify-center mb-5"
            style={{
              width: 56, height: 56,
              background: 'rgba(var(--cv-cyan-rgb), 0.06)',
              border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)',
            }}
          >
            <Key className="w-6 h-6" style={{ color: 'var(--cv-cyan)' }} />
          </div>
          <h1
            className="font-syne"
            style={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}
          >
            {t('setup_title')}
          </h1>
          <p
            className="font-dm mt-3 max-w-md mx-auto"
            style={{ fontSize: '0.7rem', lineHeight: 1.7, color: 'rgba(var(--cv-text-rgb), 0.55)' }}
          >
            {t('setup_subtitle')}
          </p>
        </div>

        {/* Encryption pill */}
        <div className="flex justify-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5"
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            <Lock className="w-3 h-3" style={{ color: '#10b981' }} />
            <span
              className="font-dm"
              style={{
                fontSize: '0.55rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#10b981',
              }}
            >
              {t('setup_encrypted')}
            </span>
          </div>
        </div>

        {/* All keys are optional */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span style={{ width: 16, height: 1, background: 'rgba(var(--cv-text-rgb), 0.32)' }} />
            <p
              className="font-dm"
              style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
            >
              {t('setup_optional_section')}
            </p>
          </div>
          <div className="space-y-3">
            {keys.map(k => <KeyCard key={k.key} k={k} />)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <button
            onClick={handleFinish}
            disabled={saving}
            className="cv-btn-prim w-full flex items-center justify-center gap-2"
            style={{ padding: '1rem 2rem', fontSize: '0.78rem' }}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}</>
              : <>
                  <ArrowRight className="w-4 h-4" />
                  {filledCount > 0
                    ? t('setup_save_keys', { n: filledCount, s: filledCount !== 1 ? 's' : '' })
                    : t('setup_continue')}
                </>
            }
          </button>
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="font-dm transition-colors"
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--cv-muted)',
              background: 'transparent',
              border: 'none',
              padding: '0.5rem 1rem',
            }}
          >
            {t('setup_skip')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupApis;
