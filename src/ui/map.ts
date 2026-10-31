import type { CityFigure, View } from '../sim/types';

export const MAP_WIDTH = 336;
export const MAP_HEIGHT = 240;
const point = (x: number, y: number) => ({ x: 15 + x * 306, y: 20 + y * 202 });

export interface CityFigurePosition {
  figure: CityFigure;
  x: number;
  y: number;
  place: string;
}

/** The sim authors evening journeys from 18:00 to 19:00 (60 game minutes).
 * Pure positions: reloading or opening the map late never restarts a journey. */
export function cityFigurePositions(view: View): CityFigurePosition[] {
  const positions = view.city.figures.map((figure) => {
    const travel = figure.arrive !== undefined && figure.toX !== undefined && figure.toY !== undefined;
    const progress = travel
      ? Math.max(0, Math.min(1, (view.now - ((figure.arrive ?? view.now) - 60)) / 60))
      : 0;
    const p = point(
      figure.x + ((figure.toX ?? figure.x) - figure.x) * progress,
      figure.y + ((figure.toY ?? figure.y) - figure.y) * progress,
    );
    return { figure, ...p, place: figure.place ?? 'İzmir' };
  });
  const groups = new Map<string, CityFigurePosition[]>();
  for (const p of positions) {
    const key = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.figure.id.localeCompare(b.figure.id, 'en'));
    const columns = Math.min(4, group.length);
    const rows = Math.ceil(group.length / columns);
    group.forEach((p, index) => {
      p.x += ((index % columns) - (columns - 1) / 2) * 13;
      p.y += (Math.floor(index / columns) - (rows - 1) / 2) * 19;
    });
  }
  return positions;
}

/** Coordinates are browser client coordinates. Choose the closest figure in a 44px target. */
export function hitCityFigure(
  canvas: HTMLCanvasElement,
  view: View,
  clientX: number,
  clientY: number,
): CityFigurePosition | undefined {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return undefined;
  let closest: CityFigurePosition | undefined;
  let distance = 22;
  for (const p of cityFigurePositions(view)) {
    const d = Math.hypot(
      rect.left + (p.x * rect.width) / MAP_WIDTH - clientX,
      rect.top + ((p.y - 1) * rect.height) / MAP_HEIGHT - clientY,
    );
    if (d < distance) {
      closest = p;
      distance = d;
    }
  }
  return closest;
}

