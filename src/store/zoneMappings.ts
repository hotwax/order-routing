import { defineStore } from 'pinia';
export interface ZoneMapping { id:string; carrier:string; origin:string; destination:string; matchType:'exact'|'prefix'; zone:string; days:number }
// Local UI drafts until the zone import/lookup contract is implemented in Moqui.
export const useZoneMappingsStore = defineStore('zoneMappingDrafts', {
 state: () => ({ mappings: [] as ZoneMapping[] }),
 actions: { save(row:ZoneMapping) { const index=this.mappings.findIndex(r=>r.id===row.id); if(index<0)this.mappings.push({...row});else this.mappings[index]={...row}; }, remove(id:string){this.mappings=this.mappings.filter(r=>r.id!==id);} }, persist:true
});
