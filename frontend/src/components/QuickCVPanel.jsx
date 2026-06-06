import React, { useState, useEffect } from 'react';
import { apiClient, BASE_URL } from '../api/client';
import CVPreview from './CVPreview';
import {
  Zap, X, Loader2, Sparkles, FileText, Trash2, Calendar, Star, AlertCircle, Plus,
  GraduationCap, ChevronUp, ChevronDown,
} from 'lucide-react';

/**
 * Dashboard "Quick CV" panel.
 *
 * Lets the user paste a role title (and optionally a job description) and get a
 * tailored CV generated straight from their profile — no company, no scraping,
 * no Discovery/Review round-trip. Everything happens here and saved CVs are
 * listed below for quick access.
 */
const QuickCVPanel = () => {
  const [open, setOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeProgress, setResumeProgress] = useState('');

  const [saved, setSaved] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchSaved = async () => {
    try {
      const data = await apiClient.listQuickCVs();
      setSaved(data || []);
    } catch (err) {
      console.warn('Quick CVs not available:', err.message);
      setSaved([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchSaved(); }, []);

  const resetModal = () => {
    setJobTitle('');
    setJobDescription('');
    setProgress('');
    setError('');
    setGenerating(false);
  };

  const closeModal = () => {
    if (generating) return; // don't allow closing mid-generation
    setOpen(false);
    resetModal();
  };

  const waitForSSE = (companyId, onProgress = setProgress) => new Promise((resolve, reject) => {
    const es = new EventSource(`${BASE_URL}/generation/status/${companyId}`);
    es.onmessage = (e) => {
      if (e.data.startsWith('DONE|')) {
        es.close();
        resolve(parseFloat(e.data.split('|')[1]) || 0);
      } else if (e.data.startsWith('ERROR|')) {
        es.close();
        reject(new Error(e.data.replace('ERROR|', '')));
      } else {
        onProgress(e.data);
      }
    };
    es.onerror = () => { es.close(); reject(new Error('Connection lost')); };
  });

  const handleGenerate = async () => {
    if (!jobTitle.trim() || generating) return;
    setGenerating(true);
    setError('');
    setProgress('Starting CV engine…');
    try {
      const { company_id } = await apiClient.quickGenerateCV(jobTitle.trim(), jobDescription.trim());
      await waitForSSE(company_id);
      await fetchSaved();
      setOpen(false);
      resetModal();
    } catch (err) {
      setError(String(err.message || err).replace('ERROR|', ''));
      setGenerating(false);
      setProgress('');
    }
  };

  const handleGenerateResume = async () => {
    if (resumeBusy) return;
    setResumeBusy(true);
    setResumeProgress('Building resume…');
    try {
      const { company_id } = await apiClient.quickGenerateResume();
      await waitForSSE(company_id, setResumeProgress);
      await fetchSaved();
    } catch (err) {
      console.warn('Resume generation failed:', err.message);
    } finally {
      setResumeBusy(false);
      setResumeProgress('');
    }
  };

  const moveCv = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= saved.length) return;
    const next = [...saved];
    [next[index], next[target]] = [next[target], next[index]];
    setSaved(next);
    try {
      await apiClient.reorderQuickCVs(next.map((c) => c.company_id));
    } catch (err) {
      console.warn('Reorder failed:', err.message);
      fetchSaved();
    }
  };

  const handleDelete = async (companyId) => {
    setSaved(prev => prev.filter(c => c.company_id !== companyId));
    try {
      await apiClient.deleteQuickCV(companyId);
    } catch (err) {
      console.warn('Delete failed:', err.message);
      fetchSaved();
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span style={{ width: 16, height: 1, background: 'var(--cv-cyan)' }} />
          <span
            className="font-dm"
            style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}
          >
            Quick CV
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {resumeBusy && (
            <span className="flex items-center gap-1.5 font-dm" style={{ fontSize: '0.62rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
              <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
              {resumeProgress || 'Working…'}
            </span>
          )}
          <button
            onClick={handleGenerateResume}
            disabled={resumeBusy}
            className="cv-btn-ghost flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.7rem' }}
            title="Generate a Harvard-format resume straight from your profile"
          >
            {resumeBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
            Generate Resume
          </button>
          <button
            onClick={() => setOpen(true)}
            className="cv-btn-prim flex items-center gap-2"
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.7rem' }}
          >
            <Zap className="w-3.5 h-3.5" /> New Quick CV
          </button>
        </div>
      </div>

      {/* Saved CVs */}
      <div
        style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
      >
        {loadingList ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 mx-auto rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(var(--cv-text-rgb), 0.08)', borderTopColor: 'var(--cv-cyan)' }} />
          </div>
        ) : saved.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-14 h-14 mx-auto flex items-center justify-center mb-5"
              style={{ background: 'rgba(var(--cv-cyan-rgb), 0.04)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)' }}
            >
              <Sparkles className="w-6 h-6" style={{ color: 'rgba(var(--cv-cyan-rgb), 0.55)' }} />
            </div>
            <h3 className="font-syne mb-2" style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}>
              No quick CVs yet
            </h3>
            <p className="font-dm max-w-sm mx-auto" style={{ fontSize: '0.72rem', lineHeight: 1.7, color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
              Enter a role like <span style={{ color: 'var(--cv-cyan)' }}>"UI/UX Designer"</span> and instantly get a tailored CV from your profile — no scraping needed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
            {saved.map((cv, index) => (
              <div
                key={cv.company_id}
                className="flex flex-col gap-3 p-4"
                style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-syne truncate" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cv-text)', letterSpacing: '-0.01em' }}>
                      {cv.job_title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {cv.kind === 'resume' && (
                        <span className="flex items-center gap-1 font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
                          <GraduationCap className="w-2.5 h-2.5" /> Harvard
                        </span>
                      )}
                      {cv.created_on && (
                        <span className="flex items-center gap-1 font-dm" style={{ fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.45)' }}>
                          <Calendar className="w-2.5 h-2.5" /> {cv.created_on.split(' ')[0]}
                        </span>
                      )}
                      {cv.score != null && (
                        <span className="flex items-center gap-1 font-dm" style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 500 }}>
                          <Star className="w-2.5 h-2.5" /> {cv.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveCv(index, -1)}
                        disabled={index === 0}
                        className="px-1 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                        style={{ color: 'rgba(var(--cv-text-rgb), 0.5)', border: '1px solid var(--cv-border)' }}
                        title="Move up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveCv(index, 1)}
                        disabled={index === saved.length - 1}
                        className="px-1 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                        style={{ color: 'rgba(var(--cv-text-rgb), 0.5)', border: '1px solid var(--cv-border)', borderTop: 'none' }}
                        title="Move down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(cv.company_id)}
                      className="p-1.5 transition-colors"
                      style={{ color: 'rgba(var(--cv-text-rgb), 0.4)', border: '1px solid var(--cv-border)' }}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {cv.has_cv ? (
                  <CVPreview companyId={cv.company_id} score={cv.score ?? null} docType={cv.kind === 'resume' ? 'resume' : 'cv'} />
                ) : (
                  <div className="w-full h-[300px] flex flex-col items-center justify-center gap-2 border border-dashed" style={{ borderColor: 'var(--cv-border)' }}>
                    <FileText className="w-6 h-6" style={{ color: 'rgba(var(--cv-text-rgb), 0.3)' }} />
                    <span className="font-dm" style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.4)' }}>
                      Not available
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg"
            style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--cv-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center" style={{ background: 'rgba(var(--cv-cyan-rgb), 0.08)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.25)' }}>
                  <Zap className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
                </div>
                <h3 className="font-syne" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cv-text)', letterSpacing: '-0.01em' }}>
                  Quick CV
                </h3>
              </div>
              <button onClick={closeModal} disabled={generating} className="p-1 transition-colors disabled:opacity-30" style={{ color: 'rgba(var(--cv-text-rgb), 0.5)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {generating ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cv-cyan)' }} />
                  <p className="font-dm animate-pulse" style={{ fontSize: '0.78rem', color: 'var(--cv-text)' }}>
                    {progress || 'Working…'}
                  </p>
                  <p className="font-dm" style={{ fontSize: '0.62rem', color: 'rgba(var(--cv-text-rgb), 0.45)' }}>
                    Tailoring your profile to this role. This can take a moment.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-dm block mb-1.5" style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
                      Role / Job Title *
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. UI/UX Designer"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleGenerate(); }}
                      className="w-full px-3 py-2.5 font-dm outline-none"
                      style={{ background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', color: 'var(--cv-text)', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label className="font-dm block mb-1.5" style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
                      Job Description <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank and AI drafts an ideal one)</span>
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the full job posting here, or leave blank — the AI will draft an ideal job description from the role title for optimal tailoring."
                      rows={6}
                      className="w-full px-3 py-2.5 font-dm outline-none resize-none"
                      style={{ background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', color: 'var(--cv-text)', fontSize: '0.78rem', lineHeight: 1.5 }}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                      <p className="font-dm" style={{ fontSize: '0.72rem', color: '#f87171' }}>{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={!jobTitle.trim()}
                    className="cv-btn-prim w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ padding: '0.7rem 1.2rem', fontSize: '0.75rem' }}
                  >
                    <Sparkles className="w-4 h-4" /> Generate CV
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickCVPanel;