/** Draw only the public city view. Threads do not reveal their unheard subject. */
export function drawCity(canvas: HTMLCanvasElement, view: View, selectedId?: string): void {
  const width = canvas.clientWidth || 336;
  const height = canvas.clientHeight || 240;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform((ratio * width) / 336, 0, 0, (ratio * height) / 240, 0, 0);
  const styles = getComputedStyle(canvas);
  const color = (token: string, fallback: string) => styles.getPropertyValue(token).trim() || fallback;
  const ink = color('--ink', '#23201B');
  const soft = color('--ink-soft', '#6E665A');
  const paper = color('--paper', '#F3ECDD');
  const accent = color('--rope', '#C2412D');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 336, 240);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  // The bay opens west. Its irregular shore gives the notebook its orientation.
  ctx.fillStyle = color('--paper-2', '#E9DFCB');
  ctx.strokeStyle = soft;
  ctx.beginPath();
  ctx.moveTo(0, 39);
  ctx.bezierCurveTo(74, 25, 140, 42, 154, 78);
  ctx.bezierCurveTo(172, 106, 144, 128, 112, 135);
  ctx.bezierCurveTo(74, 147, 43, 169, 0, 160);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = 'italic 12px Literata, Georgia, serif';
  ctx.fillStyle = soft;
  ctx.fillText('İzmir Bay', 34, 104);
  for (let y = 66; y < 132; y += 17) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.bezierCurveTo(35, y - 3, 49, y + 3, 64, y);
    ctx.stroke();
  }
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(112, 56);
  ctx.quadraticCurveTo(126, 90, 145, 117);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '12px Literata, Georgia, serif';
  const districts: [string, number, number][] = [
    ['Karşıyaka', 83, 24],
    ['Bornova', 254, 42],
    ['Alsancak', 170, 108],
    ['Göztepe', 36, 186],
    ['Buca', 232, 218],
  ];
  for (const [name, x, y] of districts) ctx.fillText(name, x, y);
  // Small unlabelled street strokes stay subordinate to people and houses.
  ctx.globalAlpha = 0.35;
  for (const [x, y] of [
    [207, 53],
    [220, 160],
    [92, 205],
    [290, 101],
  ]) {
    if (x === undefined || y === undefined) continue;
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x + 20, y + 9);
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x - 3, y + 17);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Places are drawn before people. Quiet labels orient their daily journeys.
  ctx.font = 'italic 10px Literata, Georgia, serif';
  ctx.fillStyle = soft;
  ctx.fillText('Good Hands', 144, 149);
  ctx.beginPath();
  ctx.ellipse(165, 107, 23, 13, -0.2, 0, Math.PI * 2);
  ctx.strokeStyle = soft;
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillText('Kültürpark', 148, 86);
  for (const house of view.city.houses) {
    const p = point(house.x, house.y);
    ctx.strokeStyle = ink;
    ctx.fillStyle = paper;
    ctx.fillRect(p.x - 6, p.y - 4, 12, 11);
    ctx.strokeRect(p.x - 6, p.y - 4, 12, 11);
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 4);
    ctx.lineTo(p.x, p.y - 11);
    ctx.lineTo(p.x + 8, p.y - 4);
    ctx.stroke();
    ctx.strokeRect(p.x - 1, p.y + 1, 3, 6);
  }
  const figures = cityFigurePositions(view);
  const positions = new Map(figures.map((p) => [p.figure.id, p]));
  const captions: { words: string; x: number; y: number }[] = [];
  for (const thread of view.city.threads) {
    const from = positions.get(thread.from);
    const to = positions.get(thread.to);
    if (!from || !to || view.now < thread.at) continue;
    const end = thread.end ?? thread.at + 30;
    const age = view.now - end;
    if (age >= 0 && thread.consequence) captions.push({ words: thread.consequence, x: to.x, y: to.y - 20 });
    if (age > 240 && !view.ended) continue;
    const progress = Math.max(0, Math.min(1, (view.now - thread.at) / Math.max(1, end - thread.at)));
    const ax = from.x;
    const ay = from.y - 6;
    const bx = to.x;
    const by = to.y - 6;
    const cx = (ax + bx) / 2;
    const cy = Math.min(ay, by) - 22 - (thread.id % 3) * 4;
    ctx.strokeStyle = soft;
    ctx.globalAlpha = age < 0 ? 0.65 : view.ended ? 0.22 : 0.22 * Math.max(0, 1 - age / 240);
    ctx.lineWidth = 1;
    ctx.setLineDash(age < 0 ? [] : [2, 4]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    if (age < 0) {
      const u = 1 - progress;
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(
        u * u * ax + 2 * u * progress * cx + progress * progress * bx,
        u * u * ay + 2 * u * progress * cy + progress * progress * by,
        2.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const { figure, x, y } of figures) {
    const p = { x, y };
    const tired = figure.mood === 'tired';
    const upset = figure.mood === 'upset';
    const lean = tired ? 3 : 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = selectedId === figure.id ? accent : ink;
    ctx.fillStyle = paper;
    // A small open oval gives each tappable person the same cue.
    ctx.globalAlpha = selectedId === figure.id ? 1 : 0.45;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, selectedId === figure.id ? 8 : 6, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x + lean, p.y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x + lean, p.y - 3);
    ctx.quadraticCurveTo(p.x + (tired ? 2 : 0), p.y + 1, p.x, p.y + 5);
    ctx.lineTo(p.x - 3, p.y + 10);
    ctx.moveTo(p.x, p.y + 5);
    ctx.lineTo(p.x + 4, p.y + 10);
    if (upset) {
      // Both elbows out, hands across the chest: folded arms.
      ctx.moveTo(p.x, p.y - 1);
      ctx.lineTo(p.x - 5, p.y + 2);
      ctx.lineTo(p.x + 3, p.y + 1);
      ctx.moveTo(p.x, p.y - 1);
      ctx.lineTo(p.x + 5, p.y + 2);
      ctx.lineTo(p.x - 3, p.y + 1);
    } else {
      ctx.moveTo(p.x + lean / 2, p.y - 1);
      ctx.lineTo(p.x - 4 + lean, p.y + (tired ? 5 : 2));
      ctx.moveTo(p.x + lean / 2, p.y - 1);
      ctx.lineTo(p.x + 4 + lean, p.y + (tired ? 6 : 2));
    }
    ctx.stroke();
  }
  // Only consequences the simulation says reached Nermin are supplied here.
  // Keep the most recent two legible rather than covering the city in speech.
  ctx.font = '12px Caveat, Georgia, serif';
  captions.slice(-2).forEach((caption, i) => {
    const words = caption.words;
    const lines: string[] = [];
    let line = '';
    for (const word of words.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 158 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 2);
    if (lines.length > 2) shown[1] = `${shown[1]}…`;
    const w = Math.min(166, Math.max(...shown.map((text) => ctx.measureText(text).width)) + 8);
    const x = Math.max(4, Math.min(332 - w, caption.x - w / 2));
    const y = i === 0 ? 7 : 33;
    ctx.strokeStyle = soft;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(caption.x, caption.y);
    ctx.lineTo(x + w / 2, y + shown.length * 12 + 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, w, shown.length * 12 + 5);
    ctx.fillStyle = ink;
    shown.forEach((text, index) => {
      ctx.fillText(text, x + 4, y + 12 + index * 12);
    });
  });
  canvas.dataset.cityLayout = JSON.stringify({
    figures: figures.map(({ figure, x, y, place }) => ({ ...figure, mapX: x, mapY: y, place })),
    houses: view.city.houses,
    selected: selectedId,
  });
}
