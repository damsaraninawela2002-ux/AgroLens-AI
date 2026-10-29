import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Card from "./Card";
import Button from "./Button";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught runtime error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full text-center space-y-4 border-red-200 bg-white p-8">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border border-red-200 text-[#dc2626] flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900">
                Something went wrong
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {this.state.error?.message ||
                  "An unexpected error occurred while rendering this page."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                icon={RefreshCw}
                onClick={this.handleReload}
              >
                Reload
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
