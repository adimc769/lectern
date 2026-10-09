import React, { useState } from 'react';
import { AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface FailedStateProps {
  title?: string;
  message?: string;
  errorDetails?: string | Error | null;
  onRetry?: () => void;
  className?: string;
}

export const FailedState: React.FC<FailedStateProps> = ({
  title = 'Something went wrong',
  message = 'An error occurred during local processing. You can safely retry without data loss.',
  errorDetails,
  onRetry,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const errorString =
    errorDetails instanceof Error
      ? errorDetails.stack || errorDetails.message
      : typeof errorDetails === 'string'
      ? errorDetails
      : null;

  return (
    <div
      className={`p-6 sm:p-8 rounded-2xl bg-rose-950/30 border border-rose-800/80 text-center flex flex-col items-center justify-center space-y-4 shadow-xl ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-900/60 border border-rose-700/60 flex items-center justify-center text-rose-400">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-rose-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry Operation</span>
        </button>
      )}

      {errorString && (
        <div className="w-full max-w-lg pt-2 text-left">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 mx-auto"
          >
            <span>Technical details</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showDetails && (
            <pre className="mt-2 p-3 rounded-lg bg-slate-950 border border-rose-900/80 text-[10px] font-mono text-rose-300/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {errorString}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default FailedState;
