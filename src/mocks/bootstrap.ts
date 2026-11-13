import { useZoneMappingsStore, type ZoneMapping } from '@/store/zoneMappings';
import { useOrderAttributeConditionsStore } from '@/store/orderAttributeConditions';
import { Settings } from 'luxon';
import { useUserStore } from '@/store/userStore';
import Actions from '@/authorization/actions';
const fixturePermissions = [...new Set(Object.values(Actions).flatMap(value => value.split(/ OR | AND /)).filter(Boolean))];
const fixtureStore = { productStoreId: 'AWAY_US', storeName: 'Away US' };
import { productStore } from '@/store/productStore';
import { useUtilStore } from '@/store/utilStore';
import { group, facilityGroups, enumRecords } from './fixtures';
import { orderRoutingStore } from '@/store/orderRoutingStore';
export async function installFixtures() {
 const zones = useZoneMappingsStore();
 if(!localStorage.getItem('zoneMappingDrafts')) zones.mappings = [
 {id:'z1',carrier:'FedEx',origin:'18101',destination:'10001',matchType:'exact',zone:'2',days:1},
 {id:'z2',carrier:'FedEx',origin:'18101',destination:'100',matchType:'prefix',zone:'2',days:2},
 {id:'z3',carrier:'FedEx',origin:'91761',destination:'10001',matchType:'exact',zone:'8',days:5},
 {id:'z4',carrier:'UPS',origin:'18101',destination:'02108',matchType:'exact',zone:'3',days:2},
 {id:'z5',carrier:'UPS',origin:'30336',destination:'10001',matchType:'exact',zone:'5',days:3}
 ] as ZoneMapping[];
 Settings.defaultZone = 'America/New_York';
 const user = useUserStore();
 user.$patch({ current: { userId: 'demo-operator', username: 'Demo operator', firstName: 'Demo', lastName: 'Operator', timeZone: 'America/New_York', stores: [fixtureStore] }, oms: 'local-ui-fixtures', appVersion: '', permissions: [...fixturePermissions, import.meta.env.VITE_APP_PERMISSION_ID] } as any);
 user.ensureInstanceScope = async () => false;
 const product = productStore();
 product.currentEComStore = fixtureStore;
 product.ecomStores = [fixtureStore];
 product.facilityGroups = facilityGroups;
 product.fetchRoutingReferenceData = async () => {};
 const util = useUtilStore();
 for (const row of enumRecords) { util.enums[row.enumTypeId] ||= {}; util.enums[row.enumTypeId][row.enumId] = row; }
 const attributes = useOrderAttributeConditionsStore();
 if(!attributes.byRouting.ROUTE_PERSONALIZED) attributes.byRouting.ROUTE_PERSONALIZED = { match:'all',conditions:[{id:'personalization',name:'personalizationType',operator:'is',values:'Digital print, Embroidery'}] };
 const routing = orderRoutingStore();
 routing.groups = [structuredClone(group)];
}
