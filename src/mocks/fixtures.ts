import { DEFAULT_RULE_ENUMS, DEFAULT_CONDITION_FILTER_ENUMS } from '@/utils/routingEditorEnv';
import { settingLabels, humanizeRoutingConfigValue } from '@/utils/routingConfigSection';

// A real instance reads these from Enumeration.description, which is sentence case.
// Mirror that here instead of echoing the SCREAMING_SNAKE keys back at the operator.
const enumDescription = (key: string) => settingLabels[key] || humanizeRoutingConfigValue(key);
export const facilityGroups = {"DIGITAL": {"facilityGroupId": "DIGITAL", "facilityGroupName": "Digital print", "facilityGroupTypeId": "BROKERING_GROUP", "facilityGroupTypeEnumId": "FGT_BROKERING"}, "EMBROIDERY": {"facilityGroupId": "EMBROIDERY", "facilityGroupName": "Embroidery", "facilityGroupTypeId": "BROKERING_GROUP", "facilityGroupTypeEnumId": "FGT_BROKERING"}, "FOIL": {"facilityGroupId": "FOIL", "facilityGroupName": "Foil personalization", "facilityGroupTypeId": "BROKERING_GROUP", "facilityGroupTypeEnumId": "FGT_BROKERING"}, "ENGRAVING": {"facilityGroupId": "ENGRAVING", "facilityGroupName": "Engraving", "facilityGroupTypeId": "BROKERING_GROUP", "facilityGroupTypeEnumId": "FGT_BROKERING"}, "EAST": {"facilityGroupId": "EAST", "facilityGroupName": "East Coast", "facilityGroupTypeId": "BROKERING_GROUP", "facilityGroupTypeEnumId": "FGT_BROKERING"}};
export let group = JSON.parse(localStorage.getItem('away-native-routing-v1') || 'null') || {"routingGroupId": "AWAY_PERSONALIZATION", "groupName": "Away \u00b7 Personalized orders", "description": "Route personalized orders to facilities with the required capability.", "productStoreId": "AWAY_US", "disabled": "N", "isRoutingGroupDetailLoaded": true, "routings": [{"orderRoutingId": "ROUTE_PERSONALIZED", "routingGroupId": "AWAY_PERSONALIZATION", "routingName": "Personalized orders", "sequenceNum": 1, "statusId": "ROUTING_ACTIVE", "orderFilters": [], "rules": [{"routingRuleId": "RULE_PERSONALIZED", "orderRoutingId": "ROUTE_PERSONALIZED", "ruleName": "Facilities with personalization capability", "sequenceNum": 1, "assignmentEnumId": "ORA_SINGLE", "statusId": "RULE_ACTIVE", "inventoryFilters": [{"routingRuleId": "RULE_PERSONALIZED", "routingRuleConditionId": "F1", "conditionTypeEnumId": "ENTCT_FILTER", "fieldName": "facilityGroupId", "fieldValue": "DIGITAL,EMBROIDERY", "operator": "in", "sequenceNum": 1}], "actions": []}]}]};
// Normalize the earlier synthetic seed while retaining user edits.
if (group.statusId === 'ORG_ACTIVE') { delete group.statusId; group.disabled = 'N'; }
for (const routing of group.routings || []) for (const rule of routing.rules || []) if (rule.statusId === 'ORR_ACTIVE') rule.statusId = 'RULE_ACTIVE';
export const enumRecords = [...Object.entries(DEFAULT_RULE_ENUMS).map(([key,v]: any) => ({enumId:v.id,enumCode:v.code,enumTypeId:'ORD_FILTER_PRM_TYPE',description:enumDescription(key)})), ...Object.entries(DEFAULT_CONDITION_FILTER_ENUMS).map(([key,v]: any) => ({enumId:v.id,enumCode:v.code,enumTypeId:'INV_FILTER_PRM_TYPE',description:enumDescription(key)}))];
export async function fixtureResponse({ url, method = 'GET', data, params = {} }: any): Promise<any> {
 if (url === 'order-routing/groups') { if(method.toUpperCase()==='POST') { group={...group,...data,routingGroupId:data.routingGroupId || crypto.randomUUID()};for(const routing of group.routings || []) { routing.orderRoutingId ||= crypto.randomUUID(); routing.routingGroupId=group.routingGroupId; for(const rule of routing.rules || []) { rule.routingRuleId ||= crypto.randomUUID(); rule.orderRoutingId=routing.orderRoutingId; } } localStorage.setItem('away-native-routing-v1',JSON.stringify(group));return {routingGroupId:group.routingGroupId}; } return [group]; }
 if(method.toUpperCase()==='DELETE' && /^order-routing\/(routings|rules)\//.test(url)) return {};
 if (url === `order-routing/groups/${group.routingGroupId}/raw`) { if (method.toUpperCase() !== 'GET') { group = {...group,...data}; localStorage.setItem('away-native-routing-v1',JSON.stringify(group)); } return group; }
 if (url.endsWith('/schedule')) return { schedule: null };
 if (url === 'admin/enums') return enumRecords.filter(e => !params.enumTypeId || e.enumTypeId === params.enumTypeId);
 if (url === 'admin/status') return [];
 if (url === 'admin/maarg') return { version:'6.0.0' };
 if (url.includes('categories') || url.includes('routingRuns')) return [];
 throw new Error('No local fixture for ' + method + ' ' + url);
}
