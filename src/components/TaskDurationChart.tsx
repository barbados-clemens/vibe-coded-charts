import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
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
    const baseTaskId = `${item.projectName}:${item.target}`;
    const taskId = `${baseTaskId} (${item.isCI ? 'CI' : 'Local'})`;
    
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
      baseTaskId,
      isCI: item.isCI,
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

  // Get unique task IDs (now includes CI/Local distinction) and sort data by date
  const uniqueTaskIds = [...new Set(processedData.map(item => item.taskId))];
  const uniqueDates = [...new Set(processedData.map(item => item.originalDate))].sort();

  // Create formatted data for the line chart
  const chartData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Add data for each unique task ID (including CI/Local variants)
    uniqueTaskIds.forEach(taskId => {
      const taskEntry = processedData.find(item => 
        item.originalDate === date && item.taskId === taskId
      );
      dataPoint[taskId] = taskEntry?.averageDurationSec || null;
    });
    
    return dataPoint;
  });

  // Generate colors for different task IDs with CI/Local distinction
  const getTaskColor = (taskId: string, index: number) => {
    const baseColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const baseColor = baseColors[index % baseColors.length];
    
    // Make CI tasks darker and Local tasks lighter
    if (taskId.includes('(CI)')) {
      return baseColor; // Use the base color for CI
    } else {
      // Make Local tasks lighter by converting to HSL and increasing lightness
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Convert to HSL and make lighter
      return `rgba(${r}, ${g}, ${b}, 0.6)`;
    }
  };

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

  // Calculate standard deviation for reference lines
  const calculateStandardDeviation = (values: number[], mean: number) => {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const allDurations = processedData.map(item => item.averageDurationSec);
  const stdDev = calculateStandardDeviation(allDurations, avgDuration);
  
  // Reference line values
  const meanLine = avgDuration;
  const plusOneStdDev = avgDuration + stdDev;
  const minusOneStdDev = Math.max(0, avgDuration - stdDev); // Don't go below 0
  
  // Calculate actual percentage of data within ±1 standard deviation
  const dataWithinOneStdDev = allDurations.filter(duration => 
    duration >= minusOneStdDev && duration <= plusOneStdDev
  ).length;
  const percentageWithinOneStdDev = allDurations.length > 0 
    ? (dataWithinOneStdDev / allDurations.length) * 100 
    : 0;
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalTasks}</div>
            <div className="text-sm text-gray-500">Task Executions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{avgDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Avg Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stdDev.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Std Deviation</div>
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

      {/* Reference Lines Legend */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Statistical Reference Lines</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-600"></div>
            <span>Mean ({avgDuration.toFixed(1)}s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-yellow-500 border-dashed border-t"></div>
            <span>±1σ ({minusOneStdDev.toFixed(1)}s - {plusOneStdDev.toFixed(1)}s)</span>
          </div>
          <div className="text-gray-600">
            <span>{percentageWithinOneStdDev.toFixed(1)}% of data within ±1σ</span>
          </div>
        </div>
      </div>

      {/* Task Legend */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-4">
          {uniqueTaskIds.map((taskId, index) => (
            <div key={taskId} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: getTaskColor(taskId, index) }}
              />
              <span className={`text-sm ${taskId.includes('(CI)') ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                {taskId}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">CI tasks</span> are shown as solid lines, <span className="font-medium">Local tasks</span> are shown as dashed lines with lighter colors
        </div>
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
              
              {/* Statistical Reference Lines */}
              <ReferenceLine 
                y={meanLine} 
                stroke="#16a34a" 
                strokeWidth={2}
                label={{ value: "Mean", position: "right" }}
              />
              <ReferenceLine 
                y={plusOneStdDev} 
                stroke="#eab308" 
                strokeDasharray="5 5"
                label={{ value: "+1σ", position: "right" }}
              />
              <ReferenceLine 
                y={minusOneStdDev} 
                stroke="#eab308" 
                strokeDasharray="5 5"
                label={{ value: "-1σ", position: "right" }}
              />
              {/*<ReferenceLine */}
              {/*  y={plusTwoStdDev} */}
              {/*  stroke="#f97316" */}
              {/*  strokeWidth={1}*/}
              {/*  strokeOpacity={0.6}*/}
              {/*  label={{ value: "+2σ", position: "right" }}*/}
              {/*/>*/}
              {/*<ReferenceLine */}
              {/*  y={minusTwoStdDev} */}
              {/*  stroke="#f97316" */}
              {/*  strokeWidth={1}*/}
              {/*  strokeOpacity={0.6}*/}
              {/*  label={{ value: "-2σ", position: "right" }}*/}
              {/*/>*/}
              
              {uniqueTaskIds.map((taskId, index) => {
                const color = getTaskColor(taskId, index);
                const strokeWidth = taskId.includes('(CI)') ? 2 : 2;
                const strokeDasharray = taskId.includes('(CI)') ? undefined : "5 5";
                
                return (
                  <Line 
                    key={taskId}
                    type="monotone" 
                    dataKey={taskId} 
                    stroke={color} 
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    dot={{ fill: color, strokeWidth: 2 }}
                    connectNulls={false}
                    name={taskId}
                  />
                );
              })}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CI Tasks */}
            {processedData.some(item => item.isCI) && (
              <div>
                <h4 className="text-sm font-medium text-gray-800 mb-2">CI Tasks</h4>
                <div className="grid grid-cols-3 gap-4">
                  {(() => {
                    const ciData = processedData.filter(item => item.isCI);
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">
                            {ciData.length > 0 ? (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.localCacheHit, 0) / ciData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Local Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-blue-600">
                            {ciData.length > 0 ? (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.remoteCacheHit, 0) / ciData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Remote Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-orange-600">
                            {ciData.length > 0 ? (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.cacheMiss, 0) / ciData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Cache Miss</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* Local Tasks */}
            {processedData.some(item => !item.isCI) && (
              <div>
                <h4 className="text-sm font-medium text-gray-800 mb-2">Local Tasks</h4>
                <div className="grid grid-cols-3 gap-4">
                  {(() => {
                    const localData = processedData.filter(item => !item.isCI);
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">
                            {localData.length > 0 ? (localData.reduce((sum, item) => sum + item.cacheStatusRatio.localCacheHit, 0) / localData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Local Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-blue-600">
                            {localData.length > 0 ? (localData.reduce((sum, item) => sum + item.cacheStatusRatio.remoteCacheHit, 0) / localData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Remote Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-orange-600">
                            {localData.length > 0 ? (localData.reduce((sum, item) => sum + item.cacheStatusRatio.cacheMiss, 0) / localData.length * 100).toFixed(1) : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Cache Miss</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}