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

### Chart Types
- **ExecutionCreditsChart**: Heatmap showing daily credit usage across workspaces
- **RunCountChart**: Heatmap for daily run counts
- **ComputeResourceChart**: Bar chart for compute resource usage by class
- **ContributorChart**: Top contributors by run count
- **MonthlySummaryChart**: Summary statistics for selected month
- **DailyTimeSavedChart**: Line chart showing time savings over time
- **TaskDurationAnalysisChart**: Analysis of task execution durations

### Tech Stack
- **React 18.3** with TypeScript 5.5
- **Vite** for build tooling
- **Recharts** for data visualization
- **Tailwind CSS** for styling
- **date-fns** for date manipulation
- **@heroicons/react** for icons