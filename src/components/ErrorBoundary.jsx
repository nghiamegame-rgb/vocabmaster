import { Component } from 'react';

// Catches render/effect errors so the app shows a recovery message instead of
// a blank page. Stored data is untouched; reloading re-reads LocalStorage.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Only the error type is logged: messages may contain learning data.
    console.error('VocabMaster render error', error?.name || 'Error');
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Có lỗi xảy ra, dữ liệu của bạn vẫn được giữ. Hãy tải lại trang</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
        >Tải lại trang</button>
      </div>
    );
  }
}
