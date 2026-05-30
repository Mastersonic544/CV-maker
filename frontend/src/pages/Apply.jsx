import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import {
  Send, CheckCircle2, Loader2, XCircle,
  ExternalLink, RefreshCw,
  Mail, Edit2, Check, X, Eye, EyeOff, Info,
  Globe, AlertTriangle, Ban, PlayCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Inline HR email editor with auto-fetch ───────────────────────────────────

const HrEmailEditor = ({ companyId, initialEmail, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialEmail || '');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Sync when parent updates hr_email after auto-fetch
  useEffect(() => {
    if (initialEmail && initialEmail !== value) setValue(initialEmail);
  }, [initialEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateTargetEmail(companyId, value.trim());
      onSaved(value.trim());
      setEditing(false);
      setFetchError('');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleFetch = async () => {
    setFetching(true);
    setFetchError('');
    try {
      const result = await apiClient.fetchHrEmail(companyId);
      setValue(result.email);
      onSaved(result.email);
    } catch (err) {
      setFetchError(err.message || 'Could not find an email.');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-1">
      {!editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(var(--cv-text-rgb), 0.4)' }} />
          {value ? (
            <span className="font-dm" style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.7)' }}>{value}</span>
          ) : (
            <span className="font-dm" style={{ fontSize: '0.72rem', color: 'rgba(var(--cv-text-rgb), 0.35)', fontStyle: 'italic' }}>
              No HR email
            </span>
          )}
          {/* Fetch button */}
          <button
            onClick={handleFetch}
            disabled={fetching || !!value}
            className="p-0.5 transition-colors"
            style={{
              color: fetching ? 'var(--cv-cyan)' : value ? 'rgba(var(--cv-text-rgb), 0.18)' : 'var(--cv-cyan)',
              cursor: value ? 'default' : 'pointer',
            }}
            title={value ? 'Email already set' : 'Auto-fetch from company website'}
          >
            {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          </button>
          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="p-0.5 transition-colors"
            style={{ color: 'rgba(var(--cv-text-rgb), 0.35)' }}
            title="Edit HR email manually"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--cv-cyan)' }} />
          <input
            type="email"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="hr@company.com"
            className="cv-input"
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', flex: 1, minWidth: 0 }}
          />
          <button onClick={handleSave} disabled={saving} className="p-1" style={{ color: '#34d399' }} title="Save">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={() => { setEditing(false); setValue(initialEmail || ''); }} className="p-1" style={{ color: '#f87171' }} title="Cancel">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {fetchError && (
        <p className="font-dm" style={{ fontSize: '0.62rem', color: '#f87171', paddingLeft: '1.25rem' }}>{fetchError}</p>
      )}
    </div>
  );
};

// ── Email preview card ───────────────────────────────────────────────────────

const EmailCard = ({ target, onApplied, onSkip, batchSending, batchResult }) => {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [hrEmail, setHrEmail] = useState(target.hr_email || '');
  const [error, setError] = useState('');

  // Email regenerate / edit state
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPreview = async () => {
    if (preview && !editing) { setShowBody(v => !v); return; }
    setLoadingPreview(true);
    try {
      const data = await apiClient.getEmailPreview(target.company_id);
      setPreview(data);
      setShowBody(true);
    } catch {
      setError('Could not load email preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const data = await apiClient.generateEmail(target.company_id);
      setPreview(prev => ({ ...prev, subject: data.subject, body: data.body, is_draft: true }));
      setShowBody(true);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to regenerate email.');
    } finally {
      setRegenerating(false);
    }
  };

  const startEditing = () => {
    setEditSubject(preview?.subject || '');
    setEditBody(preview?.body || '');
    setEditing(true);
    setShowBody(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.saveEmail(target.company_id, editSubject, editBody);
      setPreview(prev => ({ ...prev, subject: editSubject, body: editBody, is_draft: true }));
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save email.');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!hrEmail) { setError('Add or fetch an HR email address first.'); return; }
    setSending(true);
    setError('');
    try {
      await apiClient.applyToCompany(target.company_id);
      setSent(true);
      onApplied(target.company_id);
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await apiClient.skipAndBlacklist(target.company_id);
      onSkip(target.company_id);
    } catch {
      setSkipping(false);
    }
  };

  // Reflect batch result
  const isBatchFail = batchResult === 'no_email' || batchResult === 'send_fail';
  const isBatchSent = batchResult === 'sent';
  const displaySent = sent || isBatchSent;

  return (
    <div
      className="p-5 space-y-4"
      style={{
        background: 'var(--cv-card-bg)',
        border: `1px solid ${isBatchFail ? 'rgba(239,68,68,0.25)' : 'var(--cv-border)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-syne" style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--cv-text)' }}>
            {target.company_name}
          </h3>
          <p className="font-dm mt-0.5" style={{ fontSize: '0.68rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
            {target.job_title} · {target.location}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Batch status badge */}
          {batchResult === 'no_email' && (
            <span className="font-dm flex items-center gap-1 px-2 py-1" style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertTriangle className="w-3 h-3" /> No email found
            </span>
          )}
          {batchResult === 'send_fail' && (
            <span className="font-dm flex items-center gap-1 px-2 py-1" style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle className="w-3 h-3" /> Send failed
            </span>
          )}

          {/* Skip & Blacklist */}
          {isBatchFail && !displaySent && (
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="font-dm flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}
              title="Remove from queue and never show this listing again"
            >
              {skipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
              Skip &amp; blacklist
            </button>
          )}

          {!displaySent && !batchSending && (
            <button
              onClick={loadPreview}
              disabled={loadingPreview}
              className="font-dm flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.65)', border: '1px solid var(--cv-border)', background: 'rgba(var(--cv-text-rgb), 0.03)' }}
            >
              {loadingPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : showBody ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showBody ? 'Hide' : 'Preview'}
            </button>
          )}

          {displaySent ? (
            <div className="font-dm flex items-center gap-1.5 px-3 py-1.5" style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
              <CheckCircle2 className="w-3 h-3" /> Sent
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending || !hrEmail || batchSending}
              className="font-dm flex items-center gap-1.5 px-4 py-1.5 transition-colors"
              style={{
                fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase',
                color: sending || !hrEmail || batchSending ? 'rgba(var(--cv-text-rgb), 0.3)' : '#000',
                background: sending || !hrEmail || batchSending ? 'rgba(245,158,11,0.1)' : '#f59e0b',
                border: `1px solid ${sending || !hrEmail || batchSending ? 'rgba(245,158,11,0.2)' : '#f59e0b'}`,
                cursor: !hrEmail || batchSending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {sending ? 'Sending…' : 'Apply Now'}
            </button>
          )}
        </div>
      </div>

      {/* HR email editor */}
      <HrEmailEditor companyId={target.company_id} initialEmail={hrEmail} onSaved={setHrEmail} />

      {/* Docs status */}
      {!displaySent && (
        <div className="flex items-center gap-3 flex-wrap font-dm" style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.45)' }}>
          {preview ? (
            <>
              <span style={{ color: preview.has_cv ? '#34d399' : '#f87171' }}>
                {preview.has_cv ? '✓ CV ready' : '✗ No CV — generate in Build CV first'}
              </span>
              <span style={{ color: 'rgba(var(--cv-text-rgb), 0.22)' }}>·</span>
              <span style={{ color: preview.has_cover_letter ? '#34d399' : 'rgba(var(--cv-text-rgb), 0.45)' }}>
                {preview.has_cover_letter ? '✓ Cover letter attached' : 'No cover letter'}
              </span>
            </>
          ) : (
            <button onClick={() => navigate('/review')} className="hover:underline" style={{ color: 'rgba(var(--cv-text-rgb), 0.45)' }}>
              Generate CV + cover letter in Build CV first →
            </button>
          )}
        </div>
      )}

      {/* Email body preview / editor */}
      {showBody && preview && (
        <div className="space-y-2" style={{ background: 'rgba(var(--cv-text-rgb), 0.02)', border: '1px solid rgba(var(--cv-text-rgb), 0.07)', padding: '1rem' }}>
          {/* Preview toolbar */}
          {!displaySent && (
            <div className="flex items-center justify-between gap-2 pb-2 flex-wrap" style={{ borderBottom: '1px solid rgba(var(--cv-text-rgb), 0.07)' }}>
              <div className="flex items-center gap-2">
                {preview.is_draft && (
                  <span className="font-dm px-1.5 py-0.5" style={{ fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cv-cyan)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.35)', background: 'rgba(var(--cv-cyan-rgb), 0.06)' }}>
                    Custom
                  </span>
                )}
              </div>
              {!editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || batchSending}
                    className="font-dm flex items-center gap-1 px-2 py-1 transition-colors"
                    style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: regenerating ? 'var(--cv-cyan)' : 'rgba(var(--cv-text-rgb), 0.55)', border: '1px solid rgba(var(--cv-text-rgb), 0.12)' }}
                    title="Regenerate email using AI"
                  >
                    {regenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                    Regenerate
                  </button>
                  <button
                    onClick={startEditing}
                    disabled={batchSending}
                    className="font-dm flex items-center gap-1 px-2 py-1 transition-colors"
                    style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)', border: '1px solid rgba(var(--cv-text-rgb), 0.12)' }}
                    title="Edit email manually"
                  >
                    <Edit2 className="w-2.5 h-2.5" /> Edit
                  </button>
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="font-dm flex items-center gap-1 px-2 py-1 transition-colors"
                    style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
                  >
                    {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="font-dm flex items-center gap-1 px-2 py-1 transition-colors"
                    style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <X className="w-2.5 h-2.5" /> Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="font-dm block mb-1" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.4)' }}>Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="cv-input w-full"
                  style={{ fontSize: '0.72rem', padding: '0.4rem 0.6rem' }}
                />
              </div>
              <div>
                <label className="font-dm block mb-1" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.4)' }}>Body</label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={10}
                  className="cv-input w-full"
                  style={{ fontSize: '0.72rem', lineHeight: 1.7, padding: '0.5rem 0.6rem', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-dm" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.4)' }}>Subject</span>
                <span className="font-dm" style={{ fontSize: '0.72rem', color: 'var(--cv-text)' }}>{preview.subject}</span>
              </div>
              <pre className="font-dm whitespace-pre-wrap" style={{ fontSize: '0.72rem', lineHeight: 1.7, color: 'rgba(var(--cv-text-rgb), 0.72)', maxHeight: '220px', overflowY: 'auto' }}>
                {preview.body}
              </pre>
            </>
          )}
        </div>
      )}

      {error && <p className="font-dm" style={{ fontSize: '0.68rem', color: '#f87171' }}>{error}</p>}
    </div>
  );
};

// ── Main Apply page ──────────────────────────────────────────────────────────

const Apply = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [emailTargets, setEmailTargets] = useState([]);
  const [externalTargets, setExternalTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Batch send state
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total }
  const [batchResults, setBatchResults] = useState({});     // { company_id: 'sent' | 'no_email' | 'send_fail' }

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [statsResult, targetsResult] = await Promise.allSettled([
      apiClient.getApplyStatus(),
      apiClient.getTargets(),
    ]);

    if (statsResult.status === 'fulfilled') setStatus(statsResult.value);
    else console.error('Failed to load apply status', statsResult.reason);

    if (targetsResult.status === 'fulfilled') {
      const pending = targetsResult.value.filter(t => t.status === 'pending');
      setEmailTargets(pending.filter(t => t.apply_type === 'email'));
      setExternalTargets(pending.filter(t => t.apply_type === 'external'));
    } else {
      console.error('Failed to load targets', targetsResult.reason);
    }

    setLoading(false);
  };

  const handleEmailApplied = (companyId) => {
    setEmailTargets(prev => prev.filter(t => t.company_id !== companyId));
    setBatchResults(prev => ({ ...prev, [companyId]: 'sent' }));
    fetchData();
  };

  const handleSkip = (companyId) => {
    setEmailTargets(prev => prev.filter(t => t.company_id !== companyId));
    setBatchResults(prev => { const n = { ...prev }; delete n[companyId]; return n; });
  };

  const handleSendAll = async () => {
    setBatchSending(true);
    setBatchResults({});
    const targets = [...emailTargets];
    setBatchProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setBatchProgress({ current: i + 1, total: targets.length });
      let email = target.hr_email;

      // Auto-fetch if no email
      if (!email) {
        try {
          const result = await apiClient.fetchHrEmail(target.company_id);
          email = result.email;
          // Update local state so the card shows the found email
          setEmailTargets(prev => prev.map(t =>
            t.company_id === target.company_id ? { ...t, hr_email: email } : t
          ));
        } catch {
          setBatchResults(prev => ({ ...prev, [target.company_id]: 'no_email' }));
          continue;
        }
      }

      try {
        await apiClient.applyToCompany(target.company_id);
        setBatchResults(prev => ({ ...prev, [target.company_id]: 'sent' }));
        setEmailTargets(prev => prev.filter(t => t.company_id !== target.company_id));
      } catch {
        setBatchResults(prev => ({ ...prev, [target.company_id]: 'send_fail' }));
      }
    }

    setBatchSending(false);
    setBatchProgress(null);
    fetchData();
  };

  const SectionLabel = ({ label }) => (
    <div className="flex items-center gap-3 mb-4">
      <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
      <span className="font-dm" style={{ fontSize: '0.55rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
        {label}
      </span>
    </div>
  );

  const failedTargets = emailTargets.filter(t => batchResults[t.company_id] === 'no_email' || batchResults[t.company_id] === 'send_fail');
  const totalPending = emailTargets.length + externalTargets.length;

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-12 cv-reveal">

      {/* Page title */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
          <span className="font-dm" style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
            Phase 05 / Apply
          </span>
        </div>
        <h1 className="font-syne" style={{ fontWeight: 800, fontSize: 'clamp(2rem,4vw,2.8rem)', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}>
          Send Emails.
        </h1>
        <p className="font-dm mt-3" style={{ fontSize: '0.78rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
          Send tailored applications. Missing emails are auto-fetched from the company website.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: totalPending, color: 'var(--cv-text)' },
          { label: 'Sent Today', value: `${status?.sent_today ?? 0} / ${status?.max_limit ?? 20}`, color: '#34d399' },
          { label: 'Remaining', value: status?.remaining_today ?? 20, color: 'var(--cv-cyan)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-5" style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}>
            <p className="font-dm mb-1" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.45)' }}>{label}</p>
            <p className="font-syne" style={{ fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.03em', color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {totalPending === 0 && Object.keys(batchResults).length === 0 && (
        <div className="text-center py-16 font-dm" style={{ border: '1px dashed rgba(var(--cv-text-rgb), 0.12)', color: 'rgba(var(--cv-text-rgb), 0.4)', fontSize: '0.72rem' }}>
          <Send className="w-8 h-8 mx-auto mb-3 opacity-25" />
          <p className="mb-3">No applications in queue.</p>
          <button onClick={() => navigate('/discover')} className="hover:underline" style={{ color: 'var(--cv-cyan)' }}>
            Go to Find Jobs to add listings →
          </button>
        </div>
      )}

      {/* ── Section 1: Email applications ── */}
      {emailTargets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <SectionLabel label="01 / Email applications" />
            <button
              onClick={handleSendAll}
              disabled={batchSending}
              className="font-dm flex items-center gap-2 px-4 py-2 transition-colors"
              style={{
                fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                color: batchSending ? 'rgba(var(--cv-text-rgb), 0.4)' : 'var(--cv-bg)',
                background: batchSending ? 'rgba(var(--cv-cyan-rgb), 0.12)' : 'var(--cv-cyan)',
                border: '1px solid var(--cv-cyan)',
              }}
            >
              {batchSending
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending {batchProgress?.current}/{batchProgress?.total}</>
                : <><PlayCircle className="w-3 h-3" /> Send All</>}
            </button>
          </div>

          {/* Missing email banner */}
          {failedTargets.length > 0 && (
            <div
              className="flex items-start gap-3 p-4 mb-5 font-dm"
              style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.85)', lineHeight: 1.6 }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>{failedTargets.length}</strong> {failedTargets.length === 1 ? 'company' : 'companies'} had no contact email found and were skipped.
                Use <strong>Skip &amp; Blacklist</strong> on each card below to remove them permanently, or add the email manually and retry.
              </span>
            </div>
          )}

          {/* Email notice */}
          <div
            className="flex items-start gap-3 p-4 mb-5 font-dm"
            style={{ fontSize: '0.68rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.85)', lineHeight: 1.6 }}
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                Emails are sent via <strong>Gmail SMTP</strong>. Free: up to <strong>500/day</strong>.
                {' '}Set credentials in{' '}
                <button onClick={() => navigate('/setup-apis')} className="underline">API Setup</button>.
              </div>
              <div>
                The <Globe className="w-3 h-3 inline mx-0.5" /> icon auto-fetches missing HR emails from the company website.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {emailTargets.map(target => (
              <EmailCard
                key={target.company_id}
                target={target}
                onApplied={handleEmailApplied}
                onSkip={handleSkip}
                batchSending={batchSending}
                batchResult={batchResults[target.company_id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2: External / manual apply ── */}
      {externalTargets.length > 0 && (
        <div>
          <SectionLabel label="02 / Manual apply — open externally" />
          <div className="space-y-3">
            {externalTargets.map(target => (
              <div
                key={target.company_id}
                className="flex items-center justify-between p-4 gap-3 flex-wrap"
                style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
              >
                <div className="min-w-0">
                  <p className="font-syne" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cv-text)' }}>{target.company_name}</p>
                  <p className="font-dm mt-0.5" style={{ fontSize: '0.65rem', color: 'rgba(var(--cv-text-rgb), 0.5)' }}>
                    {target.job_title} · {target.location}
                  </p>
                </div>
                <a
                  href={target.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-dm flex items-center gap-1.5 px-4 py-2 transition-colors shrink-0"
                  style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#000', background: '#f59e0b', border: '1px solid #f59e0b' }}
                >
                  Apply Now <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh control */}
      {!batchSending && (
        <div className="flex justify-end gap-3">
          <button
            onClick={fetchData}
            className="font-dm flex items-center gap-2 px-4 py-2 transition-colors"
            style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.65)', border: '1px solid var(--cv-border)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {totalPending === 0 && (
            <button
              onClick={() => navigate('/dashboard')}
              className="font-dm flex items-center gap-2 px-4 py-2 transition-colors cv-btn-prim"
              style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}
            >
              Dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Apply;
