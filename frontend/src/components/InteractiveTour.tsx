import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  HelpCircle,
  Languages,
  CheckCircle2
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export interface TourStep {
  targetSelector: string;
  title_pl: string;
  title_en: string;
  desc_pl: string;
  desc_en: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface InteractiveTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  steps,
  isOpen,
  onClose,
}) => {
  const { lang, setLang } = useTelemetry();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const step = steps[currentStepIndex];
      if (!step) return;

      const element = document.querySelector(step.targetSelector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, currentStepIndex, steps]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Tooltip positioning
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    const margin = 16;
    const tooltipWidth = 380;
    const tooltipHeight = 220;

    const spaceBottom = window.innerHeight - targetRect.bottom;
    const spaceTop = targetRect.top;
    const spaceRight = window.innerWidth - targetRect.right;

    if (spaceBottom >= tooltipHeight + margin) {
      // Position below
      tooltipStyle.top = `${targetRect.bottom + margin}px`;
      tooltipStyle.left = `${Math.max(20, Math.min(window.innerWidth - tooltipWidth - 20, targetRect.left))}px`;
    } else if (spaceTop >= tooltipHeight + margin) {
      // Position above
      tooltipStyle.top = `${targetRect.top - tooltipHeight - margin}px`;
      tooltipStyle.left = `${Math.max(20, Math.min(window.innerWidth - tooltipWidth - 20, targetRect.left))}px`;
    } else if (spaceRight >= tooltipWidth + margin) {
      // Position right
      tooltipStyle.top = `${Math.max(20, targetRect.top)}px`;
      tooltipStyle.left = `${targetRect.right + margin}px`;
    } else {
      // Position center screen fallback
      tooltipStyle.top = '50%';
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translate(-50%, -50%)';
    }
  } else {
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[9990] overflow-hidden pointer-events-auto">
      {/* Dark backdrop overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xs transition-opacity duration-300"
      />

      {/* Target Element Highlight Spotlight */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[9995] rounded-2xl ring-4 ring-blue-500/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tour Floating Card */}
      <div
        style={tooltipStyle}
        className="w-[380px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-extrabold">
              {lang === 'pl' ? `Krok ${currentStepIndex + 1} z ${steps.length}` : `Step ${currentStepIndex + 1} of ${steps.length}`}
            </span>
            <button
              onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              title="Przełącz język / Switch language"
            >
              <Languages className="w-3 h-3 text-slate-500" />
              <span>{lang.toUpperCase()}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-2">
          <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
            {lang === 'pl' ? currentStep.title_pl : currentStep.title_en}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-normal">
            {lang === 'pl' ? currentStep.desc_pl : currentStep.desc_en}
          </p>
        </div>

        {/* Navigation Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            {lang === 'pl' ? 'Pomiń przewodnik' : 'Skip tour'}
          </button>

          <div className="flex items-center space-x-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{lang === 'pl' ? 'Wstecz' : 'Back'}</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
            >
              <span>
                {isLast ? (lang === 'pl' ? 'Zakończ' : 'Finish') : (lang === 'pl' ? 'Dalej' : 'Next')}
              </span>
              {isLast ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
