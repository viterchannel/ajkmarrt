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
            <div key={i} className="z-10 flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-black transition-all duration-500 ${
                  done
                    ? "border-success bg-success text-white shadow-sm"
                    : active
                      ? "border-brand bg-brand text-black shadow-sm ring-4 ring-brand/20"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? (
                  <CheckCircle size={14} />
                ) : icons?.[i] ? (
                  icons[i]
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <p
                className={`max-w-[64px] text-center text-[9px] font-bold leading-tight ${
                  i <= currentStep ? "text-white" : "text-muted-foreground"
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}

        <div className="absolute top-3.5 right-0 left-0 -z-0 mx-auto flex h-0.5 w-[calc(100%-56px)] justify-between">
          {steps.slice(0, -1).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1 rounded-full transition-all duration-700"
              style={{
                backgroundColor:
                  i < currentStep
                    ? "#4CAF50"
                    : "rgba(255,255,255,0.10)",
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
