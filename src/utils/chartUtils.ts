import { format, startOfYear, endOfYear, eachDayOfInterval, getDay } from 'date-fns';
import { UTCDate } from "@date-fns/utc";

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

/**
 * Calculate daily incremental values from cumulative data
 * Works for executionCredits, runCount, or any numeric field
 */
export function calculateDailyIncrements(
  data: DataItem[], 
  field: 'executionCredits' | 'runCount'
): IncrementalDataItem[] {
  // Group by workspace and month, then sort by date
  const grouped = data.reduce((acc, item) => {
    const date = new UTCDate(item.date);
    const monthKey = `${item.workspaceId}-${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(item);
    return acc;
  }, {} as Record<string, DataItem[]>);

  // Calculate increments for each workspace-month group
  const incrementalData: IncrementalDataItem[] = [];
  
  Object.values(grouped).forEach(monthData => {
    // Sort by date within each month
    const sortedData = [...monthData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    sortedData.forEach((item, index) => {
      let dailyIncrement = item[field];
      
      // If not the first day of the month, subtract previous day's cumulative total
      if (index > 0) {
        dailyIncrement = item[field] - sortedData[index - 1][field];
      }
      
      incrementalData.push({
        ...item,
        [field]: Math.max(0, dailyIncrement) // Ensure no negative values
      });
    });
  });
  
  return incrementalData;
}

/**
 * Calculate daily incremental compute usage from cumulative data
 */
export function calculateComputeIncrements(data: DataItem[]): IncrementalDataItem[] {
  // Group by workspace and month, then sort by date
  const grouped = data.reduce((acc, item) => {
    const date = new UTCDate(item.date);
    const monthKey = `${item.workspaceId}-${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(item);
    return acc;
  }, {} as Record<string, DataItem[]>);

  // Calculate increments for each workspace-month group
  const incrementalData: IncrementalDataItem[] = [];
  
  Object.values(grouped).forEach(monthData => {
    // Sort by date within each month
    const sortedData = [...monthData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    sortedData.forEach((item, index) => {
      // For compute resources, calculate incremental usage
      let incrementalCompute = [...item.compute];
      
      if (index > 0) {
        const prevCompute = sortedData[index - 1].compute;
        
        // Calculate incremental compute usage for each resource class
        incrementalCompute = item.compute.map(currentResource => {
          const prevResource = prevCompute.find(p => p.resourceClass === currentResource.resourceClass);
          const prevCredits = prevResource?.credits || 0;
          return {
            ...currentResource,
            credits: Math.max(0, currentResource.credits - prevCredits)
          };
        });
        
        // Add any new resource classes that weren't in previous day
        const newResourceClasses = item.compute.filter(current => 
          !prevCompute.some(prev => prev.resourceClass === current.resourceClass)
        );
        incrementalCompute.push(...newResourceClasses);
      }
      
      incrementalData.push({
        ...item,
        compute: incrementalCompute.filter(resource => resource.credits > 0) // Only include resources with usage
      });
    });
  });
  
  return incrementalData;
}

/**
 * Get unique workspace IDs from data
 */
export function getUniqueWorkspaceIds(data: DataItem[]): string[] {
  return [...new Set(data.map(item => item.workspaceId))];
}

/**
 * Get unique resource classes from compute data
 */
export function getUniqueResourceClasses(data: DataItem[]): string[] {
  return [...new Set(data.flatMap(item => 
    item.compute.map(compute => compute.resourceClass)
  ))];
}

/**
 * Create heatmap data structure for a given year
 */
export function createHeatmapData(
  data: IncrementalDataItem[], 
  year: number,
  field: 'executionCredits' | 'runCount'
): WeeksArray {
  const yearStart = startOfYear(new UTCDate(year, 0, 1));
  const yearEnd = endOfYear(new UTCDate(year, 11, 31));
  const allDaysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd });
  
  // Group data by date and sum all workspaces for each day
  const dailyTotals = data
    .filter(item => new UTCDate(item.date).getUTCFullYear() === year)
    .reduce((acc, item) => {
      const dateKey = item.date.split('T')[0]; // Get date part only
      acc[dateKey] = (acc[dateKey] || 0) + item[field];
      return acc;
    }, {} as Record<string, number>);

  // Create detailed daily data for tooltips
  const dailyDetailsByDate = data
    .filter(item => new UTCDate(item.date).getUTCFullYear() === year)
    .reduce((acc, item) => {
      const dateKey = item.date.split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      if (item[field] > 0) { // Only include days with actual usage
        acc[dateKey].push({
          workspaceId: item.workspaceId,
          value: item[field]
        });
      }
      return acc;
    }, {} as Record<string, Array<{ workspaceId: string; value: number }>>);

  // Create heatmap grid with proper week alignment
  const firstDayOfYear = getDay(yearStart); // 0 = Sunday, 1 = Monday, etc.
  const weeksArray: WeeksArray = [];
  
  // Add padding days for the first week
  let currentWeek: Array<HeatmapDayData | null> = [];
  for (let i = 0; i < firstDayOfYear; i++) {
    currentWeek.push(null);
  }
  
  // Add all days of the year
  allDaysInYear.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const value = dailyTotals[dateKey] || 0;
    const workspaceDetails = dailyDetailsByDate[dateKey] || [];
    
    currentWeek.push({
      date,
      value,
      dateStr: dateKey,
      workspaceDetails
    });
    
    // If week is complete (7 days), start a new week
    if (currentWeek.length === 7) {
      weeksArray.push([...currentWeek]);
      currentWeek = [];
    }
  });
  
  // Add the last partial week if it exists
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeksArray.push(currentWeek);
  }

  return weeksArray;
}

/**
 * Get color intensity for heatmap (0-4 levels like GitHub)
 */
export function getColorIntensity(value: number, maxValue: number): number {
  if (value === 0) return 0;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Create line chart formatted data for multiple workspaces
 */
export function createLineChartData(
  data: IncrementalDataItem[],
  field: 'executionCredits' | 'runCount'
): any[] {
  const workspaceIds = getUniqueWorkspaceIds(data);
  const uniqueDates = [...new Set(data.map(item => item.date))].sort();
  
  return uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Add each workspace's incremental value for this date
    workspaceIds.forEach(workspaceId => {
      const workspaceEntry = data.find(item => 
        item.date === date && item.workspaceId === workspaceId
      );
      dataPoint[workspaceId] = workspaceEntry?.[field] || 0;
    });
    
    return dataPoint;
  });
}

/**
 * Default colors for different workspaces
 */
export const WORKSPACE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

/**
 * Heatmap color schemes
 */
export const HEATMAP_COLORS = {
  green: ['bg-gray-100', 'bg-green-200', 'bg-green-300', 'bg-green-500', 'bg-green-700'],
  blue: ['bg-gray-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'],
};