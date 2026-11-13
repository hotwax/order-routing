import { defineStore } from 'pinia';

export interface OrderAttributeCondition {
  id: string;
  name: string;
  operator: 'is' | 'isNot' | 'exists' | 'missing';
  values: string;
}

export interface AttributeConditions {
  match: string;
  conditions: OrderAttributeCondition[];
  // Opt-in flag set from the order filter options modal. Older persisted drafts
  // predate it, so treat "has conditions" as enabled when it is absent.
  enabled?: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const initial = (): AttributeConditions => ({ match: 'all', conditions: [], enabled: false });
// Explicitly opted in, or carrying conditions from a draft that predates the flag.
const isEnabled = (draft?: AttributeConditions) => !!draft && (!!draft.enabled || draft.conditions.length > 0);

// Drafts saved before `enabled` existed omit the key. Compare and seed from a
// normalized copy so an untouched route is never reported as having edits.
const normalize = (draft?: AttributeConditions): AttributeConditions => {
  const copy = draft ? clone(draft) : initial();
  copy.enabled = isEnabled(copy);
  return copy;
};

export const newCondition = (): OrderAttributeCondition => ({ id: crypto.randomUUID(), name: '', operator: 'is', values: '' });

// Pending UI conditions participate in the existing group's Save and Discard controls.
// Kept outside the API payload until a backend attribute-condition contract is agreed.
export const useOrderAttributeConditionsStore = defineStore('orderAttributeConditionDrafts', {
  state: () => ({
    byRouting: {} as Record<string, AttributeConditions>,
    pending: {} as Record<string, AttributeConditions>
  }),
  getters: {
    dirtyFor: state => (ids: string[]) => Object.entries(state.pending)
      .some(([id, draft]) => ids.includes(id) && JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(state.byRouting[id]))),
    isEnabledFor: state => (id: string) => isEnabled(state.pending[id] || state.byRouting[id])
  },
  actions: {
    rekey(from: string, to: string) {
      if (from === to || !to) return;
      if (this.pending[from]) { this.pending[to] = this.pending[from]; delete this.pending[from]; }
      if (this.byRouting[from]) { this.byRouting[to] = this.byRouting[from]; delete this.byRouting[from]; }
    },
    begin(id: string) {
      if (!this.pending[id]) this.pending[id] = normalize(this.byRouting[id]);
      return this.pending[id];
    },
    setEnabled(id: string, enabled: boolean) {
      const draft = this.begin(id);
      draft.enabled = enabled;
      // Turning the filter off drops its conditions so the canvas row disappears
      // cleanly; turning it on leaves the builder to add the first condition.
      if (!enabled) draft.conditions = [];
    },
    validationError(ids: string[]) {
      return Object.entries(this.pending).some(([id, draft]) => ids.includes(id) && isEnabled(draft) && draft.conditions.some(row =>
        !row.name.trim() || (['is', 'isNot'].includes(row.operator) && !row.values.split(',').some(value => value.trim()))
      ));
    },
    commit(ids: string[]) {
      for (const [id, draft] of Object.entries(this.pending)) {
        if (!ids.includes(id)) continue;
        for (const row of draft.conditions) {
          row.name = row.name.trim();
          row.values = [...new Set(row.values.split(',').map(value => value.trim()).filter(Boolean))].join(', ');
        }
        this.byRouting[id] = clone(draft);
      }
    },
    discard(ids: string[]) {
      for (const id of ids) this.pending[id] = normalize(this.byRouting[id]);
    }
  },
  persist: { pick: ['byRouting'] }
});
