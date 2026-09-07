"use client";

import LevelSelector from "@/components/draw/LevelSelector";
import Input from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";

const LOT_PRESETS = [{ value: 0, label: "Any" }, { value: 1, label: "1" }, { value: 2.5, label: "2.5" }, { value: 5, label: "5" }, { value: 10, label: "10" }];

export default function EligibilityPanel({ criteria, onChange, onHideSensitiveChange, eligibleCount, totalCount, capabilities, levels, counts, onLevelsChange, disabled }) {
  const excluded = totalCount - eligibleCount;
  return (
    <div className="p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <h2 id="eligibility-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">Eligibility criteria</h2>
        <p className="text-xs text-text-muted" role="status"><span className="font-semibold text-accent-from">{eligibleCount}</span> eligible{excluded > 0 ? ` · ${excluded} filtered out` : ""}</p>
      </header>
      <LevelSelector levels={levels} counts={counts} total={totalCount} onChange={onLevelsChange} disabled={disabled} />
      <fieldset disabled={disabled} aria-labelledby="eligibility-heading" className="eligibility-fields mt-5 grid min-w-0 gap-6 border-t border-white/[0.07] pt-5 disabled:opacity-55 md:grid-cols-[1fr_1.2fr]">
        <Input id="min-lots" label="Minimum lots traded" suffix="lots" value={criteria.minLots} onChange={value => onChange({ minLots: value })} min={0} max={50} step={0.5} presets={LOT_PRESETS} disabled={!capabilities.lots} note={capabilities.lots ? undefined : "Trading volume is unavailable for this selection."} />
        <div className="draw-filters min-w-0">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">Draw preferences</p>
          <div className="flex flex-wrap gap-2">
            <Toggle id="hide-sensitive" label="Hide sensitive info" description="Hide MT5 IDs, email addresses, and phone numbers on screen." checked={criteria.hideSensitive} onChange={onHideSensitiveChange} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-text-muted">Every eligible client gets one entry.</p>
        </div>
      </fieldset>
    </div>
  );
}
