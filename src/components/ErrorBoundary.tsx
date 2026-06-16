import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans text-slate-300">
          <div className="bg-[#111] max-w-lg w-full rounded-2xl border border-red-500/20 p-8 text-center space-y-6 shadow-2xl">
            <div className="mx-auto bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">System Anomaly Detected</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                The application encountered an unexpected runtime error. Our diagnostic trackers have logged the incident.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-[#0a0a0a] rounded-lg p-4 text-left overflow-x-auto border border-white/5">
                <code className="text-xs font-mono text-red-300 whitespace-pre">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Reinitialize Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
