import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderAttributeConditionsStore } from '../src/store/orderAttributeConditions';
describe('local order attribute drafts', () => {
 beforeEach(() => setActivePinia(createPinia()));
 it('validates only routes in the current group', () => {
  const store=useOrderAttributeConditionsStore();
  store.begin('other').conditions.push({id:'bad',name:'',operator:'is',values:''});
  store.begin('current').conditions.push({id:'ok',name:'personalizationType',operator:'is',values:'Foil'});
  expect(store.validationError(['current'])).toBe(false);
  expect(store.validationError(['other'])).toBe(true);
 });
 it('keeps a new route draft when Save replaces its temporary ID', () => {
  const store=useOrderAttributeConditionsStore();
  store.begin('temp').conditions.push({id:'c',name:'personalizationType',operator:'is',values:'Foil, Foil'});
  expect(store.dirtyFor(['temp'])).toBe(true);
  store.rekey('temp','saved'); store.commit(['saved']);
  expect(store.byRouting.saved.conditions[0].values).toBe('Foil');
  expect(store.pending.temp).toBeUndefined();
  expect(store.dirtyFor(['saved'])).toBe(false);
 });
 it('discards the current group without modifying another draft', () => {
  const store=useOrderAttributeConditionsStore();
  for(const id of ['temp','other']) store.begin(id).conditions.push({id:'c',name:'x',operator:'exists',values:''});
  store.discard(['temp']);
  expect(store.pending.temp.conditions).toEqual([]);
  expect(store.pending.other.conditions).toHaveLength(1);
 });
});
