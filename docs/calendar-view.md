# Calendar View: Routing Schedule

Managing complex order routing rules requires precision and predictability. The transition from a static list-based view to an interactive **Calendar View** significantly enhances the user experience for retailers by providing temporal context and streamlined management capabilities.

## Why a Calendar View?

While list views are efficient for scanning, they lack the spatial and temporal representation necessary for understanding when operations actually occur. The Calendar View addresses this by mapping scheduled runs (Brokering Runs) onto a timeline.

### 1. Predictability & Timing
The calendar layout allows users to tell exactly when certain scheduled operations will run. By visualizing time-slots (e.g., 12 AM, 1 AM), retailers can:
- **Identify Gaps**: Spot periods where no routing is scheduled.
- **Avoid Overlaps**: Ensure that different routing rules are not contending for the same resources or facilities at the same time.
- **Temporal Context**: Understand the sequence of operations at a glance.

### 2. Enhanced Visibility
Each brokering run is represented as a clear, interactive card. These cards provide immediate visibility into critical metrics:
- **Runtime & Frequency**: Quickly see when a run is scheduled and how often it repeats.
- **Runtime Delta**: Visual badges (e.g., `<runtimeDelta>`) indicate the duration or time until the next execution, helping users prioritize their management tasks.
- **Status at a Glance**: With filter chips (All, Active, Draft), users can quickly focus on relevant subsets of their schedules.

### 3. Streamlined Management
The calendar is not just a display; it's a management canvas.
- **Direct Interaction**: Click into specific runs to view descriptions and adjust settings.
- **Effortless Creation**: Use the floating action button (FAB) to quickly add new brokering runs directly onto the schedule.
- **Contextual Awareness**: By seeing rules in relation to each other, users make more informed decisions when adjusting frequencies or priority.

## Key Components

> [!TIP]
> Use the **Filter Chips** at the top to quickly toggle between "Active" runs and "Draft" schedules to clean up your view.

| Component | Function | Benefit |
| :--- | :--- | :--- |
| **Time-slot Columns** | Displays 1-hour increments | Higher precision in scheduling. |
| **Run Cards** | Summarizes Run Name, Time, and Frequency | Reduces cognitive load by surfacing only key data. |
| **Status Badge** | Shows runtime delta or health status | Real-time observability within the schedule. |
| **Global FAB** | Quick add action | Optimized for rapid growth and iteration of routing rules. |

## Conclusion
The Calendar View transforms routing schedule management from a manual auditing task into a visual, predictive experience. It empowers retailers to move faster, reduce errors, and maintain total control over their omnichannel fulfillment strategy.
