import { useMemo, useState } from 'react';
import {
  FileText, Play, CheckCircle2, XCircle, RotateCcw, Award,
  ChevronRight, ChevronLeft, Clock, Save, Sparkles, Upload,
  Loader2, MessageSquareText, Send, Bot,
} from 'lucide-react';
import {
  QUIZ_TOPICS, getQuizzesForRole, generatePracticeQuiz,
  generateQuizFromText, type QuizTopic,
} from '@/lib/quizBank';
import { ROLE_META } from '@/lib/domains';
import type { JobRole, QuizResultItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Phase = 'select' | 'taking' | 'result';

// Basic PDF text extraction from raw bytes — extracts text from BT...ET blocks
function extractTextFromPdfBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';
  // Decode as latin1 to preserve byte-level access to PDF operators
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  // Extract text between parentheses within BT...ET blocks
  const btEtRegex = /BT\s+([\s\S]*?)\s+ET/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];
    // Find all (text) Tj or (text) TJ sequences
    const textRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(block)) !== null) {
      text += textMatch[1].replace(/\\([()\\])/g, '$1') + ' ';
    }
    // Also handle array form: [(text1) -250 (text2)] TJ
    const arrayTextRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = arrayTextRegex.exec(block)) !== null) {
      if (!text.includes(arrMatch[1])) {
        text += arrMatch[1].replace(/\\([()\\])/g, '$1') + ' ';
      }
    }
  }
  return text.trim();
}

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
  const [pdfText, setPdfText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // PDF Assistant state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const activeRole = user?.jobRole ?? 'SSO';

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
    setTimeout(() => {
      const quiz = generatePracticeQuiz(activeRole, 5);
      setGenerating(false);
      start(quiz);
    }, 700);
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfName(file.name);
    setParseError(null);
    setParsing(true);
    setPdfText('');

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const buffer = await file.arrayBuffer();
        const extracted = extractTextFromPdfBytes(buffer);
        if (extracted.length < 20) {
          setParseError('Could not extract text from this PDF. It may be a scanned image. Try a text-based PDF.');
          setPdfText('');
        } else {
          setPdfText(extracted);
        }
      } else {
        // Plain text file
        const text = await file.text();
        setPdfText(text);
      }
    } catch {
      setParseError('Failed to read the file. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  function handleGenerateFromPdf() {
    if (!pdfText || pdfText.length < 20) return;
    setGenerating(true);
    setTimeout(() => {
      const quiz = generateQuizFromText(pdfText, pdfName, 5);
      setGenerating(false);
      start(quiz);
    }, 700);
  }

  function handleSendChat() {
    if (!chatInput.trim() || !pdfText) return;
    const question = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: question }]);
    setChatInput('');
    setChatLoading(true);

    // Simple text-based answer: find the most relevant sentence from the document
    setTimeout(() => {
      const sentences = pdfText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      // Score sentences by keyword overlap with the question
      const questionWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      let bestSentence = '';
      let bestScore = 0;
      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        let score = 0;
        for (const word of questionWords) {
          if (lower.includes(word)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestSentence = sentence;
        }
      }

      const answer = bestScore > 0
        ? `Based on the uploaded document "${pdfName}":\n\n"${bestSentence}"`
        : `I couldn't find a direct answer to that question in the uploaded document. Try rephrasing your question or ask about a different topic covered in the document.`;

      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      setChatLoading(false);
    }, 500);
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
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate Practice Quiz'}
            </button>
          </div>

          {/* PDF upload + parse */}
          <div className="mt-4 border-t border-white/20 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <Upload className="h-3.5 w-3.5" />
                Upload PDF / Text
                <input type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={handlePdfUpload} />
              </label>
              {pdfName && (
                <span className="gov-chip bg-white/10 text-white border border-white/20">
                  <FileText className="h-3.5 w-3.5" /> {pdfName}
                </span>
              )}
              {parsing && (
                <span className="flex items-center gap-1.5 text-xs text-brand-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting text…
                </span>
              )}
              {pdfText && !parsing && (
                <button
                  onClick={handleGenerateFromPdf}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? 'Generating…' : 'Generate Quiz from PDF'}
                </button>
              )}
            </div>
            {parseError && (
              <p className="mt-2 text-xs text-amber-200">{parseError}</p>
            )}
            {pdfText && !parseError && (
              <p className="mt-2 text-[11px] text-brand-200">
                Extracted {pdfText.length} characters. Generate a quiz or ask questions below.
              </p>
            )}
          </div>
        </div>

        {/* PDF Assistant Q&A */}
        {pdfText && (
          <section className="gov-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-5 w-5 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">PDF Assistant</h3>
              <span className="gov-chip bg-brand-50 text-brand-700 border border-brand-200">
                {pdfName}
              </span>
            </div>
            <p className="text-xs text-ink-500 mb-4">
              Ask questions about the uploaded document. The assistant searches the extracted text for relevant answers.
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-4">
              {chatMessages.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">
                  No messages yet. Ask a question about the document above.
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white border border-ink-200 text-ink-700'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                      <MessageSquareText className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching document…
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                className="gov-input flex-1"
                placeholder="Ask a question about the document…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="gov-btn-primary disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

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
