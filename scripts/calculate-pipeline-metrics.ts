import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PipelineExecution {
  workspaceId: string;
  ciExecutionId: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  status: string;
  runGroups: any[];
}

interface WeeklyData {
  durations: number[];
  count: number;
  monthYear: string;
  week: number;
}

function calculatePercentiles(durations: number[], percentiles: number[] = [50, 95]): Record<string, number> {
  if (durations.length === 0) return {};
  
  const sorted = [...durations].sort((a, b) => a - b);
  const result: Record<string, number> = {};
  
  percentiles.forEach(p => {
    const index = Math.ceil(sorted.length * (p / 100)) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)];
  });
  
  return result;
}

function getWeekOfMonth(date: Date): number {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeek = startOfMonth.getDay(); // 0 = Sunday
  
  // Calculate which week of the month this date falls into
  const weekNumber = Math.ceil((dayOfMonth + dayOfWeek) / 7);
  return weekNumber;
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function main(): void {
  try {
    const dataPath = path.join(__dirname, '../src/data/dumps/ci-pipeline-executions.json');
    const data: PipelineExecution[] = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`Total pipeline executions: ${data.length}`);
    
    // Filter out in-progress executions
    const completedExecutions = data.filter(execution => 
      execution.status !== 'IN_PROGRESS' && 
      execution.completedAt && 
      execution.createdAt
    );
    
    console.log(`Completed executions: ${completedExecutions.length}`);
    
    if (completedExecutions.length === 0) {
      console.log('No completed executions found to analyze.');
      return;
    }
    
    // Calculate durations and group by week of month
    const weeklyData: Record<string, WeeklyData> = {};
    
    completedExecutions.forEach(execution => {
      const createdAt = new Date(execution.createdAt);
      const completedAt = new Date(execution.completedAt!);
      const duration = completedAt.getTime() - createdAt.getTime(); // milliseconds
      
      const year = createdAt.getFullYear();
      const month = createdAt.getMonth();
      const week = getWeekOfMonth(createdAt);
      
      const weekKey = `${year}-${month + 1}-W${week}`;
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          durations: [],
          count: 0,
          monthYear: `${year}-${String(month + 1).padStart(2, '0')}`,
          week: week
        };
      }
      
      weeklyData[weekKey].durations.push(duration);
      weeklyData[weekKey].count++;
    });
    
    // Calculate percentiles for each week
    console.log('\n=== CI Pipeline Execution Metrics by Week ===\n');
    
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    sortedWeeks.forEach(weekKey => {
      const weekData = weeklyData[weekKey];
      const percentiles = calculatePercentiles(weekData.durations);
      
      console.log(`Week ${weekKey} (${weekData.count} executions):`);
      console.log(`  P50: ${formatDuration(percentiles.p50)} (${Math.round(percentiles.p50 / 1000)}s)`);
      console.log(`  P95: ${formatDuration(percentiles.p95)} (${Math.round(percentiles.p95 / 1000)}s)`);
      console.log(`  Min: ${formatDuration(Math.min(...weekData.durations))}`);
      console.log(`  Max: ${formatDuration(Math.max(...weekData.durations))}`);
      console.log('');
    });
    
    // Overall metrics
    const allDurations = completedExecutions.map(execution => {
      const createdAt = new Date(execution.createdAt);
      const completedAt = new Date(execution.completedAt!);
      return completedAt.getTime() - createdAt.getTime();
    });
    
    const overallPercentiles = calculatePercentiles(allDurations);
    
    console.log('=== Overall Metrics ===');
    console.log(`Total completed executions: ${completedExecutions.length}`);
    console.log(`Overall P50: ${formatDuration(overallPercentiles.p50)} (${Math.round(overallPercentiles.p50 / 1000)}s)`);
    console.log(`Overall P95: ${formatDuration(overallPercentiles.p95)} (${Math.round(overallPercentiles.p95 / 1000)}s)`);
    console.log(`Overall Min: ${formatDuration(Math.min(...allDurations))}`);
    console.log(`Overall Max: ${formatDuration(Math.max(...allDurations))}`);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();