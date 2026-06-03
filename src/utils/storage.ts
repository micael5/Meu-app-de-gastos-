import { AppState, Account, HistoryEntry } from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: '1', name: 'Aluguel', value: 800, dueDate: 20, percentage: 45.71 },
  { id: '2', name: 'Compras do Mês', value: 800, dueDate: 20, percentage: 45.71 },
  { id: '3', name: 'Internet', value: 100, dueDate: 20, percentage: 5.71 },
  { id: '4', name: 'Manutenção Bicicleta', value: 50, dueDate: 20, percentage: 2.86 }
];

const STORAGE_KEY = 'MEU_CONTROLE_ENTREGAS_STATE';

export function loadAppState(): AppState {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return {
        accounts: DEFAULT_ACCOUNTS,
        history: [],
        totalSavedThisMonth: 0,
      };
    }
    const parsed = JSON.parse(serialized);
    
    // Garantir estrutura válida para evitar quebras se houver dados antigos obsoletos
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_ACCOUNTS,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      totalSavedThisMonth: typeof parsed.totalSavedThisMonth === 'number' ? parsed.totalSavedThisMonth : 0,
    };
  } catch (error) {
    console.error('Erro ao ler do localStorage:', error);
    return {
      accounts: DEFAULT_ACCOUNTS,
      history: [],
      totalSavedThisMonth: 0,
    };
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

export function calculateAllocations(gain: number, accounts: Account[]): { name: string; value: number }[] {
  if (accounts.length === 0) return [];
  
  const allocations: { name: string; value: number }[] = [];
  let sumComputed = 0;
  
  for (let i = 0; i < accounts.length - 1; i++) {
    const acc = accounts[i];
    // Calcular o valor exato com base na porcentagem
    const rawVal = gain * (acc.percentage / 100);
    const roundedVal = Math.round(rawVal * 100) / 100;
    allocations.push({ name: acc.name, value: roundedVal });
    sumComputed += roundedVal;
  }
  
  // O último item recebe exatamente o restante para que a soma seja matemática e perfeitamente idêntica ao ganho digitado
  const lastAcc = accounts[accounts.length - 1];
  const lastVal = Math.max(0, Math.round((gain - sumComputed) * 100) / 100);
  allocations.push({ name: lastAcc.name, value: lastVal });
  
  return allocations;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
