import { CheckCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface ActiveStepperProps {
  steps: string[];
  currentStep: number;
  icons?: ReactNode[];
}

export function ActiveStepper({ steps, currentStep, icons }: ActiveStepperProps) {
  return (
    <div className="w-full">
      <div className="relative flex w-full items-start justify-between">
        {steps.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={i} className="z-10 flex flex-1 flex-col items-center gap-2">
              {/* Step circle — upgraded from h-7 w-7 (28px) to h-9 w-9 (36px) for legibility */}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black transition-all duration-500 ${
                  done
                    ? "border-success bg-success text-white shadow-md"
                    : active
                      ? "border-brand bg-brand text-black shadow-md ring-4 ring-brand/25"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? (
                  <CheckCircle size={16} />
                ) : icons?.[i] ? (
                  icons[i]
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {/* Step label — upgraded from text-[9px] to text-[11px] (WCAG minimum 11px) */}
              <p
                className={`max-w-[68px] text-center text-[11px] font-bold leading-tight ${
                  i <= currentStep ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}

        {/* Progress connector line — fixed hardcoded #4CAF50 and rgba(255,255,255,0.10) */}
        <div className="absolute top-[18px] right-0 left-0 -z-0 mx-auto flex h-0.5 w-[calc(100%-56px)] justify-between">
          {steps.slice(0, -1).map((_, i) => (
            <div
              key={i}
              className={`h-full flex-1 rounded-full transition-all duration-700 ${
                i < currentStep ? "bg-success" : "bg-border"
              }`}
              style={{
                marginLeft: i === 0 ? "50%" : 0,
                marginRight: i === steps.length - 2 ? "50%" : 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
