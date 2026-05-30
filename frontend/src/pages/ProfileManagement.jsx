import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersClient } from '../api/client';
import { useUser } from '../hooks/useUser';
import {
  ArrowLeft, User, Key, FileJson, Save, Trash2,
  ChevronDown, ChevronRight, Copy, Check, Loader2,
  AlertCircle, CheckCircle2, Eye, EyeOff, RefreshCw,
  LogOut, RotateCcw, ExternalLink, Camera, Sparkles,
  PlusCircle, X,
} from 'lucide-react';

// ── Enrich Panel ──────────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are a professional career data extractor. Interview me and extract my professional profile.

Ask me about any of the following that I haven't already told you:
- Full name, location, contact details (email, phone, LinkedIn, GitHub, portfolio)
- Work experience: every role, company, dates, responsibilities, achievements, tech used
- Education: degrees, institutions, dates, grades
- Skills: technical skills, tools, frameworks, languages
- Projects: personal or professional, description, technologies, outcome
- Certifications: name, issuer, date
- Languages spoken
- Career goals, preferred work style, target roles/industries

Once you have gathered enough information (or I say "done"), output ONLY a JSON object in this exact schema — no explanation, no markdown fences, just raw JSON:

{
  "personal_info": {
    "full_name": "", "first_name": "", "last_name": "", "headline": "", "summary": "",
    "contact": { "email": "", "phone": "", "linkedin": "", "github": "", "portfolio": "" },
    "location": { "city": "", "country": "", "remote_open": true, "relocation_open": false },
    "languages": [{ "language": "", "proficiency": "" }]
  },
  "work_experience": [{
    "company": "", "title": "", "start_date": "YYYY-MM", "end_date": "YYYY-MM",
    "is_current": false, "location": "", "responsibilities": [], "achievements": [], "tech_stack": []
  }],
  "education": [{ "institution": "", "degree": "", "field": "", "start_date": "YYYY", "end_date": "YYYY", "grade": "" }],
  "skills": { "technical": [], "soft": [], "tools": [], "frameworks": [] },
  "projects": [{ "name": "", "description": "", "technologies": [], "outcome": "", "url": "" }],
  "certifications": [{ "name": "", "issuer": "", "issued_date": "YYYY-MM" }],
  "personality_and_work_style": { "work_style": "", "strengths": [], "values": [] },
  "preferences_and_goals": {
    "target_roles": [], "target_industries": [], "preferred_locations": [],
    "work_type": "remote", "open_to_relocation": false
  }
}

Start by asking me what I'd like to add or update about my professional profile.`;

