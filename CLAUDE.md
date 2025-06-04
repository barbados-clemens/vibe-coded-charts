# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev        # Start development server with hot reload (Vite)
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint for code quality checks
```

## Architecture Overview

This is a React/TypeScript visualization dashboard displaying analytics data through interactive charts. The application renders multiple chart types (line charts, heatmaps, bar charts) using Recharts, with time-based navigation and multi-workspace support.

### Data Flow
1. Mock data is imported from `src/data/mockData.ts`
2. App.tsx passes data to individual chart components
3. Chart components process data using utilities from `src/utils/chartUtils.ts`
4. Each chart manages its own state for date/time navigation
5. Charts use the shared `ChartNavigation` component for consistent UI

### Key Architectural Patterns
- **Component Independence**: Each chart is self-contained with its own state management
- **Data Processing**: Raw cumulative data is converted to daily increments for visualization
- **Shared Utilities**: Common chart logic (data transformation, color schemes) centralized in chartUtils.ts
- **No Routing/State Management**: Simple prop passing without Redux or React Router

### Chart Components (Refactored for Server-Side Processing)
All chart components now support optional pre-processed data for server-side rendering and use functional data processing utilities:

- **ExecutionCreditsChart**: Heatmap + line chart showing daily credit usage across workspaces
- **RunCountChart**: Heatmap + line chart for daily run counts  
- **ComputeResourceChart**: Stacked bar chart for compute resource usage by class and workspace
- **ContributorChart**: Bar chart showing top contributors by pipeline executions
- **MonthlySummaryChart**: Pie charts showing execution vs compute usage breakdowns
- **DailyTimeSavedChart**: Line chart with rolling averages for time savings analysis
- **TaskDurationAnalysisChart**: Analysis of task execution durations and cache performance

### Functional Data Processing Architecture
The `src/utils/chartUtils.ts` file contains pure, composable utility functions for data transformations:

- **Incremental Calculations**: `calculateIncrements()`, `calculateComputeIncrements()`
- **Data Filtering**: `filterByDateRange()`, `filterByWorkspace()`
- **Aggregations**: `sumBy()`, `averageBy()`, `groupBy()`, `sortBy()`
- **Chart Transformations**: `createLineChartData()`, `createHeatmapData()`, `createComputeBarChartData()`
- **Functional Utilities**: `pipe()`, `curry()`, `memoize()` for composition and performance
- **Statistics**: `calculateWeightedAvgDuration()`, `calculateOverallCacheRate()`

### Server-Side Friendly Design
Components accept optional pre-processed data props, allowing expensive calculations to be performed server-side:
```typescript
<ExecutionCreditsChart 
  data={rawData}
  incrementalData={preProcessedIncrements}  // Optional server-side processing
  heatmapData={preCalculatedHeatmaps}      // Optional server-side processing
/>
```

### Tech Stack
- **React 18.3** with TypeScript 5.5 (strict typing, no `any` types)
- **Vite** for build tooling
- **Recharts** for data visualization
- **Tailwind CSS** for styling
- **date-fns** for date manipulation
- **@heroicons/react** for icons