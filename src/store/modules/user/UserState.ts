export default interface UserState {
  token: string;
  current: object | null;
  instanceUrl: string;
  currentEComStore: object | null;
  omsRedirectionInfo: {
    url: string;
    token: string;
  }
  permissions: any;
}