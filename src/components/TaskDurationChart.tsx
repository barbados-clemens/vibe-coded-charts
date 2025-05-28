import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';

export type TaskStatsDataItem = {
  id: string;
  workspaceId: string;
  isCI: boolean;
  date: string;
  projectName: string;
  target: string;
  targetGroupName: string | null;
  totalCount: number;
  statusCodeRatio: {
    zero: number;
    nonZero: number;
  };
  averageDuration: {
    localCacheHitMs: number;
    remoteCacheHitMs: number;
    cacheMissMs: number;
  };
  cacheStatusRatio: {
    localCacheHit: number;
    remoteCacheHit: number;
    cacheMiss: number;
  };
};

interface TaskDurationChartProps {
  data: TaskStatsDataItem[];
}

export function TaskDurationChart({ data }: TaskDurationChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0].date)
  });

  // Filter data for current month
  const filteredData = data.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate);
  });

  // Process data to create chart-friendly format
  const processedData = filteredData.map(item => {
    const taskId = `${item.projectName}:${item.target}`;
    
    // Convert milliseconds to seconds and calculate weighted average duration
    const { averageDuration, cacheStatusRatio } = item;
    
    // Calculate weighted average duration based on cache hit ratios
    const weightedAverageDurationMs = 
      (averageDuration.localCacheHitMs * cacheStatusRatio.localCacheHit) +
      (averageDuration.remoteCacheHitMs * cacheStatusRatio.remoteCacheHit) +
      (averageDuration.cacheMissMs * cacheStatusRatio.cacheMiss);
    
    // Convert to seconds
    const weightedAverageDurationSec = weightedAverageDurationMs / 1000;
    
    return {
      date: format(new UTCDate(item.date), 'MMM dd'),
      taskId,
      projectName: item.projectName,
      target: item.target,
      workspaceId: item.workspaceId,
      totalCount: item.totalCount,
      averageDurationSec: weightedAverageDurationSec,
      localCacheHitSec: averageDuration.localCacheHitMs / 1000,
      remoteCacheHitSec: averageDuration.remoteCacheHitMs / 1000,
      cacheMissSec: averageDuration.cacheMissMs / 1000,
      cacheStatusRatio: cacheStatusRatio,
      originalDate: item.date
    };
  });

  // Get unique task IDs and sort data by date
  const uniqueTaskIds = [...new Set(processedData.map(item => item.taskId))];
  const uniqueDates = [...new Set(processedData.map(item => item.originalDate))].sort();

  // Create formatted data for the line chart
  const chartData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Add data for each unique task ID
    uniqueTaskIds.forEach(taskId => {
      const taskEntry = processedData.find(item => 
        item.originalDate === date && item.taskId === taskId
      );
      dataPoint[taskId] = taskEntry?.averageDurationSec || null;
      
      // Also add cache-specific durations for detailed view
      if (taskEntry) {
        dataPoint[`${taskId}_local`] = taskEntry.localCacheHitSec;
        dataPoint[`${taskId}_remote`] = taskEntry.remoteCacheHitSec;
        dataPoint[`${taskId}_miss`] = taskEntry.cacheMissSec;
      }
    });
    
    return dataPoint;
  });

  // Generate colors for different task IDs
  const taskColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const relevantPayload = payload.filter((entry: any) => entry.value !== null);
      
      if (relevantPayload.length === 0) return null;
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {relevantPayload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value?.toFixed(2)}s
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate summary statistics
  const totalTasks = processedData.length;
  const avgDuration = processedData.length > 0 
    ? processedData.reduce((sum, item) => sum + item.averageDurationSec, 0) / processedData.length 
    : 0;
  const maxDuration = Math.max(...processedData.map(item => item.averageDurationSec), 0);
  const totalExecutions = processedData.reduce((sum, item) => sum + item.totalCount, 0);

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Task Duration Analysis"
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
            <div className="text-sm text-gray-500">Task Executions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{avgDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Avg Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{maxDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Max Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalExecutions}</div>
            <div className="text-sm text-gray-500">Total Runs</div>
          </div>
        </div>
      </div>

      {/* Task Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {uniqueTaskIds.map((taskId, index) => (
          <div key={taskId} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: taskColors[index % taskColors.length] }}
            />
            <span className="text-sm text-gray-600">
              {taskId}
            </span>
          </div>
        ))}
      </div>
      
      {chartData.length > 0 ? (
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
                label={{ value: 'Duration (seconds)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {uniqueTaskIds.map((taskId, index) => (
                <Line 
                  key={taskId}
                  type="monotone" 
                  dataKey={taskId} 
                  stroke={taskColors[index % taskColors.length]} 
                  strokeWidth={2}
                  dot={{ fill: taskColors[index % taskColors.length], strokeWidth: 2 }}
                  connectNulls={false}
                  name={taskId}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No task data for this period</p>
            <p className="text-sm">Try navigating to a different time period</p>
          </div>
        </div>
      )}

      {/* Cache Performance Breakdown */}
      {processedData.length > 0 && (
        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Cache Performance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {(processedData.reduce((sum, item) => sum + item.cacheStatusRatio.localCacheHit, 0) / processedData.length * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Local Cache Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {(processedData.reduce((sum, item) => sum + item.cacheStatusRatio.remoteCacheHit, 0) / processedData.length * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Remote Cache Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {(processedData.reduce((sum, item) => sum + item.cacheStatusRatio.cacheMiss, 0) / processedData.length * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Cache Miss Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}