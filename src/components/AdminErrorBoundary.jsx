import React from 'react';
import { ShieldAlert, Home, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AdminErrorBoundary
 * Specifically designed to catch errors within the Admin Panel routes.
 * Provides detailed error information and recovery options for administrators.
 */
class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('[ERROR BOUNDARY] Admin Panel Error Caught:', error);
    console.error('[ERROR BOUNDARY] Component Stack:', errorInfo.componentStack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Attempt to recover by reloading or just re-rendering children
    window.location.reload();
  };

  handleBackToSite = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6">
          <div className="bg-white max-w-2xl w-full rounded-xl shadow-xl border border-rose-200 overflow-hidden">
            {/* Header */}
            <div className="bg-rose-600 p-6 flex items-center gap-4 text-white">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Admin Panel Error</h2>
                <p className="text-rose-100 text-sm">An unexpected error occurred in the administrative interface.</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium text-sm">Error Message:</p>
                  <p className="font-mono text-xs mt-1 break-all text-amber-800">
                    {this.state.error && this.state.error.toString()}
                  </p>
                </div>
              </div>

              {this.state.errorInfo && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Stack Trace:</p>
                  <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-64 custom-scrollbar">
                    <pre className="text-[10px] leading-relaxed font-mono text-slate-300">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button 
                  onClick={this.handleReset}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Admin Panel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={this.handleBackToSite}
                  className="flex-1 border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Return to Website
                </Button>
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-xs text-slate-500">
              If this persists, please check browser console logs for full details.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;