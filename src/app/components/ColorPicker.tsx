import React from 'react';

interface ColorPickerProps {
  selectedColor?: string;
  onColorChange: (color: string) => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export function ColorPicker({ selectedColor = '#8b5cf6', onColorChange }: ColorPickerProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Color</label>
      <div className="flex gap-2 flex-wrap">
        {COLORS.map(color => (
          <button
            key={color}
            type="button"
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              selectedColor === color ? 'border-slate-900 scale-110' : 'border-slate-300 hover:border-slate-400'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
    </div>
  );
}
