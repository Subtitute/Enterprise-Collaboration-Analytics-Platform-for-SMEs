import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
// 20/08/2026: PHAI import truoc App - i18next init dong bo (xem i18n/index.ts) can xong TRUOC
// khi bat ky component nao (ke ca <Suspense fallback> dau tien) render.
import './i18n';
import App from './App';
import { queryClient } from './lib/query-client';
import { ToastContainer } from './components/ui/Toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
