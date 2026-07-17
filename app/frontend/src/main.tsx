import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from '@/components/theme-provider';
import { DashboardLayoutProvider } from '@/components/dashboard-layout-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RoleProvider } from '@/lib/roleContext';
import { LanguageProvider } from '@/lib/languageContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DashboardLayoutProvider>
          <LanguageProvider>
            <TooltipProvider>
              <RoleProvider>
                <BrowserRouter>
                  <ErrorBoundary>
                    <App />
                  </ErrorBoundary>
                </BrowserRouter>
              </RoleProvider>
            </TooltipProvider>
          </LanguageProvider>
        </DashboardLayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
