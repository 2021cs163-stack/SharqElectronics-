import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Settings2, X, Type, Minus, Plus, RotateCcw } from 'lucide-react';

// Tech edit mode — persisted in localStorage per-page
// Lets Tech role click any element and adjust its text size

const OVERRIDES_KEY = 'shopshield_tech_overrides';

export function getTechOverrides(): Record<string, Partial<CSSStyleDeclaration>> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); }
  catch { return {}; }
}

export function TechEditBar() {
  const { user } = useAuth();
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState(false); // edit mode on/off
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(14);

  if (user?.role !== 'Tech' && user?.role !== 'Partner') return null;

  const toggleMode = () => {
    const next = !active;
    setActive(next);
    if (next) {
      document.body.style.cursor = 'crosshair';
      document.addEventListener('click', handleElementClick, true);
    } else {
      document.body.style.cursor = '';
      document.removeEventListener('click', handleElementClick, true);
      setSelected(null);
    }
  };

  const handleElementClick = (e: Event) => {
    const el = e.target as HTMLElement;
    // Ignore clicks on the edit bar itself
    if (el.closest('[data-tech-bar]')) return;
    e.stopPropagation(); e.preventDefault();
    setSelected(el);
    const cs = window.getComputedStyle(el);
    setFontSize(parseInt(cs.fontSize) || 14);
    setOpen(true);
  };

  const applyFontSize = (size: number) => {
    if (!selected) return;
    setFontSize(size);
    selected.style.fontSize = `${size}px`;
    // Save override keyed by element path
    const key = getElementKey(selected);
    const overrides = getTechOverrides();
    overrides[key] = { ...overrides[key], fontSize: `${size}px` };
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  };

  const resetElement = () => {
    if (!selected) return;
    selected.style.fontSize = '';
    const key = getElementKey(selected);
    const overrides = getTechOverrides();
    delete overrides[key];
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  };

  const resetAll = () => {
    localStorage.removeItem(OVERRIDES_KEY);
    window.location.reload();
  };

  return (
    <div data-tech-bar="true" className="fixed bottom-24 right-4 z-[999] lg:bottom-4">
      {/* Toggle button */}
      <button
        onClick={() => { if (active) toggleMode(); setOpen(v => !v); }}
        className={`w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all ${
          active ? 'bg-yellow-500 text-black animate-pulse' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
        }`}
        title="Tech Edit Mode"
      >
        <Settings2 className="w-5 h-5"/>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-14 right-0 bg-card border border-border rounded-2xl shadow-2xl w-64 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tech Edit Mode</p>
            <button onClick={() => { setOpen(false); if (active) toggleMode(); }} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className={`p-3 rounded-xl border text-center text-xs font-bold ${active ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-400' : 'bg-muted/30 border-border text-muted-foreground'}`}>
            {active ? '⚡ Click any element to select it' : 'Activate to tap & edit elements'}
          </div>

          <button onClick={toggleMode}
            className={`w-full py-2.5 rounded-xl font-black uppercase text-xs transition-all ${
              active ? 'bg-yellow-500 text-black hover:brightness-110' : 'bg-primary text-white hover:brightness-110'
            }`}>
            {active ? 'Stop Editing' : 'Start Editing'}
          </button>

          {selected && active && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground truncate">Selected: <span className="text-foreground font-bold">{selected.tagName.toLowerCase()}.{selected.className.split(' ')[0]}</span></p>

              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Font Size</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => applyFontSize(Math.max(8, fontSize - 1))}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                    <Minus className="w-3 h-3"/>
                  </button>
                  <span className="flex-1 text-center font-black text-foreground text-sm">{fontSize}px</span>
                  <button onClick={() => applyFontSize(Math.min(72, fontSize + 1))}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                    <Plus className="w-3 h-3"/>
                  </button>
                </div>
              </div>

              <button onClick={resetElement}
                className="w-full py-2 rounded-xl border border-border text-muted-foreground text-xs font-black hover:text-white flex items-center justify-center gap-1.5">
                <RotateCcw className="w-3 h-3"/> Reset This Element
              </button>
            </div>
          )}

          <button onClick={resetAll}
            className="w-full py-2 rounded-xl border border-red-900/40 text-red-400 text-xs font-black hover:bg-red-900/20 flex items-center justify-center gap-1.5">
            <RotateCcw className="w-3 h-3"/> Reset All Changes
          </button>
        </div>
      )}
    </div>
  );
}

// Generate a stable key for an element based on its position in the DOM
function getElementKey(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    const idx = Array.from(current.parentElement?.children || []).indexOf(current);
    parts.unshift(`${current.tagName}:${idx}`);
    current = current.parentElement;
  }
  return parts.join('>');
}
