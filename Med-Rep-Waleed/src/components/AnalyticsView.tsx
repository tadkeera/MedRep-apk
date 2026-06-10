/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getInitialState } from '../utils/db';
import { Doctor, VisitLog } from '../types';
import {
  BrainCircuit, CalendarRange, Stethoscope, MessageCircleQuestion,
  Sparkles, Loader, Send, AlertTriangle, TrendingUp, FileDown, User, Bot,
} from 'lucide-react';
import { motion } from 'motion/react';

interface AnalyticsViewProps {
  lang: 'ar' | 'en';
}

/* ============================================================
   Local AI Analytics Engine
   Reads ALL application data (doctors, visits, samples stock,
   workplaces, cycle plans) and produces intelligent insights:
   1) Smart Monthly Plan
   2) Comprehensive per-doctor analysis & coaching advice
   3) "Ask Me" — free questions answered from live app data
   ============================================================ */

const CLASS_MONTHLY_TARGET: Record<string, number> = { A: 4, B: 2, C: 1 };

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}

interface DoctorInsight {
  doctor: Doctor;
  visits: VisitLog[];
  totalVisits: number;
  last30: number;
  lastVisitDate: string | null;
  daysSinceLast: number | null;
  avgGapDays: number | null;
  target: number;
  deficit: number; // target - last30 (>= 0 means needs more visits)
  priority: number; // higher = needs intensified visits
  samplesGiven: Record<string, number>;
  workplaces: string[];
}

function buildDoctorInsight(doctor: Doctor, allVisits: VisitLog[]): DoctorInsight {
  const visits = allVisits
    .filter((v) => v.doctorName === doctor.name)
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  const now = new Date();
  const last30 = visits.filter((v) => daysBetween(now, new Date(v.visitDate)) <= 30).length;
  const lastVisitDate = visits.length ? visits[visits.length - 1].visitDate : null;
  const daysSinceLast = lastVisitDate ? daysBetween(now, new Date(lastVisitDate)) : null;

  let avgGapDays: number | null = null;
  if (visits.length >= 2) {
    let total = 0;
    for (let i = 1; i < visits.length; i++) {
      total += daysBetween(new Date(visits[i].visitDate), new Date(visits[i - 1].visitDate));
    }
    avgGapDays = Math.round(total / (visits.length - 1));
  }

  const samplesGiven: Record<string, number> = {};
  visits.forEach((v) =>
    (v.samples || []).forEach((s) => {
      samplesGiven[s.sampleName] = (samplesGiven[s.sampleName] || 0) + s.quantityDistributed;
    })
  );

  const workplaces = Array.from(new Set(visits.map((v) => v.workplaceName).filter(Boolean)));
  if (doctor.workplace1 && !workplaces.includes(doctor.workplace1)) workplaces.push(doctor.workplace1);
  if (doctor.workplace2 && !workplaces.includes(doctor.workplace2)) workplaces.push(doctor.workplace2);

  const target = CLASS_MONTHLY_TARGET[doctor.classRating] || 1;
  const deficit = Math.max(0, target - last30);

  // Priority score: class weight + deficit + neglect duration
  const classWeight = doctor.classRating === 'A' ? 3 : doctor.classRating === 'B' ? 2 : 1;
  const neglectFactor = daysSinceLast === null ? 30 : daysSinceLast;
  const priority = classWeight * 10 + deficit * 8 + Math.min(neglectFactor, 60) / 2;

  return { doctor, visits, totalVisits: visits.length, last30, lastVisitDate, daysSinceLast, avgGapDays, target, deficit, priority, samplesGiven, workplaces };
}

