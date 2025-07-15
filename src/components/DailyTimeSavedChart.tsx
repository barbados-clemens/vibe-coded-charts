import React, { useState } from 'react';
import { format, addYears, addMonths, isSameYear, isSameMonth, getDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';

export type DailyTimeSavedDataItem = {
  workspaceId: string;
  date: string;
  timeSaved: number;
  totalCount?: number;
  cacheStatusRatio?: {
    localCacheHit?: number;
    remoteCacheHit?: number;
    cacheMiss?: number;
  };
};

interface DailyTimeSavedChartProps {
  data: DailyTimeSavedDataItem[];
}

export function DailyTimeSavedChart({ data }: DailyTimeSavedChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0]?.date || new Date())
  });
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [chartType, setChartType] = useState<'timeSaved' | 'cacheHitRate'>('timeSaved');

  // Early return if no data
  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Daily Time Saved</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No time saved data available</p>
          <p className="text-sm mt-2">Run tasks with caching enabled to see time savings</p>
        </div>
      </div>
    );
  }

  // Filter data based on view mode
  const filteredData = data.filter(item => {
    const itemDate = new UTCDate(item.date);
    if (viewMode === 'annual') {
      return isSameYear(itemDate, currentDate);
    } else {
      return isSameMonth(itemDate, currentDate) && isSameYear(itemDate, currentDate);
    }
  });

  // Group data by day and sum time saved
  const groupedData = filteredData.reduce((acc, item) => {
    // Extract just the date part (YYYY-MM-DD) to group by day
    const dateKey = item.date.split('T')[0];
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateKey + 'T00:00:00.000Z',
        timeSaved: 0,
        workspaceIds: new Set(),
        totalTasks: 0,
        weightedLocalCacheHitRatio: 0,
        weightedRemoteCacheHitRatio: 0,
        weightedCacheMissRatio: 0
      };
    }
    
    acc[dateKey].timeSaved += item.timeSaved;
    acc[dateKey].workspaceIds.add(item.workspaceId);
    
    // Aggregate cache statistics using weighted averages to preserve accuracy
    if (item.totalCount && item.cacheStatusRatio) {
      const totalCount = item.totalCount;
      const localRatio = item.cacheStatusRatio.localCacheHit || 0;
      const remoteRatio = item.cacheStatusRatio.remoteCacheHit || 0;
      const missRatio = item.cacheStatusRatio.cacheMiss || 0;
      
      // Accumulate weighted ratios (weight = totalCount)
      acc[dateKey].totalTasks += totalCount;
      acc[dateKey].weightedLocalCacheHitRatio += localRatio * totalCount;
      acc[dateKey].weightedRemoteCacheHitRatio += remoteRatio * totalCount;
      acc[dateKey].weightedCacheMissRatio += missRatio * totalCount;
    }
    
    return acc;
  }, {} as Record<string, { 
    date: string; 
    timeSaved: number; 
    workspaceIds: Set<string>;
    totalTasks: number;
    weightedLocalCacheHitRatio: number;
    weightedRemoteCacheHitRatio: number;
    weightedCacheMissRatio: number;
  }>);

  // Convert grouped data back to array format
  const aggregatedData = Object.values(groupedData).map(item => {
    if (item.totalTasks === 0) {
      return {
        date: item.date,
        timeSaved: item.timeSaved,
        workspaceId: Array.from(item.workspaceIds).join(', '),
        totalTasks: 0,
        totalCacheHits: 0,
        localCacheHits: 0,
        remoteCacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0
      };
    }

    // Calculate the weighted average ratios
    const localRatio = item.weightedLocalCacheHitRatio / item.totalTasks;
    const remoteRatio = item.weightedRemoteCacheHitRatio / item.totalTasks;
    const missRatio = item.weightedCacheMissRatio / item.totalTasks;
    
    // Calculate individual counts for display (matching MongoDB logic)
    const localCacheHits = localRatio * item.totalTasks;
    const remoteCacheHits = remoteRatio * item.totalTasks;
    const cacheMisses = missRatio * item.totalTasks;
    
    // Calculate cache hit rate matching MongoDB logic: (localHits + remoteHits) / totalTasks * 100
    const cacheHitRate = ((localCacheHits + remoteCacheHits) / item.totalTasks) * 100;
    
    return {
      date: item.date,
      timeSaved: item.timeSaved,
      workspaceId: Array.from(item.workspaceIds).join(', '),
      totalTasks: item.totalTasks,
      totalCacheHits: Math.round(localCacheHits + remoteCacheHits),
      localCacheHits: Math.round(localCacheHits),
      remoteCacheHits: Math.round(remoteCacheHits),
      cacheMisses: Math.round(cacheMisses),
      cacheHitRate: cacheHitRate
    };
  });

  // Check if aggregated data is empty
  if (aggregatedData.length === 0) {
    return (
      <div className="w-full bg-white p-6 rounded-lg shadow-lg">
        <ChartNavigation
          title="Daily Time Saved"
          displayValue={viewMode === 'annual' ? format(currentDate, 'yyyy') : format(currentDate, 'MMMM yyyy')}
          onPrevious={() => setCurrentDate(prev => viewMode === 'annual' ? addYears(prev, -1) : addMonths(prev, -1))}
          onNext={() => setCurrentDate(prev => viewMode === 'annual' ? addYears(prev, 1) : addMonths(prev, 1))}
        />
        <div className="text-center py-12 text-gray-500">
          <p>No time saved data available for {format(currentDate, 'yyyy')}</p>
          <p className="text-sm mt-2">Try a different year or run more tasks with caching enabled</p>
        </div>
      </div>
    );
  }

  // Process data to create chart-friendly format with proper date formatting
  const sortedData = aggregatedData
    .map((item, index) => ({
      date: item.date,
      dateDisplay: format(new UTCDate(item.date), 'MMM dd'),
      monthDisplay: format(new UTCDate(item.date), 'MMM'),
      timeSavedHours: item.timeSaved / (1000 * 60 * 60), // Convert ms to hours
      timeSavedMs: item.timeSaved,
      workspaceId: item.workspaceId,
      dayOfWeek: getDay(new UTCDate(item.date)), // 0 = Sunday, 6 = Saturday
      isWeekend: getDay(new UTCDate(item.date)) === 0 || getDay(new UTCDate(item.date)) === 6,
      dataIndex: index,
      totalTasks: item.totalTasks,
      cacheHitRate: item.cacheHitRate,
      localCacheHits: item.localCacheHits,
      remoteCacheHits: item.remoteCacheHits,
      cacheMisses: item.cacheMisses
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate rolling averages (7-day window) for both time saved and cache hit rate
  const rollingWindow = 7;
  const chartData = sortedData.map((item, index) => {
    // Calculate rolling average for current position
    const windowStart = Math.max(0, index - Math.floor(rollingWindow / 2));
    const windowEnd = Math.min(sortedData.length - 1, index + Math.floor(rollingWindow / 2));
    
    const windowData = sortedData.slice(windowStart, windowEnd + 1);
    const rollingAverageTimeSaved = windowData.reduce((sum, d) => sum + d.timeSavedHours, 0) / windowData.length;
    
    // Calculate rolling average for cache hit rate (only include days with actual data)
    const validCacheData = windowData.filter(d => d.totalTasks > 0);
    const rollingAverageCacheHitRate = validCacheData.length > 0 
      ? validCacheData.reduce((sum, d) => sum + d.cacheHitRate, 0) / validCacheData.length
      : 0;
    
    return {
      ...item,
      rollingAverage: rollingAverageTimeSaved,
      rollingAverageCacheHitRate: rollingAverageCacheHitRate
    };
  });

  // Create weekend highlight areas
  const weekendAreas = [];
  let weekendStart = null;
  
  chartData.forEach((item, index) => {
    if (item.isWeekend && weekendStart === null) {
      // Start of weekend
      weekendStart = index;
    } else if (!item.isWeekend && weekendStart !== null) {
      // End of weekend
      weekendAreas.push({
        x1: weekendStart,
        x2: index - 1
      });
      weekendStart = null;
    }
  });
  
  // Handle case where data ends on a weekend
  if (weekendStart !== null) {
    weekendAreas.push({
      x1: weekendStart,
      x2: chartData.length - 1
    });
  }

  const handlePrevious = () => {
    if (viewMode === 'annual') {
      setCurrentDate(prev => addYears(prev, -1));
    } else {
      setCurrentDate(prev => addMonths(prev, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'annual') {
      setCurrentDate(prev => addYears(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Safety checks to prevent undefined errors
      const timeSavedHours = data?.timeSavedHours || 0;
      const rollingAverage = data?.rollingAverage || 0;
      const rollingAverageCacheHitRate = data?.rollingAverageCacheHitRate || 0;
      const timeSavedMs = data?.timeSavedMs || 0;
      const cacheHitRate = data?.cacheHitRate || 0;
      const totalTasks = data?.totalTasks || 0;
      const localCacheHits = data?.localCacheHits || 0;
      const remoteCacheHits = data?.remoteCacheHits || 0;
      const cacheMisses = data?.cacheMisses || 0;
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label || 'N/A'}</p>
          
          {chartType === 'timeSaved' ? (
            <>
              <p className="text-sm text-green-600">
                Daily: {timeSavedHours.toFixed(1)} hours
              </p>
              <p className="text-sm text-blue-600">
                7-Day Avg: {rollingAverage.toFixed(1)} hours
              </p>
              <p className="text-xs text-gray-500">
                ({timeSavedMs.toLocaleString()} ms)
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-purple-600">
                Daily: {cacheHitRate.toFixed(1)}%
              </p>
              <p className="text-sm text-blue-600">
                7-Day Avg: {rollingAverageCacheHitRate.toFixed(1)}%
              </p>
            </>
          )}
          
          {totalTasks > 0 && (
            <>
              <hr className="my-2 border-gray-200" />
              {chartType === 'timeSaved' && (
                <p className="text-sm font-medium text-purple-600">
                  Cache Hit Rate: {cacheHitRate.toFixed(1)}%
                </p>
              )}
              {chartType === 'cacheHitRate' && (
                <p className="text-sm font-medium text-green-600">
                  Time Saved: {timeSavedHours.toFixed(1)} hours
                </p>
              )}
              <div className="text-xs text-gray-600 mt-1">
                <p>Total Tasks: {totalTasks.toLocaleString()}</p>
                <p>Local Cache Hits: {localCacheHits.toLocaleString()}</p>
                <p>Remote Cache Hits: {remoteCacheHits.toLocaleString()}</p>
                <p>Cache Misses: {cacheMisses.toLocaleString()}</p>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };


  // Calculate summary statistics
  const totalTimeSavedMs = aggregatedData.reduce((sum, item) => sum + item.timeSaved, 0);
  const totalTimeSavedHours = totalTimeSavedMs / (1000 * 60 * 60);
  const avgTimeSavedHours = aggregatedData.length > 0 ? totalTimeSavedHours / aggregatedData.length : 0;
  const maxTimeSavedHours = Math.max(...aggregatedData.map(item => item.timeSaved / (1000 * 60 * 60)), 0);
  const daysWithData = aggregatedData.filter(item => item.timeSaved > 0).length;
  
  // Calculate cache hit rate summary statistics
  const daysWithCacheData = aggregatedData.filter(item => item.totalTasks > 0);
  const avgCacheHitRate = daysWithCacheData.length > 0 
    ? daysWithCacheData.reduce((sum, item) => sum + item.cacheHitRate, 0) / daysWithCacheData.length 
    : 0;
  const maxCacheHitRate = daysWithCacheData.length > 0 
    ? Math.max(...daysWithCacheData.map(item => item.cacheHitRate), 0)
    : 0;
  const minCacheHitRate = daysWithCacheData.length > 0 
    ? Math.min(...daysWithCacheData.map(item => item.cacheHitRate), 100)
    : 0;
  const totalTasks = aggregatedData.reduce((sum, item) => sum + item.totalTasks, 0);

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Daily Time Saved"
        displayValue={viewMode === 'annual' ? format(currentDate, 'yyyy') : format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
      
      {/* View Mode Toggle */}
      <div className="mb-4 flex justify-center gap-2">
        <button
          onClick={() => setViewMode('annual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'annual' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Annual View
        </button>
        <button
          onClick={() => setViewMode('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'monthly' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Monthly View
        </button>
      </div>
      
      {/* Chart Type Toggle */}
      <div className="mb-4 flex justify-center gap-2">
        <button
          onClick={() => setChartType('timeSaved')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartType === 'timeSaved' 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Time Saved
        </button>
        <button
          onClick={() => setChartType('cacheHitRate')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartType === 'cacheHitRate' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cache Hit Rate
        </button>
      </div>
      
      {/* Summary Stats */}
      <div className={`mb-6 p-4 rounded-lg ${
        chartType === 'timeSaved' ? 'bg-green-50' : 'bg-purple-50'
      }`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {chartType === 'timeSaved' ? (
            <>
              <div>
                <div className="text-2xl font-bold text-green-700">{totalTimeSavedHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Total Saved</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{avgTimeSavedHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Avg per Day</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{maxTimeSavedHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Peak Day</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{daysWithData}</div>
                <div className="text-sm text-gray-600">Active Days</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-2xl font-bold text-purple-700">{avgCacheHitRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Avg Hit Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-700">{maxCacheHitRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Peak Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-700">{minCacheHitRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Lowest Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-700">{totalTasks.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Tasks</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart Legend */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Chart Legend</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-white border border-gray-300"></div>
            <span>Weekdays (Mon-Fri)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-gray-300 bg-opacity-30"></div>
            <span>Weekends (Sat-Sun)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-0.5 ${
              chartType === 'timeSaved' ? 'bg-green-600' : 'bg-purple-600'
            }`}></div>
            <span>Daily {chartType === 'timeSaved' ? 'Time Saved' : 'Cache Hit Rate'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-600 border-dashed border-t"></div>
            <span>7-Day Rolling Average</span>
          </div>
        </div>
      </div>

      {/* Time saved equivalents info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Time Saved Context</h4>
        <div className="text-xs text-gray-600">
          <p>Total time saved this {viewMode === 'annual' ? 'year' : 'month'} is equivalent to:</p>
          <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            <span>• {(totalTimeSavedHours / 24).toFixed(1)} days</span>
            <span>• {(totalTimeSavedHours / (8)).toFixed(1)} work days</span>
            <span>• {(totalTimeSavedMs / 1000).toFixed(0)} seconds</span>
            <span>• {(totalTimeSavedMs / (1000 * 60)).toFixed(0)} minutes</span>
          </div>
        </div>
      </div>
      
      {chartData.length > 0 ? (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              
              {/* Weekend highlighting */}
              {weekendAreas.map((area, index) => (
                <ReferenceArea
                  key={`weekend-${index}`}
                  x1={chartData[area.x1]?.dateDisplay}
                  x2={chartData[area.x2]?.dateDisplay}
                  fill="#f3f4f6"
                  fillOpacity={0.3}
                  stroke="none"
                />
              ))}
              
              <XAxis 
                dataKey="dateDisplay" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval="preserveStartEnd"
                tickFormatter={(value, index) => {
                  // For annual view, show every 30th day; for monthly view, show more days
                  if (viewMode === 'annual') {
                    if (index % 30 === 0) return value;
                    return '';
                  } else {
                    if (index % 3 === 0) return value;
                    return '';
                  }
                }}
              />
              <YAxis 
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ 
                  value: chartType === 'timeSaved' ? 'Time Saved (hours)' : 'Cache Hit Rate (%)', 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey={chartType === 'timeSaved' ? 'timeSavedHours' : 'cacheHitRate'}
                stroke={chartType === 'timeSaved' ? '#10b981' : '#9333ea'}
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 5, 
                  stroke: chartType === 'timeSaved' ? '#10b981' : '#9333ea', 
                  strokeWidth: 2, 
                  fill: chartType === 'timeSaved' ? '#10b981' : '#9333ea' 
                }}
                connectNulls={true}
                name={chartType === 'timeSaved' ? 'Daily Time Saved' : 'Daily Cache Hit Rate'}
              />
              <Line 
                type="monotone" 
                dataKey={chartType === 'timeSaved' ? 'rollingAverage' : 'rollingAverageCacheHitRate'}
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#3b82f6' }}
                connectNulls={true}
                name="7-Day Rolling Average"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No time saved data for this period</p>
            <p className="text-sm">Try navigating to a different time period</p>
          </div>
        </div>
      )}

      {/* Performance insights */}
      {aggregatedData.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Performance Insights</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {totalTimeSavedHours > 1000 && viewMode === 'annual' && (
              <p className="text-green-700">🎉 Excellent caching performance! Over 1,000 hours saved this year.</p>
            )}
            {totalTimeSavedHours > 100 && viewMode === 'monthly' && (
              <p className="text-green-700">🎉 Great month! Over 100 hours saved through caching.</p>
            )}
            {daysWithData < aggregatedData.length && (
              <p className="text-yellow-600">⚠️ Some days show no time savings - consider optimizing cache strategies.</p>
            )}
            {avgTimeSavedHours > 5 && (
              <p className="text-blue-600">📈 Consistently strong performance with {avgTimeSavedHours.toFixed(1)} hours saved per day on average.</p>
            )}
            <p className="text-gray-600">💡 The blue dashed line shows the 7-day rolling average to help identify trends and smooth out daily fluctuations.</p>
          </div>
        </div>
      )}
    </div>
  );
}