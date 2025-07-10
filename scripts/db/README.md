# MongoDB Data Integration

Simple MongoDB query scripts with date-based filtering that dump raw JSON data for direct import into UI components.

## Prerequisites

- MongoDB connection string in `.env` file as `DB_URL`
- Node.js and npm installed

## Available Scripts

### Dump Collections with Date Filtering
```bash
# Default: Last 90 days
npm run db:dump

# Last 30 days
npm run db:dump:30

# Last 7 days  
npm run db:dump:7

# Custom days (e.g., last 60 days)
npx tsx scripts/db/dump-collections.ts 60
```

**Date Filtering by Collection:**
- `billing.workspaceCreditUsage` → filters by `date` field
- `analytics.dailyTaskStatistics` → filters by `date` field
- `analytics.dailyOrganizationContributors` → filters by `date` field
- `analytics.dailyWorkspaceRunCounts` → filters by `date` field
- `contributors` → filters by `createdAt` field
- `runs` → filters by `startTime` field

### Custom Queries
```bash
npm run db:query
```
Runs example queries. Modify `scripts/db/query-mongo.ts` to add custom queries.

## Direct JSON Import Usage

### Import JSON Files in Components
```typescript
// Import raw MongoDB JSON dumps directly
import workspaceCreditUsageData from '../data/dumps/workspace-credit-usage.json';
import taskStatisticsData from '../data/dumps/task-statistics.json';
import workspaceRunCountsData from '../data/dumps/workspace-run-counts.json';

// Use directly in your component
export function MyDashboard() {
  const totalCredits = workspaceCreditUsageData.reduce((sum, item) => 
    sum + (item.executionCredits || 0), 0);
    
  return <div>Total Credits: {totalCredits.toLocaleString()}</div>;
}
```

### Access Raw MongoDB Fields
```typescript
// Workspace Credit Usage fields:
// date, organizationId, workspaceId, compute, executionCredits, runCount, updatedAt

const totalCredits = workspaceCreditUsageData.reduce((sum, item) => 
  sum + (item.executionCredits || 0), 0);

// Task Statistics fields:
// averageDuration, cacheStatusRatio, date, isCI, projectName, statusCodeRatio, 
// target, targetGroupName, totalCount, workspaceId

const avgCacheHit = taskStatisticsData.reduce((sum, task) => 
  sum + (task.cacheStatusRatio?.localCacheHit || 0), 0) / taskStatisticsData.length;

// Run Counts fields:
// date, organizationId, workspaceId, ciRunFailureCount, ciRunSuccessCount,
// localRunFailureCount, localRunSuccessCount

const totalRuns = workspaceRunCountsData.reduce((sum, item) => 
  sum + (item.ciRunSuccessCount || 0) + (item.ciRunFailureCount || 0), 0);
```

## File Structure

```
scripts/db/
├── dump-collections.ts      # Main dump script with date filtering
├── mongo-connection.ts      # MongoDB connection utilities
├── query-mongo.ts          # Custom query runner
├── list-collections.ts     # Collection explorer
└── README.md               # This file

src/data/
└── dumps/                  # Raw JSON dumps (gitignored)
    ├── workspace-credit-usage.json
    ├── task-statistics.json
    ├── workspace-run-counts.json
    ├── organization-contributors.json
    ├── contributors.json
    ├── runs.json
    ├── sample-*.ts         # Sample data structures
    └── ...
```

## MongoDB Collections

### Available Collections
- **billing.workspaceCreditUsage** - Credit usage and run counts by workspace/date
- **analytics.dailyTaskStatistics** - Task execution statistics with cache performance
- **analytics.dailyOrganizationContributors** - Daily contributor counts
- **analytics.dailyWorkspaceRunCounts** - CI and local run counts by workspace
- **contributors** - Contributor data with hashed identifiers
- **runs** - Individual run records with timing and status

### Sample Data Structures

Each collection dump includes a sample TypeScript file showing the exact field structure:
- `sample-workspace-credit-usage.ts`
- `sample-task-statistics.ts`
- `sample-organization-contributors.ts`
- etc.

## Example Component

```typescript
import React from 'react';
import workspaceCreditUsageData from '../data/dumps/workspace-credit-usage.json';
import taskStatisticsData from '../data/dumps/task-statistics.json';

export function MyDashboard() {
  // Calculate metrics directly from raw MongoDB data
  const totalCredits = workspaceCreditUsageData.reduce((sum, item) => 
    sum + (item.executionCredits || 0), 0);
    
  const avgCacheHitRate = taskStatisticsData.length > 0
    ? taskStatisticsData.reduce((sum, task) => 
        sum + (task.cacheStatusRatio?.localCacheHit || 0), 0) / taskStatisticsData.length
    : 0;

  // Date filtering (if needed)
  const recentData = workspaceCreditUsageData.filter(item => 
    new Date(item.date) > new Date('2025-06-01'));

  return (
    <div>
      <h2>Total Credits: {totalCredits.toLocaleString()}</h2>
      <h2>Avg Cache Hit Rate: {(avgCacheHitRate * 100).toFixed(1)}%</h2>
      <h3>Recent Records: {recentData.length}</h3>
      
      {/* Use raw data in charts */}
      <MyChart data={workspaceCreditUsageData} />
    </div>
  );
}
```

## Configuration

### Customizing Collections
Edit `DUMP_CONFIGS` in `scripts/db/dump-collections.ts`:
```typescript
{
  collection: 'your.collection.name',
  outputFile: 'your-data.json',
  dateField: 'your_date_field',  // Field to filter by date
  projection: { _id: 0, field1: 1, field2: 1 },  // Optional
  sort: { your_date_field: -1 }  // Optional
}
```

### Adding Custom Queries
Edit `scripts/db/query-mongo.ts` to add specialized aggregations or complex queries.

## Benefits

- **Simple**: Just import JSON files directly, no build step
- **Fast**: No transformation layer, use raw MongoDB data
- **Flexible**: Easy date filtering, custom queries
- **Type Safe**: Sample TypeScript files show exact field structure
- **Minimal**: No generated code, no complex build pipeline

## Notes

- Raw MongoDB data is used directly in components
- Date filtering ensures reasonable data sizes and recent data focus
- All dumped data is excluded from git by default
- Use MongoDB field names directly in your components
- TypeScript gets type inference from JSON imports automatically