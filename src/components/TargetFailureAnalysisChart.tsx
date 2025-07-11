import React, { useState, useMemo } from 'react';
import { format, addMonths, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ComposedChart } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import { DailyTaskStatsDataItem } from './TaskDurationAnalysisChart';

interface TargetFailureAnalysisChartProps {
  data: DailyTaskStatsDataItem[];
}

export function TargetFailureAnalysisChart({ data }: TargetFailureAnalysisChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0]?.date || new Date())
  });

  // Get unique targets from the data
  const uniqueTargets = useMemo(() => {
    return Array.from(new Set(data.map(item => item.target))).sort();
  }, [data]);
  
  const [selectedTarget, setSelectedTarget] = useState(uniqueTargets[0] || '');

  // Filter data for current month and selected target (CI only)
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new UTCDate(item.date);
      return isSameMonth(itemDate, currentDate) && item.target === selectedTarget && item.isCI;
    });
  }, [data, currentDate, selectedTarget]);

  // Get all days in the current month to handle missing days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Create chart data with all days, aggregating across all projects
  const chartData = useMemo(() => {
    return allDaysInMonth.map(day => {
      const dayStr = day.toISOString().split('T')[0] + 'T00:00:00.000Z';
      
      // Get all data for this day across all projects
      const dayData = filteredData.filter(item => item.date === dayStr);
      
      if (dayData.length === 0) {
        return {
          date: format(day, 'MMM dd'),
          fullDate: dayStr,
          totalCount: 0,
          failureCount: 0,
          successCount: 0,
          failureRate: 0,
          projectCount: 0
        };
      }

      // Aggregate data across all projects (CI only)
      const aggregated = dayData.reduce((acc, item) => {
        const failureCount = Math.round(item.totalCount * item.statusCodeRatio.nonZero);
        const successCount = Math.round(item.totalCount * item.statusCodeRatio.zero);
        
        acc.totalCount += item.totalCount;
        acc.failureCount += failureCount;
        acc.successCount += successCount;
        acc.projects.add(item.projectName);
        
        return acc;
      }, {
        totalCount: 0,
        failureCount: 0,
        successCount: 0,
        projects: new Set<string>()
      });

      return {
        date: format(day, 'MMM dd'),
        fullDate: dayStr,
        totalCount: aggregated.totalCount,
        failureCount: aggregated.failureCount,
        successCount: aggregated.successCount,
        failureRate: aggregated.totalCount > 0 ? (aggregated.failureCount / aggregated.totalCount) * 100 : 0,
        projectCount: aggregated.projects.size
      };
    });
  }, [allDaysInMonth, filteredData]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = chartData.reduce((acc, day) => {
      acc.totalRuns += day.totalCount;
      acc.totalFailures += day.failureCount;
      acc.totalSuccesses += day.successCount;
      acc.daysWithData += day.totalCount > 0 ? 1 : 0;
      acc.maxDailyFailures = Math.max(acc.maxDailyFailures, day.failureCount);
      return acc;
    }, {
      totalRuns: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      daysWithData: 0,
      maxDailyFailures: 0
    });

    return {
      ...stats,
      overallFailureRate: stats.totalRuns > 0 ? (stats.totalFailures / stats.totalRuns) * 100 : 0,
      avgDailyFailures: stats.daysWithData > 0 ? stats.totalFailures / stats.daysWithData : 0
    };
  }, [chartData]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-sm">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-medium">Total Runs: {data.totalCount}</p>
              <p className="text-red-600">Failures: {data.failureCount}</p>
              <p className="text-green-600">Successes: {data.successCount}</p>
            </div>
            
            <div className="border-t pt-2">
              <p className="font-medium">Failure Rate: {data.failureRate.toFixed(1)}%</p>
            </div>
            
            <div className="border-t pt-2 text-xs">
              <p>Projects: {data.projectCount}</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="CI Target Failure Analysis"
        subtitle={`Target: ${selectedTarget}`}
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Target Selector */}
      <div className="mt-4 mb-6">
        <div className="flex items-center gap-4">
          <label htmlFor="target-select" className="text-sm font-medium text-gray-700">
            Select Target:
          </label>
          <select
            id="target-select"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {uniqueTargets.map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{summaryStats.totalRuns}</div>
            <div className="text-sm text-gray-600">Total Runs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summaryStats.totalFailures}</div>
            <div className="text-sm text-gray-600">Total Failures</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-700">{summaryStats.overallFailureRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Failure Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{summaryStats.avgDailyFailures.toFixed(0)}</div>
            <div className="text-sm text-gray-600">Avg Daily Failures</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-800">{summaryStats.maxDailyFailures}</div>
            <div className="text-sm text-gray-600">Peak Daily Failures</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-700">{summaryStats.daysWithData}</div>
            <div className="text-sm text-gray-600">Active Days</div>
          </div>
        </div>
      </div>

      
      {chartData.length > 0 ? (
        <>
          {/* Failure Rate Chart */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Failure Rate (%)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280' }}
                    label={{ value: 'Failure Rate (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="failureRate" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2 }}
                    name="Failure Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Failure Count Chart */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Daily CI Failure Count</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    yAxisId="count"
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280' }}
                    label={{ value: 'Failure Count', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="total"
                    orientation="right"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af' }}
                    label={{ value: 'Total Runs', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  <Bar 
                    yAxisId="count"
                    dataKey="failureCount" 
                    fill="#ef4444" 
                    name="CI Failures"
                  />
                  <Line 
                    yAxisId="total"
                    type="monotone" 
                    dataKey="totalCount" 
                    stroke="#6b7280" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Total CI Runs"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No data for this target in the selected period</p>
            <p className="text-sm">Try selecting a different target or time period</p>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      {chartData.length > 0 && summaryStats.totalRuns > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Failure Analysis Insights</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {summaryStats.overallFailureRate < 1 && (
              <p className="text-green-700">✅ Excellent reliability! Failure rate below 1%</p>
            )}
            {summaryStats.overallFailureRate >= 5 && summaryStats.overallFailureRate < 10 && (
              <p className="text-yellow-600">⚠️ Moderate failure rate ({summaryStats.overallFailureRate.toFixed(1)}%) - Consider investigating common failure patterns</p>
            )}
            {summaryStats.overallFailureRate >= 10 && (
              <p className="text-red-600">🚨 High failure rate ({summaryStats.overallFailureRate.toFixed(1)}%) - Immediate attention recommended</p>
            )}
            {summaryStats.maxDailyFailures > summaryStats.avgDailyFailures * 3 && (
              <p className="text-purple-600">📈 Spike detected: Peak failures ({summaryStats.maxDailyFailures}) much higher than average</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}