/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, HistoryEntry, AppState } from './types';
import { loadAppState, saveAppState, DEFAULT_ACCOUNTS, getCurrentCycleDates } from './utils/storage';
import HomeView from './components/HomeView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [state, setState] = useState<AppState>(loadAppState);
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const [nextCycleId, setNextCycleId] = useState<string | null>(null);

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

  // Verificar se o período mudou (virada de mês após dia 20)
  useEffect(() => {
    const dates = getCurrentCycleDates();
    if (!state.currentCycleId) {
      // Se não houver ciclo registrado (estado antigo), registrar o atual
      setState(prev => ({
        ...prev,
        currentCycleId: dates.cycleId
      }));
    } else if (state.currentCycleId !== dates.cycleId) {
      // Período mudou!
      setNextCycleId(dates.cycleId);
      setShowCyclePrompt(true);
    }
  }, [state.currentCycleId]);

  // Handlers para a decisão da virada de mês
  const handleKeepMarkedDays = () => {
    if (nextCycleId) {
      setState(prev => ({
        ...prev,
        currentCycleId: nextCycleId
      }));
    }
    setShowCyclePrompt(false);
  };

  const handleClearMarkedDays = () => {
    if (nextCycleId) {
      setState(prev => ({
        ...prev,
        currentCycleId: nextCycleId,
        markedDays: {}
      }));
    }
    setShowCyclePrompt(false);
  };

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

  // Callback para atualizar marcações de dias de folga/trabalho
  const handleUpdateMarkedDays = (newMarkedDays: { [dateStr: string]: 'work' | 'off' }) => {
    setState(prev => ({
      ...prev,
      markedDays: newMarkedDays
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
    <div className="min-h-full font-sans antialiased text-[#1A1A1A] select-none bg-white">
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
              markedDays={state.markedDays || {}}
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
              markedDays={state.markedDays || {}}
              deferredPrompt={deferredPrompt}
              onGoBack={() => setCurrentView('home')}
              onUpdateAccounts={handleUpdateAccounts}
              onUpdateMarkedDays={handleUpdateMarkedDays}
              onResetSaved={handleResetSaved}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Decisão Virada de Mês (Dia 21) */}
      {showCyclePrompt && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-[#E2E2E2] text-center flex flex-col justify-center items-center">
            <div className="w-12 h-12 rounded-full bg-[#FF4500]/10 flex items-center justify-center text-[#FF4500] text-xl font-black mb-4">
              📅
            </div>
            <h2 className="text-[#FF4500] font-display font-black text-lg uppercase tracking-tight mb-2">
              Virada de Período!
            </h2>
            <p className="text-xs text-[#1A1A1A]/70 font-semibold mb-6 leading-relaxed">
              O mês de trabalho virou! Você deseja manter os seus dias de folga marcados no calendário ou prefere começar tudo limpo de novo?
            </p>
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={handleKeepMarkedDays}
                className="w-full bg-[#F4F4F4] hover:bg-[#E2E2E2] text-[#1A1A1A] font-display font-black text-xs py-3.5 rounded-xl cursor-pointer uppercase tracking-wider transition-all"
              >
                Manter dias de folga
              </button>
              <button
                type="button"
                onClick={handleClearMarkedDays}
                className="w-full bg-[#FF4500] hover:bg-[#E03D00] text-white font-display font-black text-xs py-3.5 rounded-xl cursor-pointer uppercase tracking-wider transition-all"
              >
                Começar tudo limpo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
