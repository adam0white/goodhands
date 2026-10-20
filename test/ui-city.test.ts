import { describe, expect, it, vi } from 'vitest';
import { newGame, view } from '../src/sim/index.ts';
import type { CityFigure, View } from '../src/sim/types.ts';
import { cityFigurePositions, drawCity, hitCityFigure } from '../src/ui/map.ts';

const traveler: CityFigure = {
  id: 'sevda',
  name: 'Sevda',
  kind: 'worker',
  x: 0.2,
  y: 0.3,
  toX: 0.8,
  toY: 0.7,
  arrive: 600,
  place: 'On the ferry to Karşıyaka',
};

function city(now: number): View {
  const base = view(newGame(1));
  return { ...base, now, city: { ...base.city, figures: [traveler] } };
}

describe('city positions', () => {
  it('keeps a journey on the game clock even when the map opens midway', () => {
    const middle = cityFigurePositions(city(570))[0];
    expect(middle?.x).toBeCloseTo(168);
    expect(middle?.y).toBeCloseTo(121);
    expect(cityFigurePositions(city(570))).toEqual(cityFigurePositions(city(570)));
    expect(cityFigurePositions(city(500))[0]?.x).toBeCloseTo(76.2);
    expect(cityFigurePositions(city(700))[0]?.x).toBeCloseTo(259.8);
  });

  it('finds the visible moving figure after the canvas is resized', () => {
    const canvas = {
      getBoundingClientRect: () => ({ left: 20, top: 30, width: 672, height: 480 }),
    } as HTMLCanvasElement;
    expect(hitCityFigure(canvas, city(570), 356, 270)?.figure.id).toBe('sevda');
    expect(hitCityFigure(canvas, city(570), 356 + 23, 270)).toBeUndefined();
  });
});

it('draws people sharing a place as distinct figures', () => {
  const v = city(500);
  v.city.figures = [
    { ...traveler, toX: undefined, toY: undefined, arrive: undefined },
    { ...traveler, id: 'gul', name: 'Gül', toX: undefined, toY: undefined, arrive: undefined },
  ];
  const positions = cityFigurePositions(v);
  const [first, second] = positions;
  if (!first || !second) throw new Error('Both people should be drawn.');
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(12);
});

it('shows a known consequence even when it arrives after the talk trail has faded', () => {
  const v = city(2100);
  v.city.figures.push({ ...traveler, id: 'hulya', name: 'Hülya', x: 0.6 });
  v.city.threads = [
    {
      id: 1,
      at: 600,
      end: 630,
      from: 'sevda',
      to: 'hulya',
      place: 'the ferry',
      consequence: 'Hülya came because Sevda told her about you.',
    },
  ];
  const words: string[] = [];
  const context = new Proxy(
    {
      fillText: (text: string) => words.push(text),
      measureText: (text: string) => ({ width: text.length * 5 }),
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
  );
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
  try {
    drawCity(
      {
        clientWidth: 336,
        clientHeight: 240,
        getContext: () => context,
        dataset: {},
      } as unknown as HTMLCanvasElement,
      v,
    );
    expect(words.join(' ')).toContain('Hülya came because Sevda');
  } finally {
    vi.unstubAllGlobals();
  }
});
