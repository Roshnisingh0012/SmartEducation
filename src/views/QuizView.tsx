import { useMemo, useState } from 'react';
import { FileText, Play, CheckCircle2, XCircle, RotateCcw, Award, ChevronRight, ChevronLeft, Clock, Save, Sparkles, Upload } from 'lucide-react';
import { QUIZ_TOPICS, getQuizzesForRole, generatePracticeQuiz, type QuizTopic } from '@/lib/quizBank';
import { ROLE_META } from '@/lib/domains';
import type { JobRole, QuizResultItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Phase = 'select' | 'taking' | 'result';

export default function QuizView() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('select');
  const [topic, setTopic] = useState<QuizTopic | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number; items: QuizResultItem[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pdfName, setPdfName] = useState('');

  const activeRole = user?.jobRole ?? 'SSO';

  // Role-filtered quizzes (or all if showAll is toggled)
  const roleQuizzes = useMemo(() => getQuizzesForRole(activeRole), [activeRole]);
  const displayQuizzes = showAll ? QUIZ_TOPICS : roleQuizzes;

  function start(t: QuizTopic) {
    setTopic(t);
    setAnswers(Array(t.questions.length).fill(null));
    setCurrent(0);
    setResult(null);
    setSavedFlag(false);
    setPhase('taking');
  }

  function selectOption(i: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = i;
      return next;
    });
  }

  function finish() {
    if (!topic) return;
    const items: QuizResultItem[] = topic.questions.map((q, i) => ({
      question: q.question,
      selected: answers[i] ?? -1,
      correct: q.correctIndex,
      explanation: q.explanation,
    }));
    const score = items.filter((it) => it.selected === it.correct).length;
    setResult({ score, total: items.length, items });
    setPhase('result');
    void persist(score, items.length, items);
  }

  async function persist(score: number, total: number, items: QuizResultItem[]) {
    if (!topic || !user) return;
    setSaving(true);
    await supabase.from('quiz_attempts').insert({
      learner_name: user.name,
      job_role: user.jobRole,
      topic: topic.title,
      score,
      total,
      results: items,
    });
    setSaving(false);
    setSavedFlag(true);
  }

  function reset() {
    setPhase('select');
    setTopic(null);
    setAnswers([]);
    setResult(null);
  }

  function handleGenerate() {
    setGenerating(true);
    // Simulate AI quiz generation with a brief delay
    setTimeout(() => {
      const quiz = generatePracticeQuiz(activeRole, 5);
      setGenerating(false);
      start(quiz);
    }, 700);
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPdfName(file.name);
    }
  }

  const progress = useMemo(() => {
    if (!topic) return 0;
    return Math.round(((current + 1) / topic.questions.length) * 100);
  }, [current, topic]);

  // ---- Select phase ----
  if (phase === 'select') {
    return (
      <div className="space-y-6">
        {/* Role banner + Generate Practice Quiz */}
        <div className="gov-card bg-gradient-to-r from-brand-600 to-brand-700 border-brand-700 p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  Quizzes tailored for {ROLE_META[activeRole]?.label ?? activeRole}
                </p>
                <p className="mt-1 text-xs text-brand-100">
                  {roleQuizzes.length} quiz topics matched to your role. Generate a
                  practice quiz or upload a PDF to create a custom quiz.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating…' : 'Generate Practice Quiz'}
            </button>
          </div>

          {/* PDF upload */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/20 pt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <Upload className="h-3.5 w-3.5" />
              Upload PDF (optional)
              <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            </label>
            {pdfName && (
              <span className="gov-chip bg-white/10 text-white border border-white/20">
                <FileText className="h-3.5 w-3.5" /> {pdfName}
              </span>
            )}
            <span className="text-[11px] text-brand-200">
              PDF upload simulates extracting questions — the practice quiz uses role-specific content.
            </span>
          </div>
        </div>

        {/* Toggle: role-specific vs all */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-900">
            {showAll ? 'All quiz topics' : `Quizzes for ${ROLE_META[activeRole]?.short ?? activeRole}`}
          </h3>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            {showAll ? 'Show only my role' : 'Show all topics'}
          </button>
        </div>

        {/* Quiz topic cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayQuizzes.map((t) => (
            <article key={t.id} className="gov-card gov-card-hover p-5 flex flex-col animate-fadeIn">
              <div className="flex items-center justify-between mb-2">
                <span className="gov-chip bg-brand-50 text-brand-700 border border-brand-200 w-fit">
                  {t.domain}
                </span>
                {t.roles && t.roles.includes(activeRole) && (
                  <span className="gov-chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                    For your role
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-ink-900 leading-snug">{t.title}</h4>
              <p className="mt-1.5 text-[11px] text-ink-400">{t.source}</p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {t.questions.length} questions
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> ~{t.questions.length * 2} min
                </span>
              </div>
              <button onClick={() => start(t)} className="gov-btn-primary mt-4 w-full">
                <Play className="h-4 w-4" /> Start quiz
              </button>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // ---- Taking phase ----
  if (phase === 'taking' && topic) {
    const q = topic.questions[current];
    const answered = answers[current] !== null;
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="gov-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="gov-chip bg-brand-50 text-brand-700 border border-brand-200">
              {topic.domain}
            </span>
            <span className="text-xs font-medium text-ink-500">
              Question {current + 1} of {topic.questions.length}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden mb-4">
            <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <h3 className="text-base font-semibold text-ink-900 leading-snug">{q.question}</h3>
          <div className="mt-4 space-y-2.5">
            {q.options.map((opt, i) => {
              const selected = answers[current] === i;
              return (
                <button
                  key={i}
                  onClick={() => selectOption(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-200'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                    selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 text-ink-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="gov-btn-ghost disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            {current < topic.questions.length - 1 ? (
              <button onClick={() => setCurrent((c) => c + 1)} disabled={!answered} className="gov-btn-primary disabled:opacity-40">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={finish} disabled={!answered} className="gov-btn-primary disabled:opacity-40">
                <Award className="h-4 w-4" /> Submit &amp; Score
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Result phase ----
  if (phase === 'result' && topic && result) {
    const pct = Math.round((result.score / result.total) * 100);
    const pass = pct >= 60;
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className={`gov-card p-6 text-center ${pass ? 'border-emerald-200' : 'border-amber-200'}`}>
          <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${pass ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <Award className={`h-8 w-8 ${pass ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <h3 className="mt-3 text-lg font-bold text-ink-900">You scored {result.score}/{result.total}</h3>
          <p className={`text-3xl font-extrabold ${pass ? 'text-emerald-600' : 'text-amber-600'}`}>{pct}%</p>
          <p className="mt-1 text-xs text-ink-500">
            {pass ? 'Well done — you meet the competency threshold.' : 'Review the explanations below and retake the quiz.'}
          </p>
          {savedFlag && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-emerald-600">
              <Save className="h-3.5 w-3.5" /> Attempt saved to analytics dashboard.
            </p>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => start(topic)} className="gov-btn-ghost">
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button onClick={reset} className="gov-btn-primary">
              <FileText className="h-4 w-4" /> Choose another topic
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink-900">Answer key &amp; explanations</h3>
          {result.items.map((item, i) => {
            const correct = item.selected === item.correct;
            return (
              <div key={i} className={`gov-card p-4 border-l-4 ${correct ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
                <div className="flex items-start gap-2.5">
                  {correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-800">{i + 1}. {item.question}</p>
                    {!correct && (
                      <p className="mt-1 text-xs text-rose-600">
                        Your answer: {String.fromCharCode(65 + item.selected)}{'  '}· Correct: {String.fromCharCode(65 + item.correct)}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                      <span className="font-semibold text-ink-700">Explanation: </span>{item.explanation}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
