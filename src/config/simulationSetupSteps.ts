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
    summary: "Authenticate OMS with the sister Sim Routing instance using a SystemMessageRemote tenant key.",
    description: "Main OMS communicates with the sister Sim Routing container using a secure SystemMessageRemote (SIM_ROUTING_CONFIG) and one-time tenant API key.",
    actionLabel: "Verify & Save Auth"
  },
  {
    id: "prod-source",
    group: "backend",
    label: "Source replica check",
    summary: "Verify connection to the production read replica datasource.",
    description: "The data ingestion DAG reads facilities, products, stock, and queued orders from the prod-source replica.",
    actionLabel: "Verify replica"
  },
  {
    id: "datastore-select",
    group: "datastore",
    label: "Datastore schema",
    summary: "Choose an existing datastore or provision a new schema.",
    description: "Each simulation datastore is a dedicated MySQL schema (m4sim_<id>) with 28 copy tables and 14 simulation tables.",
    actionLabel: "Provision datastore"
  },
  {
    id: "data-fill",
    group: "datastore",
    label: "Data ingestion (DAG)",
    summary: "Execute the 5-step data copy graph into the datastore.",
    description: "Streams and batches facility masters, facilities, routing trees, closure products with stock, and approved queued orders.",
    actionLabel: "Start data fill"
  },
  {
    id: "readiness-gate",
    group: "datastore",
    label: "Fidelity & readiness",
    summary: "Run integrity checks and mark the datastore as ready.",
    description: "Verifies column shapes, closure reachability, and order totals against the source replica before enabling simulations.",
    actionLabel: "Validate fidelity"
  },
  {
    id: "open-datastore",
    group: "datastore",
    label: "Open datastore pool",
    summary: "Mount the datastore as the active connection target.",
    description: "Instructs the simulation datasource factory to route all brokering operations to this active schema.",
    actionLabel: "Open datastore"
  },
  {
    id: "routing-baseline",
    group: "routing",
    label: "Baseline routing groups",
    summary: "Inspect and validate current routing configuration.",
    description: "Loads the routing groups, routings, rules, conditions, and actions copied from production.",
    actionLabel: "Inspect rules"
  },
  {
    id: "create-variation",
    group: "routing",
    label: "Create variation",
    summary: "Clone a baseline routing group into an experimental variation.",
    description: "Variations allow testing alternate ranking orders, facility groupings, or threshold conditions safely.",
    actionLabel: "Clone variation"
  },
  {
    id: "execute-simulation",
    group: "simulation",
    label: "Execute simulation",
    summary: "Run comparative brokering simulation across baseline and variations.",
    description: "Simulates full order allocation, evaluates facility capacity and stock depletion, and records item-level decisions.",
    actionLabel: "Launch simulation"
  }
];
