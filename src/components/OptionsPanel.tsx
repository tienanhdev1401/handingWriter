import { useState } from 'react';
import type { GenerationOptions } from '../types';
import { DEFAULT_OPTIONS } from '../types';

interface OptionsPanelProps {
  options: GenerationOptions;
  onChange: (o: GenerationOptions) => void;
  disabled?: boolean;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-xs text-muted flex-shrink-0">{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const SliderRow = ({
  label, value, min, max, step, unit, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit?: string; onChange: (v: number) => void; disabled?: boolean;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-mono text-subtle">{value}{unit}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="disabled:opacity-40"
    />
  </div>
);

const Toggle = ({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button" role="switch" aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative w-8 rounded-full transition-colors disabled:opacity-40 flex-shrink-0`}
    style={{ height: '18px', background: checked ? '#d62828' : '#2a2a2a' }}
  >
    <span className={`
      absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform duration-150
      ${checked ? 'left-[calc(100%-15px)]' : 'left-0.5'}
    `} />
  </button>
);

export default function OptionsPanel({ options, onChange, disabled }: OptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof GenerationOptions>(k: K, v: GenerationOptions[K]) =>
    onChange({ ...options, [k]: v });

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted hover:text-text transition-colors"
      >
        <span>Tùy chọn thêm</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-surface animate-in">

          {/* Colors */}
          <div className="space-y-2.5">
            <p className="text-[10px] text-subtle uppercase tracking-wider">Màu</p>

            <Row label="Màu nét">
              <span className="text-xs font-mono text-subtle">{options.strokeColor}</span>
              <input
                type="color" value={options.strokeColor} disabled={disabled}
                onChange={(e) => set('strokeColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer disabled:opacity-40"
              />
            </Row>

            <Row label="Màu phác thảo">
              <span className="text-xs font-mono text-subtle">{options.outlineColor}</span>
              <input
                type="color" value={options.outlineColor} disabled={disabled}
                onChange={(e) => set('outlineColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer disabled:opacity-40"
              />
            </Row>

            {!options.transparentBackground && (
              <Row label="Màu nền">
                <span className="text-xs font-mono text-subtle">{options.backgroundColor}</span>
                <input
                  type="color" value={options.backgroundColor} disabled={disabled}
                  onChange={(e) => set('backgroundColor', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer disabled:opacity-40"
                />
              </Row>
            )}
          </div>

          {/* Animation */}
          <div className="space-y-3">
            <p className="text-[10px] text-subtle uppercase tracking-wider">Hoạt ảnh</p>
            <SliderRow
              label="Tốc độ vẽ" value={options.strokeSpeed}
              min={4} max={30} step={1}
              onChange={(v) => set('strokeSpeed', v)} disabled={disabled}
            />
            <SliderRow
              label="Khoảng dừng giữa nét" value={options.delayBetweenStrokes}
              min={0} max={1500} step={50} unit="ms"
              onChange={(v) => set('delayBetweenStrokes', v)} disabled={disabled}
            />
            <SliderRow
              label="Dừng cuối vòng lặp" value={options.finalDelay}
              min={500} max={5000} step={250} unit="ms"
              onChange={(v) => set('finalDelay', v)} disabled={disabled}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2.5">
            <p className="text-[10px] text-subtle uppercase tracking-wider">Hiển thị</p>
            <Row label="Phác thảo nền">
              <Toggle checked={options.showOutline} onChange={(v) => set('showOutline', v)} disabled={disabled} />
            </Row>
            <Row label="Nền trong suốt">
              <Toggle checked={options.transparentBackground} onChange={(v) => set('transparentBackground', v)} disabled={disabled} />
            </Row>
            <Row label="Lặp vô hạn">
              <Toggle checked={options.loop} onChange={(v) => set('loop', v)} disabled={disabled} />
            </Row>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_OPTIONS })}
            disabled={disabled}
            className="text-xs text-subtle hover:text-muted transition-colors disabled:opacity-40"
          >
            Đặt lại mặc định
          </button>
        </div>
      )}
    </div>
  );
}
