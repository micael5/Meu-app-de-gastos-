/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, HistoryEntry, AppState } from './types';
import { loadAppState, saveAppState, DEFAULT_ACCOUNTS } from './utils/storage';
import HomeView from './components/HomeView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [state, setState] = useState<AppState>(loadAppState);
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Persistir o estado no localStorage sempre que houver modificações
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Capturar o evento 'beforeinstallprompt' para instalação nativa do PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Callback chamado ao efetuar um cálculo na HomeView
  const handleCalculateSave = (gain: number, allocations: { name: string; value: number }[]) => {
    // Adicionar ao acumulado mensal salvo
    const newTotalSaved = state.totalSavedThisMonth + gain;

    // Criar entrada no histórico
    const dateObj = new Date();
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      date: formattedDate,
      gain,
      allocations
    };

    setState(prev => ({
      ...prev,
      totalSavedThisMonth: newTotalSaved,
      history: [...prev.history, newEntry]
    }));
  };

  // Callback para atualizar a lista de contas mensais (Seção 1 e Seção 4)
  const handleUpdateAccounts = (updatedAccounts: Account[]) => {
    setState(prev => ({
      ...prev,
      accounts: updatedAccounts
    }));
  };

  // Callback para zerar o acumulado do mês corrente preservando o histórico (Seção 3)
  const handleResetSaved = () => {
    setState(prev => ({
      ...prev,
      totalSavedThisMonth: 0
    }));
  };

  return (
    <div className="min-h-full font-sans antialiased text-white select-none">
      <AnimatePresence mode="wait">
        {currentView === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="min-h-screen"
          >
            <HomeView
              accounts={state.accounts}
              onCalculate={handleCalculateSave}
              onNavigateToSettings={() => setCurrentView('settings')}
            />
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="min-h-screen"
          >
            <SettingsView
              accounts={state.accounts}
              history={state.history}
              totalSavedThisMonth={state.totalSavedThisMonth}
              deferredPrompt={deferredPrompt}
              onGoBack={() => setCurrentView('home')}
              onUpdateAccounts={handleUpdateAccounts}
              onResetSaved={handleResetSaved}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

