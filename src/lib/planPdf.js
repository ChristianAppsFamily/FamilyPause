import { jsPDF } from "jspdf";
import { calendarTitle } from "./googleCalendar";
import { getPlanningWeekDates } from "./planWeek";
import { formatPlanItemWhen, formatWeekOfRange } from "./planExport";

const WHO_RGB = {
  spence: [190, 90, 55],
  amanda: [94, 107, 55],
  both: [192, 151, 64],
};

const CAT_RGB = [238, 225, 204];
const INK = [42, 37, 29];
const INK2 = [91, 82, 69];
const INK3 = [140, 128, 112];
const TERRA = [190, 90, 55];
const PAPER = [251, 246, 236];

async function loadLogoDataUrl() {
  try {
    const res = await fetch("/uploads/Logo_4.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Download a Terra & Cream styled PDF of the weekly plan.
 * @param {{ name: string, who?: string, items: object[] }[]} sections
 * @param {string} meetingDate
 */
export async function downloadPlanPdf(sections, meetingDate) {
  const weekOf = formatWeekOfRange(meetingDate);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const paintPage = () => {
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  paintPage();

  const ensureSpace = (need) => {
    if (y + need <= pageH - margin) return;
    doc.addPage();
    paintPage();
    y = margin;
  };

  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 28, 28);
    } catch { /* ignore */ }
  }

  doc.setFont("times", "italic");
  doc.setFontSize(22);
  doc.setTextColor(...TERRA);
  doc.text("Family", margin + (logo ? 38 : 0), y + 20);
  const familyW = doc.getTextWidth("Family");
  doc.setTextColor(...INK);
  doc.text("Pause", margin + (logo ? 38 : 0) + familyW, y + 20);
  y += 42;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK3);
  doc.text(`Week of ${weekOf}`, margin, y);
  y += 10;
  doc.setDrawColor(230, 217, 196);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 28;

  for (const sec of sections) {
    if (!sec.items?.length) continue;
    ensureSpace(56);
    const rgb = WHO_RGB[sec.who] || TERRA;
    doc.setFillColor(...rgb);
    doc.circle(margin + 5, y - 3, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(String(sec.name).toUpperCase(), margin + 18, y);
    y += 18;

    for (const it of sec.items) {
      const title = calendarTitle(it);
      const when = formatPlanItemWhen(it);
      const titleLines = doc.splitTextToSize(title, contentW - 12);
      const blockH = 14 + titleLines.length * 13 + (when ? 12 : 0) + (it.category ? 16 : 0) + 10;
      ensureSpace(blockH);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(titleLines, margin + 8, y);
      y += titleLines.length * 13;

      if (when) {
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...INK3);
        doc.text(when, margin + 8, y + 2);
        y += 14;
      }

      if (it.category) {
        const label = String(it.category);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const tw = doc.getTextWidth(label) + 10;
        doc.setFillColor(...CAT_RGB);
        doc.roundedRect(margin + 8, y - 1, tw, 12, 3, 3, "F");
        doc.setTextColor(...INK2);
        doc.text(label, margin + 13, y + 8);
        y += 18;
      } else {
        y += 8;
      }
    }
    y += 10;
  }

  const startIso = getPlanningWeekDates(meetingDate)[0];
  doc.save(`FamilyPause-Week-of-${startIso}.pdf`);
}
