import { api } from "@common";

export const SIM_ROUTING_REMOTE_ID = "SIM_ROUTING_CONFIG";

export interface SimulationRemoteConfig {
  systemMessageRemoteId: string;
  sendUrl?: string;
  username?: string;
}

export interface SimulationRemoteCredentials {
  sendUrl: string;
  username: string;
  password: string;
}

export async function loadSimulationRemoteConfig(): Promise<SimulationRemoteConfig | null> {
  const response: any = await api({
    url: "oms/systemMessageRemotes",
    method: "GET",
    params: { systemMessageRemoteId: [SIM_ROUTING_REMOTE_ID] },
  });
  const responseData = response?.data;
  const remotes = responseData?.systemMessageRemoteList ?? (Array.isArray(responseData) ? responseData : []);

  return remotes.find((remote: SimulationRemoteConfig) => remote.systemMessageRemoteId === SIM_ROUTING_REMOTE_ID) ?? null;
}

export async function saveSimulationRemoteConfig(
  credentials: SimulationRemoteCredentials,
  remoteExists: boolean,
): Promise<any> {
  if(!remoteExists && !credentials.password) {
    throw new Error("Password is required when creating the Sim Routing remote.");
  }

  const data: Record<string, string> = {
    systemMessageRemoteId: SIM_ROUTING_REMOTE_ID,
    description: "Sim Routing Sister Instance Remote",
    sendUrl: credentials.sendUrl,
    username: credentials.username,
    sendAuthEnumId: "SmatLogin",
  };
  if(credentials.password) {
    data.password = credentials.password;
  }

  const response = await api({
    url: remoteExists
      ? `oms/systemMessageRemotes/${encodeURIComponent(SIM_ROUTING_REMOTE_ID)}`
      : "oms/systemMessageRemotes",
    method: remoteExists ? "PUT" : "POST",
    data,
  });

  return response;
}

export async function checkSimulationRemoteConnection(): Promise<number> {
  const response: any = await api({
    url: "order-routing/simulation/datastores",
    method: "GET",
  });
  const datastores = response?.data?.datastoreList;
  if (!Array.isArray(datastores)) {
    throw new Error("Sim Routing datastore list was missing from the response.");
  }
  return datastores.length;
}
