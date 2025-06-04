import React, { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  DataItem,
  IncrementalDataItem,
  TooltipProps,
  calculateComputeIncrements,
  getUniqueWorkspaceIds,
  getUniqueResourceClasses,
  filterByDateRange,
  createComputeBarChartData,
  calculateComputeSummary,
  getWorkspaceColorShades,
  RESOURCE_COLORS
} from '../utils/chartUtils';

interface ComputeResourceChartProps {
  data: DataItem[];
  // Optional pre-processed data for server-side rendering
  incrementalData?: IncrementalDataItem[];
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const totalCredits = payload.reduce((sum: number, entry) => sum + entry.value, 0);
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <p className="text-sm text-gray-600 mb-2">Total: {totalCredits} credits</p>
        {payload
          .filter((entry) => entry.value > 0)
          .map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} credits
            </p>
          ))}
      </div>
    );
  }
  return null;
};

export function ComputeResourceChart({ 
  data, 
  incrementalData: providedIncrementalData 
}: ComputeResourceChartProps) {
  // Initialize state
  const [currentDate, setCurrentDate] = useState(() => new UTCDate(data[0]?.date || new Date()));
  const [viewMode, setViewMode] = useState<'per-workspace' | 'all-workspaces'>('per-workspace');

  // Use provided incremental data or calculate it
  const incrementalData = useMemo(
    () => providedIncrementalData || calculateComputeIncrements(data),
    [data, providedIncrementalData]
  );

  // Filter data for current month
  const monthlyData = useMemo(() => {
    const startOfMonth = new UTCDate(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
    const endOfMonth = new UTCDate(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0);
    return filterByDateRange(startOfMonth, endOfMonth)(incrementalData);
  }, [incrementalData, currentDate]);

  // Get unique identifiers
  const workspaceIds = useMemo(() => getUniqueWorkspaceIds(monthlyData), [monthlyData]);
  const resourceClasses = useMemo(() => getUniqueResourceClasses(monthlyData), [monthlyData]);
  
  // Create chart data
  const barChartData = useMemo(
    () => createComputeBarChartData(viewMode, workspaceIds, resourceClasses)(monthlyData),
    [monthlyData, viewMode, workspaceIds, resourceClasses]
  );

  // Calculate summary statistics
  const summaryStats = useMemo(
    () => calculateComputeSummary(monthlyData),
    [monthlyData]
  );

  // Create bars based on view mode
  const bars = useMemo(() => {
    if (viewMode === 'per-workspace') {
      return workspaceIds.flatMap((workspaceId) => {
        const colors = getWorkspaceColorShades(workspaceId, workspaceIds);
        
        return resourceClasses.map((resourceClass, resourceIndex) => {
          const key = `${workspaceId}-${resourceClass}`;
          const displayName = `${workspaceId.slice(-4)} - ${resourceClass.split('/')[1]}`;
          
          return (
            <Bar
              key={key}
              dataKey={key}
              stackId={workspaceId}
              name={displayName}
              fill={colors[resourceIndex % colors.length]}
            />
          );
        });
      });
    } else {
      return resourceClasses.map((resourceClass, index) => {
        const displayName = resourceClass.split('/')[1] || resourceClass;
        
        return (
          <Bar
            key={resourceClass}
            dataKey={resourceClass}
            stackId="resources"
            name={displayName}
            fill={RESOURCE_COLORS[index % RESOURCE_COLORS.length]}
          />
        );
      });
    }
  }, [viewMode, workspaceIds, resourceClasses]);

  const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Compute Resource Usage"
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* View Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('per-workspace')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'per-workspace'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Per Workspace
            </button>
            <button
              onClick={() => setViewMode('all-workspaces')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'all-workspaces'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Workspaces
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {viewMode === 'per-workspace' 
            ? 'Shows usage by workspace and resource type' 
            : 'Shows combined usage across all workspaces by resource type'
          }
        </div>
      </div>
      
      {/* Resource Class Legend */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Resource Classes:</h3>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          {resourceClasses.map(resourceClass => (
            <span key={resourceClass} className="px-2 py-1 bg-gray-100 rounded">
              {resourceClass}
            </span>
          ))}
        </div>
      </div>
      
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
              label={{ value: 'Credits', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) => {
                const parts = value.split(' - ');
                if (parts.length === 1) {
                  return `${parts[0]}`;
                }
                return `${parts[0]} - ${parts[1]}`;
              }}
            />
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {workspaceIds.map(workspaceId => {
            const workspaceTotal = summaryStats[workspaceId] || 0;
            
            return (
              <div key={workspaceId} className="text-center">
                <div className="text-lg font-semibold text-gray-900">{workspaceTotal}</div>
                <div className="text-xs text-gray-500">Workspace {workspaceId.slice(-4)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}