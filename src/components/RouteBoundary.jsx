// src/components/RouteBoundary.jsx
import React from "react";

export function RouteFallback() {
  return (
    <div className="ym-route-fallback" role="status" aria-label="页面加载中">
      <div className="ym-route-fallback__spinner ym-spin" aria-hidden="true" />
      <p className="ym-route-fallback__text">页面加载中…</p>
    </div>
  );
}

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("路由加载失败:", error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="ym-route-error" role="alert">
          <p className="ym-route-error__title">页面加载失败</p>
          <p className="ym-route-error__desc">网络似乎不太稳定，请检查网络后重试。</p>
          <button
            type="button"
            className="ym-btn ym-btn-primary"
            onClick={this.handleRetry}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
