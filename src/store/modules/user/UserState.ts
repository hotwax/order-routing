export default interface UserState {
  token: string;
  current: object | null;
  instanceUrl: string;
  currentProductStore: object | null;
  omsRedirectionInfo: {
    url: string;
    token: string;
  }
  permissions: any;
}