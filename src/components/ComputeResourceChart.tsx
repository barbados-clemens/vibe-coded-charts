import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  DataItem,
  calculateComputeIncrements,
  getUniqueWorkspaceIds,
  getUniqueResourceClasses
} from '../utils/chartUtils';

interface ComputeResourceChartProps {
  data: DataItem[];
}

export function ComputeResourceChart({ data }: ComputeResourceChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(data[0].date)
  });
  
  const [viewMode, setViewMode] = useState<'per-workspace' | 'all-workspaces'>('per-workspace');

  // Get incremental data
  const incrementalData = calculateComputeIncrements(data);

  const filteredData = incrementalData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate)
  });

  // Get unique workspace IDs and resource classes
  const workspaceIds = getUniqueWorkspaceIds(filteredData);
  const resourceClasses = getUniqueResourceClasses(filteredData);
  
  // Get unique dates and sort them
  const uniqueDates = [...new Set(filteredData.map(item => item.date))].sort();
  
  // Create formatted data based on view mode
  const formattedData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    const dayEntries = filteredData.filter(item => item.date === date);
    
    if (viewMode === 'per-workspace') {
      // Initialize all workspace-resource combinations to 0
      workspaceIds.forEach(workspaceId => {
        resourceClasses.forEach(resourceClass => {
          const key = `${workspaceId}-${resourceClass}`;
          dataPoint[key] = 0;
        });
      });
      
      // Add actual data for workspace-resource combinations
      dayEntries.forEach(entry => {
        entry.compute.forEach(compute => {
          const key = `${entry.workspaceId}-${compute.resourceClass}`;
          dataPoint[key] = compute.credits;
        });
      });
    } else {
      // All workspaces combined - group by resource class only
      resourceClasses.forEach(resourceClass => {
        dataPoint[resourceClass] = 0;
      });
      
      // Sum credits across all workspaces for each resource class
      dayEntries.forEach(entry => {
        entry.compute.forEach(compute => {
          dataPoint[compute.resourceClass] = (dataPoint[compute.resourceClass] || 0) + compute.credits;
        });
      });
    }
    
    return dataPoint;
  });

  // Define colors for workspace-resource combinations
  const workspaceColors = {
    [workspaceIds[0] || 'default']: ['#3b82f6', '#1d4ed8', '#1e3a8a', '#172554'], // Blue shades
    [workspaceIds[1] || 'default']: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'], // Red shades
    [workspaceIds[2] || 'default']: ['#10b981', '#059669', '#047857', '#065f46'], // Green shades
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Create bars based on view mode
  const createBars = () => {
    const bars: any[] = [];
    
    if (viewMode === 'per-workspace') {
      // Per workspace mode - existing logic
      workspaceIds.forEach((workspaceId, workspaceIndex) => {
        const colors = workspaceColors[workspaceId] || ['#6b7280', '#4b5563', '#374151', '#1f2937'];
        
        resourceClasses.forEach((resourceClass, resourceIndex) => {
          const key = `${workspaceId}-${resourceClass}`;
          const displayName = `${workspaceId.slice(-4)} - ${resourceClass.split('/')[1]}`;
          
          bars.push(
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
      // All workspaces mode - stacked bars for resource classes
      const resourceColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
      
      resourceClasses.forEach((resourceClass, index) => {
        const displayName = resourceClass.split('/')[1] || resourceClass;
        
        bars.push(
          <Bar
            key={resourceClass}
            dataKey={resourceClass}
            stackId="resources"
            name={displayName}
            fill={resourceColors[index % resourceColors.length]}
          />
        );
      });
    }
    
    return bars;
  };

  // Custom tooltip to show better formatted data
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalCredits = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <p className="text-sm text-gray-600 mb-2">Total: {totalCredits} credits</p>
          {payload
            .filter((entry: any) => entry.value > 0)
            .map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {entry.value} credits
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

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
          <BarChart data={formattedData}>
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
            {createBars()}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {workspaceIds.map(workspaceId => {
            const workspaceTotal = filteredData
              .filter(item => item.workspaceId === workspaceId)
              .reduce((sum, item) => 
                sum + item.compute.reduce((computeSum, compute) => computeSum + compute.credits, 0), 0
              );
            
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