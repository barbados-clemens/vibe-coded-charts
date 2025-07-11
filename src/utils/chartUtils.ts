import { format, startOfYear, endOfYear, eachDayOfInterval, getDay } from 'date-fns';
import { UTCDate } from "@date-fns/utc";

// ===== TYPE DEFINITIONS =====
export type DataItem = {
  id: string;
  organizationId: string;
  workspaceId: string;
  compute: Array<{
    resourceClass: string;
    credits: number;
  }>;
  runCount: number;
  executionCredits: number;
  date: string;
};

export type IncrementalDataItem = DataItem;

export type HeatmapDayData = {
  date: Date;
  value: number;
  dateStr: string;
  workspaceDetails: Array<{ workspaceId: string; value: number }>;
};

export type WeeksArray = Array<Array<HeatmapDayData | null>>;

export type ComputeAggregation = {
  resourceClass: string;
  total: number;
  byWorkspace: Record<string, number>;
};

export type ContributorData = {
  name: string;
  runs: number;
  successful: number;
  cached: number;
  cacheRate: number;
};

export type ContributorDataItem = {
  id: string;
  organizationId: string;
  periodEnd: string;
  periodStart: string;
  contributors: Record<string, Array<{
    ciPipelineExecutionId: string;
    triggeredAt: string;
    title: string;
  }> | undefined>;
};

export type ProcessedContributor = {
  contributor: string;
  ciPipelineExecutions: number;
  executions: Array<{
    ciPipelineExecutionId: string;
    triggeredAt: string;
    title: string;
  }>;
};

export type TimeSavedData = {
  date: string;
  workspaceId: string;
  timeSavedMs: number;
};

export type TaskStats = {
  projectName: string;
  taskName: string;
  cacheable: boolean;
  avgDurationMs: number;
  runCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  localEnvironment: string;
};

export type ChartDataPoint = {
  date: string;
  fullDate: string;
  [key: string]: string | number;
};

export type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
};

// ===== FUNCTIONAL UTILITIES =====

// Pipe function for composing transformations
export const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
  fns.reduce((acc, fn) => fn(acc), value);

// Curry function for partial application
export const curry = <T extends (...args: unknown[]) => unknown>(fn: T) => {
  const arity = fn.length;
  return function curried(...args: unknown[]): unknown {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...nextArgs: unknown[]) => curried(...args, ...nextArgs);
  };
};

