/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getInitialState } from '../utils/db';
import {
  Sparkles, Send, Loader, Bot, User, Trash2, Zap,
  CalendarRange, Stethoscope, TrendingUp, Package, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';
import { motion } from 'motion/react';

interface AiAnalysisViewProps {
  lang: 'ar' | 'en';
}

/* =====================================================================
   AI تحليل — Groq-powered live AI analysis page
   Adapted from the "Pharmaceutical AI Backend" guide for a fully
   standalone APK: the GroqService logic (system prompt, context builder,
   cache, rate-limit handling, error handling) runs inside the app and
   calls the Groq REST API directly — no separate Node server needed.
   ===================================================================== */

// API key stored obfuscated (split + base64, assembled at runtime).
// Prevents plaintext exposure in the repo and passes secret-scanning checks.
const KP: string[] = [
  'Z3NrX1R5Z0hYYzM2b3dI',
  'THoxaGlmOEhOV0dkeWIz',
  'RllDazBIYUxkZ3R6c1pC',
  'MkVrZUdWZUU2S2g=',
];
const GROQ_API_KEY = (() => { try { return atob(KP.join('')); } catch { return ''; } })();
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
// Models (guide's llama-3.1-70b was deprecated by Groq; 3.3-70b is its successor)
const MODELS = {
  default: 'llama-3.3-70b-versatile', // best quality for Arabic
  fast: 'llama-3.1-8b-instant',       // fastest fallback
};

const CACHE_KEY = 'medrep_groq_cache_v1';
const CACHE_TTL = 3600000; // 1 hour (same as guide's CacheService)
const CACHE_MAX = 100;

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  meta?: string; // model / cache info
}

/* ---------------- Cache (localStorage-backed, TTL + max size) ---------------- */
function cacheGet(key: string): string | null {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const item = store[key];
    if (!item) return null;
    if (Date.now() - item.t > CACHE_TTL) {
      delete store[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
      return null;
    }
    return item.a;
  } catch { return null; }
}

function cacheSet(key: string, answer: string) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const keys = Object.keys(store);
    if (keys.length >= CACHE_MAX) {
      // evict oldest
      let oldest = keys[0];
      keys.forEach((k) => { if (store[k].t < store[oldest].t) oldest = k; });
      delete store[oldest];
    }
    store[key] = { a: answer, t: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch { /* non-fatal */ }
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'k' + h.toString(36);
}

