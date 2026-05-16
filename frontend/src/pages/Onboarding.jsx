import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usersClient } from '../api/client';
import { Copy, Check, Loader2, ChevronRight, ChevronLeft, User, Database, Github, Linkedin } from 'lucide-react';

const STEPS = [
  { id: 'info', label: 'You',  icon: User,     title: 'Who are you?',           sub: 'Name, email, and your links. We do the rest.' },
  { id: 'dump', label: 'Data', icon: Database,  title: 'The intelligence drop',  sub: 'Paste an AI export, or let us scrape your profiles.' },
];

const DATA_DUMP_PROMPT = `I need you to analyze everything you know about me from our entire conversation history and create a comprehensive professional profile. Extract all details, including things I mentioned casually.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "personal_info": {
    "full_name": "",
    "first_name": "",
    "last_name": "",
    "headline": "",
    "summary": "",
    "contact": { "email": "", "phone": "", "linkedin": "", "github": "", "portfolio": "" },
    "location": { "city": "", "country": "", "remote_open": true, "relocation_open": false },
    "languages": [{ "language": "", "proficiency": "native|fluent|advanced|intermediate|basic" }]
  },
  "work_experience": [{
    "company": "", "title": "", "start_date": "YYYY-MM",
    "end_date": "YYYY-MM or null", "is_current": false,
    "location": "", "responsibilities": [], "achievements": [], "tech_stack": []
  }],
  "education": [{ "institution": "", "degree": "", "field": "", "start_date": "YYYY", "end_date": "YYYY", "grade": "" }],
  "skills": { "technical": [], "soft": [], "tools": [], "frameworks": [] },
  "projects": [{ "name": "", "description": "", "technologies": [], "outcome": "", "url": "" }],
  "certifications": [{ "name": "", "issuer": "", "issued_date": "YYYY-MM" }],
  "personality_and_work_style": { "work_style": "", "strengths": [], "values": [] },
  "preferences_and_goals": { "target_roles": [], "target_industries": [], "preferred_locations": [], "work_type": "remote|hybrid|onsite", "open_to_relocation": false }
}

Be thorough. Quantify achievements, include all technologies mentioned, infer things I have not explicitly stated if reasonable. Return ONLY the JSON.`;

const Label = ({ children }) => (
  <label className="block mb-2 font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.55)' }}>
    {children}
  </label>
);

const Field = ({ label, value, onChange, placeholder, type = 'text', half }) => (
  <div className={half ? 'col-span-1' : 'col-span-2'}>
    <Label>{label}</Label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="cv-input" />
  </div>
);

