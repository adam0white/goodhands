import type { View } from '../sim/types';

/** Draw only the public city view. Threads do not reveal their unheard subject. */
export function drawCity(canvas: HTMLCanvasElement, view: View): void {
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
    ['Buca', 259, 218],
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
  const point = (x: number, y: number) => ({ x: 15 + x * 306, y: 20 + y * 202 });
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
  for (const thread of view.city.threads) {
    const a = view.city.figures.find((figure) => figure.id === thread.from);
    const b = view.city.figures.find((figure) => figure.id === thread.to);
    if (!a || !b) continue;
    const from = point(a.x, a.y);
    const to = point(b.x, b.y);
    ctx.strokeStyle = soft;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - 5);
    ctx.quadraticCurveTo((from.x + to.x) / 2, Math.min(from.y, to.y) - 17, to.x, to.y - 5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const figure of view.city.figures) {
    const p = point(figure.x, figure.y);
    const lean = figure.mood === 'tired' ? 3 : figure.mood === 'upset' ? -2 : 0;
    ctx.strokeStyle = ink;
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.arc(p.x + lean, p.y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x + lean, p.y - 3);
    ctx.lineTo(p.x, p.y + 5);
    ctx.lineTo(p.x - 3, p.y + 10);
    ctx.moveTo(p.x, p.y + 5);
    ctx.lineTo(p.x + 4, p.y + 10);
    ctx.moveTo(p.x + lean / 2, p.y);
    ctx.lineTo(p.x - 4, p.y + (figure.mood === 'upset' ? -3 : 3));
    ctx.stroke();
  }
  canvas.dataset.cityLayout = JSON.stringify({ figures: view.city.figures, houses: view.city.houses });
}
