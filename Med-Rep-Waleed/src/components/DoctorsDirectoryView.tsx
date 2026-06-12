import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, Search, Filter, MapPin, Link2, ArrowRight, Plus, Building2, Trash2, CheckCircle2 } from 'lucide-react';
import { getInitialState, linkDoctorToWorkplace, saveState } from '../utils/db';
import { Doctor } from '../types';

interface DoctorsDirectoryViewProps {
  lang: 'ar' | 'en';
}

export default function DoctorsDirectoryView({ lang }: DoctorsDirectoryViewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const state = useMemo(() => getInitialState(), [refreshKey]);
  const doctors = state.doctors || [];
  const visits = state.visits || [];

  // ===== Doctor-Workplace linking page state =====
  const [linkingDoctor, setLinkingDoctor] = useState<Doctor | null>(null);
  const [wpQuery, setWpQuery] = useState('');
  const [pendingWps, setPendingWps] = useState<string[]>([]);
  const [linkSaved, setLinkSaved] = useState(false);

  const wpSuggestions = useMemo(() => {
    const q = wpQuery.trim().toLowerCase();
    if (q.length < 3) return [];
    return (state.workplaces || [])
      .map((w) => w.name)
      .filter((n) => n && n.toLowerCase().includes(q) && !pendingWps.includes(n))
      .slice(0, 8);
  }, [wpQuery, state.workplaces, pendingWps]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  // Simplification for month filter - combining with DateRange or explicit month selection.
  const [month, setMonth] = useState(''); // e.g., '2026-06'

  const t = {
    ar: {
      title: 'قائمة الأطباء',
      name: 'اسم الطبيب',
      searchName: 'البحث باسم الطبيب...',
      speciality: 'التخصص',
      class: 'الفئة (Class)',
      filterClass: 'تصفية حسب الفئة',
      month: 'الشهر',
      dateFrom: 'من تاريخ',
      dateTo: 'إلى تاريخ',
      requiredVisits: 'الزيارات المطلوبة شهرياً',
      completedVisits: 'الزيارات المنجزة',
      totalVisits: 'كلي الزيارات',
      location: 'الموقع الجغرافي',
      yes: 'متوفر',
      no: 'غير متوفر',
      selectAll: 'الكل',
      noResults: 'لا يوجد أطباء مطابقين لشروط البحث.',
    },
    en: {
      title: 'Doctors Directory',
      name: 'Doctor Name',
      searchName: 'Search by doctor name...',
      speciality: 'Speciality',
      class: 'Class',
      filterClass: 'Filter by Class',
      month: 'Month',
      dateFrom: 'Date From',
      dateTo: 'Date To',
      requiredVisits: 'Required Visits/Month',
      completedVisits: 'Completed Visits',
      totalVisits: 'Total Visits',
      location: 'GPS Location',
      yes: 'Available',
      no: 'Not Available',
      selectAll: 'All',
      noResults: 'No doctors found matching filters.',
    }
  }[lang];

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (filterClass !== 'ALL' && doc.classRating !== filterClass) return false;
      if (searchName && !doc.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
  }, [doctors, filterClass, searchName]);

  const getDocStats = (docName: string, docClass: string) => {
    const docVisits = visits.filter(v => v.clientType === 'Doctor' && v.doctorName?.trim() === docName.trim());
    
    let total = docVisits.length;
    let completedInMonth = 0;

    let targetVisits = docVisits;

    if (dateFrom && dateTo) {
      const start = new Date(dateFrom).getTime();
      const end = new Date(dateTo).getTime();
      targetVisits = docVisits.filter(v => {
        const t = new Date(v.visitDate).getTime();
        return t >= start && t <= end;
      });
      // Update total within this range if dates applied? 
      // The requirement says "Total visits for doctor" (probably global), and "Completed visits based on month filter"
    }

    if (month) {
      completedInMonth = docVisits.filter(v => v.visitDate.startsWith(month)).length;
    } else {
      // If no explicit month selected, maybe count current month
      const currentMonth = new Date().toISOString().substring(0, 7);
      completedInMonth = docVisits.filter(v => v.visitDate.startsWith(currentMonth)).length;
    }

    let required = 1;
    if (docClass === 'A') required = 4;
    else if (docClass === 'B') required = 3;

    return { total, completed: completedInMonth, required };
  };

  /* =====================================================================
     FULL-PAGE: Doctor ↔ Workplace linking
     Opened by the "ربط" button. Type 3+ letters to see saved workplaces,
     pick one or more, then save — the doctor gets linked everywhere.
     ===================================================================== */
  if (linkingDoctor) {
    const existingLinks = [
      ...(linkingDoctor.workplace1 ? [linkingDoctor.workplace1] : []),
      ...(linkingDoctor.workplace2 ? [linkingDoctor.workplace2] : []),
      ...((linkingDoctor.workplaceLocations || []).map((l) => l.workplaceName)),
    ].filter((v, i, a) => a.indexOf(v) === i);

    return (
      <div className="space-y-4 fade-in text-slate-800 max-w-2xl mx-auto pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {lang === 'ar' ? 'ربط الطبيب بأماكن العمل' : 'Link Doctor to Workplaces'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {linkingDoctor.name} • {linkingDoctor.speciality || (lang === 'ar' ? 'غير محدد' : 'N/A')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setLinkingDoctor(null); setPendingWps([]); setWpQuery(''); setLinkSaved(false); }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            {lang === 'ar' ? 'رجوع للقائمة' : 'Back to list'}
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
          {/* Doctor info card */}
          <div className="bg-gradient-to-l from-indigo-600 to-violet-600 rounded-2xl p-4 text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-extrabold text-lg">
              {linkingDoctor.name.charAt(0)}
            </div>
            <div>
              <div className="font-extrabold text-sm">{linkingDoctor.name}</div>
              <div className="text-[11px] text-indigo-100">{linkingDoctor.speciality || '-'} • Class {linkingDoctor.classRating}</div>
            </div>
          </div>

          {/* Existing links */}
          {existingLinks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400">
                {lang === 'ar' ? 'أماكن العمل المرتبطة حالياً:' : 'Currently linked workplaces:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {existingLinks.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold">
                    <Building2 className="w-3 h-3 text-indigo-400" />
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workplace search input with autocomplete (3+ chars) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 block">
              {lang === 'ar' ? 'اكتب أول ثلاثة أحرف من اسم مكان العمل:' : 'Type the first 3 letters of the workplace name:'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={wpQuery}
                onChange={(e) => setWpQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: مست... / عيا... / صيد...' : 'e.g. hos... / cli...'}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
              {wpSuggestions.length > 0 && (
                <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-lg max-h-44 overflow-y-auto divide-y divide-slate-50">
                  {wpSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setPendingWps([...pendingWps, name]);
                        setWpQuery('');
                      }}
                      className="w-full text-right px-3.5 py-2.5 text-xs hover:bg-indigo-50 text-slate-700 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {wpQuery.trim().length > 0 && wpQuery.trim().length < 3 && (
              <div className="text-[10px] text-slate-400">
                {lang === 'ar' ? `اكتب ${3 - wpQuery.trim().length} حرف إضافي لإظهار الاقتراحات...` : `Type ${3 - wpQuery.trim().length} more character(s)...`}
              </div>
            )}
          </div>

          {/* Pending selected workplaces (can add more than one) */}
          {pendingWps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-emerald-600">
                {lang === 'ar' ? 'أماكن العمل المختارة للربط:' : 'Selected workplaces to link:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pendingWps.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold">
                    <Building2 className="w-3 h-3" />
                    {w}
                    <button
                      type="button"
                      onClick={() => setPendingWps(pendingWps.filter((_, x) => x !== i))}
                      className="text-emerald-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {linkSaved && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4" />
              {lang === 'ar'
                ? 'تم ربط الطبيب بأماكن العمل بنجاح وتحديث بياناته في كل صفحات التطبيق!'
                : 'Doctor linked to workplaces successfully and updated across all app pages!'}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setLinkingDoctor(null); setPendingWps([]); setWpQuery(''); setLinkSaved(false); }}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="button"
              disabled={pendingWps.length === 0}
              onClick={() => {
                // Link the doctor to every selected workplace. linkDoctorToWorkplace
                // fills workplace1/workplace2 + workplaceLocations with pinned
                // coordinates, so maps/reports/visit logs all reflect the change.
                pendingWps.forEach((w) => linkDoctorToWorkplace(linkingDoctor.name, w));
                setPendingWps([]);
                setLinkSaved(true);
                setRefreshKey((k) => k + 1);
                // refresh the linkingDoctor object from updated DB
                const updated = getInitialState().doctors.find((d) => d.id === linkingDoctor.id);
                if (updated) setLinkingDoctor(updated);
              }}
              className="px-6 py-2.5 bg-indigo-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Link2 className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'حفظ الربط' : 'Save Links'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t.title}</h2>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">{t.name}</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder={t.searchName}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">{t.filterClass}</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-slate-400" />
              </div>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none bg-white"
              >
                <option value="ALL">{t.selectAll}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">{t.month}</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="space-y-1.5 flex flex-col md:flex-row lg:flex-col gap-2">
            <div className="w-full">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">{t.dateFrom}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:ring-1 outline-none h-[42px]"
              />
            </div>
            <div className="w-full">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">{t.dateTo}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:ring-1 outline-none h-[42px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {filteredDoctors.length === 0 ? (
          <div className="p-10 text-center text-slate-500">{t.noResults}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3">{t.name}</th>
                  <th className="px-4 py-3 text-center">{t.class}</th>
                  <th className="px-4 py-3 text-center">{t.requiredVisits}</th>
                  <th className="px-4 py-3 text-center">{t.completedVisits}</th>
                  <th className="px-4 py-3 text-center">{t.totalVisits}</th>
                  <th className="px-4 py-3 text-center">{t.location}</th>
                  <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map((doc) => {
                  const stats = getDocStats(doc.name, doc.classRating);
                  const isComplete = stats.completed >= stats.required;
                  const hasLocation = doc.locationLatitude && doc.locationLongitude;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{doc.name}</div>
                        <div className="text-[11px] text-slate-500">{doc.speciality}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs ${
                          doc.classRating === 'A' ? 'bg-amber-100 text-amber-700' :
                          doc.classRating === 'B' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.classRating}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {stats.required}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {stats.completed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-600">
                        {stats.total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasLocation ? (
                          <div className="flex items-center justify-center gap-1 text-emerald-600">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs font-bold">{t.yes}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{t.no}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLinkingDoctor(doc);
                            setPendingWps([]);
                            setWpQuery('');
                            setLinkSaved(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'ربط' : 'Link'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
