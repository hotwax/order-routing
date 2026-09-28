export interface SimulationSetupGroup {
  id: string;
  label: string;
}

export interface SimulationSetupStep {
  id: string;
  group: string;
  label: string;
  summary: string;
  description: string;
  actionLabel?: string;
}

export const SIMULATION_SETUP_GROUPS: SimulationSetupGroup[] = [
  {
    id: "backend",
    label: "Backend & connectivity"
  },
  {
    id: "datastore",
    label: "Datastore & ingestion"
  },
  {
    id: "routing",
    label: "Routing & variations"
  },
  {
    id: "simulation",
    label: "Simulation run"
  }
];

export const SIMULATION_SETUP_STEPS: SimulationSetupStep[] = [
  {
    id: "backend-connection",
    group: "backend",
    label: "Simulation Remote Auth",
    summary: "Save the sister instance credentials and test them through Main OMS.",
    description: "Main OMS uses SIM_ROUTING_CONFIG to authenticate to Sim Routing. Listing its datastores proves this connection works.",
    actionLabel: "Test connection"
  },
  {
    id: "datastore-select",
    group: "datastore",
    label: "Choose a datastore",
    summary: "Select an existing copy or create an empty one.",
    description: "A new datastore is an empty MySQL database. Select a Ready copy to skip the fill.",
    actionLabel: "Select or create"
  },
  {
    id: "open-datastore",
    group: "datastore",
    label: "Open datastore",
    summary: "Make the selected copy active before filling or simulating.",
    description: "Opening selects the database Sim Routing reads and writes. Open a Created datastore before filling it, or a Ready datastore before running simulations.",
    actionLabel: "Open datastore"
  },
  {
    id: "data-fill",
    group: "datastore",
    label: "Copy source data",
    summary: "Fill a new datastore from the configured prod-source database.",
    description: "The background fill reads facility, routing, product, stock, and queued-order data from prod-source. Its progress and failures prove whether source access works.",
    actionLabel: "Start fill"
  },
  {
    id: "readiness-gate",
    group: "datastore",
    label: "Confirm readiness",
    summary: "Check the datastore state after the fill.",
    description: "Sim Routing marks the datastore Ready after its fill completes and passes the built-in check. Refresh its state here; there is no manual readiness action.",
    actionLabel: "Refresh status"
  },
  {
    id: "routing-baseline",
    group: "routing",
    label: "Choose baseline group",
    summary: "Select a copied routing group and check its references.",
    description: "Choose a routing group copied into the active datastore. Validation checks whether its rule references resolve in that copy.",
    actionLabel: "Validate group"
  },
  {
    id: "create-variation",
    group: "routing",
    label: "Optional variation",
    summary: "Clone a group if you want to prepare a what-if run.",
    description: "A fresh clone has the same rules as its parent until you edit it. You can run the baseline alone without creating one.",
    actionLabel: "Clone variation"
  },
  {
    id: "execute-simulation",
    group: "simulation",
    label: "Execute simulation",
    summary: "Run the selected group against the active datastore.",
    description: "Submit the baseline, optionally include a variation, then follow the persisted run until it completes or fails.",
    actionLabel: "Launch simulation"
  }
];
