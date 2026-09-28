import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[280px] w-full flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3 font-sans">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">界面组件加载异常</h3>
          <p className="text-xs text-slate-500 max-w-md">
            {this.state.error?.message || '组件渲染过程中发生了意外错误，已阻止全局白屏。'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>重新加载应用</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
