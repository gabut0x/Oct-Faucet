import React from 'react';
import { FaucetPage } from './components/FaucetPage';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="octra-faucet-theme">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <FaucetPage />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;