// Memoization for expensive calculations
export const memoize = <T extends (...args: unknown[]) => unknown>(fn: T): T => {
  const cache = new Map();
  return ((...args: unknown[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

// ===== PURE DATA TRANSFORMATION FUNCTIONS =====

// Generic groupBy function
export const groupBy = <T>(key: keyof T | ((item: T) => string)) => (data: T[]): Record<string, T[]> => {
  return data.reduce((acc, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    return {
      ...acc,
      [groupKey]: [...(acc[groupKey] || []), item]
    };
  }, {} as Record<string, T[]>);
};

// Generic sortBy function
export const sortBy = <T>(key: keyof T | ((item: T) => number)) => (data: T[]): T[] => {
  return [...data].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : Number(a[key]);
    const bVal = typeof key === 'function' ? key(b) : Number(b[key]);
    return aVal - bVal;
  });
};

// Filter data by date range
export const filterByDateRange = (startDate: Date, endDate: Date) => (data: DataItem[]): DataItem[] => {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return data.filter(item => {
    const itemDate = new UTCDate(item.date).getTime();
    return itemDate >= start && itemDate <= end;
  });
};

// Filter data by workspace
export const filterByWorkspace = (workspaceId: string) => (data: DataItem[]): DataItem[] => {
  return data.filter(item => item.workspaceId === workspaceId);
};

// ===== INCREMENTAL CALCULATIONS =====

// Calculate incremental values from cumulative data
export const calculateIncrements = (field: 'executionCredits' | 'runCount') => (data: DataItem[]): IncrementalDataItem[] => {
  const grouped = groupBy<DataItem>(item => {
    const date = new UTCDate(item.date);
    return `${item.workspaceId}-${date.getUTCFullYear()}-${date.getUTCMonth()}`;
  })(data);

  return Object.values(grouped).flatMap(monthData => {
    const sorted = sortBy<DataItem>(item => new Date(item.date).getTime())(monthData);
    
    // Skip months that don't start from the 1st of the month
    if (sorted.length > 0) {
      const firstDate = new UTCDate(sorted[0].date);
      const firstDayOfMonth = firstDate.getUTCDate();
      
      // If the first data point is not from the 1st of the month, skip this entire month
      if (firstDayOfMonth !== 1) {
        return [];
      }
    }
    
    return sorted.map((item, index) => ({
      ...item,
      [field]: index === 0 
        ? item[field] 
        : Math.max(0, item[field] - sorted[index - 1][field])
    }));
  });
};

// Calculate compute increments
export const calculateComputeIncrements = (data: DataItem[]): IncrementalDataItem[] => {
  const grouped = groupBy<DataItem>(item => {
    const date = new UTCDate(item.date);
    return `${item.workspaceId}-${date.getUTCFullYear()}-${date.getUTCMonth()}`;
  })(data);

  return Object.values(grouped).flatMap(monthData => {
    const sorted = sortBy<DataItem>(item => new Date(item.date).getTime())(monthData);
    
    // Skip months that don't start from the 1st of the month
    if (sorted.length > 0) {
      const firstDate = new UTCDate(sorted[0].date);
      const firstDayOfMonth = firstDate.getUTCDate();
      
      // If the first data point is not from the 1st of the month, skip this entire month
      if (firstDayOfMonth !== 1) {
        return [];
      }
    }
    
    return sorted.map((item, index) => {
      if (index === 0) return item;
      
      const prevCompute = sorted[index - 1].compute;
      const incrementalCompute = item.compute.map(currentResource => {
        const prevResource = prevCompute.find(p => p.resourceClass === currentResource.resourceClass);
        return {
          ...currentResource,
          credits: Math.max(0, currentResource.credits - (prevResource?.credits || 0))
        };
      }).filter(resource => resource.credits > 0);
      
      return { ...item, compute: incrementalCompute };
    });
  });
};

// ===== AGGREGATION FUNCTIONS =====

// Sum values by a specific field
export const sumBy = <T>(field: keyof T | ((item: T) => number)) => (data: T[]): number => {
  return data.reduce((sum, item) => {
    const value = typeof field === 'function' ? field(item) : Number(item[field]);
    return sum + value;
  }, 0);
};

// Calculate average
export const averageBy = <T>(field: keyof T | ((item: T) => number)) => (data: T[]): number => {
  if (data.length === 0) return 0;
  return sumBy(field)(data) / data.length;
};

// Get unique values
export const getUnique = <T, K>(selector: (item: T) => K) => (data: T[]): K[] => {
  return [...new Set(data.map(selector))];
};

// ===== SPECIALIZED TRANSFORMATIONS =====

// Get unique workspace IDs
export const getUniqueWorkspaceIds = getUnique<DataItem, string>(item => item.workspaceId);

// Get unique resource classes
export const getUniqueResourceClasses = (data: DataItem[]): string[] => {
  return getUnique<{ resourceClass: string }, string>(
    item => item.resourceClass
  )(data.flatMap(item => item.compute));
};

// Aggregate compute by resource class
export const aggregateComputeByResourceClass = (data: DataItem[]): ComputeAggregation[] => {
  const resourceClasses = getUniqueResourceClasses(data);
  
  return resourceClasses.map(resourceClass => {
    const byWorkspace: Record<string, number> = {};
    let total = 0;
    
    data.forEach(item => {
      const resource = item.compute.find(c => c.resourceClass === resourceClass);
      if (resource) {
        byWorkspace[item.workspaceId] = (byWorkspace[item.workspaceId] || 0) + resource.credits;
        total += resource.credits;
      }
    });
    
    return { resourceClass, total, byWorkspace };
  });
};

// Transform data for line charts
export const createLineChartData = (field: 'executionCredits' | 'runCount', workspaceIds: string[]) => 
  (data: IncrementalDataItem[]): ChartDataPoint[] => {
    const uniqueDates = getUnique<IncrementalDataItem, string>(item => item.date)(data);
    const sortedDates = sortBy<string>(date => new Date(date).getTime())(uniqueDates);
    
    return sortedDates.map(date => {
      const dataPoint: ChartDataPoint = {
        date: format(new UTCDate(date), 'MMM dd'),
        fullDate: date
      };
      
      workspaceIds.forEach(workspaceId => {
        const item = data.find(d => d.date === date && d.workspaceId === workspaceId);
        dataPoint[workspaceId] = item?.[field] || 0;
      });
      
      return dataPoint;
    });
  };

// ===== HEATMAP FUNCTIONS =====

// Create heatmap data structure
export const createHeatmapData = memoize((
  data: IncrementalDataItem[], 
  year: number,
  field: 'executionCredits' | 'runCount'
): WeeksArray => {
  const yearStart = startOfYear(new UTCDate(year, 0, 1));
  const yearEnd = endOfYear(new UTCDate(year, 11, 31));
  const allDaysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd });
  
  // Filter data for the specific year
  const yearData = data.filter(item => new UTCDate(item.date).getUTCFullYear() === year);
  
  // Create daily aggregations
  const dailyData = yearData.reduce((acc, item) => {
    const dateKey = item.date.split('T')[0];
    
    if (!acc[dateKey]) {
      acc[dateKey] = { total: 0, workspaces: [] };
    }
    
    acc[dateKey].total += item[field];
    if (item[field] > 0) {
      acc[dateKey].workspaces.push({
        workspaceId: item.workspaceId,
        value: item[field]
      });
    }
    
    return acc;
  }, {} as Record<string, { total: number; workspaces: Array<{ workspaceId: string; value: number }> }>);
  
  // Build weeks array
  const firstDayOfYear = getDay(yearStart);
  const weeksArray: WeeksArray = [];
  let currentWeek: Array<HeatmapDayData | null> = Array(firstDayOfYear).fill(null);
  
  allDaysInYear.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = dailyData[dateKey];
    
    currentWeek.push({
      date,
      value: dayData?.total || 0,
      dateStr: dateKey,
      workspaceDetails: dayData?.workspaces || []
    });
    
    if (currentWeek.length === 7) {
      weeksArray.push(currentWeek);
      currentWeek = [];
    }
  });
  
  // Add last partial week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeksArray.push(currentWeek);
  }
  
  return weeksArray;
});