const LoadingScreen = ({ onDone }) => {
  const messages = [
    'Parsing your professional history',
    'Scraping LinkedIn profile',
    'Fetching GitHub repositories and READMEs',
    'Extracting skills and technologies',
    'Identifying achievements and impact',
    'Structuring your experience timeline',
    'Building your hiring persona profile',
    'Optimising for ATS compatibility',
    'Finalising your profile',
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const total = 28000;
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(95, (elapsed / total) * 100);
      setPct(p);
      setMsgIdx(Math.floor((p / 100) * (messages.length - 1)));
      if (elapsed >= total) { clearInterval(tick); setPct(100); setTimeout(onDone, 800); }
    }, 200);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10" style={{ background: 'var(--cv-bg)', fontFamily: "'DM Mono', monospace" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(var(--cv-cyan-rgb), 0.08) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(0,0,0,0.7), transparent)', WebkitMaskImage: 'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(0,0,0,0.7), transparent)' }} />
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(var(--cv-cyan-rgb), 0.1)" strokeWidth="2" />
          <circle cx="48" cy="48" r="44" fill="none" stroke="var(--cv-cyan)" strokeWidth="2" strokeLinecap="butt" strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`} style={{ transition: 'stroke-dashoffset 0.3s ease', filter: 'drop-shadow(0 0 6px rgba(var(--cv-cyan-rgb), 0.5))' }} />
        </svg>
        <span className="font-syne" style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--cv-text)' }}>
          {Math.round(pct)}<span style={{ color: 'rgba(var(--cv-cyan-rgb), 0.55)', fontSize: '0.7rem' }}>%</span>
        </span>
      </div>
      <div className="text-center space-y-2 relative">
        <div className="flex items-center justify-center gap-2.5" style={{ color: 'var(--cv-cyan)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="font-dm" style={{ fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{messages[msgIdx]}</span>
        </div>
        <p className="font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.32)' }}>
          Building your AI-powered profile
        </p>
      </div>
    </div>
  );
};

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId || localStorage.getItem('cvmaker_active_user');

  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dumpText, setDumpText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState('');

  const [info, setInfo] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    city: '', country: '', linkedin: '', github: '', portfolio: '',
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(DATA_DUMP_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = async () => {
    setError('');
    setLoading(true);
    setShowLoader(true);

    const basicInfo = {
      full_name:  `${info.firstName} ${info.lastName}`.trim(),
      first_name: info.firstName,
      last_name:  info.lastName,
      email:      info.email,
      phone:      info.phone,
      city:       info.city,
      country:    info.country,
      linkedin:   info.linkedin,
      github:     info.github,
      portfolio:  info.portfolio,
    };

    try {
      await usersClient.submitOnboarding(userId, { dump_text: dumpText, basic_info: basicInfo });
    } catch (e) {
      console.error('Onboarding error:', e);
    }
  };

  const handleLoaderDone = () => {
    setShowLoader(false);
    setLoading(false);
    navigate('/setup-apis', { state: { userId } });
  };

  const canAdvance = () => {
    if (step === 0) return info.firstName && info.lastName && info.email;
    return true; // dump is optional — LinkedIn + GitHub scraping fills the gap
  };

  const Progress = () => (
    <div className="mb-10">
      <div className="flex items-center gap-1.5 mb-3">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex-1 h-[2px] transition-colors" style={{ background: i < step ? 'var(--cv-cyan)' : i === step ? 'rgba(var(--cv-cyan-rgb), 0.4)' : 'rgba(var(--cv-text-rgb), 0.06)' }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
          Step {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </span>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.id} className="font-dm" style={{ fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: i === step ? 'var(--cv-text)' : i < step ? 'rgba(var(--cv-cyan-rgb), 0.55)' : 'rgba(var(--cv-text-rgb), 0.22)' }}>
              {s.label}{i < STEPS.length - 1 ? ' ›' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name"    value={info.firstName} onChange={v => setInfo(p => ({...p, firstName: v}))}  placeholder="Alex"                  half />
        <Field label="Last name"     value={info.lastName}  onChange={v => setInfo(p => ({...p, lastName: v}))}   placeholder="Rivera"                 half />
        <Field label="Email"         value={info.email}     onChange={v => setInfo(p => ({...p, email: v}))}      placeholder="alex@email.com"         type="email" />
        <Field label="Phone"         value={info.phone}     onChange={v => setInfo(p => ({...p, phone: v}))}      placeholder="+1 555 000 0000"        half />
        <Field label="City"          value={info.city}      onChange={v => setInfo(p => ({...p, city: v}))}       placeholder="San Francisco"          half />
        <Field label="Country"       value={info.country}   onChange={v => setInfo(p => ({...p, country: v}))}    placeholder="United States"          half />

        {/* LinkedIn — highlighted since it gets auto-scraped */}
        <div className="col-span-2">
          <label className="flex items-center gap-2 mb-2 font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cv-cyan)' }}>
            <Linkedin className="w-3 h-3" /> LinkedIn URL
            <span style={{ color: 'rgba(var(--cv-text-rgb), 0.35)', fontWeight: 400 }}>— auto-scraped</span>
          </label>
          <input value={info.linkedin} onChange={e => setInfo(p => ({...p, linkedin: e.target.value}))} placeholder="linkedin.com/in/alexrivera" className="cv-input" style={{ borderColor: info.linkedin ? 'rgba(var(--cv-cyan-rgb), 0.4)' : undefined }} />
        </div>

        {/* GitHub — highlighted since it gets auto-scraped */}
        <div className="col-span-1">
          <label className="flex items-center gap-2 mb-2 font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(var(--cv-cyan-rgb), 0.75)' }}>
            <Github className="w-3 h-3" /> GitHub URL
            <span style={{ color: 'rgba(var(--cv-text-rgb), 0.35)', fontWeight: 400 }}>— repos scraped</span>
          </label>
          <input value={info.github} onChange={e => setInfo(p => ({...p, github: e.target.value}))} placeholder="github.com/alexrivera" className="cv-input" style={{ borderColor: info.github ? 'rgba(var(--cv-cyan-rgb), 0.4)' : undefined }} />
        </div>

        <Field label="Portfolio URL" value={info.portfolio} onChange={v => setInfo(p => ({...p, portfolio: v}))} placeholder="alexrivera.dev" half />

        {/* Scraping notice */}
        {(info.linkedin || info.github) && (
          <div className="col-span-2 flex items-start gap-2 px-3 py-2.5" style={{ background: 'rgba(var(--cv-cyan-rgb), 0.04)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--cv-cyan)', boxShadow: '0 0 6px var(--cv-cyan)' }} />
            <p className="font-dm" style={{ fontSize: '0.62rem', letterSpacing: '0.06em', color: 'rgba(var(--cv-text-rgb), 0.65)', lineHeight: 1.6 }}>
              We will automatically scrape your {[info.linkedin && 'LinkedIn profile', info.github && 'GitHub repos and READMEs'].filter(Boolean).join(' and ')} to enrich your profile during processing.
            </p>
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-5">
        {/* AI dump card */}
        <div className="p-5" style={{ background: 'var(--cv-card-bg)', border: '1px solid var(--cv-border)' }}>
          <p className="font-dm mb-3" style={{ fontSize: '0.72rem', lineHeight: 1.7, color: 'rgba(var(--cv-text-rgb), 0.78)' }}>
            <span style={{ color: 'var(--cv-cyan)' }}>Optional</span> — open <span style={{ color: 'var(--cv-cyan)' }}>Claude, GPT, or Gemini</span>, paste this prompt, then copy the JSON it returns below.
          </p>
          <div className="relative">
            <pre className="font-dm overflow-auto" style={{ background: 'var(--cv-bg)', border: '1px solid rgba(var(--cv-text-rgb), 0.05)', padding: '1rem', fontSize: '0.6rem', color: 'rgba(var(--cv-text-rgb), 0.55)', maxHeight: '7rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {DATA_DUMP_PROMPT.slice(0, 200)}...
            </pre>
            <button onClick={handleCopy} className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 font-dm transition-all" style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(var(--cv-cyan-rgb), 0.1)', border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(var(--cv-cyan-rgb), 0.35)'}`, color: copied ? '#10b981' : 'var(--cv-cyan)' }}>
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
        </div>

        <div>
          <Label>Paste the full AI output (optional)</Label>
          <textarea
            value={dumpText}
            onChange={e => { setDumpText(e.target.value); setError(''); }}
            placeholder="Paste the entire JSON output... or skip — we will build your profile from LinkedIn and GitHub alone."
            rows={8}
            className="cv-input font-dm"
            style={{ resize: 'vertical', lineHeight: 1.6, fontSize: '0.7rem' }}
          />
          {error && <p className="font-dm mt-2" style={{ fontSize: '0.65rem', color: '#f87171', letterSpacing: '0.08em' }}>{error}</p>}
          <div className="flex items-center justify-between mt-2">
            <p className="font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--cv-text-rgb), 0.32)' }}>
              {dumpText.length} characters
            </p>
            {!dumpText && (
              <p className="font-dm" style={{ fontSize: '0.58rem', letterSpacing: '0.1em', color: 'rgba(var(--cv-cyan-rgb), 0.65)' }}>
                LinkedIn + GitHub data is sufficient to build a strong profile
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <>
      {showLoader && <LoadingScreen onDone={handleLoaderDone} />}
      <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'var(--cv-bg)', fontFamily: "'DM Mono', monospace", color: 'var(--cv-text)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(var(--cv-cyan-rgb), 0.07) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(0,0,0,0.7), transparent)', WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(0,0,0,0.7), transparent)' }} />

        <div className="w-full max-w-xl relative z-10 cv-reveal">
          <Progress />

          <div className="p-8" style={{ background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div className="flex items-start gap-4 mb-7">
              <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--cv-cyan-rgb), 0.08)', border: '1px solid rgba(var(--cv-cyan-rgb), 0.3)' }}>
                <Icon className="w-4 h-4" style={{ color: 'var(--cv-cyan)' }} />
              </div>
              <div className="min-w-0">
                <h2 className="font-syne" style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.03em', color: 'var(--cv-text)', lineHeight: 1.1 }}>{current.title}</h2>
                <p className="font-dm mt-1" style={{ fontSize: '0.7rem', color: 'rgba(var(--cv-text-rgb), 0.55)', letterSpacing: '0.02em' }}>{current.sub}</p>
              </div>
            </div>

            {renderStep()}

            <div className="flex justify-between mt-8 pt-6" style={{ borderTop: '1px solid rgba(var(--cv-text-rgb), 0.05)' }}>
              <button
                onClick={() => step > 0 && setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2 font-dm transition-colors"
                style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: step === 0 ? 'rgba(var(--cv-text-rgb), 0.2)' : 'rgba(var(--cv-text-rgb), 0.55)', background: 'transparent', border: '1px solid var(--cv-border)', cursor: step === 0 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft className="w-3 h-3" /> Back
              </button>

              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="cv-btn-purple flex items-center gap-2">
                  Continue <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
                <button onClick={handleFinish} disabled={loading} className="cv-btn-prim flex items-center gap-2">
                  {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Processing</> : <>Build Profile</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
