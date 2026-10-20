import type { View } from '../sim/types';

export interface OfficeSeat {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalized hit areas match the drawn bench. Names also belong in the HTML controls. */
export function officeSeats(view: View): OfficeSeat[] {
  const width = Math.min(0.15, 0.57 / Math.max(1, view.bench.length));
  return view.bench.map((person, index) => ({
    id: person.id,
    x: 0.4 + index * width,
    y: 0.39,
    width,
    height: 0.57,
  }));
}

export function drawOffice(canvas: HTMLCanvasElement, view: View, selected: string | null): void {
  const width = canvas.clientWidth || 336;
  const height = canvas.clientHeight || 140;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform((ratio * width) / 336, 0, 0, (ratio * height) / 140, 0, 0);
  const style = getComputedStyle(canvas);
  const color = (token: string, fallback: string) => style.getPropertyValue(token).trim() || fallback;
  const paper = color('--paper', '#F3ECDD');
  const ink = color('--ink', '#23201B');
  const soft = color('--ink-soft', '#6E665A');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 336, 140);
  ctx.strokeStyle = soft;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  const line = (...points: number[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
    ctx.stroke();
  };
  // The street is visible through the office window.
  ctx.fillStyle = color('--paper-2', '#E9DFCB');
  ctx.fillRect(14, 12, 91, 57);
  ctx.strokeRect(14, 12, 91, 57);
  line(59, 12, 59, 69);
  line(14, 46, 105, 46);
  line(17, 41, 29, 32, 44, 39, 44, 61);
  line(71, 62, 71, 30, 91, 30, 91, 63);
  line(17, 63, 102, 63);
  line(117, 13, 117, 112, 331, 112);
  ctx.font = '10px Literata, Georgia, serif';
  ctx.fillStyle = soft;
  ctx.fillText('Alsancak', 20, 24);
  ctx.fillText('GOOD HANDS', 143, 25);
  // Nermin's desk, notebook and telephone.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  line(8, 94, 108, 92, 111, 104, 7, 105, 8, 94);
  line(17, 105, 15, 133);
  line(99, 105, 102, 133);
  ctx.strokeRect(22, 81, 28, 11);
  line(36, 82, 36, 92);
  line(26, 85, 32, 85);
  line(39, 87, 46, 87);
  ctx.beginPath();
  ctx.ellipse(81, 87, 14, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  line(68, 80, 72, 77, 90, 77, 95, 81);
  line(71, 79, 70, 84);
  line(91, 79, 92, 84);
  ctx.beginPath();
  ctx.arc(81, 85, 3, 0, Math.PI * 2);
  ctx.stroke();
  if (view.phoneRinging) {
    line(61, 78, 57, 73);
    line(62, 85, 55, 84);
    line(100, 78, 105, 72);
    line(101, 85, 109, 83);
    ctx.fillStyle = ink;
    ctx.fillText('ring!', 73, 70);
  }
  // Continuous bench; the posture changes before someone leaves.
  line(134, 92, 326, 92, 326, 99, 134, 99, 134, 92);
  line(142, 100, 140, 121);
  line(318, 100, 320, 121);
  line(135, 79, 326, 79);
  for (const seat of officeSeats(view)) {
    const person = view.bench.find((p) => p.id === seat.id);
    if (!person) continue;
    const x = (seat.x + seat.width / 2) * 336;
    const leaving = person.posture === 'leaving';
    const restless = person.posture === 'restless';
    const headY = leaving ? 57 : restless ? 64 : 66;
    const lean = restless ? 5 : 0;
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(x + lean, headY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    line(x + lean, headY + 6, x, leaving ? 88 : 91);
    line(x + lean, headY + 13, x - 8, 85, x + 6, restless ? 77 : 86);
    line(x, leaving ? 88 : 91, x - 7, 106, x - (leaving ? 11 : 6), 114);
    line(x, leaving ? 88 : 91, x + 7, 106, x + (leaving ? 14 : 9), 114);
    ctx.strokeRect(x + 10, leaving ? 83 : 100, 9, 12);
    if (restless) {
      ctx.beginPath();
      ctx.arc(x + 6, 77, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (selected === person.id) {
      ctx.strokeRect(x - 19, 49, 40, 71);
      ctx.strokeRect(x - 22, 46, 46, 77);
    }
  }
  canvas.dataset.officeSeats = JSON.stringify(officeSeats(view));
}