// Get color intensity for heatmap
export const getColorIntensity = curry((maxValue: number, value: number): number => {
  if (value === 0 || maxValue === 0) return 0;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
});

// ===== TIME SAVED CALCULATIONS =====

// Convert milliseconds to appropriate time unit
export const formatTimeUnit = (ms: number): { value: number; unit: string } => {
  const minutes = ms / (1000 * 60);
  if (minutes < 60) return { value: Math.round(minutes), unit: 'minutes' };
  
  const hours = minutes / 60;
  if (hours < 24) return { value: Math.round(hours * 10) / 10, unit: 'hours' };
  
  const days = hours / 24;
  return { value: Math.round(days * 10) / 10, unit: 'days' };
};

// Calculate rolling average
export const calculateRollingAverage = curry((windowSize: number, data: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> => {
  return data.map((item, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = data.slice(start, index + 1);
    const average = averageBy<{ value: number }>('value')(window);
    
    return { date: item.date, value: average };
  });
});

// ===== TASK DURATION ANALYSIS =====

// Calculate weighted average duration
export const calculateWeightedAvgDuration = (tasks: TaskStats[]): number => {
  const totalWeight = sumBy<TaskStats>('runCount')(tasks);
  if (totalWeight === 0) return 0;
  
  const weightedSum = tasks.reduce((sum, task) => 
    sum + (task.avgDurationMs * task.runCount), 0
  );
  
  return weightedSum / totalWeight;
};

// Calculate overall cache rate
export const calculateOverallCacheRate = (tasks: TaskStats[]): number => {
  const totalHits = sumBy<TaskStats>('cacheHitCount')(tasks);
  const totalRuns = sumBy<TaskStats>(task => task.cacheHitCount + task.cacheMissCount)(tasks);
  
  return totalRuns > 0 ? (totalHits / totalRuns) * 100 : 0;
};

// Group tasks by environment
export const groupTasksByEnvironment = groupBy<TaskStats>('localEnvironment');

// ===== CONTRIBUTOR TRANSFORMATIONS =====

// Process contributor data for a period
export const processContributorData = (data: ContributorDataItem | null): ProcessedContributor[] => {
  if (!data) return [];
  
  return Object.entries(data.contributors)
    .filter(([, executions]) => executions && executions.length > 0)
    .map(([contributor, executions]) => ({
      contributor,
      ciPipelineExecutions: executions!.length,
      executions: executions!
    }))
    .sort((a, b) => b.ciPipelineExecutions - a.ciPipelineExecutions);
};

// Calculate contributor statistics
export const calculateContributorStats = (contributors: ProcessedContributor[]) => {
  const totalExecutions = sumBy<ProcessedContributor>('ciPipelineExecutions')(contributors);
  const contributorCount = contributors.length;
  const avgPerContributor = contributorCount > 0 ? Math.round(totalExecutions / contributorCount) : 0;
  const mostActive = contributors.length > 0 ? contributors[0].ciPipelineExecutions : 0;
  
  return {
    totalExecutions,
    contributorCount,
    avgPerContributor,
    mostActive
  };
};

// Generate distinct colors for charts
export const generateChartColors = (count: number): string[] => {
  const baseColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
    '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#059669'
  ];
  
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < baseColors.length) {
      result.push(baseColors[i]);
    } else {
      // Generate a color using golden angle for good distribution
      const hue = (i * 137.508) % 360;
      result.push(`hsl(${hue}, 70%, 50%)`);
    }
  }
  return result;
};

