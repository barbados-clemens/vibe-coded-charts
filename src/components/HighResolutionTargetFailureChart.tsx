import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, ComposedChart } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfMinute, addMinutes } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import ChartNavigation from './ChartNavigation';

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

interface HighResolutionTargetFailureChartProps {
  data: Run[];
}

const HighResolutionTargetFailureChart: React.FC<HighResolutionTargetFailureChartProps> = ({ data }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedTarget, setSelectedTarget] = useState<string>('');

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

  // Process data into 5-minute intervals
  const chartData = useMemo(() => {
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

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return { totalRuns: 0, totalFailures: 0, overallFailureRate: 0 };
    
    const totalRuns = chartData.reduce((sum, item) => sum + item.total, 0);
    const totalFailures = chartData.reduce((sum, item) => sum + item.failed, 0);
    const overallFailureRate = totalRuns > 0 ? (totalFailures / totalRuns) * 100 : 0;

    return { totalRuns, totalFailures, overallFailureRate };
  }, [chartData]);

  const handlePrevious = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (currentDate < new Date()) {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

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
        </div>
        <ChartNavigation
          currentDate={currentDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPrevious={handlePrevious}
          onNext={handleNext}
          dateFormat="MMMM yyyy"
        />
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

      <div className="text-sm text-gray-600 mb-4">
        Showing 5-minute intervals with task execution data
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          {selectedTarget ? `No data available for target "${selectedTarget}" in ${format(currentDate, 'MMMM yyyy')}` : 'No target selected'}
        </div>
      ) : (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
            <p>• Time range: {chartData[0].time} to {chartData[chartData.length - 1].time}</p>
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