export default interface OrderRoutingState {
  groups: Array<any>; // runs
  rules: any;
  currentGroup: any;
  currentRoute: any;
  routingHistory: any;
  currentRuleId: string;
  temporalExp: any;
}