const EnrichPanel = ({ userId, onDone }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(EXTRACTION_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      await usersClient.enrichProfile(userId, text.trim());
      setResult('ok');
      setText('');
      onDone();
    } catch (err) {
      setResult('error');
      setErrorMsg(err.message || 'Enrichment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="font-dm flex items-center gap-2 px-4 py-2.5 transition-colors"
      style={{
        fontSize: '0.62rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#a78bfa',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.3)',
      }}
    >
      <PlusCircle className="w-3 h-3" />
      Add more info
    </button>
  );

  return (
    <div
      className="w-full mt-4 p-4 space-y-3"
      style={{
        background: 'rgba(139,92,246,0.04)',
        border: '1px solid rgba(139,92,246,0.25)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a78bfa' }}
          >
            AI Profile Enrichment
          </span>
        </div>
        <button onClick={() => { setOpen(false); setResult(null); setText(''); setCopied(false); }}>
          <X className="w-3.5 h-3.5" style={{ color: 'rgba(var(--cv-text-rgb), 0.4)' }} />
        </button>
      </div>

      {/* Description + copy-prompt CTA */}
      <div
        className="p-3 space-y-2"
        style={{ background: 'rgba(var(--cv-text-rgb), 0.02)', border: '1px solid var(--cv-border)' }}
      >
        <p className="font-dm" style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.55)', lineHeight: 1.6 }}>
          Paste anything — a LinkedIn bio, old CV, a list of projects, job descriptions, certifications, or plain text about yourself.
          The AI will extract only the new information and merge it into your profile.
        </p>
        <div
          className="flex items-start gap-3 pt-2"
          style={{ borderTop: '1px solid var(--cv-border)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-dm" style={{ fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.38)', lineHeight: 1.5 }}>
              <span style={{ color: '#a78bfa' }}>Tip:</span> Copy the extraction prompt below and paste it into ChatGPT, Claude, or any AI chat.
              It will interview you and produce a JSON block — paste that JSON back here.
            </p>
          </div>
          <button
            onClick={handleCopyPrompt}
            className="font-dm flex items-center gap-1.5 px-3 py-1.5 shrink-0 transition-all"
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: copied ? '#34d399' : '#a78bfa',
              background: copied ? 'rgba(52,211,153,0.08)' : 'rgba(139,92,246,0.08)',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(139,92,246,0.3)'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {copied
              ? <><Check className="w-3 h-3" /> Copied!</>
              : <><Copy className="w-3 h-3" /> Copy prompt</>}
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste the JSON (or any raw text) returned by the AI here…"
        rows={7}
        className="cv-input font-dm w-full resize-y"
        style={{ fontSize: '0.7rem', lineHeight: 1.6 }}
      />

      {result === 'ok' && (
        <div
          className="flex items-center gap-2 px-3 py-2 font-dm"
          style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Profile updated — review the new AI-filled fields above.
        </div>
      )}
      {result === 'error' && (
        <div
          className="flex items-center gap-2 px-3 py-2 font-dm"
          style={{ fontSize: '0.65rem', color: '#f87171', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => { setOpen(false); setResult(null); setText(''); }}
          className="font-dm px-4 py-2 transition-colors"
          style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.4)', border: '1px solid var(--cv-border)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="font-dm flex items-center gap-2 px-5 py-2 transition-colors"
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: loading || !text.trim() ? 'rgba(139,92,246,0.4)' : '#a78bfa',
            background: loading || !text.trim() ? 'rgba(139,92,246,0.03)' : 'rgba(139,92,246,0.1)',
            border: `1px solid ${loading || !text.trim() ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.4)'}`,
            cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
            : <><Sparkles className="w-3 h-3" /> Enrich Profile</>}
        </button>
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

const MonoLabel = ({ children, color = 'rgba(var(--cv-text-rgb), 0.55)' }) => (
  <label
    className="block mb-2 font-dm"
    style={{
      fontSize: '0.58rem',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color,
    }}
  >
    {children}
  </label>
);

const MiniAvatar = ({ user, name, color, size = 40, onUpload }) => {
  const [hovering, setHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const resolvedColor = user?.avatar_color || color || '#6C63FF';
  const resolvedName = user?.name || name || '?';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await usersClient.uploadAvatar(user.user_id, file);
      onUpload?.();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className="relative cursor-pointer shrink-0"
      style={{
        width: size, height: size,
        boxShadow: `0 0 0 1px rgba(var(--cv-text-rgb), 0.06), 0 0 12px ${resolvedColor}30`,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => !uploading && fileRef.current?.click()}
      title="Change profile picture"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {user?.has_avatar ? (
        <img
          src={usersClient.getAvatarUrl(user.user_id, user.avatar_updated_at)}
          alt={resolvedName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 0 }}
        />
      ) : (
        <div
          style={{
            width: '100%', height: '100%', background: resolvedColor,
            fontSize: size * 0.36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', userSelect: 'none',
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.02em',
            borderRadius: 0,
          }}
        >
          {getInitials(resolvedName)}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
        style={{
          background: 'rgba(0,0,0,0.52)',
          opacity: hovering || uploading ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        {uploading
          ? <Loader2 className="w-4 h-4 text-white animate-spin" />
          : <Camera className="w-4 h-4 text-white" />
        }
      </div>
    </div>
  );
};

// ── Tab button ──
const TabBtn = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex items-center gap-2 px-4 py-3 transition-all duration-200"
    style={{
      background: 'transparent',
      color: active ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.55)',
      borderBottom: active ? '2px solid var(--cv-cyan)' : '2px solid transparent',
      fontFamily: "'DM Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 500,
    }}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    {label}
  </button>
);

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <MonoLabel>{label}</MonoLabel>
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="cv-input"
    />
  </div>
);

// ── Tab 1: Profile ────────────────────────────────────────────────────────────
const ProfileTab = ({ userId, user }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    usersClient.getProfileJson(userId)
      .then(data => setForm(data?.personal_info || {}))
      .catch(() => setForm({}));
  }, [userId]);

  const setField = (path, val) => {
    setForm(prev => {
      const parts = path.split('.');
      if (parts.length === 1) return { ...prev, [parts[0]]: val };
      return { ...prev, [parts[0]]: { ...(prev[parts[0]] || {}), [parts[1]]: val } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fullName = `${form.first_name || ''} ${form.last_name || ''}`.trim() || form.full_name || '';
      await usersClient.updateProfileJson(userId, { personal_info: { ...form, full_name: fullName } });
      if (fullName) await usersClient.updateUser(userId, { name: fullName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete profile "${user?.name}"? All data will be lost.`)) return;
    setDeleting(true);
    try {
      await usersClient.deleteUser(userId);
      localStorage.removeItem('cvmaker_active_user');
      navigate('/profile-selector', { replace: true });
    } catch (e) {
      alert('Delete failed: ' + e.message);
      setDeleting(false);
    }
  };

  if (!form) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-5">
          <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
          <p
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Personal Information
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" value={form.first_name} onChange={v => setField('first_name', v)} placeholder="Alex" />
          <Field label="Last name" value={form.last_name} onChange={v => setField('last_name', v)} placeholder="Rivera" />
          <div className="col-span-2">
            <Field label="Headline" value={form.headline} onChange={v => setField('headline', v)} placeholder="Software Engineer at Acme" />
          </div>
          <Field label="Email" value={form.contact?.email} onChange={v => setField('contact.email', v)} placeholder="you@example.com" type="email" />
          <Field label="Phone" value={form.contact?.phone} onChange={v => setField('contact.phone', v)} placeholder="+1 234 567 890" />
          <Field label="City" value={form.location?.city} onChange={v => setField('location.city', v)} placeholder="San Francisco" />
          <Field label="Country" value={form.location?.country} onChange={v => setField('location.country', v)} placeholder="USA" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-5">
          <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
          <p
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Links
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="LinkedIn" value={form.contact?.linkedin} onChange={v => setField('contact.linkedin', v)} placeholder="https://linkedin.com/in/..." />
          <Field label="GitHub" value={form.contact?.github} onChange={v => setField('contact.github', v)} placeholder="https://github.com/..." />
          <Field label="Portfolio" value={form.contact?.portfolio} onChange={v => setField('contact.portfolio', v)} placeholder="https://yoursite.com" />
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.location?.remote_open ?? true}
            onChange={e => setField('location.remote_open', e.target.checked)}
            style={{ accentColor: 'var(--cv-cyan)', width: 14, height: 14 }}
          />
          <span className="font-dm" style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.7)' }}>
            Open to remote
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.location?.relocation_open ?? false}
            onChange={e => setField('location.relocation_open', e.target.checked)}
            style={{ accentColor: 'var(--cv-cyan)', width: 14, height: 14 }}
          />
          <span className="font-dm" style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.7)' }}>
            Open to relocation
          </span>
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="cv-btn-purple ml-auto flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving' : saved ? 'Saved' : 'Save changes'}
        </button>
      </div>

      {/* Danger zone */}
      <div
        className="p-5"
        style={{
          background: 'rgba(239,68,68,0.04)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderLeft: '2px solid #f87171',
        }}
      >
        <p
          className="font-dm mb-4"
          style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#f87171' }}
        >
          Danger zone
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              localStorage.removeItem('cvmaker_active_user');
              navigate('/profile-selector', { replace: true });
            }}
            className="cv-btn-ghost flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch profile
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="font-dm flex items-center gap-2 px-4 py-3 transition-colors"
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#f87171',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete profile
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Tab 2: API Keys ───────────────────────────────────────────────────────────
const KEY_INFO = {
  OPENROUTER_API_KEY: {
    url: 'https://openrouter.ai/keys',
    what: 'Powers all AI features — CV generation, HR persona research, cover letters, role suggestions.',
    howTo: ['Go to openrouter.ai/keys', 'Sign in or create a free account', 'Click "Create Key", give it a name, copy it'],
  },
  LINKEDIN_EMAIL: {
    url: 'https://linkedin.com',
    what: 'Your LinkedIn login email. Used to scrape job listings from LinkedIn.',
    howTo: ['Use the same email you log into LinkedIn with'],
  },
  LINKEDIN_PASSWORD: {
    url: 'https://linkedin.com',
    what: 'Your LinkedIn password. Stored encrypted locally, never transmitted anywhere.',
    howTo: ['Use the same password you log into LinkedIn with'],
  },
  SMTP_USER: {
    url: 'https://mail.google.com',
    what: 'Your Gmail address. Emails to HR contacts are sent directly from this address.',
    howTo: ['Enter your full Gmail address — e.g. you@gmail.com'],
  },
  SMTP_PASSWORD: {
    url: 'https://myaccount.google.com/apppasswords',
    what: 'A Gmail App Password — a 16-char code that lets this app send emails without using your real password.',
    howTo: [
      'Go to myaccount.google.com/security',
      'Enable 2-Step Verification if not already on',
      'Go to myaccount.google.com/apppasswords',
      'Name it "cvmaker", click Create',
      'Copy the 16-char code (spaces are fine)',
    ],
  },
  SENDER_NAME: {
    url: null,
    what: 'Your full name as it appears in the From field of outgoing emails.',
    howTo: ['Enter your first and last name — e.g. Yassine Dhouib'],
  },
};

const KeyTooltip = ({ info }) => {
  if (!info) return null;
  return (
    <div
      className="absolute left-0 top-full mt-2 z-50 w-72 p-3 space-y-2 font-dm"
      style={{
        background: 'var(--cv-bg)',
        border: '1px solid var(--cv-cyan)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
      }}
    >
      <p style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.75)', lineHeight: 1.55 }}>
        {info.what}
      </p>
      <div>
        <p style={{ fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cv-cyan)', marginBottom: '0.35rem' }}>
          How to get it
        </p>
        <ol className="space-y-0.5" style={{ paddingLeft: '0.75rem', listStyleType: 'decimal' }}>
          {info.howTo.map((step, i) => (
            <li key={i} style={{ fontSize: '0.62rem', color: 'rgba(var(--cv-text-rgb), 0.6)', lineHeight: 1.5 }}>{step}</li>
          ))}
        </ol>
      </div>
      {info.url && (
        <p style={{ fontSize: '0.55rem', color: 'var(--cv-cyan)', opacity: 0.7 }}>{info.url.replace('https://', '')}</p>
      )}
    </div>
  );
};

const ApiKeysTab = ({ userId }) => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersClient.getApiKeysMeta(userId);
      setKeys(data);
      const init = {};
      data.forEach(k => {
        init[k.key] = { editing: false, input: '', showInput: false, testing: false, testResult: null, saving: false, copied: false };
      });
      setStates(init);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const patchState = (key, patch) => setStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSave = async (k) => {
    const val = (states[k.key]?.input || '').trim();
    if (!val) return;
    patchState(k.key, { saving: true });
    try {
      await usersClient.setApiKey(userId, k.key, val);
      await load();
    } catch (e) { alert(e.message); }
    finally { patchState(k.key, { saving: false, editing: false, input: '' }); }
  };

  const handleDelete = async (k) => {
    if (!confirm(`Remove ${k.label}?`)) return;
    try {
      await usersClient.deleteApiKey(userId, k.key);
      await load();
    } catch (e) { alert(e.message); }
  };

  const handleTest = async (k) => {
    patchState(k.key, { testing: true, testResult: null });
    try {
      let val = (states[k.key]?.input || '').trim();
      if (!val) {
        const decrypted = await usersClient.getApiKeysDecrypted(userId);
        val = decrypted[k.key] || '';
      }
      const result = await usersClient.testApiKey(userId, k.key, val);
      patchState(k.key, { testResult: result });
    } catch (e) {
      patchState(k.key, { testResult: { ok: false, message: e.message } });
    } finally {
      patchState(k.key, { testing: false });
    }
  };

  const handleCopy = async (k) => {
    try {
      const decrypted = await usersClient.getApiKeysDecrypted(userId);
      await navigator.clipboard.writeText(decrypted[k.key] || '');
      patchState(k.key, { copied: true });
      setTimeout(() => patchState(k.key, { copied: false }), 2000);
    } catch (e) { alert(e.message); }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  return (
    <div className="space-y-3">
      {keys.map(k => {
        const s = states[k.key] || {};
        const isSet = k.is_set;
        const info = KEY_INFO[k.key];

        return (
          <div
            key={k.key}
            className="p-4"
            style={{
              background: 'var(--cv-card-bg)',
              border: '1px solid var(--cv-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className="mt-1.5 shrink-0"
                  style={{
                    width: 8, height: 8,
                    background: isSet ? '#10b981' : 'rgba(var(--cv-text-rgb), 0.18)',
                    boxShadow: isSet ? '0 0 8px #10b981' : 'none',
                  }}
                />
                <div className="relative min-w-0">
                  <div
                    className="group inline-block"
                    onMouseEnter={() => patchState(k.key, { showTooltip: true })}
                    onMouseLeave={() => patchState(k.key, { showTooltip: false })}
                    style={{ cursor: 'default' }}
                  >
                    <p
                      className="font-syne"
                      style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cv-text)', letterSpacing: '-0.01em', borderBottom: '1px dashed rgba(var(--cv-text-rgb), 0.2)' }}
                    >
                      {k.label}
                    </p>
                    {s.showTooltip && <KeyTooltip info={info} />}
                  </div>
                  <p
                    className="font-dm mt-0.5"
                    style={{
                      fontSize: '0.55rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(var(--cv-text-rgb), 0.42)',
                    }}
                  >
                    {k.key}
                  </p>
                  {isSet && (
                    <p
                      className="font-dm mt-1.5"
                      style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.32)', letterSpacing: '0.25em' }}
                    >
                      •••••••••••••••
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {info?.url && (
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 transition-colors"
                    style={{
                      color: 'rgba(var(--cv-text-rgb), 0.55)',
                      border: '1px solid var(--cv-border)',
                    }}
                    title="Open docs"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {isSet && (
                  <>
                    <button
                      onClick={() => handleCopy(k)}
                      title="Copy value"
                      className="p-2 transition-colors"
                      style={{
                        color: s.copied ? '#10b981' : 'rgba(var(--cv-text-rgb), 0.55)',
                        border: '1px solid var(--cv-border)',
                      }}
                    >
                      {s.copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleTest(k)}
                      disabled={s.testing}
                      title="Test connection"
                      className="p-2 transition-colors"
                      style={{
                        color: 'rgba(var(--cv-text-rgb), 0.55)',
                        border: '1px solid var(--cv-border)',
                      }}
                    >
                      {s.testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleDelete(k)}
                      title="Remove key"
                      className="p-2 transition-colors"
                      style={{
                        color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => patchState(k.key, { editing: !s.editing })}
                  className="font-dm px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    background: 'rgba(var(--cv-cyan-rgb), 0.08)',
                    color: 'var(--cv-cyan)',
                    border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)',
                  }}
                >
                  {isSet ? 'Update' : 'Set key'}
                </button>
              </div>
            </div>

            {s.editing && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[260px]">
                  <input
                    type={s.showInput ? 'text' : 'password'}
                    value={s.input}
                    onChange={e => patchState(k.key, { input: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSave(k)}
                    placeholder={`Paste ${k.label}`}
                    className="cv-input pr-10"
                    autoFocus
                  />
                  <button
                    onClick={() => patchState(k.key, { showInput: !s.showInput })}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(var(--cv-text-rgb), 0.42)' }}
                  >
                    {s.showInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => handleSave(k)}
                  disabled={!s.input?.trim() || s.saving}
                  className="cv-btn-purple flex items-center gap-2"
                >
                  {s.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            )}

            {s.testResult && (
              <div
                className="mt-3 flex items-center gap-2 px-3 py-2 font-dm"
                style={{
                  fontSize: '0.65rem',
                  background: s.testResult.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${s.testResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: s.testResult.ok ? '#10b981' : '#f87171',
                }}
              >
                {s.testResult.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                }
                {s.testResult.message || (s.testResult.ok ? 'Connection successful' : 'Connection failed')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Tab 3: JSON Editor ────────────────────────────────────────────────────────
const SECTION_TAG = {
  meta: 'META', personal_info: 'PERSONAL', work_experience: 'WORK',
  education: 'EDU', skills: 'SKILLS', projects: 'PROJECTS',
  certifications: 'CERTS', personality_and_work_style: 'STYLE',
  preferences_and_goals: 'GOALS',
};

const JsonSection = ({ sectionKey, value, onSave, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(JSON.stringify(value, null, 2));
    setEditing(true);
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    let parsed;
    try { parsed = JSON.parse(draft); }
    catch { setError('Invalid JSON. Fix syntax errors before saving.'); return; }
    setSaving(true);
    try {
      await onSave(sectionKey, parsed);
      setEditing(false);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const tag = SECTION_TAG[sectionKey] || 'SECTION';
  const label = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const preview = Array.isArray(value)
    ? `${value.length} item${value.length !== 1 ? 's' : ''}`
    : (typeof value === 'object' && value !== null)
      ? `${Object.keys(value).length} fields`
      : String(value);

  return (
    <div
      style={{
        background: 'var(--cv-card-bg)',
        border: '1px solid var(--cv-border)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--cv-text-rgb), 0.02)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        onClick={() => { setOpen(o => !o); if (open) setEditing(false); }}
      >
        <span
          className="font-dm px-1.5 py-0.5 shrink-0"
          style={{
            fontSize: '0.52rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--cv-cyan)',
            background: 'rgba(var(--cv-cyan-rgb), 0.06)',
            border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)',
          }}
        >
          {tag}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="font-syne"
            style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--cv-text)', letterSpacing: '-0.01em' }}
          >
            {label}
          </p>
          <p
            className="font-dm truncate"
            style={{ fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.42)', letterSpacing: '0.04em' }}
          >
            {preview}
          </p>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4" style={{ color: 'rgba(var(--cv-text-rgb), 0.55)' }} />
          : <ChevronRight className="w-4 h-4" style={{ color: 'rgba(var(--cv-text-rgb), 0.55)' }} />}
      </div>

      {open && (
        <div
          className="p-4 space-y-3"
          style={{ borderTop: '1px solid var(--cv-border)', background: 'var(--cv-bg)' }}
        >
          {!editing ? (
            <>
              {/* Code-editor style */}
              <div
                className="overflow-auto custom-scrollbar"
                style={{
                  background: 'var(--cv-bg)',
                  border: '1px solid rgba(var(--cv-text-rgb), 0.05)',
                  maxHeight: 256,
                }}
              >
                <pre
                  className="font-dm"
                  style={{
                    padding: '1rem',
                    fontSize: '0.68rem',
                    color: 'rgba(var(--cv-text-rgb), 0.78)',
                    lineHeight: 1.65,
                  }}
                >
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={startEdit}
                  className="font-dm px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    background: 'rgba(var(--cv-cyan-rgb), 0.06)',
                    color: 'var(--cv-cyan)',
                    border: '1px solid rgba(var(--cv-cyan-rgb), 0.25)',
                  }}
                >
                  Edit section
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(sectionKey); }}
                  className="font-dm px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    background: 'rgba(239,68,68,0.04)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={draft}
                onChange={e => { setDraft(e.target.value); setError(''); }}
                rows={12}
                className="cv-input custom-scrollbar"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.68rem',
                  color: 'rgba(var(--cv-text-rgb), 0.85)',
                  lineHeight: 1.65,
                  resize: 'vertical',
                }}
              />
              {error && (
                <p
                  className="font-dm"
                  style={{ fontSize: '0.65rem', color: '#f87171', letterSpacing: '0.05em' }}
                >
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="cv-btn-purple flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setError(''); }}
                  className="cv-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const JsonEditorTab = ({ userId }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersClient.getProfileJson(userId);
      setProfile(data);
    } catch { setProfile(null); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (section, value) => {
    await usersClient.updateProfileJson(userId, { [section]: value });
    setProfile(prev => ({ ...prev, [section]: value }));
  };

  const handleDelete = async (section) => {
    if (!confirm(`Delete section "${section}"? This cannot be undone.`)) return;
    await usersClient.deleteProfileSection(userId, section);
    setProfile(prev => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-12 space-y-4">
      <p
        className="font-dm"
        style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.42)', letterSpacing: '0.08em' }}
      >
        No profile data found.
      </p>
      <button
        onClick={() => navigate('/onboarding')}
        className="cv-btn-purple inline-flex items-center gap-2"
      >
        Start Onboarding
      </button>
    </div>
  );

  const pendingFields = profile._ai_pending || [];
  const sections = Object.entries(profile).filter(([k]) => !k.startsWith('_'));

  const handleApprove = async (field) => {
    await usersClient.approveAiFields(userId, field);
    await load();
  };

  const handleApproveAll = async () => {
    await usersClient.approveAiFields(userId, null);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* AI Pending Approvals panel */}
      {pendingFields.length > 0 && (
        <div
          className="p-4 space-y-3"
          style={{
            background: 'rgba(139,92,246,0.04)',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              <span
                className="font-dm"
                style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a78bfa' }}
              >
                {pendingFields.length} AI-filled field{pendingFields.length !== 1 ? 's' : ''} — pending review
              </span>
            </div>
            <button
              onClick={handleApproveAll}
              className="font-dm flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={{
                fontSize: '0.58rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#a78bfa',
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.35)',
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingFields.map(field => (
              <span
                key={field}
                className="font-dm inline-flex items-center gap-1.5 px-2.5 py-1"
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.14em',
                  background: 'rgba(139,92,246,0.07)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  color: '#a78bfa',
                }}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {field}
                <button
                  onClick={() => handleApprove(field)}
                  className="ml-1 transition-opacity hover:opacity-100"
                  style={{ opacity: 0.7, color: '#a78bfa' }}
                  title="Approve this field"
                >
                  <Check className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <p
            className="font-dm"
            style={{ fontSize: '0.6rem', color: 'rgba(139,92,246,0.7)', letterSpacing: '0.04em' }}
          >
            Review the values below. Edit any section, then click ✓ on a chip to approve it, or use Approve All.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p
            className="font-dm"
            style={{
              fontSize: '0.6rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(var(--cv-text-rgb), 0.55)',
            }}
          >
            {sections.length} section{sections.length !== 1 ? 's' : ''} in profile
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <EnrichPanel userId={userId} onDone={load} />
            <button
              onClick={() => navigate('/onboarding')}
              className="font-dm flex items-center gap-2 px-4 py-2.5 transition-colors"
              style={{
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Redo onboarding
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {sections.map(([key, val]) => (
          <JsonSection
            key={key}
            sectionKey={key}
            value={val}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ProfileManagement = () => {
  const navigate = useNavigate();
  const { userId, user, loading, refreshUser } = useUser();
  const [tab, setTab] = useState('profile');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  if (!userId) {
    navigate('/profile-selector', { replace: true });
    return null;
  }

  return (
    <div className="cv-reveal">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 transition-colors"
          style={{
            color: 'rgba(var(--cv-text-rgb), 0.55)',
            border: '1px solid var(--cv-border)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <MiniAvatar user={user} name={user?.name || '?'} color={user?.avatar_color} size={42} onUpload={refreshUser} />
        <div className="min-w-0">
          <h1
            className="font-syne"
            style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--cv-text)', lineHeight: 1.1 }}
          >
            {user?.name || 'Profile'}
          </h1>
          <p
            className="font-dm truncate"
            style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
          >
            {userId}
          </p>
        </div>
      </div>

      {/* Tab strip */}
      <div
        className="flex flex-wrap gap-1 mb-8"
        style={{ borderBottom: '1px solid var(--cv-border)' }}
      >
        <TabBtn icon={User} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
        <TabBtn icon={Key} label="API Keys" active={tab === 'apis'} onClick={() => setTab('apis')} />
        <TabBtn icon={FileJson} label="JSON Editor" active={tab === 'json'} onClick={() => setTab('json')} />
      </div>

      {/* Content */}
      <div
        className="p-6"
        style={{
          background: 'var(--cv-card-bg)',
          border: '1px solid var(--cv-border)',
        }}
      >
        {tab === 'profile' && <ProfileTab userId={userId} user={user} />}
        {tab === 'apis' && <ApiKeysTab userId={userId} />}
        {tab === 'json' && <JsonEditorTab userId={userId} />}
      </div>
    </div>
  );
};

export default ProfileManagement;