export default function AnalyticsView({ lang }: AnalyticsViewProps) {
  const [db, setDb] = useState(getInitialState());
  const [activeTab, setActiveTab] = useState<'plan' | 'doctor' | 'ask'>('plan');

  // Monthly plan state
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Doctor analysis state
  const [doctorQuery, setDoctorQuery] = useState('');
  const [doctorReport, setDoctorReport] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);

  // Ask me state
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [askLoading, setAskLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDb(getInitialState());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const insights = useMemo(
    () => db.doctors.map((d) => buildDoctorInsight(d, db.visits)).sort((a, b) => b.priority - a.priority),
    [db]
  );

  const t = {
    ar: {
      title: 'التحليلات',
      subtitle: 'محرك ذكاء يطّلع على كل بيانات التطبيق: الأطباء، الزيارات، العينات، المواقع والخطط.',
      tabPlan: 'الخطة الشهرية الذكية',
      tabDoctor: 'تحليل الأطباء',
      tabAsk: 'اسألني',
      planTitle: '🧠 مولّد الخطة الشهرية الذكية',
      planDesc: 'يحلل مواقع الأطباء، تصنيفهم (Class)، عدد الزيارات السابقة، والفجوات الزمنية ليبني خطة شهرية من 4 أسابيع مع تحديد الأطباء الذين يجب تكثيف الزيارات لهم.',
      planBtn: 'توليد الخطة الشهرية الآن',
      planLoading: 'جاري تحليل البيانات وبناء الخطة...',
      doctorTitle: '🩺 التحليل الشامل للأطباء',
      doctorDesc: 'اكتب اسم الطبيب للحصول على تقرير شامل: كل الزيارات، العينات المصروفة، ونصائح عملية لتحسين الزيارات لهذا الطبيب.',
      doctorPlaceholder: 'اكتب اسم الطبيب هنا...',
      doctorBtn: 'إنشاء التقرير الشامل',
      doctorLoading: 'جاري تحليل سجل الطبيب...',
      doctorNotFound: 'لم يتم العثور على طبيب بهذا الاسم في قاعدة البيانات. تأكد من الاسم أو اختر من القائمة.',
      askTitle: '💬 اسألني — مساعدك الذكي',
      askDesc: 'اسأل أي سؤال عن بيانات التطبيق (الزيارات، الأطباء، العينات، المخزون) أو اطلب نصائح وطرق لتحسين عملك الميداني.',
      askPlaceholder: 'مثال: كم زيارة قمت بها هذا الشهر؟ / من الأطباء المهملون؟ / أعطني نصائح...',
      send: 'إرسال',
      thinking: 'جاري التحليل...',
      exportPdf: 'تصدير التقرير PDF',
      suggested: 'أسئلة مقترحة:',
      sugg1: 'كم عدد زياراتي هذا الشهر؟',
      sugg2: 'من الأطباء الذين يجب تكثيف زياراتهم؟',
      sugg3: 'ما حالة مخزون العينات؟',
      sugg4: 'أعطني نصائح لتحسين عملي',
      engineNote: 'محرك التحليل الذكي المحلي — يعمل بدون إنترنت ويطّلع على كامل بياناتك',
    },
    en: {
      title: 'Analytics',
      subtitle: 'An intelligence engine with full access to app data: doctors, visits, samples, locations and plans.',
      tabPlan: 'Smart Monthly Plan',
      tabDoctor: 'Doctor Analysis',
      tabAsk: 'Ask Me',
      planTitle: '🧠 Smart Monthly Plan Generator',
      planDesc: 'Analyzes doctor locations, class ratings, historical visit counts and time gaps to build a 4-week monthly plan and flags doctors requiring intensified visits.',
      planBtn: 'Generate Monthly Plan Now',
      planLoading: 'Analyzing data and building the plan...',
      doctorTitle: '🩺 Comprehensive Doctor Analysis',
      doctorDesc: 'Type a doctor name to get a full report: all visits, dispensed samples, and practical coaching advice to improve visits for this doctor.',
      doctorPlaceholder: 'Type the doctor name...',
      doctorBtn: 'Build Full Report',
      doctorLoading: 'Analyzing doctor history...',
      doctorNotFound: 'No doctor with this name found in the database. Check the name or pick from the list.',
      askTitle: '💬 Ask Me — Your Smart Assistant',
      askDesc: 'Ask anything about your app data (visits, doctors, samples, stock) or request tips and methods to improve your field work.',
      askPlaceholder: 'e.g. How many visits this month? / Which doctors are neglected? / Give me tips...',
      send: 'Send',
      thinking: 'Analyzing...',
      exportPdf: 'Export Report PDF',
      suggested: 'Suggested questions:',
      sugg1: 'How many visits did I do this month?',
      sugg2: 'Which doctors need intensified visits?',
      sugg3: 'What is the samples stock status?',
      sugg4: 'Give me tips to improve my work',
      engineNote: 'Local smart analytics engine — works offline with full access to your data',
    },
  }[lang];

  /* ----------------------------------------------------------
     1) SMART MONTHLY PLAN
     ---------------------------------------------------------- */
  const generateMonthlyPlan = () => {
    setPlanLoading(true);
    setPlanResult(null);

    setTimeout(() => {
      const ar = lang === 'ar';
      if (!db.doctors.length) {
        setPlanResult(ar ? '⚠️ لا يوجد أطباء مسجلون بعد. أضف الأطباء أولاً من صفحة الأطباء.' : '⚠️ No doctors registered yet. Add doctors first.');
        setPlanLoading(false);
        return;
      }

      // Doctors needing intensified visits (deficit or long neglect)
      const intensify = insights.filter(
        (i) => i.deficit > 0 || (i.daysSinceLast !== null && i.daysSinceLast > 21) || i.daysSinceLast === null
      );

      // Cluster doctors by workplace (geographic grouping proxy + coordinates when available)
      const clusters: Record<string, DoctorInsight[]> = {};
      insights.forEach((i) => {
        const key = i.workplaces[0] || (ar ? 'بدون منشأة محددة' : 'Unassigned');
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(i);
      });

      // Build visit quota: each doctor appears (deficit||target) times across the month
      type Slot = { ins: DoctorInsight; cluster: string };
      const slots: Slot[] = [];
      insights.forEach((i) => {
        const times = Math.max(i.deficit, i.deficit > 0 ? i.deficit : i.target);
        for (let k = 0; k < times; k++) slots.push({ ins: i, cluster: i.workplaces[0] || '-' });
      });
      slots.sort((a, b) => b.ins.priority - a.ins.priority);

      // Distribute into 4 weeks, keeping same-cluster doctors in the same week when possible
      const weeks: Slot[][] = [[], [], [], []];
      const clusterWeek: Record<string, number> = {};
      let nextWeek = 0;
      slots.forEach((s) => {
        let w: number;
        if (clusterWeek[s.cluster] !== undefined && weeks[clusterWeek[s.cluster]].length < Math.ceil(slots.length / 3)) {
          w = clusterWeek[s.cluster];
        } else {
          w = nextWeek % 4;
          clusterWeek[s.cluster] = w;
          nextWeek++;
        }
        // avoid duplicating the same doctor in the same week — push to lightest other week
        if (weeks[w].some((x) => x.ins.doctor.id === s.ins.doctor.id)) {
          let best = 0;
          for (let i = 1; i < 4; i++) if (weeks[i].length < weeks[best].length && !weeks[i].some((x) => x.ins.doctor.id === s.ins.doctor.id)) best = i;
          w = best;
        }
        weeks[w].push(s);
      });

      const monthName = new Date().toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
      const L: string[] = [];

      L.push(ar ? `📅 الخطة الشهرية الذكية — ${monthName}` : `📅 Smart Monthly Plan — ${monthName}`);
      L.push(ar
        ? `تم تحليل: ${db.doctors.length} طبيب • ${db.visits.length} زيارة سابقة • ${db.workplaces.length} منشأة`
        : `Analyzed: ${db.doctors.length} doctors • ${db.visits.length} past visits • ${db.workplaces.length} workplaces`);
      L.push('');

      // Intensify section
      L.push(ar ? '🚨 أطباء يجب تكثيف الزيارات لهم (أولوية قصوى):' : '🚨 Doctors requiring intensified visits (top priority):');
      if (intensify.length === 0) {
        L.push(ar ? '  ✓ ممتاز! جميع الأطباء ضمن المعدل المستهدف.' : '  ✓ Excellent! All doctors are within target frequency.');
      } else {
        intensify.slice(0, 10).forEach((i) => {
          const reason = i.daysSinceLast === null
            ? (ar ? 'لم تتم زيارته إطلاقاً' : 'never visited')
            : i.daysSinceLast > 21
              ? (ar ? `آخر زيارة منذ ${i.daysSinceLast} يوم` : `last visit ${i.daysSinceLast} days ago`)
              : (ar ? `نقص ${i.deficit} زيارة عن هدف الشهر` : `${i.deficit} visit(s) below monthly target`);
          L.push(`  • ${i.doctor.name} (Class ${i.doctor.classRating} — ${i.doctor.speciality || '-'}) ← ${reason}`);
        });
      }
      L.push('');

      // Weekly breakdown
      const weekNames = ar ? ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'الأسبوع الرابع'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      weeks.forEach((week, wi) => {
        L.push(`🗓️ ${weekNames[wi]}:`);
        if (!week.length) {
          L.push(ar ? '  (لا زيارات مجدولة)' : '  (no scheduled visits)');
        } else {
          // group by cluster inside week
          const byCluster: Record<string, DoctorInsight[]> = {};
          week.forEach((s) => {
            const key = s.cluster;
            if (!byCluster[key]) byCluster[key] = [];
            if (!byCluster[key].some((d) => d.doctor.id === s.ins.doctor.id)) byCluster[key].push(s.ins);
          });
          Object.entries(byCluster).forEach(([cl, docs]) => {
            L.push(ar ? `  📍 منطقة/منشأة: ${cl}` : `  📍 Area/Workplace: ${cl}`);
            docs.forEach((i) => {
              const star = i.deficit > 0 ? ' ⭐' : '';
              L.push(`     - ${i.doctor.name} (Class ${i.doctor.classRating})${star}`);
            });
          });
        }
        L.push('');
      });

      L.push(ar ? '💡 توصيات الخطة:' : '💡 Plan recommendations:');
      L.push(ar
        ? '  1. ابدأ كل أسبوع بأطباء Class A المعلّمين بنجمة ⭐ (الأكثر إلحاحاً).'
        : '  1. Start each week with starred ⭐ Class A doctors (most urgent).');
      L.push(ar
        ? '  2. الزيارات مجمّعة حسب المنشأة/المنطقة لتقليل وقت وتكلفة التنقل.'
        : '  2. Visits are grouped by workplace/area to minimize travel time and cost.');
      L.push(ar
        ? '  3. الهدف الشهري: Class A = 4 زيارات • B = زيارتان • C = زيارة واحدة.'
        : '  3. Monthly targets: Class A = 4 visits • B = 2 • C = 1.');

      setPlanResult(L.join('\n'));
      setPlanLoading(false);
    }, 700);
  };

  /* ----------------------------------------------------------
     2) COMPREHENSIVE DOCTOR ANALYSIS
     ---------------------------------------------------------- */
  const matchDoctor = (q: string): DoctorInsight | null => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
    const nq = norm(q);
    if (!nq) return null;
    let found = insights.find((i) => norm(i.doctor.name) === nq);
    if (!found) found = insights.find((i) => norm(i.doctor.name).includes(nq) || nq.includes(norm(i.doctor.name)));
    return found || null;
  };

  const buildDoctorReport = (i: DoctorInsight): string => {
    const ar = lang === 'ar';
    const d = i.doctor;
    const L: string[] = [];

    L.push(ar ? `📋 التقرير الشامل — ${d.name}` : `📋 Comprehensive Report — ${d.name}`);
    L.push(ar
      ? `التخصص: ${d.speciality || 'غير محدد'} • التصنيف: Class ${d.classRating} • المنشآت: ${i.workplaces.join('، ') || 'غير محدد'}`
      : `Speciality: ${d.speciality || 'N/A'} • Rating: Class ${d.classRating} • Workplaces: ${i.workplaces.join(', ') || 'N/A'}`);
    L.push('');

    // Visits summary
    L.push(ar ? `🗂️ سجل الزيارات (${i.totalVisits} زيارة):` : `🗂️ Visit history (${i.totalVisits} visits):`);
    if (!i.visits.length) {
      L.push(ar ? '  ⚠️ لم تُسجل أي زيارة لهذا الطبيب حتى الآن!' : '  ⚠️ No visits recorded for this doctor yet!');
    } else {
      i.visits.slice(-15).reverse().forEach((v) => {
        const samples = (v.samples || []).map((s) => `${s.sampleName} ×${s.quantityDistributed}`).join(' ، ') || (ar ? 'بدون عينات' : 'no samples');
        L.push(`  • ${v.visitDate} — ${v.workplaceName || '-'} | ${samples}${v.notes ? (ar ? ` | ملاحظة: ${v.notes}` : ` | note: ${v.notes}`) : ''}`);
      });
      if (i.visits.length > 15) L.push(ar ? `  ... و ${i.visits.length - 15} زيارة أقدم.` : `  ... and ${i.visits.length - 15} older visits.`);
    }
    L.push('');

    // Samples totals
    const sampleEntries = Object.entries(i.samplesGiven).sort((a, b) => b[1] - a[1]);
    L.push(ar ? '💊 إجمالي العينات المصروفة لهذا الطبيب:' : '💊 Total samples dispensed to this doctor:');
    if (!sampleEntries.length) {
      L.push(ar ? '  لا توجد عينات مصروفة.' : '  No samples dispensed.');
    } else {
      sampleEntries.forEach(([name, qty]) => L.push(`  • ${name}: ${qty}`));
    }
    L.push('');

    // KPIs
    L.push(ar ? '📊 مؤشرات الأداء:' : '📊 Performance indicators:');
    L.push(ar
      ? `  • زيارات آخر 30 يوماً: ${i.last30} / الهدف الشهري: ${i.target}`
      : `  • Visits last 30 days: ${i.last30} / monthly target: ${i.target}`);
    L.push(ar
      ? `  • آخر زيارة: ${i.lastVisitDate || 'لا يوجد'}${i.daysSinceLast !== null ? ` (منذ ${i.daysSinceLast} يوم)` : ''}`
      : `  • Last visit: ${i.lastVisitDate || 'none'}${i.daysSinceLast !== null ? ` (${i.daysSinceLast} days ago)` : ''}`);
    if (i.avgGapDays !== null) {
      L.push(ar ? `  • متوسط الفاصل بين الزيارات: ${i.avgGapDays} يوم` : `  • Average gap between visits: ${i.avgGapDays} days`);
    }
    L.push('');

    // Advice
    L.push(ar ? '🎯 نصائح لتحسين الزيارات لهذا الطبيب:' : '🎯 Advice to improve visits for this doctor:');
    const advice: string[] = [];
    if (i.totalVisits === 0) {
      advice.push(ar
        ? 'ابدأ بزيارة تعريفية فورية — هذا الطبيب لم يُزر مطلقاً وهو فرصة غير مستغلة.'
        : 'Schedule an introductory visit immediately — this doctor was never visited and is an untapped opportunity.');
    }
    if (i.deficit > 0) {
      advice.push(ar
        ? `كثّف الزيارات: ينقصه ${i.deficit} زيارة للوصول لهدف Class ${d.classRating} الشهري (${i.target} زيارات).`
        : `Intensify visits: ${i.deficit} more visit(s) needed to meet the Class ${d.classRating} monthly target (${i.target}).`);
    }
    if (i.daysSinceLast !== null && i.daysSinceLast > 21) {
      advice.push(ar
        ? `فجوة زمنية خطيرة (${i.daysSinceLast} يوم بدون زيارة) — رتّب زيارة خلال 48 ساعة لاستعادة العلاقة.`
        : `Critical time gap (${i.daysSinceLast} days without a visit) — arrange a visit within 48 hours to restore the relationship.`);
    }
    if (i.avgGapDays !== null && i.avgGapDays > 30 && d.classRating === 'A') {
      advice.push(ar
        ? 'طبيب Class A بمتوسط فاصل أكبر من 30 يوماً — اجعل دورته كل 7-10 أيام.'
        : 'Class A doctor with >30 day average gap — tighten the cycle to every 7-10 days.');
    }
    if (sampleEntries.length === 1) {
      advice.push(ar
        ? 'يتم صرف نوع عينة واحد فقط — نوّع العينات المقدمة لتوسيع وصف المنتجات.'
        : 'Only one sample type dispensed — diversify samples to broaden product prescriptions.');
    }
    if (!sampleEntries.length && i.totalVisits > 0) {
      advice.push(ar
        ? 'زيارات بدون أي عينات — اصطحب عينات مناسبة لتخصصه في الزيارة القادمة لرفع التأثير.'
        : 'Visits without any samples — bring samples matching the speciality next time to boost impact.');
    }
    const visitsWithNotes = i.visits.filter((v) => v.notes && v.notes.trim()).length;
    if (i.totalVisits > 0 && visitsWithNotes / i.totalVisits < 0.5) {
      advice.push(ar
        ? 'أقل من نصف الزيارات موثقة بملاحظات — سجّل اهتمامات الطبيب واعتراضاته بعد كل زيارة لبناء ملف معرفي.'
        : 'Less than half of visits have notes — record the doctor’s interests and objections after each visit.');
    }
    if (i.deficit === 0 && i.daysSinceLast !== null && i.daysSinceLast <= 14 && i.totalVisits > 0) {
      advice.push(ar
        ? 'أداء ممتاز مع هذا الطبيب! حافظ على نفس الإيقاع وفكّر في طلب إحالات لأطباء زملاء.'
        : 'Excellent performance with this doctor! Keep the rhythm and consider asking for peer referrals.');
    }
    if (!advice.length) {
      advice.push(ar ? 'استمر بالمتابعة المنتظمة وحدّث بياناته أولاً بأول.' : 'Continue regular follow-up and keep data updated.');
    }
    advice.forEach((a, idx) => L.push(`  ${idx + 1}. ${a}`));

    return L.join('\n');
  };

  const analyzeDoctor = () => {
    setDoctorLoading(true);
    setDoctorReport(null);
    setTimeout(() => {
      const found = matchDoctor(doctorQuery);
      setDoctorReport(found ? buildDoctorReport(found) : t.doctorNotFound);
      setDoctorLoading(false);
    }, 600);
  };

  /* ----------------------------------------------------------
     3) ASK ME — data-aware Q&A engine
     ---------------------------------------------------------- */
  const answerQuestion = (q: string): string => {
    const ar = lang === 'ar';
    const nq = q.trim().toLowerCase();
    const now = new Date();

    // Did the user mention a doctor name?
    const mentioned = insights.find((i) => nq.includes(i.doctor.name.toLowerCase()) || i.doctor.name.toLowerCase().includes(nq));

    const has = (...keys: string[]) => keys.some((k) => nq.includes(k));

    // Doctor-specific question
    if (mentioned && nq.length > 2) {
      return buildDoctorReport(mentioned);
    }

    // Visits count questions
    if (has('كم زيار', 'عدد الزيار', 'how many visit', 'visits count', 'زياراتي')) {
      const thisMonth = db.visits.filter((v) => {
        const d = new Date(v.visitDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      const last30 = db.visits.filter((v) => daysBetween(now, new Date(v.visitDate)) <= 30).length;
      const classA = db.visits.filter((v) => v.doctorClass === 'A').length;
      return ar
        ? `📊 إحصائيات زياراتك:\n• إجمالي الزيارات المسجلة: ${db.visits.length}\n• زيارات هذا الشهر: ${thisMonth}\n• زيارات آخر 30 يوماً: ${last30}\n• زيارات أطباء Class A: ${classA}\n\n💡 نصيحة: حافظ على معدل لا يقل عن 8-10 زيارات أسبوعياً لتغطية مثالية.`
        : `📊 Your visit statistics:\n• Total recorded visits: ${db.visits.length}\n• Visits this month: ${thisMonth}\n• Visits in last 30 days: ${last30}\n• Class A doctor visits: ${classA}\n\n💡 Tip: keep at least 8-10 visits weekly for ideal coverage.`;
    }

    // Neglected / intensify questions
    if (has('مهمل', 'تكثيف', 'إهمال', 'اهمال', 'يجب زيار', 'neglect', 'intensif', 'overdue', 'لم أزر', 'لم ازر')) {
      const list = insights.filter((i) => i.deficit > 0 || i.daysSinceLast === null || (i.daysSinceLast ?? 0) > 21).slice(0, 8);
      if (!list.length) return ar ? '✅ رائع! لا يوجد أطباء مهملون — جميعهم ضمن المعدل المستهدف.' : '✅ Great! No neglected doctors — all within target.';
      const lines = list.map((i) => {
        const why = i.daysSinceLast === null ? (ar ? 'لم يُزر إطلاقاً' : 'never visited') : (ar ? `آخر زيارة منذ ${i.daysSinceLast} يوم • ينقصه ${i.deficit} زيارة` : `last visit ${i.daysSinceLast}d ago • ${i.deficit} visit(s) short`);
        return `• ${i.doctor.name} (Class ${i.doctor.classRating}) — ${why}`;
      });
      return (ar ? '🚨 الأطباء الذين يجب تكثيف الزيارات لهم:\n' : '🚨 Doctors requiring intensified visits:\n') + lines.join('\n') +
        (ar ? '\n\n💡 ابدأ بهم في أول أيام الأسبوع القادم حسب الترتيب أعلاه (مرتبون بالأولوية).' : '\n\n💡 Start with them early next week in the order above (sorted by priority).');
    }

    // Best / most visited doctor
    if (has('أفضل طبيب', 'افضل طبيب', 'أكثر طبيب', 'اكثر طبيب', 'most visited', 'best doctor', 'top doctor')) {
      const top = [...insights].sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 5).filter((i) => i.totalVisits > 0);
      if (!top.length) return ar ? 'لا توجد زيارات مسجلة بعد.' : 'No visits recorded yet.';
      return (ar ? '🏆 الأطباء الأكثر زيارة:\n' : '🏆 Most visited doctors:\n') +
        top.map((i, x) => `${x + 1}. ${i.doctor.name} — ${i.totalVisits} ${ar ? 'زيارة' : 'visits'} (Class ${i.doctor.classRating})`).join('\n');
    }

    // Samples / stock questions
    if (has('عينات', 'عينة', 'مخزون', 'سحب', 'صرف', 'sample', 'stock', 'inventory')) {
      const stock: Record<string, { remaining: number; initial: number }> = {};
      db.invoices.forEach((inv) =>
        inv.items.forEach((it) => {
          if (!stock[it.sampleName]) stock[it.sampleName] = { remaining: 0, initial: 0 };
          stock[it.sampleName].remaining += it.currentQuantity;
          stock[it.sampleName].initial += it.initialQuantity;
        })
      );
      const dispensed: Record<string, number> = {};
      db.visits.forEach((v) => (v.samples || []).forEach((s) => { dispensed[s.sampleName] = (dispensed[s.sampleName] || 0) + s.quantityDistributed; }));
      const entries = Object.entries(stock);
      if (!entries.length) return ar ? 'لا توجد فواتير عينات مسجلة في المستودع.' : 'No sample invoices registered in the warehouse.';
      const lines = entries.map(([name, s]) => {
        const pct = s.initial ? Math.round((s.remaining / s.initial) * 100) : 0;
        const warn = pct <= 20 ? ' ⚠️' : '';
        return `• ${name}: ${ar ? 'متبقي' : 'remaining'} ${s.remaining}/${s.initial} (${pct}%)${warn} — ${ar ? 'مصروف' : 'dispensed'}: ${dispensed[name] || 0}`;
      });
      const low = entries.filter(([, s]) => s.initial && s.remaining / s.initial <= 0.2);
      return (ar ? '💊 حالة مخزون العينات:\n' : '💊 Samples stock status:\n') + lines.join('\n') +
        (low.length
          ? (ar ? `\n\n⚠️ تنبيه: ${low.length} صنف تحت 20% — اطلب دفعة جديدة قريباً.` : `\n\n⚠️ Alert: ${low.length} item(s) below 20% — reorder soon.`)
          : (ar ? '\n\n✅ المخزون بوضع جيد.' : '\n\n✅ Stock levels are healthy.'));
    }

    // Plan questions
    if (has('خطة', 'خطه', 'plan', 'جدول', 'schedule')) {
      const urgent = insights.filter((i) => i.deficit > 0).length;
      return ar
        ? `📅 ملخص التخطيط:\n• أطباء يحتاجون زيارات إضافية هذا الشهر: ${urgent}\n• إجمالي الأطباء: ${db.doctors.length} (A: ${db.doctors.filter((d) => d.classRating === 'A').length} • B: ${db.doctors.filter((d) => d.classRating === 'B').length} • C: ${db.doctors.filter((d) => d.classRating === 'C').length})\n\n💡 انتقل لتبويب "الخطة الشهرية الذكية" واضغط زر التوليد للحصول على خطة 4 أسابيع كاملة مجمعة جغرافياً.`
        : `📅 Planning summary:\n• Doctors needing extra visits this month: ${urgent}\n• Total doctors: ${db.doctors.length} (A: ${db.doctors.filter((d) => d.classRating === 'A').length} • B: ${db.doctors.filter((d) => d.classRating === 'B').length} • C: ${db.doctors.filter((d) => d.classRating === 'C').length})\n\n💡 Open the "Smart Monthly Plan" tab and hit generate for a full geographic 4-week plan.`;
    }

    // Doctors count / list
    if (has('كم طبيب', 'عدد الأطباء', 'عدد الاطباء', 'how many doctor', 'doctors count', 'قائمة الأطباء', 'قائمة الاطباء')) {
      const a = db.doctors.filter((d) => d.classRating === 'A').length;
      const b = db.doctors.filter((d) => d.classRating === 'B').length;
      const c = db.doctors.filter((d) => d.classRating === 'C').length;
      return ar
        ? `👨‍⚕️ قاعدة الأطباء:\n• الإجمالي: ${db.doctors.length}\n• Class A: ${a} • Class B: ${b} • Class C: ${c}\n• منشآت مسجلة: ${db.workplaces.length}\n\n💡 يمكنك كتابة اسم أي طبيب هنا للحصول على تقريره الكامل فوراً.`
        : `👨‍⚕️ Doctors base:\n• Total: ${db.doctors.length}\n• Class A: ${a} • Class B: ${b} • Class C: ${c}\n• Registered workplaces: ${db.workplaces.length}\n\n💡 Type any doctor name here to get their full report instantly.`;
    }

    // Tips / advice questions
    if (has('نصائح', 'نصيحة', 'تحسين', 'طور', 'تطوير', 'tips', 'advice', 'improve', 'كيف أ', 'كيف ا', 'how to', 'how can')) {
      const neglectCount = insights.filter((i) => i.deficit > 0).length;
      const noNotes = db.visits.filter((v) => !v.notes || !v.notes.trim()).length;
      const tips: string[] = [];
      if (neglectCount > 0) tips.push(ar ? `لديك ${neglectCount} طبيب تحت الهدف الشهري — خصص أول ساعتين من كل يوم لهم.` : `You have ${neglectCount} doctors below monthly target — dedicate the first 2 hours daily to them.`);
      if (db.visits.length && noNotes / db.visits.length > 0.4) tips.push(ar ? 'وثّق ملاحظات بعد كل زيارة (اعتراضات الطبيب، اهتماماته) — هذا يضاعف فعالية الزيارة التالية.' : 'Write notes after every visit (objections, interests) — it doubles the next visit’s effectiveness.');
      tips.push(ar ? 'جمّع زيارات اليوم الواحد في منطقة جغرافية واحدة لتقليل التنقل 30-40%.' : 'Cluster each day’s visits in one geographic area to cut travel by 30-40%.');
      tips.push(ar ? 'اربط كل عينة تصرفها برسالة علمية محددة، ولا تصرف عينات بدون هدف وصفي.' : 'Tie every sample to a specific scientific message; never dispense samples without a prescribing goal.');
      tips.push(ar ? 'راجع تبويب "تحليل الأطباء" أسبوعياً لأهم 5 أطباء Class A لديك.' : 'Review the "Doctor Analysis" tab weekly for your top 5 Class A doctors.');
      tips.push(ar ? 'خذ نسخة احتياطية من بياناتك أسبوعياً من صفحة المستندات.' : 'Take a weekly backup of your data from the documents page.');
      return (ar ? '💡 نصائح مخصصة بناءً على بياناتك:\n' : '💡 Personalized tips based on your data:\n') + tips.map((s, i2) => `${i2 + 1}. ${s}`).join('\n');
    }

    // Fallback: general overview
    const thisMonth = db.visits.filter((v) => {
      const d = new Date(v.visitDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return ar
      ? `🤖 لم أتعرف على سؤال محدد، لكن إليك نظرة عامة على بياناتك:\n• الأطباء: ${db.doctors.length} • الزيارات: ${db.visits.length} (هذا الشهر: ${thisMonth})\n• الفواتير: ${db.invoices.length} • المنشآت: ${db.workplaces.length}\n\nجرّب أسئلة مثل:\n• "كم زيارة قمت بها هذا الشهر؟"\n• "من الأطباء الذين يجب تكثيف زياراتهم؟"\n• "ما حالة مخزون العينات؟"\n• اكتب اسم أي طبيب لتقريره الكامل.`
      : `🤖 I couldn’t identify a specific question, but here’s your data overview:\n• Doctors: ${db.doctors.length} • Visits: ${db.visits.length} (this month: ${thisMonth})\n• Invoices: ${db.invoices.length} • Workplaces: ${db.workplaces.length}\n\nTry questions like:\n• "How many visits this month?"\n• "Which doctors need intensified visits?"\n• "What is the samples stock status?"\n• Or type any doctor name for a full report.`;
  };

  const sendQuestion = (preset?: string) => {
    const q = (preset ?? question).trim();
    if (!q || askLoading) return;
    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setAskLoading(true);
    setTimeout(() => {
      const answer = answerQuestion(q);
      setChat((c) => [...c, { role: 'ai', text: answer }]);
      setAskLoading(false);
    }, 650);
  };

  /* ---------- PDF export for plan / doctor report ---------- */
  const exportAsPdf = (content: string, title: string) => {
    const repName = localStorage.getItem('medrep_representative_name') || (lang === 'ar' ? 'مندوب الدعاية الطبية' : 'Medical Representative');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>body{font-family:'Cairo',sans-serif;direction:${lang === 'ar' ? 'rtl' : 'ltr'};margin:36px;color:#1e293b;line-height:1.9;}
      h1{font-size:18px;color:#1e1b4b;border-bottom:3px double #cbd5e1;padding-bottom:12px;}
      .meta{font-size:11px;color:#64748b;margin-bottom:18px;}
      pre{white-space:pre-wrap;font-family:'Cairo',sans-serif;font-size:12.5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;}</style></head>
      <body><h1>${title}</h1><div class="meta">${repName} — ${new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</div>
      <pre>${content.replace(/</g, '&lt;')}</pre>
      <script>window.onload=function(){window.print();};</script></body></html>`);
    w.document.close();
  };

  const TabBtn = ({ id, icon, label }: { id: 'plan' | 'doctor' | 'ask'; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        activeTab === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-5 fade-in text-slate-800" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{t.title}</h2>
          <p className="text-xs text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      {/* Engine badge */}
      <div className="flex items-center gap-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 font-bold">
        <Sparkles className="w-3.5 h-3.5" />
        {t.engineNote}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn id="plan" icon={<CalendarRange className="w-4 h-4" />} label={t.tabPlan} />
        <TabBtn id="doctor" icon={<Stethoscope className="w-4 h-4" />} label={t.tabDoctor} />
        <TabBtn id="ask" icon={<MessageCircleQuestion className="w-4 h-4" />} label={t.tabAsk} />
      </div>

      {/* ============ TAB 1: SMART MONTHLY PLAN ============ */}
      {activeTab === 'plan' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-indigo-600" />
              {t.planTitle}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">{t.planDesc}</p>
          </div>

          <button
            type="button"
            onClick={generateMonthlyPlan}
            disabled={planLoading}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/15 transition-all cursor-pointer w-full justify-center"
          >
            {planLoading ? (<><Loader className="w-4 h-4 animate-spin" />{t.planLoading}</>) : (<><Sparkles className="w-4 h-4" />{t.planBtn}</>)}
          </button>

          {planResult && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 text-xs leading-relaxed space-y-3">
              <div className="text-[10px] text-indigo-300 font-mono flex items-center justify-between border-b border-slate-800 pb-2">
                <span>⚡ {lang === 'ar' ? 'الخطة الشهرية الذكية' : 'Smart Monthly Plan'}</span>
                <span>{lang === 'ar' ? 'محرك التحليل المحلي' : 'Local analytics engine'}</span>
              </div>
              <div className="whitespace-pre-line text-slate-200 max-h-96 overflow-y-auto pr-1">{planResult}</div>
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => exportAsPdf(planResult, lang === 'ar' ? 'الخطة الشهرية الذكية' : 'Smart Monthly Plan')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <FileDown className="w-3 h-3" />
                  {t.exportPdf}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ============ TAB 2: DOCTOR ANALYSIS ============ */}
      {activeTab === 'doctor' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
              {t.doctorTitle}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">{t.doctorDesc}</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              list="analytics-doctors-list"
              value={doctorQuery}
              onChange={(e) => setDoctorQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doctorQuery.trim() && analyzeDoctor()}
              placeholder={t.doctorPlaceholder}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            <datalist id="analytics-doctors-list">
              {db.doctors.map((d) => <option key={d.id} value={d.name} />)}
            </datalist>
            <button
              type="button"
              onClick={analyzeDoctor}
              disabled={doctorLoading || !doctorQuery.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/15 transition-all cursor-pointer whitespace-nowrap"
            >
              {doctorLoading ? <Loader className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {doctorLoading ? t.doctorLoading : t.doctorBtn}
            </button>
          </div>

          {/* Quick doctor chips */}
          {db.doctors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {db.doctors.slice(0, 8).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setDoctorQuery(d.name); }}
                  className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 rounded-md text-[10px] font-bold transition-all cursor-pointer"
                >
                  {d.name} ({d.classRating})
                </button>
              ))}
            </div>
          )}

          {doctorReport && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 text-xs leading-relaxed space-y-3">
              <div className="text-[10px] text-indigo-300 font-mono flex items-center justify-between border-b border-slate-800 pb-2">
                <span>⚡ {lang === 'ar' ? 'تقرير التحليل الشامل' : 'Comprehensive Analysis Report'}</span>
                <span>{lang === 'ar' ? 'محرك التحليل المحلي' : 'Local analytics engine'}</span>
              </div>
              <div className="whitespace-pre-line text-slate-200 max-h-96 overflow-y-auto pr-1">{doctorReport}</div>
              {doctorReport !== t.doctorNotFound && (
                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => exportAsPdf(doctorReport, lang === 'ar' ? `تقرير الطبيب — ${doctorQuery}` : `Doctor Report — ${doctorQuery}`)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <FileDown className="w-3 h-3" />
                    {t.exportPdf}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ============ TAB 3: ASK ME ============ */}
      {activeTab === 'ask' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-indigo-600" />
              {t.askTitle}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">{t.askDesc}</p>
          </div>

          {/* Suggested questions */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400">{t.suggested}</div>
            <div className="flex flex-wrap gap-1.5">
              {[t.sugg1, t.sugg2, t.sugg3, t.sugg4].map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendQuestion(s)}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-96 min-h-[180px] overflow-y-auto space-y-3">
            {chat.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
                <Bot className="w-8 h-8 opacity-40" />
                <span className="text-[11px] italic">{lang === 'ar' ? 'اكتب سؤالك أو اختر من الأسئلة المقترحة أعلاه' : 'Type your question or pick a suggestion above'}</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed whitespace-pre-line ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {askLoading && (
              <div className="flex gap-2">
                <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Bot className="w-3.5 h-3.5" /></div>
                <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 text-[11px] flex items-center gap-2">
                  <Loader className="w-3 h-3 animate-spin" />
                  {t.thinking}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendQuestion()}
              placeholder={t.askPlaceholder}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={() => sendQuestion()}
              disabled={askLoading || !question.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/15 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {t.send}
            </button>
          </div>
        </motion.div>
      )}

      {/* Data coverage footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: lang === 'ar' ? 'الأطباء' : 'Doctors', value: db.doctors.length },
          { label: lang === 'ar' ? 'الزيارات' : 'Visits', value: db.visits.length },
          { label: lang === 'ar' ? 'الفواتير' : 'Invoices', value: db.invoices.length },
          { label: lang === 'ar' ? 'المنشآت' : 'Workplaces', value: db.workplaces.length },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-extrabold text-indigo-600">{s.value}</div>
            <div className="text-[10px] text-slate-500 font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert if no data */}
      {db.doctors.length === 0 && (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lang === 'ar'
            ? 'لا توجد بيانات أطباء بعد — أضف الأطباء والزيارات أولاً لتحصل على تحليلات دقيقة.'
            : 'No doctor data yet — add doctors and visits first to get accurate analytics.'}
        </div>
      )}
    </div>
  );
}