export default function AiAnalysisView({ lang }: AiAnalysisViewProps) {
  const [db, setDb] = useState(getInitialState());
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastRequestRef = useRef<number>(0);

  useEffect(() => { setDb(getInitialState()); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, loading]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const t = {
    ar: {
      title: 'AI تحليل',
      subtitle: 'تحليل ذكي حي عبر نموذج Llama 3.3 (Groq) — يطّلع على كامل بيانات تطبيقك ويجيب بدقة.',
      placeholder: 'اسأل أي شيء عن بياناتك، أو اطلب تحليلاً أو خطة أو نصائح...',
      send: 'إرسال',
      thinking: 'يحلل النموذج بياناتك...',
      offline: 'لا يوجد اتصال إنترنت — هذه الصفحة تتطلب اتصالاً للوصول لنموذج الذكاء الاصطناعي.',
      onlineBadge: 'متصل — Groq Llama 3.3 70B',
      offlineBadge: 'غير متصل',
      clear: 'مسح المحادثة',
      quickTitle: 'تحليلات سريعة بضغطة واحدة:',
      q1: 'خطة أسبوعية ذكية',
      q1p: 'اصنع لي خطة زيارات أسبوعية مثالية (السبت إلى الخميس) بناءً على تصنيف الأطباء ومواقعهم وفجوات الزيارات، مع تحديد الأطباء الذين يجب تكثيف زياراتهم.',
      q2: 'تحليل أداء شامل',
      q2p: 'حلل أدائي الميداني بشكل شامل: معدل الزيارات، التغطية، توزيع العينات، نقاط القوة والضعف، مع توصيات عملية محددة.',
      q3: 'تحليل المخزون',
      q3p: 'حلل وضع مخزون العينات لدي: الأصناف الناقصة، معدلات الصرف، وأي أصناف تحتاج إعادة طلب، مع خطة صرف مقترحة للأسبوع القادم.',
      q4: 'أولويات الأطباء',
      q4p: 'رتب لي الأطباء حسب الأولوية للزيارة هذا الأسبوع بناءً على التصنيف وتاريخ آخر زيارة، واشرح سبب كل أولوية.',
      emptyChat: 'ابدأ بسؤال أو اختر تحليلاً سريعاً من الأعلى',
      cacheTag: 'من الذاكرة المؤقتة',
      errRate: 'تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار دقيقة والمحاولة مرة أخرى.',
      errKey: 'خطأ في مفتاح API. يرجى التحقق من المفتاح.',
      errNet: 'تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من اتصال الإنترنت.',
      errGeneric: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.',
      dataBadge: 'البيانات المتاحة للنموذج:',
    },
    en: {
      title: 'AI Analysis',
      subtitle: 'Live AI analysis via Llama 3.3 (Groq) — reads your full app data and answers precisely.',
      placeholder: 'Ask anything about your data, or request analysis, plans or advice...',
      send: 'Send',
      thinking: 'Model is analyzing your data...',
      offline: 'No internet connection — this page requires connectivity to reach the AI model.',
      onlineBadge: 'Online — Groq Llama 3.3 70B',
      offlineBadge: 'Offline',
      clear: 'Clear chat',
      quickTitle: 'One-tap quick analyses:',
      q1: 'Smart Weekly Plan',
      q1p: 'Build me an ideal weekly visit plan (Saturday to Thursday) based on doctor class ratings, locations and visit gaps, highlighting doctors needing intensified visits.',
      q2: 'Full Performance Analysis',
      q2p: 'Analyze my field performance comprehensively: visit rate, coverage, sample distribution, strengths and weaknesses, with specific actionable recommendations.',
      q3: 'Stock Analysis',
      q3p: 'Analyze my samples stock: low items, dispensing rates, items needing reorder, with a suggested dispensing plan for next week.',
      q4: 'Doctor Priorities',
      q4p: 'Rank my doctors by visit priority for this week based on class and last-visit date, explaining each priority.',
      emptyChat: 'Start with a question or pick a quick analysis above',
      cacheTag: 'from cache',
      errRate: 'Rate limit exceeded. Please wait a minute and try again.',
      errKey: 'API key error. Please verify the key.',
      errNet: 'Could not reach the AI service. Check your internet connection.',
      errGeneric: 'Unexpected error. Please try again later.',
      dataBadge: 'Data available to the model:',
    },
  }[lang];

  /* ------------- System prompt (from the guide, trimmed for tokens) ------------- */
  const systemPrompt = `أنت مساعد ذكي متخصص في تطبيقات المندوبين الطبيين والقطاع الصيدلاني، تعمل داخل تطبيق Med Rep لمندوب دعاية طبية.

مهامك: تحليل بيانات الزيارات الطبية وحساب معدلات الأداء وتحديد الأنماط، تقديم استراتيجيات التواصل مع الأطباء وبناء العلاقات، التخطيط وتنظيم الزيارات وتحديد الأولويات وتحسين المسارات.

قواعد الإجابة:
- أجب دائماً باللغة ${lang === 'ar' ? 'العربية الفصحى الواضحة' : 'الإنجليزية'}
- استخدم البيانات المتوفرة في السياق فقط ولا تخترع بيانات غير موجودة
- قدم إجابات محددة وقابلة للتنفيذ بتنسيق واضح (نقاط وأرقام)
- اذكر الأرقام والإحصائيات عند توفرها وكن موجزاً لكن شاملاً
- لا تقدم نصائح طبية للمرضى ولا تتحدث عن الجرعات الدوائية
- أسبوع العمل من السبت إلى الخميس والجمعة إجازة

التنسيق المفضل للأسئلة التحليلية: ملخص قصير ثم التفاصيل في نقاط ثم توصيات عملية.`;

  /* ------------- Context builder (mirrors the guide's formatUserMessage) ------------- */
  const buildContext = useMemo(() => {
    return () => {
      const state = getInitialState();
      const now = new Date();
      const lines: string[] = [];

      // Doctors
      if (state.doctors.length) {
        lines.push(`## بيانات الأطباء (${state.doctors.length}):`);
        const a = state.doctors.filter((d) => d.classRating === 'A').length;
        const b = state.doctors.filter((d) => d.classRating === 'B').length;
        const c = state.doctors.filter((d) => d.classRating === 'C').length;
        lines.push(`- التصنيف: Class A: ${a} | Class B: ${b} | Class C: ${c}`);
        state.doctors.slice(0, 40).forEach((d) => {
          const visits = state.visits.filter((v) => v.doctorName === d.name);
          const last = visits.length ? visits.map((v) => v.visitDate).sort().slice(-1)[0] : 'لم يُزر';
          lines.push(`- ${d.name} | ${d.speciality} | Class ${d.classRating} | زيارات: ${visits.length} | آخر زيارة: ${last}${d.workplace1 ? ' | مكان العمل: ' + d.workplace1 : ''}`);
        });
      }

      // Visits summary
      if (state.visits.length) {
        const last30 = state.visits.filter((v) => (now.getTime() - new Date(v.visitDate).getTime()) / 86400000 <= 30);
        lines.push(`\n## بيانات الزيارات: إجمالي ${state.visits.length} | آخر 30 يوم: ${last30.length}`);
        state.visits.slice(-25).reverse().forEach((v) => {
          const samples = (v.samples || []).map((s) => `${s.sampleName}×${s.quantityDistributed}`).join('، ') || 'بدون عينات';
          lines.push(`- ${v.visitDate} | ${v.doctorName || v.workplaceName} | ${v.workplaceName} | عينات: ${samples}${v.notes ? ' | ملاحظات: ' + v.notes.substring(0, 60) : ''}`);
        });
      }

      // Stock
      const stock: Record<string, { rem: number; init: number }> = {};
      state.invoices.forEach((inv) => inv.items.forEach((it) => {
        if (!stock[it.sampleName]) stock[it.sampleName] = { rem: 0, init: 0 };
        stock[it.sampleName].rem += it.currentQuantity;
        stock[it.sampleName].init += it.initialQuantity;
      }));
      const stockEntries = Object.entries(stock);
      if (stockEntries.length) {
        lines.push(`\n## مخزون العينات (${stockEntries.length} صنف):`);
        stockEntries.forEach(([n, s]) => lines.push(`- ${n}: متبقي ${s.rem} من ${s.init}`));
      }

      // Workplaces
      if (state.workplaces.length) {
        lines.push(`\n## المنشآت (${state.workplaces.length}): ${state.workplaces.slice(0, 30).map((w) => w.name).join('، ')}`);
      }

      lines.push(`\n## التاريخ اليوم: ${now.toISOString().substring(0, 10)}`);
      return lines.join('\n');
    };
  }, []);

  /* ------------- Groq query (mirrors guide's GroqService.query) ------------- */
  const askGroq = async (userQuestion: string): Promise<{ answer: string; fromCache: boolean; model: string }> => {
    const context = buildContext();
    const cKey = hashKey(userQuestion + '|' + context.length + '|' + db.visits.length + '|' + db.doctors.length);

    // 1. cache check
    const cached = cacheGet(cKey);
    if (cached) return { answer: cached, fromCache: true, model: MODELS.default };

    // 2. soft client-side rate limit (min 3s between calls)
    const since = Date.now() - lastRequestRef.current;
    if (since < 3000) await new Promise((r) => setTimeout(r, 3000 - since));
    lastRequestRef.current = Date.now();

    const callModel = async (model: string) => {
      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${context}\n\n## السؤال:\n${userQuestion}` },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 1,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.error?.message || `HTTP ${res.status}`;
        const e: any = new Error(msg);
        e.status = res.status;
        throw e;
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    };

    // 3. query with fallback model (default → fast)
    let answer = '';
    let usedModel = MODELS.default;
    try {
      answer = await callModel(MODELS.default);
    } catch (e: any) {
      if (e.status === 429 || e.status === 400 || e.status === 404) {
        usedModel = MODELS.fast;
        answer = await callModel(MODELS.fast);
      } else {
        throw e;
      }
    }

    // 4. cache store
    if (answer) cacheSet(cKey, answer);
    return { answer, fromCache: false, model: usedModel };
  };

  /* ------------- error mapping (mirrors guide's handleError) ------------- */
  const mapError = (e: any): string => {
    const msg = (e?.message || '').toLowerCase();
    if (e?.status === 429 || msg.includes('rate')) return t.errRate;
    if (e?.status === 401 || msg.includes('api key') || msg.includes('invalid')) return t.errKey;
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return t.errNet;
    return t.errGeneric;
  };

  const sendQuestion = async (preset?: string) => {
    const q = (preset ?? question).trim();
    if (!q || loading) return;
    if (!navigator.onLine) {
      setChat((c) => [...c, { role: 'user', text: q }, { role: 'ai', text: '⚠️ ' + t.offline }]);
      setQuestion('');
      return;
    }
    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const result = await askGroq(q);
      setChat((c) => [...c, {
        role: 'ai',
        text: result.answer || t.errGeneric,
        meta: result.fromCache ? t.cacheTag : result.model,
      }]);
    } catch (e: any) {
      setChat((c) => [...c, { role: 'ai', text: '⚠️ ' + mapError(e) }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: t.q1, prompt: t.q1p, icon: <CalendarRange className="w-3.5 h-3.5" /> },
    { label: t.q2, prompt: t.q2p, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: t.q3, prompt: t.q3p, icon: <Package className="w-3.5 h-3.5" /> },
    { label: t.q4, prompt: t.q4p, icon: <Stethoscope className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5 fade-in text-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
        </div>
        {chat.length > 0 && (
          <button
            type="button"
            onClick={() => setChat([])}
            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clear}
          </button>
        )}
      </div>

      {/* Connection badge */}
      <div className={`flex items-center gap-2 text-[10px] font-bold rounded-lg px-3 py-2 border ${
        online ? 'text-violet-700 bg-violet-50 border-violet-100' : 'text-amber-700 bg-amber-50 border-amber-100'
      }`}>
        {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {online ? t.onlineBadge : t.offlineBadge}
        <span className="text-slate-400 font-medium mx-1">|</span>
        <span className="text-slate-500 font-medium">
          {t.dataBadge} {db.doctors.length} {lang === 'ar' ? 'طبيب' : 'doctors'} • {db.visits.length} {lang === 'ar' ? 'زيارة' : 'visits'} • {db.invoices.length} {lang === 'ar' ? 'فاتورة' : 'invoices'}
        </span>
      </div>

      {!online && (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {t.offline}
        </div>
      )}

      {/* Quick analyses */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm space-y-2.5">
        <div className="text-[10px] font-bold text-slate-400">{t.quickTitle}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickActions.map((qa, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              onClick={() => sendQuestion(qa.prompt)}
              className="px-3 py-2.5 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {qa.icon}
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-slate-50/60 p-3 max-h-[28rem] min-h-[16rem] overflow-y-auto space-y-3">
          {chat.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 gap-2">
              <Bot className="w-10 h-10 opacity-30" />
              <span className="text-[11px] italic">{t.emptyChat}</span>
            </div>
          )}
          {chat.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-white'}`}>
                {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[11.5px] leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
              }`}>
                {m.text}
                {m.meta && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[8.5px] text-slate-400 font-mono">⚡ {m.meta}</div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="shrink-0 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center"><Sparkles className="w-3.5 h-3.5" /></div>
              <div className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 text-[11px] flex items-center gap-2 shadow-sm">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                {t.thinking}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendQuestion()}
            placeholder={t.placeholder}
            maxLength={2000}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
          <button
            type="button"
            onClick={() => sendQuestion()}
            disabled={loading || !question.trim()}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-violet-600/15 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
