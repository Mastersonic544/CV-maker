import React, { useState, useEffect } from 'react';
import { apiClient, BASE_URL } from '../api/client';
import CVPreview from '../components/CVPreview';
import {
  Target, Zap, PlayCircle, Loader2, CheckCircle2, ExternalLink,
  FileText, ChevronDown, ChevronUp, User, Building2, Star,
  AlertCircle, Brain, BarChart2, Shield, Sparkles, X, BookOpen, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Research Details Panel ──────────────────────────────────────────────────

const INSIGHT_LABELS = {
  company_value: 'Company Value',
  what_they_look_for: 'What They Look For',
  red_flag: 'Red Flag to Avoid',
  cultural_keyword: 'Cultural Keyword',
  communication_style: 'Communication Style',
  scoring_note: 'Scoring Feedback',
};

const ResearchPanel = ({ companyId }) => {
  const [meta, setMeta] = useState(null);
  const [iterations, setIterations] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedInsight, setSelectedInsight] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const load = async () => {
    if (meta) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const [m, it] = await Promise.all([
        apiClient.getApplicationMeta(companyId),
        apiClient.getGANIterations(companyId),
      ]);
      setMeta(m);
      setIterations(it || []);
      setOpen(true);
    } catch {
      setMeta({ error: true });
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInsightClick = async (type, value) => {
    if (explainLoading) return;
    setSelectedInsight({ type, value });
    setExplanation(null);
    setExplainLoading(true);
    try {
      const result = await apiClient.explainInsight(companyId, type, value);
      setExplanation(result);
    } catch {
      setExplanation({ error: true });
    } finally {
      setExplainLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedInsight(null);
    setExplanation(null);
    setExplainLoading(false);
  };

  const Chip = ({ type, value, colorClass }) => (
    <button
      onClick={() => handleInsightClick(type, value)}
      title="Click to understand why"
      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer
                  hover:scale-105 active:scale-95 ${colorClass}`}
    >
      {value}
    </button>
  );

  const persona = meta?.persona;
  const targetInfo = meta?.target_info;
  const scraped = meta?.scraped_data;

  return (
    <div className="mt-4 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/80
                   hover:bg-zinc-800/80 transition-colors text-sm font-medium text-zinc-300"
      >
        <div className="flex items-center gap-2">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-[#6C63FF]" />
            : <Brain className="w-4 h-4 text-[#6C63FF]" />}
          <span>Research & Scoring Details</span>
          {open && <span className="text-[10px] text-zinc-700 ml-1">— click any insight to understand why</span>}
        </div>
        {!loading && (open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />)}
      </button>

      {open && (
        <div className="bg-zinc-950 border-t border-zinc-800 divide-y divide-zinc-800/60">

          {meta?.error && (
            <div className="p-4 text-sm text-zinc-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Research data not found — run generation first.
            </div>
          )}

          {/* People */}
          {targetInfo && (targetInfo.hr_name || targetInfo.ceo_name) && (
            <div className="p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">People</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {targetInfo.hr_name && (
                  <PersonCard icon={<User className="w-3.5 h-3.5 text-blue-400" />} label="HR Contact" name={targetInfo.hr_name} linkedin={targetInfo.hr_linkedin} />
                )}
                {targetInfo.ceo_name && (
                  <PersonCard icon={<User className="w-3.5 h-3.5 text-purple-400" />} label="CEO / Founder" name={targetInfo.ceo_name} linkedin={targetInfo.ceo_linkedin} />
                )}
              </div>
            </div>
          )}

          {/* Company Intel */}
          {scraped?.company_info?.about && (
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Company Intel</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{scraped.company_info.about}</p>
              {scraped.company_info.size && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                  Size: {scraped.company_info.size}
                </span>
              )}
            </div>
          )}

          {/* Hiring Persona — all chips clickable */}
          {persona && (
            <div className="p-4 space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                HR Persona
                <span className="ml-2 normal-case font-normal text-zinc-700">click any chip to see why</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Company Values
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(persona.company_values || []).map((v, i) => (
                      <Chip key={i} type="company_value" value={v}
                        colorClass="bg-[#6C63FF]/10 border-[#6C63FF]/20 text-[#8B85FF] hover:bg-[#6C63FF]/25 hover:border-[#6C63FF]/50" />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Star className="w-3 h-3" /> What They Look For
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(persona.what_they_look_for || []).map((v, i) => (
                      <Chip key={i} type="what_they_look_for" value={v}
                        colorClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50" />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Red Flags to Avoid
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(persona.red_flags_to_avoid || []).map((v, i) => (
                      <Chip key={i} type="red_flag" value={v}
                        colorClass="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25 hover:border-red-500/50" />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5">Communication Style</p>
                  <button
                    onClick={() => handleInsightClick("communication_style", persona.hr_communication_style)}
                    className="text-xs text-zinc-300 text-left hover:text-[#6C63FF] transition-colors block mb-1.5"
                    title="Click to understand why"
                  >
                    {persona.hr_communication_style}
                  </button>
                  <Chip type="communication_style" value={`Tone: ${persona.tone_preference}`}
                    colorClass="bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:border-zinc-600" />
                </div>
              </div>

              {(persona.cultural_keywords || []).length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5">Cultural Keywords to Mirror</p>
                  <div className="flex flex-wrap gap-1">
                    {persona.cultural_keywords.map((k, i) => (
                      <Chip key={i} type="cultural_keyword" value={k}
                        colorClass="bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/50" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAN Scoring History — notes are clickable */}
          {iterations.length > 0 && (
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3 flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> GAN Scoring History
                <span className="ml-1 normal-case font-normal text-zinc-700">click any note to understand it</span>
              </p>
              <div className="space-y-2">
                {iterations.map((it) => (
                  <div key={it.iteration}
                    className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex-shrink-0 text-center">
                      <div className={`text-sm font-bold ${it.score >= 9 ? 'text-emerald-400' : it.score >= 7 ? 'text-amber-400' : 'text-red-400'}`}>
                        {it.score.toFixed(1)}
                      </div>
                      <div className="text-[9px] text-zinc-600">#{it.iteration}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${it.score >= 9 ? 'bg-emerald-500' : it.score >= 7 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${(it.score / 10) * 100}%` }}
                          />
                        </div>
                        {it.passed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      </div>
                      {it.notes?.length > 0 && (
                        <ul className="space-y-0.5">
                          {it.notes.map((note, ni) => (
                            <li
                              key={ni}
                              onClick={() => handleInsightClick("scoring_note", note)}
                              title="Click to understand this feedback"
                              className="text-[10px] text-zinc-500 flex items-start gap-1 cursor-pointer
                                         hover:text-zinc-300 transition-colors group/note"
                            >
                              <span className="text-zinc-600 mt-0.5 group-hover/note:text-[#6C63FF] transition-colors">›</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Insight Explanation Modal */}
      {selectedInsight && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/60"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-[#6C63FF]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                    {INSIGHT_LABELS[selectedInsight.type] || selectedInsight.type}
                  </p>
                  <p className="font-bold text-white text-sm mt-0.5 leading-snug">
                    {selectedInsight.value}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="text-zinc-600 hover:text-white transition-colors ml-4 flex-shrink-0 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {explainLoading && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#6C63FF]" />
                  <span className="text-sm text-zinc-400">Analyzing source data…</span>
                </div>
              )}

              {explanation && !explanation.error && (
                <>
                  {/* Term definition — only shown for jargon/technical terms */}
                  {explanation.term_definition && (
                    <div className="flex gap-3 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-amber-500/70 font-semibold mb-1">
                          What this term means
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{explanation.term_definition}</p>
                      </div>
                    </div>
                  )}

                  {explanation.source_quote && (
                    <div className="bg-zinc-900 border-l-2 border-[#6C63FF] pl-3 py-2.5 rounded-r-lg">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">From the job posting</p>
                      <p className="text-xs text-zinc-400 italic leading-relaxed">"{explanation.source_quote}"</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                      Why the AI flagged this
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{explanation.why_identified}</p>
                  </div>

                  <div className="p-3 bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-xl">
                    <p className="text-[10px] uppercase tracking-widest text-[#6C63FF]/70 font-semibold mb-1.5">
                      What to do about it
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{explanation.what_it_means}</p>
                  </div>

                  {explanation.priority && (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                      <span className="text-[10px] text-zinc-600">Priority:</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        explanation.priority === 'high'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : explanation.priority === 'medium'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {explanation.priority}
                      </span>
                    </div>
                  )}
                </>
              )}

              {explanation?.error && (
                <p className="text-sm text-red-400">Could not load explanation. Try again.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PersonCard = ({ icon, label, name, linkedin }) => (
  <div className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
    <div className="mt-0.5">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-xs font-semibold text-white truncate">{name}</p>
      {linkedin && (
        <a
          href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-[#6C63FF] hover:underline truncate block"
        >
          LinkedIn profile
        </a>
      )}
    </div>
  </div>
);

// ── Main Review Page ────────────────────────────────────────────────────────

const Review = () => {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGeneration, setActiveGeneration] = useState(null);
  const [progressMessages, setProgressMessages] = useState({});
  const [completed, setCompleted] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState(null); // { current, total, name }

  useEffect(() => { fetchTargets(); }, []);

  const fetchTargets = async () => {
    try {
      const all = await apiClient.getTargets();
      const pendingTargets = all.filter(t => t.status === 'pending');
      setTargets(pendingTargets);

      // Check which targets already have generated CVs/CLs
      const completedStates = {};
      await Promise.all(pendingTargets.map(async (t) => {
        try {
          const iterations = await apiClient.getGANIterations(t.company_id);
          if (iterations && iterations.length > 0) {
            const finalScore = iterations[iterations.length - 1].score;
            // Only check CL existence if CV has already been generated
            let clReady = null;
            try {
              await apiClient.getCLJson(t.company_id);
              clReady = Date.now();
            } catch (_) { /* CL not yet generated — expected */ }
            completedStates[t.company_id] = { score: finalScore, clReady };
          }
        } catch (_) { }
      }));
      setCompleted(prev => ({ ...prev, ...completedStates }));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const _makeSSEWaiter = (company_id) => (label) => new Promise((resolve, reject) => {
    const es = new EventSource(`${BASE_URL}/generation/status/${company_id}`);
    es.onmessage = (e) => {
      if (e.data.startsWith('DONE|')) {
        es.close(); resolve(e.data);
      } else if (e.data.startsWith('ERROR|')) {
        es.close(); reject(new Error(e.data.replace('ERROR|', '')));
      } else {
        setProgressMessages(prev => ({ ...prev, [company_id]: `${label} ${e.data}` }));
      }
    };
    es.onerror = () => { es.close(); reject(new Error(`${label} connection lost`)); };
  });

  const handleGenerate = async (company_id) => {
    setActiveGeneration(company_id);
    setCompleted(prev => { const n = { ...prev }; delete n[company_id]; return n; });
    const waitForSSE = _makeSSEWaiter(company_id);
    try {
      setProgressMessages(prev => ({ ...prev, [company_id]: 'Starting CV engine…' }));
      await apiClient.generateCV(company_id);
      const cvDone = await waitForSSE('[CV]');
      const cvScore = parseFloat(cvDone.split('|')[1]) || 0;
      setCompleted(prev => ({ ...prev, [company_id]: { score: cvScore } }));

      setProgressMessages(prev => ({ ...prev, [company_id]: 'Starting Cover Letter engine…' }));
      await apiClient.generateCoverLetter(company_id);
      await waitForSSE('[CL]');
      setCompleted(prev => ({ ...prev, [company_id]: { ...prev[company_id], clReady: Date.now() } }));

      setProgressMessages(prev => ({ ...prev, [company_id]: 'Complete' }));
      setActiveGeneration(null);
    } catch (err) {
      const msg = String(err.message || err).replace('ERROR|', '');
      setProgressMessages(prev => ({ ...prev, [company_id]: `ERROR|${msg}` }));
      setActiveGeneration(null);
    }
  };

  const handleGenerateCL = async (company_id) => {
    setActiveGeneration(company_id);
    const waitForSSE = _makeSSEWaiter(company_id);
    try {
      setProgressMessages(prev => ({ ...prev, [company_id]: 'Starting Cover Letter engine…' }));
      await apiClient.generateCoverLetter(company_id);
      await waitForSSE('[CL]');
      setCompleted(prev => ({ ...prev, [company_id]: { ...prev[company_id], clReady: Date.now() } }));
      setProgressMessages(prev => ({ ...prev, [company_id]: 'Complete' }));
      setActiveGeneration(null);
    } catch (err) {
      const msg = String(err.message || err).replace('ERROR|', '');
      setProgressMessages(prev => ({ ...prev, [company_id]: `ERROR|${msg}` }));
      setActiveGeneration(null);
    }
  };

  const handleRegenerateDoc = (company_id, doc_type) => {
    const trigger = doc_type === 'cv'
      ? apiClient.generateCV(company_id)
      : apiClient.generateCoverLetter(company_id);

    return trigger.then(() => new Promise((resolve, reject) => {
      const es = new EventSource(`${BASE_URL}/generation/status/${company_id}`);
      es.onmessage = (e) => {
        if (e.data.startsWith('DONE|')) {
          if (doc_type === 'cv') {
            const score = parseFloat(e.data.split('|')[1]);
            setCompleted(prev => ({ ...prev, [company_id]: { ...prev[company_id], score } }));
          } else {
            setCompleted(prev => ({
              ...prev,
              [company_id]: { ...prev[company_id], clReady: Date.now() },
            }));
          }
          es.close(); resolve();
        } else if (e.data.startsWith('ERROR|')) {
          es.close(); reject(new Error(e.data.replace('ERROR|', '')));
        }
      };
      es.onerror = () => { es.close(); reject(new Error('SSE connection failed')); };
    }));
  };

  const handleGenerateAll = async () => {
    const noDoc = targets.filter(t => !completed[t.company_id]);
    const noCL  = targets.filter(t => completed[t.company_id] && !completed[t.company_id]?.clReady);
    const pending = [...noDoc, ...noCL];
    if (!pending.length) return;
    setGeneratingAll(true);
    for (let i = 0; i < pending.length; i++) {
      const t = pending[i];
      setGenerateAllProgress({ current: i + 1, total: pending.length, name: t.company_name });
      if (completed[t.company_id]) {
        await handleGenerateCL(t.company_id).catch(() => {});
      } else {
        await handleGenerate(t.company_id).catch(() => {});
      }
    }
    setGeneratingAll(false);
    setGenerateAllProgress(null);
  };

  if (loading) return (
    <div className="p-8">
      <Loader2 className="w-8 h-8 animate-spin text-[#6C63FF]" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 cv-reveal">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ width: 22, height: 1, background: 'var(--cv-cyan)' }} />
          <span className="font-dm" style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
            Phase 03 / Build CV
          </span>
        </div>
        <h1 className="font-syne" style={{ fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.04em', color: 'var(--cv-text)', lineHeight: 1 }}>
          CV Builder.
        </h1>
        <p className="font-dm mt-3" style={{ fontSize: '0.78rem', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
          Research each target and generate hyper-tailored CVs and cover letters.
        </p>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Target className="text-emerald-400 w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Target Queue ({targets.length})</h2>
          </div>
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll || !!activeGeneration || targets.every(t => completed[t.company_id]?.clReady)}
            className="cv-btn-prim flex items-center gap-2"
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.7rem' }}
          >
            {generatingAll
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {generateAllProgress
                    ? `${generateAllProgress.current} / ${generateAllProgress.total}`
                    : 'Starting…'}
                </>
              : <><PlayCircle className="w-3.5 h-3.5" /> Generate All</>}
          </button>
        </div>

        {/* Generate All progress banner */}
        {generatingAll && generateAllProgress && (
          <div
            className="mb-4 px-4 py-3 flex items-center gap-3 font-dm"
            style={{
              background: 'rgba(var(--cv-cyan-rgb), 0.04)',
              border: '1px solid rgba(var(--cv-cyan-rgb), 0.2)',
            }}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--cv-cyan)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontSize: '0.65rem', color: 'var(--cv-cyan)', letterSpacing: '0.04em' }}>
                  {generateAllProgress.name}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.45)', letterSpacing: '0.12em' }}>
                  {generateAllProgress.current} / {generateAllProgress.total}
                </span>
              </div>
              <div style={{ height: 2, background: 'rgba(var(--cv-text-rgb), 0.08)', borderRadius: 1 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(generateAllProgress.current / generateAllProgress.total) * 100}%`,
                    background: 'var(--cv-cyan)',
                    borderRadius: 1,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {targets.map(target => {
            const isGenerating = activeGeneration === target.company_id;
            const isComplete = !!completed[target.company_id];
            const msg = progressMessages[target.company_id];
            const isError = msg && String(msg).includes('ERROR');

            return (
              <div key={target.company_id}
                className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">

                <div className="flex flex-col md:flex-row">
                  {/* ── Left: Info + Controls ── */}
                  <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-zinc-800/60">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h3 className="text-lg font-bold text-white">{target.company_name}</h3>
                        <p className="text-sm text-zinc-400">{target.job_title} · {target.location}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                          {target.apply_type.replace('_', ' ')}
                        </span>
                        {target.job_url && (
                          <a
                            href={target.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-mono tracking-wider uppercase px-2 py-1 bg-zinc-800/60 rounded text-[#6C63FF] hover:bg-zinc-700 transition-colors"
                            title="View job posting"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* HR / CEO quick view */}
                    {(target.hr_name || target.ceo_name) && (
                      <div className="flex items-center gap-3 mt-2 mb-1">
                        {target.hr_name && (
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <User className="w-3 h-3 text-blue-400" />
                            HR: <span className="text-zinc-400">{target.hr_name}</span>
                          </span>
                        )}
                        {target.ceo_name && (
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <User className="w-3 h-3 text-purple-400" />
                            CEO: <span className="text-zinc-400">{target.ceo_name}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    <div className="bg-zinc-900 p-4 rounded-lg mt-3 min-h-[72px] flex flex-col
                                    justify-center border border-zinc-800/80">
                      {isGenerating ? (
                        <div className="flex items-center gap-3 text-sm font-mono text-zinc-300">
                          <Loader2 className="w-4 h-4 animate-spin text-[#6C63FF] flex-shrink-0" />
                          <span className="animate-pulse">{msg || 'Waiting…'}</span>
                        </div>
                      ) : isError ? (
                        <div className="space-y-2">
                          <div className="text-sm text-red-400 font-mono flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {String(msg).replace('ERROR|', '')}
                          </div>
                          {isComplete && (
                            <button
                              onClick={() => handleGenerateCL(target.company_id)}
                              disabled={!!activeGeneration}
                              className="text-xs text-[#6C63FF] hover:underline disabled:opacity-40"
                            >
                              Retry Cover Letter →
                            </button>
                          )}
                        </div>
                      ) : isComplete ? (
                        <div className="flex items-center gap-3 text-sm font-semibold text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Complete — Score: {completed[target.company_id].score.toFixed(1)}/10</span>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-600 font-mono">Awaiting generation.</div>
                      )}
                    </div>

                    {!isComplete && !isGenerating && (
                      <button
                        onClick={() => handleGenerate(target.company_id)}
                        className="mt-3 px-4 py-2.5 bg-[#6C63FF] hover:bg-[#5B54E6] text-white rounded-lg
                                   text-sm font-medium transition-colors w-full flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Research + Generate CV
                      </button>
                    )}

                    {/* Research details panel — shown after completion */}
                    {isComplete && <ResearchPanel companyId={target.company_id} />}
                  </div>

                  {/* ── Right: PDF Preview ── */}
                  <div className="w-full md:w-[480px] bg-zinc-900/30 flex items-center justify-center p-4">
                    {isComplete ? (
                      <div className="flex gap-4 w-full h-full">
                        <div className="flex-1 flex flex-col items-center">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Resume</span>
                          <CVPreview
                            companyId={target.company_id}
                            score={completed[target.company_id].score}
                            docType="cv"
                            onRegenerate={() => handleRegenerateDoc(target.company_id, 'cv')}
                          />
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Cover Letter</span>
                          {completed[target.company_id]?.clReady ? (
                            <CVPreview
                              key={`cl-${target.company_id}-${completed[target.company_id].clReady}`}
                              companyId={target.company_id}
                              docType="cover_letter"
                              onRegenerate={() => handleRegenerateDoc(target.company_id, 'cover_letter')}
                            />
                          ) : activeGeneration === target.company_id ? (
                            <div className="w-full h-[300px] rounded-xl border border-dashed border-zinc-700
                                            bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-zinc-600">
                              <RefreshCw className="w-6 h-6 opacity-30 animate-spin" />
                              <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">Generating…</p>
                            </div>
                          ) : (
                            <div className="w-full h-[300px] rounded-xl border border-dashed border-zinc-700
                                            bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-zinc-600">
                              <FileText className="w-6 h-6 opacity-30" />
                              <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">Not Generated</p>
                              <button
                                onClick={() => handleGenerateCL(target.company_id)}
                                disabled={!!activeGeneration}
                                className="text-xs text-[#6C63FF] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Generate Cover Letter →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-700 gap-3
                                      border-2 border-dashed border-zinc-800 rounded-lg w-full h-full min-h-[240px]">
                        <FileText className="w-8 h-8 opacity-40" />
                        <span className="text-xs uppercase font-mono tracking-widest opacity-40">No Document</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {targets.length === 0 && (
            <div className="text-center py-12 text-zinc-500 bg-zinc-950 rounded-xl border border-zinc-800 border-dashed">
              No active targets. Go back to Discovery and select listings.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Review;
