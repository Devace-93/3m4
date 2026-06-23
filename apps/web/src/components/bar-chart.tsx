import { component$ } from "@builder.io/qwik";
import type { SeriesPoint } from "../lib/types";

/** Lightweight hand-rolled SVG bar chart (no chart-lib dependency). */
export const BarChart = component$<{ series: SeriesPoint[]; height?: number }>(
  ({ series, height = 160 }) => {
    if (!series.length) {
      return (
        <div class="grid h-40 place-items-center text-sm text-slate-400">
          No clicks in this range yet.
        </div>
      );
    }
    const max = Math.max(1, ...series.map((p) => p.count));
    const n = series.length;
    const gap = 2;

    return (
      <div>
        <div
          class="flex items-end gap-[2px]"
          style={{ height: `${height}px` }}
          role="img"
          aria-label="Clicks over time"
        >
          {series.map((p) => {
            const h = Math.max(2, Math.round((p.count / max) * height));
            return (
              <div
                key={p.date}
                class="group relative flex-1 rounded-t bg-primary-500 transition hover:bg-primary-600"
                style={{ height: `${h}px`, marginLeft: `${gap / 2}px`, marginRight: `${gap / 2}px` }}
                title={`${p.date}: ${p.count}`}
              >
                <span class="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {p.count}
                </span>
              </div>
            );
          })}
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{series[0]?.date}</span>
          {n > 1 && <span>{series[n - 1]?.date}</span>}
        </div>
      </div>
    );
  },
);
