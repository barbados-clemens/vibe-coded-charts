import React, { useState } from 'react';
import { format, addMonths, isSameMonth, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, BarChart } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';

export type DailyTaskStatsDataItem = {
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

interface TaskDurationAnalysisChartProps {
  data: DailyTaskStatsDataItem[];
}


export function TaskDurationAnalysisChart({ data }: TaskDurationAnalysisChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return data.length > 0 ? new UTCDate(data[0].date) : new UTCDate();
  });

  const [showReferenceLines, setShowReferenceLines] = useState(true);
  const [showLocalEnvironment, setShowLocalEnvironment] = useState(true);
  const [showCIEnvironment, setShowCIEnvironment] = useState(true);

  // Filter data for current month
  const filteredData = data.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate);
  });

  // Get all days in the current month to handle missing days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Create chart data with all days, filling gaps where data doesn't exist
  const chartData = allDaysInMonth.map(day => {
    const dayStr = day.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const localData = filteredData.find(item => item.date === dayStr && !item.isCI);
    const ciData = filteredData.find(item => item.date === dayStr && item.isCI);

    // Calculate weighted average duration for each environment
    const calculateWeightedDuration = (item: DailyTaskStatsDataItem | undefined) => {
      if (!item) return null;
      
      const { averageDuration, cacheStatusRatio } = item;
      
      // Only consider cache hits that actually have duration > 0
      const totalValidRatio = 
        (averageDuration.localCacheHitMs > 0 ? cacheStatusRatio.localCacheHit : 0) +
        (averageDuration.remoteCacheHitMs > 0 ? cacheStatusRatio.remoteCacheHit : 0) +
        cacheStatusRatio.cacheMiss;
      
      if (totalValidRatio === 0) return null;
      
      // Calculate weighted average only using non-zero durations
      const weightedAverageDurationMs = 
        (averageDuration.localCacheHitMs > 0 ? (averageDuration.localCacheHitMs * cacheStatusRatio.localCacheHit) : 0) +
        (averageDuration.remoteCacheHitMs > 0 ? (averageDuration.remoteCacheHitMs * cacheStatusRatio.remoteCacheHit) : 0) +
        (averageDuration.cacheMissMs * cacheStatusRatio.cacheMiss);
      
      return totalValidRatio > 0 ? weightedAverageDurationMs / totalValidRatio / 1000 : null;
    };

    const localDuration = calculateWeightedDuration(localData);
    const ciDuration = calculateWeightedDuration(ciData);

    return {
      date: format(day, 'MMM dd'),
      fullDate: dayStr,
      // Duration data (in seconds)
      localDuration: localDuration,
      ciDuration: ciDuration,
      // Invocation counts
      localInvocations: localData?.totalCount || 0,
      ciInvocations: ciData?.totalCount || 0,
      totalInvocations: (localData?.totalCount || 0) + (ciData?.totalCount || 0),
      // Cache hit ratios (percentages)
      localCacheHitPct: localData ? localData.cacheStatusRatio.localCacheHit * 100 : 0,
      remoteCacheHitPct: localData ? localData.cacheStatusRatio.remoteCacheHit * 100 : 0,
      cacheMissPct: localData ? localData.cacheStatusRatio.cacheMiss * 100 : 0,
      // CI Cache hit ratios (percentages)
      ciLocalCacheHitPct: ciData ? ciData.cacheStatusRatio.localCacheHit * 100 : 0,
      ciRemoteCacheHitPct: ciData ? ciData.cacheStatusRatio.remoteCacheHit * 100 : 0,
      ciCacheMissPct: ciData ? ciData.cacheStatusRatio.cacheMiss * 100 : 0,
      // Success ratios
      localSuccessRate: localData ? localData.statusCodeRatio.zero * 100 : null,
      ciSuccessRate: ciData ? ciData.statusCodeRatio.zero * 100 : null,
      // Raw data for detailed tooltip
      localData,
      ciData
    };
  });

  // Calculate statistics for reference lines
  const validLocalDurations = chartData.map(d => d.localDuration).filter(d => d !== null) as number[];
  const validCiDurations = chartData.map(d => d.ciDuration).filter(d => d !== null) as number[];
  
  const avgLocalDuration = validLocalDurations.length > 0 
    ? validLocalDurations.reduce((sum, val) => sum + val, 0) / validLocalDurations.length 
    : 0;
  const avgCiDuration = validCiDurations.length > 0 
    ? validCiDurations.reduce((sum, val) => sum + val, 0) / validCiDurations.length 
    : 0;

  // Calculate standard deviations
  const calculateStandardDeviation = (values: number[], mean: number) => {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const localStdDev = calculateStandardDeviation(validLocalDurations, avgLocalDuration);
  const ciStdDev = calculateStandardDeviation(validCiDurations, avgCiDuration);

  const maxDuration = Math.max(
    Math.max(...validLocalDurations, 0),
    Math.max(...validCiDurations, 0)
  );

  const totalLocalInvocations = chartData.reduce((sum, d) => sum + d.localInvocations, 0);
  const totalCiInvocations = chartData.reduce((sum, d) => sum + d.ciInvocations, 0);

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
          
          {/* Duration Info */}
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Task Duration</p>
            {data.localDuration !== null && (
              <p className="text-sm text-blue-600">Local: {data.localDuration.toFixed(2)}s</p>
            )}
            {data.ciDuration !== null && (
              <p className="text-sm text-red-600">CI: {data.ciDuration.toFixed(2)}s</p>
            )}
            {data.localDuration === null && data.ciDuration === null && (
              <p className="text-sm text-gray-500">No task runs</p>
            )}
          </div>

          {/* Invocations */}
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Invocations</p>
            <p className="text-sm">Local: {data.localInvocations}</p>
            <p className="text-sm">CI: {data.ciInvocations}</p>
            <p className="text-sm font-medium">Total: {data.totalInvocations}</p>
          </div>

          {/* Cache Performance */}
          {(data.localData || data.ciData) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Cache Performance</p>
              {data.localData && (
                <div className="mb-1">
                  <p className="text-xs text-gray-600">Local Environment:</p>
                  <p className="text-xs">Cache Hit: {(data.localData.cacheStatusRatio.localCacheHit * 100).toFixed(1)}%</p>
                  <p className="text-xs">Remote Hit: {(data.localData.cacheStatusRatio.remoteCacheHit * 100).toFixed(1)}%</p>
                  <p className="text-xs">Cache Miss: {(data.localData.cacheStatusRatio.cacheMiss * 100).toFixed(1)}%</p>
                </div>
              )}
              {data.ciData && (
                <div>
                  <p className="text-xs text-gray-600">CI Environment:</p>
                  <p className="text-xs">Cache Hit: {(data.ciData.cacheStatusRatio.localCacheHit * 100).toFixed(1)}%</p>
                  <p className="text-xs">Remote Hit: {(data.ciData.cacheStatusRatio.remoteCacheHit * 100).toFixed(1)}%</p>
                  <p className="text-xs">Cache Miss: {(data.ciData.cacheStatusRatio.cacheMiss * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for invocations chart
  const InvocationsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          
          <div className="space-y-1">
            <p className="text-sm">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded mr-2"></span>
              Local: <span className="font-medium">{data.localInvocations}</span>
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 bg-red-600 rounded mr-2"></span>
              CI: <span className="font-medium">{data.ciInvocations}</span>
            </p>
            <p className="text-sm font-medium border-t pt-1 mt-2">
              Total: {data.totalInvocations}
            </p>
          </div>

          {/* Success rates if available */}
          {(data.localSuccessRate !== null || data.ciSuccessRate !== null) && (
            <div className="mt-3 pt-2 border-t">
              <p className="text-xs font-medium text-gray-700 mb-1">Success Rate</p>
              {data.localSuccessRate !== null && (
                <p className="text-xs">Local: {data.localSuccessRate.toFixed(1)}%</p>
              )}
              {data.ciSuccessRate !== null && (
                <p className="text-xs">CI: {data.ciSuccessRate.toFixed(1)}%</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Task Duration Analysis"
        subtitle={`${data[0].projectName}:${data[0].target}`}
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{avgLocalDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Avg Local Duration</div>
            <div className="text-xs text-gray-400">±{localStdDev.toFixed(1)}s</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{avgCiDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Avg CI Duration</div>
            <div className="text-xs text-gray-400">±{ciStdDev.toFixed(1)}s</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalLocalInvocations}</div>
            <div className="text-sm text-gray-500">Local Invocations</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalCiInvocations}</div>
            <div className="text-sm text-gray-500">CI Invocations</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{maxDuration.toFixed(1)}s</div>
            <div className="text-sm text-gray-500">Max Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {avgCiDuration > avgLocalDuration ? '+' : ''}{((avgCiDuration - avgLocalDuration) / (avgLocalDuration || 1) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">CI vs Local</div>
          </div>
        </div>
      </div>

      {/* Chart Toggles */}
      <div className="mb-6 space-y-4">
        {/* Environment Toggles */}
        <div className="flex justify-center gap-8">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLocalEnvironment}
              onChange={() => setShowLocalEnvironment(!showLocalEnvironment)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="w-4 h-0.5 bg-blue-600"></div>
            <span className="text-sm text-gray-700 font-medium">Local Environment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCIEnvironment}
              onChange={() => setShowCIEnvironment(!showCIEnvironment)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <div className="w-4 h-0.5 bg-red-600"></div>
            <span className="text-sm text-gray-700 font-medium">CI Environment</span>
          </label>
        </div>
        
        {/* Chart Display Toggles */}
        <div className="flex justify-end gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showReferenceLines}
              onChange={() => setShowReferenceLines(!showReferenceLines)}
              className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700">Show Reference Lines</span>
          </label>
        </div>
      </div>
      
      {chartData.length > 0 && (showLocalEnvironment || showCIEnvironment) ? (
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                yAxisId="duration"
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
                label={{ value: 'Duration (seconds)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Duration area charts - conditional based on environment toggles */}
              {showLocalEnvironment && (
                <Area
                  yAxisId="duration"
                  type="monotone"
                  dataKey="localDuration"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  connectNulls={false}
                  name="Local Duration"
                />
              )}
              {showCIEnvironment && (
                <Area
                  yAxisId="duration"
                  type="monotone"
                  dataKey="ciDuration"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  connectNulls={false}
                  name="CI Duration"
                />
              )}

              {/* Reference lines - conditional based on toggle and environment visibility */}
              {showReferenceLines && (
                <>
                  {/* Average reference lines */}
                  {showLocalEnvironment && avgLocalDuration > 0 && (
                    <ReferenceLine 
                      yAxisId="duration"
                      y={avgLocalDuration} 
                      stroke="#3b82f6" 
                      strokeDasharray="8 4"
                      strokeWidth={2}
                      label={{ value: `Avg Local: ${avgLocalDuration.toFixed(1)}s`, position: "top" }}
                    />
                  )}
                  {showCIEnvironment && avgCiDuration > 0 && (
                    <ReferenceLine 
                      yAxisId="duration"
                      y={avgCiDuration} 
                      stroke="#ef4444" 
                      strokeDasharray="8 4"
                      strokeWidth={2}
                      label={{ value: `Avg CI: ${avgCiDuration.toFixed(1)}s`, position: "top" }}
                    />
                  )}

                  {/* Standard deviation reference lines */}
                  {showLocalEnvironment && localStdDev > 0 && avgLocalDuration > 0 && (
                    <>
                      <ReferenceLine 
                        yAxisId="duration"
                        y={avgLocalDuration + localStdDev} 
                        stroke="#3b82f6" 
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{ value: `+1σ Local: ${(avgLocalDuration + localStdDev).toFixed(1)}s`, position: "top" }}
                      />
                      <ReferenceLine 
                        yAxisId="duration"
                        y={Math.max(0, avgLocalDuration - localStdDev)} 
                        stroke="#3b82f6" 
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{ value: `-1σ Local: ${Math.max(0, avgLocalDuration - localStdDev).toFixed(1)}s`, position: "bottom" }}
                      />
                    </>
                  )}
                  {showCIEnvironment && ciStdDev > 0 && avgCiDuration > 0 && (
                    <>
                      <ReferenceLine 
                        yAxisId="duration"
                        y={avgCiDuration + ciStdDev} 
                        stroke="#ef4444" 
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{ value: `+1σ CI: ${(avgCiDuration + ciStdDev).toFixed(1)}s`, position: "top" }}
                      />
                      <ReferenceLine 
                        yAxisId="duration"
                        y={Math.max(0, avgCiDuration - ciStdDev)} 
                        stroke="#ef4444" 
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        label={{ value: `-1σ CI: ${Math.max(0, avgCiDuration - ciStdDev).toFixed(1)}s`, position: "bottom" }}
                      />
                    </>
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            {chartData.length === 0 ? (
              <>
                <p className="text-lg mb-2">No task data for this period</p>
                <p className="text-sm">Try navigating to a different time period</p>
              </>
            ) : !showLocalEnvironment && !showCIEnvironment ? (
              <>
                <p className="text-lg mb-2">No environments selected</p>
                <p className="text-sm">Enable Local Environment or CI Environment to view data</p>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">No valid duration data</p>
                <p className="text-sm">Try a different time period or check data quality</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Task Invocations Chart */}
      {chartData.length > 0 && (showLocalEnvironment || showCIEnvironment) && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Task Invocations</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280' }}
                  label={{ value: 'Invocations', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<InvocationsTooltip />} />
                <Legend />
                
                {showLocalEnvironment && (
                  <Bar 
                    dataKey="localInvocations" 
                    fill="#3b82f6" 
                    name="Local Invocations"
                    stackId="invocations"
                  />
                )}
                {showCIEnvironment && (
                  <Bar 
                    dataKey="ciInvocations" 
                    fill="#ef4444" 
                    name="CI Invocations"
                    stackId="invocations"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Cache Analysis */}
      {filteredData.length > 0 && (
        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Cache Performance Analysis</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Local Environment Stats */}
            {filteredData.some(item => !item.isCI) && (
              <div>
                <h4 className="text-sm font-medium text-blue-700 mb-3">Local Environment</h4>
                <div className="grid grid-cols-3 gap-4">
                  {(() => {
                    const localData = filteredData.filter(item => !item.isCI);
                    const avgLocalCache = localData.length > 0 ? 
                      (localData.reduce((sum, item) => sum + item.cacheStatusRatio.localCacheHit, 0) / localData.length * 100) : 0;
                    const avgRemoteCache = localData.length > 0 ? 
                      (localData.reduce((sum, item) => sum + item.cacheStatusRatio.remoteCacheHit, 0) / localData.length * 100) : 0;
                    const avgCacheMiss = localData.length > 0 ? 
                      (localData.reduce((sum, item) => sum + item.cacheStatusRatio.cacheMiss, 0) / localData.length * 100) : 0;
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">{avgLocalCache.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Local Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-blue-600">{avgRemoteCache.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Remote Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-orange-600">{avgCacheMiss.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Cache Miss</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* CI Environment Stats */}
            {filteredData.some(item => item.isCI) && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-3">CI Environment</h4>
                <div className="grid grid-cols-3 gap-4">
                  {(() => {
                    const ciData = filteredData.filter(item => item.isCI);
                    const avgLocalCache = ciData.length > 0 ? 
                      (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.localCacheHit, 0) / ciData.length * 100) : 0;
                    const avgRemoteCache = ciData.length > 0 ? 
                      (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.remoteCacheHit, 0) / ciData.length * 100) : 0;
                    const avgCacheMiss = ciData.length > 0 ? 
                      (ciData.reduce((sum, item) => sum + item.cacheStatusRatio.cacheMiss, 0) / ciData.length * 100) : 0;
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">{avgLocalCache.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Local Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-blue-600">{avgRemoteCache.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Remote Cache</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-orange-600">{avgCacheMiss.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Cache Miss</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Performance Insights */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-800 mb-2">Performance Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Duration Difference:</span> 
                <span className={`ml-1 ${avgCiDuration > avgLocalDuration ? 'text-red-600' : 'text-green-600'}`}>
                  {avgCiDuration > avgLocalDuration ? '+' : ''}{((avgCiDuration - avgLocalDuration) / (avgLocalDuration || 1) * 100).toFixed(1)}%
                </span>
                <span className="text-gray-600 ml-1">(CI vs Local)</span>
              </div>
              <div>
                <span className="font-medium">Total Tasks:</span> 
                <span className="ml-1 text-gray-700">{totalLocalInvocations + totalCiInvocations}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}