// ===== COMPUTE RESOURCE TRANSFORMATIONS =====

// Transform compute data for bar charts
export const createComputeBarChartData = (
  viewMode: 'per-workspace' | 'all-workspaces',
  workspaceIds: string[],
  resourceClasses: string[]
) => (data: IncrementalDataItem[]): ChartDataPoint[] => {
  const uniqueDates = getUnique<IncrementalDataItem, string>(item => item.date)(data);
  const sortedDates = sortBy<string>(date => new Date(date).getTime())(uniqueDates);
  
  return sortedDates.map(date => {
    const dataPoint: ChartDataPoint = {
      date: format(new UTCDate(date), 'MMM dd'),
      fullDate: date
    };
    
    const dayEntries = data.filter(item => item.date === date);
    
    if (viewMode === 'per-workspace') {
      // Initialize all workspace-resource combinations
      workspaceIds.forEach(workspaceId => {
        resourceClasses.forEach(resourceClass => {
          dataPoint[`${workspaceId}-${resourceClass}`] = 0;
        });
      });
      
      // Add actual data
      dayEntries.forEach(entry => {
        entry.compute.forEach(compute => {
          const key = `${entry.workspaceId}-${compute.resourceClass}`;
          dataPoint[key] = compute.credits;
        });
      });
    } else {
      // All workspaces combined
      resourceClasses.forEach(resourceClass => {
        dataPoint[resourceClass] = 0;
      });
      
      dayEntries.forEach(entry => {
        entry.compute.forEach(compute => {
          dataPoint[compute.resourceClass] = (dataPoint[compute.resourceClass] || 0) + compute.credits;
        });
      });
    }
    
    return dataPoint;
  });
};

// Calculate compute summary stats
export const calculateComputeSummary = (data: IncrementalDataItem[]): Record<string, number> => {
  const summary: Record<string, number> = {};
  
  data.forEach(item => {
    const workspaceTotal = item.compute.reduce((sum, compute) => sum + compute.credits, 0);
    summary[item.workspaceId] = (summary[item.workspaceId] || 0) + workspaceTotal;
  });
  
  return summary;
};

// ===== CONSTANTS =====

export const WORKSPACE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const RESOURCE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const WORKSPACE_COLOR_SHADES: Record<string, string[]> = {
  workspace1: ['#3b82f6', '#1d4ed8', '#1e3a8a', '#172554'], // Blue shades
  workspace2: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'], // Red shades
  workspace3: ['#10b981', '#059669', '#047857', '#065f46'], // Green shades
};

export const HEATMAP_COLORS = {
  green: ['bg-gray-100', 'bg-green-200', 'bg-green-300', 'bg-green-500', 'bg-green-700'],
  blue: ['bg-gray-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'],
};

// Helper to get color for workspace
export const getWorkspaceColor = (workspaceId: string, workspaceIds: string[]): string => {
  const index = workspaceIds.indexOf(workspaceId);
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length];
};

// Helper to get color shades for workspace
export const getWorkspaceColorShades = (workspaceId: string, workspaceIds: string[]): string[] => {
  const index = workspaceIds.indexOf(workspaceId);
  const shadeKeys = Object.keys(WORKSPACE_COLOR_SHADES);
  return WORKSPACE_COLOR_SHADES[shadeKeys[index % shadeKeys.length]] || ['#6b7280', '#4b5563', '#374151', '#1f2937'];
};