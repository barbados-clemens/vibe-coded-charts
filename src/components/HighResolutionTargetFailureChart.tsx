import React, { useState, useMemo, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, ComposedChart, ReferenceArea } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfMinute, addMinutes } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import { ChartNavigation } from './ChartNavigation';

interface Task {
  taskId: string;
  target: string;
  projectName: string;
  status: number | { $numberLong: string };
  startTime: string;
  endTime: string;
}

interface Run {
  workspaceId: string | { $oid: string };
  command: string;
  startTime: string;
  endTime: string;
  status: number;
  tasks: Task[];
  branch: string;
  sha: string;
  createdAt: string | { $date: string };
}

type MinRunsThreshold = 'none' | '1' | '3' | '5' | '10' | '20';

interface HighResolutionTargetFailureChartProps {
  data: Run[];
}

const HighResolutionTargetFailureChart: React.FC<HighResolutionTargetFailureChartProps> = ({ data }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [minRunsThreshold, setMinRunsThreshold] = useState<MinRunsThreshold>('none');
  
  // Zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<{ left: string | null; right: string | null }>({ left: null, right: null });

  // Extract unique target names from all runs
  const uniqueTargets = useMemo(() => {
    const targetSet = new Set<string>();
    data.forEach(run => {
      run.tasks?.forEach(task => {
        if (task.target) {
          targetSet.add(task.target);
        }
      });
    });
    return Array.from(targetSet).sort();
  }, [data]);

  // Set default selected target if not set
  useMemo(() => {
    if (!selectedTarget && uniqueTargets.length > 0) {
      setSelectedTarget(uniqueTargets[0]);
    }
  }, [uniqueTargets, selectedTarget]);

  // Filter data by date range
  const filteredData = useMemo(() => {
    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(currentDate);
    
    return data.filter(run => {
      const runDate = typeof run.createdAt === 'string' 
        ? new Date(run.createdAt)
        : new Date(run.createdAt.$date);
        
      if (viewMode === 'daily') {
        return runDate.getMonth() === currentDate.getMonth() && 
               runDate.getFullYear() === currentDate.getFullYear();
      }
      return isWithinInterval(runDate, { start: startDate, end: endDate });
    });
  }, [data, currentDate, viewMode]);

  // Apply minimum runs filtering to chart data intervals
  const applyMinRunsFilter = useCallback((chartData: any[], threshold: MinRunsThreshold): { filteredData: any[], originalIntervals: number, filteredIntervals: number } => {
    if (threshold === 'none') {
      return {
        filteredData: chartData,
        originalIntervals: chartData.length,
        filteredIntervals: 0
      };
    }
    
    const minRuns = parseInt(threshold);
    const filteredData = chartData.filter(interval => interval.total >= minRuns);
    
    return {
      filteredData,
      originalIntervals: chartData.length,
      filteredIntervals: chartData.length - filteredData.length
    };
  }, []);

  // Process data into 5-minute intervals
  const rawChartData = useMemo(() => {
    if (!selectedTarget || filteredData.length === 0) return [];

    // Create a map to store 5-minute interval data
    const intervalMap = new Map<string, { total: number; failed: number; timestamp: Date }>();

    filteredData.forEach(run => {
      run.tasks?.forEach(task => {
        if (task.target === selectedTarget) {
          // Parse task start time
          const taskTime = new Date(task.startTime);
          // Round down to nearest 5-minute interval
          const intervalStart = startOfMinute(taskTime);
          intervalStart.setMinutes(Math.floor(intervalStart.getMinutes() / 5) * 5);
          const intervalKey = intervalStart.toISOString();

          if (!intervalMap.has(intervalKey)) {
            intervalMap.set(intervalKey, { total: 0, failed: 0, timestamp: intervalStart });
          }

          const interval = intervalMap.get(intervalKey)!;
          interval.total += 1;

          // Check if task failed (status !== 0)
          const status = typeof task.status === 'object' ? parseInt(task.status.$numberLong) : task.status;
          if (status !== 0) {
            interval.failed += 1;
          }
        }
      });
    });

    // Convert map to sorted array
    const intervals = Array.from(intervalMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(interval => ({
        timestamp: interval.timestamp.toISOString(),
        time: format(interval.timestamp, 'MMM dd HH:mm'),
        shortTime: format(interval.timestamp, 'HH:mm'),
        date: format(interval.timestamp, 'MMM dd'),
        total: interval.total,
        failed: interval.failed,
        failureRate: interval.total > 0 ? (interval.failed / interval.total) * 100 : 0
      }));

    return intervals;
  }, [filteredData, selectedTarget]);

  // Apply minimum runs filter
  const { filteredData: chartData, originalIntervals, filteredIntervals } = useMemo(() => {
    return applyMinRunsFilter(rawChartData, minRunsThreshold);
  }, [rawChartData, minRunsThreshold, applyMinRunsFilter]);

  // Filter chart data based on zoom domain
  const displayData = useMemo(() => {
    if (!zoomDomain.left || !zoomDomain.right) return chartData;
    
    const leftIndex = chartData.findIndex(item => item.shortTime === zoomDomain.left);
    const rightIndex = chartData.findIndex(item => item.shortTime === zoomDomain.right);
    
    if (leftIndex === -1 || rightIndex === -1) return chartData;
    
    return chartData.slice(Math.min(leftIndex, rightIndex), Math.max(leftIndex, rightIndex) + 1);
  }, [chartData, zoomDomain]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const dataToAnalyze = displayData.length > 0 ? displayData : chartData;
    if (dataToAnalyze.length === 0) return { totalRuns: 0, totalFailures: 0, overallFailureRate: 0 };
    
    const totalRuns = dataToAnalyze.reduce((sum, item) => sum + item.total, 0);
    const totalFailures = dataToAnalyze.reduce((sum, item) => sum + item.failed, 0);
    const overallFailureRate = totalRuns > 0 ? (totalFailures / totalRuns) * 100 : 0;

    return { totalRuns, totalFailures, overallFailureRate };
  }, [chartData, displayData]);

  const handlePrevious = () => {
    setCurrentDate(prev => subMonths(prev, 1));
    // Reset zoom when changing months
    setZoomDomain({ left: null, right: null });
  };

  const handleNext = () => {
    if (currentDate < new Date()) {
      setCurrentDate(prev => addMonths(prev, 1));
      // Reset zoom when changing months
      setZoomDomain({ left: null, right: null });
    }
  };

  // Custom zoom navigation
  const handleZoomNavigation = useCallback((direction: 'prev' | 'next') => {
    if (!zoomDomain.left || !zoomDomain.right || displayData.length === 0) return;
    
    const currentLeftIndex = chartData.findIndex(item => item.shortTime === zoomDomain.left);
    const currentRightIndex = chartData.findIndex(item => item.shortTime === zoomDomain.right);
    
    if (currentLeftIndex === -1 || currentRightIndex === -1) return;
    
    const windowSize = Math.abs(currentRightIndex - currentLeftIndex) + 1;
    const minIndex = Math.min(currentLeftIndex, currentRightIndex);
    const maxIndex = Math.max(currentLeftIndex, currentRightIndex);
    
    if (direction === 'prev') {
      // Move backward by window size
      const newMinIndex = Math.max(0, minIndex - windowSize);
      const newMaxIndex = newMinIndex + windowSize - 1;
      
      if (newMaxIndex < chartData.length) {
        setZoomDomain({
          left: chartData[newMinIndex].shortTime,
          right: chartData[Math.min(newMaxIndex, chartData.length - 1)].shortTime
        });
      }
    } else {
      // Move forward by window size
      const newMinIndex = Math.min(chartData.length - windowSize, maxIndex + 1);
      const newMaxIndex = newMinIndex + windowSize - 1;
      
      if (newMinIndex >= 0 && newMinIndex < chartData.length) {
        setZoomDomain({
          left: chartData[newMinIndex].shortTime,
          right: chartData[Math.min(newMaxIndex, chartData.length - 1)].shortTime
        });
      }
    }
  }, [chartData, zoomDomain, displayData.length]);

  // Zoom handlers
  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsZooming(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (isZooming && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  }, [isZooming]);

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      setZoomDomain({ left: refAreaLeft, right: refAreaRight });
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsZooming(false);
  }, [refAreaLeft, refAreaRight]);

  const handleZoomOut = useCallback(() => {
    setZoomDomain({ left: null, right: null });
  }, []);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.time}</p>
          <p className="text-sm text-red-600">
            Failed: {data.failed} / {data.total}
          </p>
          <p className="text-sm text-gray-600">
            Failure Rate: {data.failureRate.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">High Resolution Target Failure Analysis</h2>
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {uniqueTargets.map(target => (
              <option key={target} value={target}>{target}</option>
            ))}
          </select>
          <select
            value={minRunsThreshold}
            onChange={(e) => setMinRunsThreshold(e.target.value as MinRunsThreshold)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">No minimum filter</option>
            <option value="1">Min 1 run per interval</option>
            <option value="3">Min 3 runs per interval</option>
            <option value="5">Min 5 runs per interval</option>
            <option value="10">Min 10 runs per interval</option>
            <option value="20">Min 20 runs per interval</option>
          </select>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Runs</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalRuns}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-red-600">Total Failures</p>
          <p className="text-2xl font-semibold text-red-900">{stats.totalFailures}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-sm text-orange-600">Overall Failure Rate</p>
          <p className="text-2xl font-semibold text-orange-900">{stats.overallFailureRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {zoomDomain.left && zoomDomain.right && displayData.length > 0 ? (
            <span>
              Showing {displayData[0].time} - {displayData[displayData.length - 1].time}
              {filteredIntervals > 0 && (
                <span className="text-orange-600 ml-2">
                  ({filteredIntervals} intervals filtered out)
                </span>
              )}
            </span>
          ) : (
            <span>
              Showing 5-minute intervals with task execution data
              {filteredIntervals > 0 && (
                <span className="text-orange-600 ml-2">
                  ({filteredIntervals} intervals filtered out)
                </span>
              )}
            </span>
          )}
        </div>
        {zoomDomain.left && zoomDomain.right && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleZoomNavigation('prev')}
              disabled={chartData.findIndex(item => item.shortTime === zoomDomain.left) === 0}
              className="p-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous time window"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleZoomNavigation('next')}
              disabled={chartData.findIndex(item => item.shortTime === zoomDomain.right) >= chartData.length - 1}
              className="p-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next time window"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reset Zoom
            </button>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          {selectedTarget ? `No data available for target "${selectedTarget}" in ${format(currentDate, 'MMMM yyyy')}` : 'No target selected'}
        </div>
      ) : (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="shortTime" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
                tick={{ fontSize: 10 }}
              />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8">
                <Label value="Count" angle={-90} position="insideLeft" />
              </YAxis>
              <YAxis yAxisId="right" orientation="right" stroke="#dc2626">
                <Label value="Failure Rate (%)" angle={90} position="insideRight" />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Bar for counts */}
              <Bar yAxisId="left" dataKey="total" fill="#3b82f6" name="Total Runs" />
              <Bar yAxisId="left" dataKey="failed" fill="#ef4444" name="Failed Runs" />
              
              {/* Line for failure rate */}
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="failureRate" 
                stroke="#dc2626" 
                strokeWidth={2}
                name="Failure Rate (%)"
                dot={{ fill: '#dc2626', r: 3 }}
              />
              
              {/* Reference line at 10% failure rate */}
              <ReferenceLine yAxisId="right" y={10} stroke="#fbbf24" strokeDasharray="5 5" label="10% threshold" />
              
              {/* Reference area for zoom selection */}
              {refAreaLeft && refAreaRight && (
                <ReferenceArea
                  yAxisId="left"
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Additional insights */}
      {chartData.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Analysis Details</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Data shown in 5-minute intervals for high resolution analysis</p>
            <p>• Total intervals with data: {chartData.length}</p>
            {!zoomDomain.left ? (
              <p>• Full time range: {chartData[0].time} to {chartData[chartData.length - 1].time}</p>
            ) : (
              <>
                <p>• Original range: {chartData[0].time} to {chartData[chartData.length - 1].time}</p>
                <p className="text-blue-600">• Zoomed view: {displayData.length} intervals ({displayData[0]?.time} - {displayData[displayData.length - 1]?.time})</p>
              </>
            )}
            {minRunsThreshold !== 'none' && (
              <p className="text-orange-600">• Min runs filter: {minRunsThreshold} runs per interval ({filteredIntervals} intervals removed from {originalIntervals} total)</p>
            )}
            {stats.overallFailureRate > 10 && (
              <p className="text-red-600 font-medium">⚠️ Failure rate above 10% threshold - investigation recommended</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Fix for Recharts Label import
const Label = ({ value, angle, position }: any) => null;

export default HighResolutionTargetFailureChart;