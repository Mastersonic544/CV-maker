import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import {
  Zap, MapPin, Target, Search, Check, CheckCircle2, ChevronRight,
  PlusCircle, X, Trash2, User, Briefcase, Loader2, Pencil, FileJson,
  ExternalLink, AlertCircle,
} from 'lucide-react';

// ── Apify JSON Import Modal ─────────────────────────────────────────────────

const APIFY_URL = 'https://apify.com/curious_coder/linkedin-jobs-scraper';

const STEPS = [
  {
    n: '01',
    title: 'Open the Apify scraper',
    body: 'Go to the free LinkedIn Jobs Scraper on Apify. No account needed for a few runs.',
    link: APIFY_URL,
    linkLabel: 'Open Apify →',
  },
  {
    n: '02',
    title: 'Fill in your search',
    body: 'Enter your desired job title, location, and any filters. Click "Start" and wait for it to finish.',
    link: null,
  },
  {
    n: '03',
    title: 'Copy the JSON output',
    body: 'Click "Export" → "JSON", copy everything, and paste it into the box below.',
    link: null,
  },
];

const ApifyImportModal = ({ onClose, onAdded }) => {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { added, targets }

  const handleImport = async () => {
    const trimmed = jsonText.trim();
    if (!trimmed) { setError('Paste your Apify JSON first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.importJsonTargets(trimmed);
      setResult(res);
      res.targets.forEach(t => onAdded(t));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--cv-overlay)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col"
        style={{
          background: 'var(--cv-surface)',
          border: '1px solid rgba(var(--cv-text-rgb), 0.10)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 shrink-0"
          style={{ borderBottom: '1px solid var(--cv-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(var(--cv-cyan-rgb), 0.06)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)' }}
            >
              <FileJson className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
            </div>
            <div>
              <h2 className="font-syne" style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}>
                Import from Apify
              </h2>
              <p className="font-dm mt-0.5" style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}>
                Free LinkedIn job scraper · no API key needed
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 transition-colors" style={{ color: 'rgba(var(--cv-text-rgb), 0.55)', border: '1px solid var(--cv-border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {result ? (
            /* Success state */
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#34d399' }} />
              <p className="font-syne mb-1" style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--cv-text)' }}>
                {result.added} job{result.added !== 1 ? 's' : ''} imported.
              </p>
              <p className="font-dm mb-6" style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
                They've been added to your target list below. Review and finalize when ready.
              </p>
              <button onClick={onClose} className="cv-btn-prim">Done</button>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Steps */}
              <div className="space-y-3">
                {STEPS.map(step => (
                  <div
                    key={step.n}
                    className="flex gap-4 p-4"
                    style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
                  >
                    <span
                      className="font-syne shrink-0"
                      style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--cv-cyan)', letterSpacing: '-0.03em', lineHeight: 1, marginTop: 2 }}
                    >
                      {step.n}
                    </span>
                    <div className="min-w-0">
                      <p className="font-syne mb-1" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cv-text)', letterSpacing: '-0.01em' }}>
                        {step.title}
                      </p>
                      <p className="font-dm" style={{ fontSize: '0.68rem', color: 'rgba(var(--cv-text-rgb), 0.58)', lineHeight: 1.6 }}>
                        {step.body}
                      </p>
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-dm mt-2"
                          style={{ fontSize: '0.62rem', color: 'var(--cv-cyan)', letterSpacing: '0.06em' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {step.linkLabel}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* JSON textarea */}
              <div>
                <label
                  className="block font-dm mb-2"
                  style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
                >
                  Paste Apify JSON output
                </label>
                <textarea
                  value={jsonText}
                  onChange={e => { setJsonText(e.target.value); setError(''); }}
                  placeholder={'[\n  {\n    "title": "Frontend Developer",\n    "company": { "name": "Acme" },\n    "url": "https://linkedin.com/jobs/view/...",\n    "location": "Paris"\n  }\n]'}
                  rows={10}
                  className="cv-input font-dm"
                  style={{ resize: 'vertical', fontSize: '0.68rem', lineHeight: 1.6, fontFamily: "'DM Mono', monospace" }}
                  spellCheck={false}
                />
                <p className="font-dm mt-1.5" style={{ fontSize: '0.58rem', color: 'rgba(var(--cv-text-rgb), 0.38)', letterSpacing: '0.04em' }}>
                  Any Apify output format is accepted — the AI will normalize it if needed.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 font-dm" style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div
            className="flex justify-end gap-3 p-6 shrink-0"
            style={{ borderTop: '1px solid var(--cv-border)' }}
          >
            <button onClick={onClose} className="cv-btn-ghost">Cancel</button>
            <button
              onClick={handleImport}
              disabled={loading || !jsonText.trim()}
              className="cv-btn-prim flex items-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</>
                : <><FileJson className="w-3.5 h-3.5" /> Import Jobs</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Manual Add Modal ────────────────────────────────────────────────────────

const EMPTY_FORM = {
  company_name: '', job_title: '', job_url: '', location: '',
  apply_type: 'email', company_linkedin: '', company_website: '',
  hr_name: '', hr_email: '', hr_linkedin: '', ceo_name: '', ceo_linkedin: '',
  job_description: '',
};

const MonoLabel = ({ children }) => (
  <label
    className="block mb-2 font-dm"
    style={{
      fontSize: '0.55rem',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'rgba(var(--cv-text-rgb), 0.55)',
    }}
  >
    {children}
  </label>
);

const ModalField = ({ label, value, onChange, placeholder, required = false, type = 'text' }) => (
  <div>
    <MonoLabel>
      {label}{required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
    </MonoLabel>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="cv-input"
    />
  </div>
);

const ManualAddModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.job_title || !form.job_url || !form.location) {
      setError('Company name, job title, URL and location are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const target = await apiClient.addManualTarget(form);
      onAdded(target);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--cv-overlay)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        style={{
          background: 'var(--cv-surface)',
          border: '1px solid rgba(var(--cv-text-rgb), 0.10)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 sticky top-0 z-10"
          style={{
            borderBottom: '1px solid var(--cv-border)',
            background: 'var(--cv-surface)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: 'rgba(var(--cv-cyan-rgb), 0.06)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)' }}
            >
              <PlusCircle className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
            </div>
            <div>
              <h2
                className="font-syne"
                style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}
              >
                Add Job Manually
              </h2>
              <p
                className="font-dm mt-0.5"
                style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
              >
                Paste a listing you found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 transition-colors"
            style={{ color: 'rgba(var(--cv-text-rgb), 0.55)', border: '1px solid var(--cv-border)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              className="px-4 py-3 font-dm"
              style={{
                fontSize: '0.7rem',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalField label="Company name" value={form.company_name} onChange={v => set('company_name', v)} placeholder="Acme Corp" required />
            <ModalField label="Job title" value={form.job_title} onChange={v => set('job_title', v)} placeholder="Senior Frontend Developer" required />
          </div>
          <ModalField label="Job posting URL" value={form.job_url} onChange={v => set('job_url', v)} placeholder="https://linkedin.com/jobs/view/..." required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalField label="Location" value={form.location} onChange={v => set('location', v)} placeholder="Remote / Paris" required />
            <div>
              <MonoLabel>Apply type</MonoLabel>
              <select
                value={form.apply_type}
                onChange={e => set('apply_type', e.target.value)}
                className="cv-input"
              >
                <option value="external">External (redirect)</option>
                <option value="email">Email Application</option>
              </select>
            </div>
          </div>

          {/* Optional job description */}
          <div>
            <MonoLabel>Job description (optional — paste the full posting)</MonoLabel>
            <textarea
              value={form.job_description}
              onChange={e => set('job_description', e.target.value)}
              placeholder="Paste the full job description here. Used by the AI to build a precise HR persona when the URL can't be scraped (e.g. external apply forms)."
              rows={5}
              className="cv-input"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <p
              className="font-dm mt-1"
              style={{ fontSize: '0.58rem', color: 'rgba(var(--cv-text-rgb), 0.38)', letterSpacing: '0.04em' }}
            >
              Not required — but strongly recommended for external jobs where the LinkedIn preview differs from the real form.
            </p>
          </div>

          <div className="pt-4" style={{ borderTop: '1px solid rgba(var(--cv-text-rgb), 0.05)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ width: 12, height: 1, background: 'rgba(var(--cv-text-rgb), 0.32)' }} />
              <p
                className="font-dm"
                style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
              >
                Optional. Improves persona research.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Company LinkedIn URL" value={form.company_linkedin} onChange={v => set('company_linkedin', v)} placeholder="linkedin.com/company/acme" />
              <ModalField label="Company website" value={form.company_website} onChange={v => set('company_website', v)} placeholder="https://acme.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalField label="HR contact name" value={form.hr_name} onChange={v => set('hr_name', v)} placeholder="Jane Smith" />
            <ModalField label="HR email" value={form.hr_email} onChange={v => set('hr_email', v)} placeholder="hr@company.com" type="email" />
          </div>
          <ModalField label="HR LinkedIn URL" value={form.hr_linkedin} onChange={v => set('hr_linkedin', v)} placeholder="linkedin.com/in/jane" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalField label="CEO / Founder name" value={form.ceo_name} onChange={v => set('ceo_name', v)} placeholder="John Doe" />
            <ModalField label="CEO LinkedIn URL" value={form.ceo_linkedin} onChange={v => set('ceo_linkedin', v)} placeholder="linkedin.com/in/john" />
          </div>

          <div className="flex justify-end gap-3 pt-2 flex-wrap">
            <button type="button" onClick={onClose} className="cv-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="cv-btn-purple flex items-center gap-2">
              {saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <PlusCircle className="w-3.5 h-3.5" />}
              {saving ? 'Adding' : 'Add to Targets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Target Modal ───────────────────────────────────────────────────────

const EditTargetModal = ({ target, onClose, onSaved }) => {
  const [form, setForm] = useState({
    company_name: target.company_name || '',
    job_title: target.job_title || '',
    job_url: target.job_url || '',
    location: target.location || '',
    apply_type: target.apply_type || 'external',
    company_linkedin: target.company_linkedin || '',
    company_website: target.company_website || '',
    hr_name: target.hr_name || '',
    hr_email: target.hr_email || '',
    hr_linkedin: target.hr_linkedin || '',
    ceo_name: target.ceo_name || '',
    ceo_linkedin: target.ceo_linkedin || '',
    job_description: target.job_description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.job_title || !form.job_url || !form.location) {
      setError('Company name, job title, URL and location are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await apiClient.updateTarget(target.company_id, form);
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--cv-overlay)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        style={{ background: 'var(--cv-surface)', border: '1px solid rgba(var(--cv-text-rgb), 0.10)', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--cv-border)', background: 'var(--cv-surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--cv-cyan-rgb), 0.06)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)' }}>
              <Pencil className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
            </div>
            <div>
              <h2 className="font-syne" style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}>
                Edit Target
              </h2>
              <p className="font-dm mt-0.5" style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}>
                {target.company_name} — changes rebuild the HR persona
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 transition-colors" style={{ color: 'rgba(var(--cv-text-rgb), 0.55)', border: '1px solid var(--cv-border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {saved ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#34d399' }} />
            <p className="font-syne mb-1" style={{ fontWeight: 700, color: 'var(--cv-text)' }}>Target updated.</p>
            <p className="font-dm mb-5" style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
              The HR persona for this company has been reset. Regenerate the CV in Build CV to apply the changes.
            </p>
            <button onClick={onClose} className="cv-btn-prim">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="px-4 py-3 font-dm" style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Company name" value={form.company_name} onChange={v => set('company_name', v)} placeholder="Acme Corp" required />
              <ModalField label="Job title" value={form.job_title} onChange={v => set('job_title', v)} placeholder="Senior Frontend Developer" required />
            </div>
            <ModalField label="Job posting URL" value={form.job_url} onChange={v => set('job_url', v)} placeholder="https://linkedin.com/jobs/view/..." required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Location" value={form.location} onChange={v => set('location', v)} placeholder="Remote / Paris" required />
              <div>
                <MonoLabel>Apply type</MonoLabel>
                <select value={form.apply_type} onChange={e => set('apply_type', e.target.value)} className="cv-input">
                  <option value="external">External (redirect)</option>
                  <option value="email">Email Application</option>
                </select>
              </div>
            </div>

            <div>
              <MonoLabel>Job description (optional — paste the full posting)</MonoLabel>
              <textarea
                value={form.job_description}
                onChange={e => set('job_description', e.target.value)}
                placeholder="Paste the full job description here…"
                rows={5}
                className="cv-input"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid rgba(var(--cv-text-rgb), 0.05)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span style={{ width: 12, height: 1, background: 'rgba(var(--cv-text-rgb), 0.32)' }} />
                <p className="font-dm" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
                  Optional. Improves persona research.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ModalField label="Company LinkedIn URL" value={form.company_linkedin} onChange={v => set('company_linkedin', v)} placeholder="linkedin.com/company/acme" />
                <ModalField label="Company website" value={form.company_website} onChange={v => set('company_website', v)} placeholder="https://acme.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="HR contact name" value={form.hr_name} onChange={v => set('hr_name', v)} placeholder="Jane Smith" />
              <ModalField label="HR email" value={form.hr_email} onChange={v => set('hr_email', v)} placeholder="hr@company.com" type="email" />
            </div>
            <ModalField label="HR LinkedIn URL" value={form.hr_linkedin} onChange={v => set('hr_linkedin', v)} placeholder="linkedin.com/in/jane" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="CEO / Founder name" value={form.ceo_name} onChange={v => set('ceo_name', v)} placeholder="John Doe" />
              <ModalField label="CEO LinkedIn URL" value={form.ceo_linkedin} onChange={v => set('ceo_linkedin', v)} placeholder="linkedin.com/in/john" />
            </div>

            <div className="flex justify-end gap-3 pt-2 flex-wrap">
              <button type="button" onClick={onClose} className="cv-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="cv-btn-purple flex items-center gap-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ── Main Discovery Page ─────────────────────────────────────────────────────

const Discovery = () => {
  const navigate = useNavigate();

  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleSuggestions, setRoleSuggestions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState(25);
  const [isScraping, setIsScraping] = useState(false);
  const [targets, setTargets] = useState([]);
  const [selectedTargets, setSelectedTargets] = useState(new Set());
  const [scrapeError, setScrapeError] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);

  useEffect(() => {
    apiClient.getTargets()
      .then(existing => {
        if (existing?.length) {
          setTargets(existing);
          setSelectedTargets(new Set(existing.filter(t => t.status !== 'ignored').map(t => t.company_id)));
        }
      })
      .catch(() => {});
  }, []);

  const handleSuggestRoles = async () => {
    setLoadingRoles(true);
    setScrapeError(null);
    try {
      const suggestions = await apiClient.suggestRoles();
      setRoleSuggestions(suggestions);
      if (suggestions.length > 0) setSelectedRole(suggestions[0].role);
    } catch {
      setScrapeError('Failed to fetch role suggestions. Ensure backend and OpenRouter API key are configured.');
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleScrape = async () => {
    if (!selectedRole || !location) {
      setScrapeError('Enter a target role and location before searching.');
      return;
    }
    setIsScraping(true);
    setScrapeError(null);
    try {
      const result = await apiClient.scrapeJobs({ role: selectedRole, location, radius_km: radius });
      const preview = result.preview || [];
      setTargets(preview);
      setSelectedTargets(new Set(preview.map(t => t.company_id)));
    } catch (err) {
      setScrapeError('Failed to scrape jobs: ' + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualAdded = (target) => {
    setTargets(prev => [...prev, target]);
    setSelectedTargets(prev => new Set([...prev, target.company_id]));
  };

  const toggleTarget = (id) => {
    setSelectedTargets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleEditSaved = (updated) => {
    setTargets(prev => prev.map(t => t.company_id === updated.company_id ? updated : t));
  };

  const handleDelete = async (companyId) => {
    setDeletingId(companyId);
    try {
      await apiClient.deleteTarget(companyId);
      setTargets(prev => prev.filter(t => t.company_id !== companyId));
      setSelectedTargets(prev => { const n = new Set(prev); n.delete(companyId); return n; });
    } catch (err) {
      setScrapeError('Failed to delete target: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFinalize = async () => {
    try {
      await apiClient.finalizeTargets(Array.from(selectedTargets));
      navigate('/review');
    } catch {
      setScrapeError('Failed to finalize targets.');
    }
  };

  // ── Section header building block
  const SectionHeader = ({ icon: Icon, label, title, sub, right }) => (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div className="flex items-start gap-4 min-w-0">
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0"
          style={{ background: 'rgba(var(--cv-cyan-rgb), 0.06)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)' }}
        >
          <Icon className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
        </div>
        <div className="min-w-0">
          <div
            className="font-dm"
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--cv-cyan)',
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <h2
            className="font-syne"
            style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}
          >
            {title}
          </h2>
          <p
            className="font-dm mt-1"
            style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
          >
            {sub}
          </p>
        </div>
      </div>
      {right}
    </div>
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 cv-reveal">
      {/* Page title */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Phase 02 / Discovery
          </span>
        </div>
        <h1
          className="font-syne"
          style={{ fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}
        >
          Job Discovery.
        </h1>
        <p
          className="font-dm mt-3"
          style={{ fontSize: '0.78rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
        >
          Find target roles via AI and scraping, or add listings manually.
        </p>
      </div>

      {scrapeError && (
        <div
          className="p-4 font-dm"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            fontSize: '0.72rem',
          }}
        >
          {scrapeError}
        </div>
      )}

      {/* Section 1: Role */}
      <div
        className="p-6"
        style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
      >
        <SectionHeader
          icon={Zap}
          label="01 / Target Role"
          title="Pick a position."
          sub="What are you applying for?"
          right={
            <button
              onClick={handleSuggestRoles}
              disabled={loadingRoles}
              className="font-dm flex items-center gap-2 px-4 py-2.5 transition-colors"
              style={{
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--cv-cyan)',
                background: 'rgba(var(--cv-cyan-rgb), 0.06)',
                border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)',
              }}
            >
              {loadingRoles
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <SparklesIcon />}
              {loadingRoles ? 'Analyzing' : 'AI Suggest'}
            </button>
          }
        />

        {roleSuggestions.length > 0 ? (
          <div className="space-y-2">
            {roleSuggestions.map((sug, idx) => (
              <label
                key={idx}
                className="relative flex items-start gap-4 p-4 cursor-pointer transition-all"
                style={{
                  background: selectedRole === sug.role ? 'rgba(var(--cv-cyan-rgb), 0.04)' : 'var(--cv-card-bg)',
                  border: `1px solid ${selectedRole === sug.role ? 'rgba(var(--cv-cyan-rgb), 0.4)' : 'var(--cv-border)'}`,
                  borderLeft: `2px solid ${selectedRole === sug.role ? 'var(--cv-cyan)' : 'var(--cv-border)'}`,
                }}
              >
                <input
                  type="radio" name="role" value={sug.role}
                  checked={selectedRole === sug.role}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="mt-1.5 shrink-0"
                  style={{ accentColor: 'var(--cv-cyan)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
                    <span
                      className="font-syne"
                      style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em', color: 'var(--cv-text)' }}
                    >
                      {sug.role}
                    </span>
                    <span
                      className="font-dm"
                      style={{ fontSize: '0.68rem', color: '#34d399', letterSpacing: '0.05em', fontWeight: 500 }}
                    >
                      {Math.round((sug.match_score || 0) * 100)}% Match
                    </span>
                  </div>
                  <p
                    className="font-dm"
                    style={{ fontSize: '0.72rem', lineHeight: 1.6, color: 'rgba(var(--cv-text-rgb), 0.62)' }}
                  >
                    {sug.reasoning}
                  </p>
                </div>
              </label>
            ))}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span
                className="font-dm shrink-0"
                style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
              >
                Or enter manually
              </span>
              <input
                type="text" placeholder="e.g. Frontend Developer" value={selectedRole}
                onChange={e => { setSelectedRole(e.target.value); setRoleSuggestions([]); }}
                className="cv-input flex-1 min-w-[200px]"
              />
            </div>
          </div>
        ) : (
          <input
            type="text" placeholder="e.g. Frontend Developer" value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="cv-input"
          />
        )}
      </div>

      {/* Section 2: Location & Search */}
      <div
        className="p-6"
        style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
      >
        <SectionHeader icon={MapPin} label="02 / Location" title="Where to apply." sub="Geography of the search." />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <MonoLabel>City, country, or remote</MonoLabel>
            <input
              type="text" placeholder="Paris, France / Remote" value={location}
              onChange={e => setLocation(e.target.value)}
              className="cv-input"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <MonoLabel>Search radius</MonoLabel>
              <span
                className="font-dm"
                style={{ fontSize: '0.7rem', color: 'var(--cv-cyan)', letterSpacing: '0.04em' }}
              >
                +{radius} km
              </span>
            </div>
            <input
              type="range" min="10" max="150" step="10" value={radius}
              onChange={e => setRadius(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--cv-cyan)' }}
            />
            <div className="flex justify-between mt-2">
              {['10km','150km'].map(l => (
                <span
                  key={l}
                  className="font-dm"
                  style={{ fontSize: '0.55rem', letterSpacing: '0.18em', color: 'rgba(var(--cv-text-rgb), 0.42)' }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleScrape}
          disabled={isScraping}
          className="cv-btn-prim w-full flex items-center justify-center gap-2"
          style={{ padding: '1rem 2rem' }}
        >
          {isScraping
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Search className="w-4 h-4" />}
          {isScraping ? 'Searching LinkedIn' : 'Find Companies'}
        </button>
      </div>

      {/* Section 3: Target List */}
      <div
        className="p-6"
        style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
      >
        <SectionHeader
          icon={Target}
          label="03 / Targets"
          title="Validate listings."
          sub={
            targets.length > 0
              ? `${targets.length} listing${targets.length !== 1 ? 's' : ''}. Review and confirm.`
              : 'Add listings manually or scrape above.'
          }
          right={
            <div className="flex items-center gap-3 flex-wrap">
              {targets.length > 0 && (
                <span
                  className="font-dm"
                  style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}
                >
                  <span style={{ color: '#34d399', fontWeight: 500 }}>{selectedTargets.size}</span> / {targets.length} selected
                </span>
              )}
              <button
                onClick={() => setShowImportModal(true)}
                className="p-2 transition-colors"
                style={{
                  color: 'var(--cv-cyan)',
                  background: 'rgba(var(--cv-cyan-rgb), 0.04)',
                  border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)',
                }}
                title="Import from Apify JSON"
              >
                <FileJson className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowManualModal(true)}
                className="font-dm flex items-center gap-2 px-3 py-2 transition-colors"
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--cv-text)',
                  background: 'rgba(var(--cv-text-rgb), 0.04)',
                  border: '1px solid rgba(var(--cv-text-rgb), 0.10)',
                }}
              >
                <PlusCircle className="w-3 h-3" style={{ color: 'var(--cv-cyan)' }} />
                Add Manually
              </button>
            </div>
          }
        />

        {targets.some(t => t.company_id.startsWith('mock_')) && (
          <div
            className="mb-4 px-4 py-3 font-dm"
            style={{
              fontSize: '0.7rem',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.25)',
              color: '#a78bfa',
            }}
          >
            LinkedIn scraping is unavailable right now — showing placeholder companies.
            The <strong>View</strong> links open a real LinkedIn job search for your role.
            Replace these with real listings using <strong>Add Manually</strong>, or they'll be used as demo targets.
          </div>
        )}

        {targets.length > 0 ? (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            {targets.map((target, idx) => {
              const isSelected = selectedTargets.has(target.company_id);
              return (
                <div
                  key={target.company_id || idx}
                  className="flex items-start justify-between p-4 transition-all gap-3 flex-wrap"
                  style={{
                    background: isSelected ? 'rgba(var(--cv-text-rgb), 0.03)' : 'rgba(var(--cv-text-rgb), 0.01)',
                    border: `1px solid ${isSelected ? 'rgba(var(--cv-cyan-rgb), 0.18)' : 'rgba(var(--cv-text-rgb), 0.05)'}`,
                    opacity: isSelected ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTarget(target.company_id)}
                      className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center transition-colors"
                      style={{
                        background: isSelected ? 'var(--cv-cyan)' : 'transparent',
                        border: `1px solid ${isSelected ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.18)'}`,
                        color: 'var(--cv-bg)',
                      }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className="font-syne"
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            letterSpacing: '-0.01em',
                            color: 'var(--cv-text)',
                            textDecoration: !isSelected ? 'line-through' : 'none',
                          }}
                        >
                          {target.company_name}
                        </h3>
                        {target.company_id.startsWith('manual_') && (
                          <span
                            className="font-dm px-1.5 py-0.5"
                            style={{
                              fontSize: '0.5rem',
                              letterSpacing: '0.2em',
                              textTransform: 'uppercase',
                              background: 'rgba(245,158,11,0.08)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245,158,11,0.25)',
                            }}
                          >
                            Manual
                          </span>
                        )}
                        {target.company_id.startsWith('mock_') && (
                          <span
                            className="font-dm px-1.5 py-0.5"
                            style={{
                              fontSize: '0.5rem',
                              letterSpacing: '0.2em',
                              textTransform: 'uppercase',
                              background: 'rgba(139,92,246,0.08)',
                              color: '#a78bfa',
                              border: '1px solid rgba(139,92,246,0.25)',
                            }}
                          >
                            Demo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap font-dm" style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{target.job_title}
                        </span>
                        <span style={{ color: 'rgba(var(--cv-text-rgb), 0.22)' }}>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{target.location}
                        </span>
                      </div>

                      {(target.hr_name || target.ceo_name) && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap font-dm" style={{ fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.42)' }}>
                          {target.hr_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-2.5 h-2.5" style={{ color: '#60a5fa' }} />
                              HR: <span style={{ color: 'rgba(var(--cv-text-rgb), 0.62)' }}>{target.hr_name}</span>
                            </span>
                          )}
                          {target.ceo_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-2.5 h-2.5" style={{ color: '#a78bfa' }} />
                              CEO: <span style={{ color: 'rgba(var(--cv-text-rgb), 0.62)' }}>{target.ceo_name}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                    <span
                      className="font-dm px-2 py-0.5"
                      style={{
                        fontSize: '0.5rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        background: 'rgba(var(--cv-text-rgb), 0.03)',
                        border: '1px solid rgba(var(--cv-text-rgb), 0.08)',
                        color: 'rgba(var(--cv-text-rgb), 0.62)',
                      }}
                    >
                      {target.apply_type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingTarget(target)}
                        className="p-1 transition-colors"
                        style={{ color: 'rgba(var(--cv-text-rgb), 0.42)', border: '1px solid rgba(var(--cv-text-rgb), 0.06)' }}
                        title="Edit target"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(target.company_id)}
                        disabled={deletingId === target.company_id}
                        className="p-1 transition-colors"
                        style={{ color: 'rgba(var(--cv-text-rgb), 0.42)', border: '1px solid rgba(var(--cv-text-rgb), 0.06)' }}
                        title="Remove target"
                      >
                        {deletingId === target.company_id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="text-center py-12 font-dm"
            style={{
              fontSize: '0.7rem',
              color: 'rgba(var(--cv-text-rgb), 0.42)',
              border: '1px dashed rgba(var(--cv-text-rgb), 0.10)',
              letterSpacing: '0.04em',
            }}
          >
            <PlusCircle className="w-7 h-7 mx-auto mb-3 opacity-30" />
            <p>No listings yet. Scrape LinkedIn above or add one manually.</p>
          </div>
        )}

        {targets.length > 0 && (
          <div className="pt-4 mt-4 flex justify-end" style={{ borderTop: '1px solid rgba(var(--cv-text-rgb), 0.05)' }}>
            <button
              onClick={handleFinalize}
              disabled={selectedTargets.size === 0}
              className="cv-btn-prim flex items-center gap-2"
              style={{ padding: '0.9rem 1.8rem' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve and proceed
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {showImportModal && (
        <ApifyImportModal
          onClose={() => setShowImportModal(false)}
          onAdded={handleManualAdded}
        />
      )}
      {showManualModal && (
        <ManualAddModal
          onClose={() => setShowManualModal(false)}
          onAdded={handleManualAdded}
        />
      )}
      {editingTarget && (
        <EditTargetModal
          target={editingTarget}
          onClose={() => setEditingTarget(null)}
          onSaved={(updated) => { handleEditSaved(updated); }}
        />
      )}
    </div>
  );
};

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
);

export default Discovery;
