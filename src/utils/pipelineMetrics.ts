export interface MinimalCIPE {
  createdAt: string;
  completedAt: string | null;
  status: string;
}

export interface PipelineStats {
  p50: number;
  p95: number;
  median: number;
  min: number;
  max: number;
  count: number;
}

export interface WeeklyStats {
  [weekKey: string]: PipelineStats;
}

export interface PipelineMetrics {
  weekly: WeeklyStats;
  overall: PipelineStats;
}

function calculatePipelineStats(durations: number[]): PipelineStats {
  if (durations.length === 0) {
    return { p50: 0, p95: 0, median: 0, min: 0, max: 0, count: 0 };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  
  const p50Index = Math.ceil(sorted.length * 0.5) - 1;
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  
  // Calculate median (true median, not p50)
  let median: number;
  if (sorted.length % 2 === 0) {
    // Even number of elements - average of two middle values
    const mid1 = sorted[sorted.length / 2 - 1];
    const mid2 = sorted[sorted.length / 2];
    median = (mid1 + mid2) / 2;
  } else {
    // Odd number of elements - middle value
    median = sorted[Math.floor(sorted.length / 2)];
  }
  
  return {
    p50: sorted[Math.max(0, p50Index)],
    p95: sorted[Math.max(0, p95Index)],
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: durations.length
  };
}

export function getWeekOfMonth(date: Date): number {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeek = startOfMonth.getDay(); // 0 = Sunday
  
  // Calculate which week of the month this date falls into
  const weekNumber = Math.ceil((dayOfMonth + dayOfWeek) / 7);
  return weekNumber;
}

export function calculateCIPEMetrics(cipes: MinimalCIPE[]): PipelineMetrics {
  // Filter out in-progress executions
  const completedExecutions = cipes.filter(execution => 
    execution.status !== 'IN_PROGRESS' && 
    execution.completedAt && 
    execution.createdAt
  );
  
  if (completedExecutions.length === 0) {
    return {
      weekly: {},
      overall: { p50: 0, p95: 0, median: 0, min: 0, max: 0, count: 0 }
    };
  }
  
  // Calculate durations and group by week of month
  const weeklyDurations: Record<string, number[]> = {};
  const allDurations: number[] = [];
  
  completedExecutions.forEach(execution => {
    const createdAt = new Date(execution.createdAt);
    const completedAt = new Date(execution.completedAt!);
    const duration = completedAt.getTime() - createdAt.getTime(); // milliseconds
    
    const year = createdAt.getFullYear();
    const month = createdAt.getMonth();
    const week = getWeekOfMonth(createdAt);
    
    const weekKey = `${year}-${month + 1}-W${week}`;
    
    if (!weeklyDurations[weekKey]) {
      weeklyDurations[weekKey] = [];
    }
    
    weeklyDurations[weekKey].push(duration);
    allDurations.push(duration);
  });
  
  // Calculate stats for each week
  const weeklyStats: WeeklyStats = {};
  Object.keys(weeklyDurations).forEach(weekKey => {
    weeklyStats[weekKey] = calculatePipelineStats(weeklyDurations[weekKey]);
  });
  
  // Calculate overall stats
  const overallStats = calculatePipelineStats(allDurations);
  
  return {
    weekly: weeklyStats,
    overall: overallStats
  };
}