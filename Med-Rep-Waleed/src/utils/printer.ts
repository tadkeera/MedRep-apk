/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveVirtualFile } from './db';

/**
 * Unified print + save pipeline.
 * - Inside the Med Rep APK: calls the native Android bridge which opens the
 *   phone's system print sheet (printer apps, Save as PDF, ...) AND writes a
 *   copy of the report into /Med Rep/download automatically.
 * - In a normal browser: falls back to a print popup window.
 * Always also registers the report in the app's virtual DOWNLOAD folder.
 */
export function printAndSaveReport(html: string, jobName: string, lang: 'ar' | 'en' = 'ar'): void {
  const cleanName = (jobName || `medrep_report_${Date.now()}`).replace(/[\\/:*?"<>|]/g, '_');

  // 1. Register a copy in the app's virtual DOWNLOAD registry (this also gets
  //    physically synced to /Med Rep/download by the native auto-sync layer).
  try {
    saveVirtualFile({
      name: `${cleanName}.html`,
      size: `${(html.length / 1024).toFixed(1)} KB`,
      dateModified: new Date().toISOString().replace('T', ' ').substring(0, 16),
      folder: 'DOWNLOAD',
      content: html,
      type: 'html',
    });
  } catch { /* non-fatal */ }

  // 2. Native Android system print dialog (preferred inside the APK)
  const w = window as any;
  if (w.MedRepNative && typeof w.MedRepNative.printHtml === 'function') {
    try {
      const b64 = btoa(unescape(encodeURIComponent(html)));
      w.MedRepNative.printHtml(b64, cleanName);
      return;
    } catch (err) {
      console.warn('Native print failed, falling back to window print:', err);
    }
  }

  // 3. Browser fallback: popup window with auto print trigger
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(lang === 'ar' ? 'تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.' : 'Could not open print window. Allow popups.');
    return;
  }
  printWindow.document.write(`${html}
    <script>window.onload = function() { setTimeout(function(){ window.print(); }, 400); };</script>`);
  printWindow.document.close();
}

/**
 * Strips internal legacy-migration note text from report content so it never
 * appears in printed/saved reports.
 */
export function cleanReportNotes(notes?: string): string {
  if (!notes) return '';
  return notes
    .replace(/زيارة مرحّلة تلقائياً من النظام القديم/g, '')
    .replace(/زيارة مرحلة تلقائياً من النظام القديم/g, '')
    .replace(/زيارة مرحّلة تلقائيا من النظام القديم/g, '')
    .trim();
}
