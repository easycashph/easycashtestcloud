import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from '@/components/theme-provider';
import { DashboardLayoutProvider } from '@/components/dashboard-layout-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RoleProvider } from '@/lib/roleContext';
import { LanguageProvider } from '@/lib/languageContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoanSigningPage } from '@/pages/LoanSigningPage';
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
              <BrowserRouter>
                <ErrorBoundary>
                  {/* 2026-07-22 (e-signature): /sign/:token is the app's first UNAUTHENTICATED
                      public route - reached only via an SMS link, never behind staff login. It
                      must render BEFORE `RoleProvider` gates everything else behind auth (see
                      RoleProvider's own doc comment), so it's a sibling route here rather than
                      nested inside App.tsx's route tree. */}
                  <Routes>
                    <Route path="/sign/:token" element={<LoanSigningPage />} />
                    <Route
                      path="/*"
                      element={
                        <RoleProvider>
                          <App />
                        </RoleProvider>
                      }
                    />
                  </Routes>
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </LanguageProvider>
        </DashboardLayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
