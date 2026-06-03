export interface Account {
  id: string;
  name: string;
  value: number;
  dueDate: number;
  percentage: number; // percentage of the total budget allocated to this account
}

export interface HistoryEntry {
  id: string;
  date: string;
  gain: number;
  allocations: {
    name: string;
    value: number;
  }[];
}

export interface AppState {
  accounts: Account[];
  history: HistoryEntry[];
  totalSavedThisMonth: number; // cumulative total saved for the accounts from "Calcular" operations
  markedDays?: { [dateStr: string]: 'work' | 'off' };
  currentCycleId?: string; // "YYYY-MM-20" representing the active billing cycle
}
