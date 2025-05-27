import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { mockData } from '../data/mockData';
import { UTCDate } from "@date-fns/utc";

export function ComputeResourceChart() {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(mockData[0].date)
  });

  // Function to calculate daily incremental compute usage from cumulative data
  const calculateDailyIncrements = (data: typeof mockData) => {
    // Group by workspace and month, then sort by date
    const grouped = data.reduce((acc, item) => {
      const date = new UTCDate(item.date);
      const monthKey = `${item.workspaceId}-${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(item);
      return acc;
    }, {} as Record<string, typeof mockData>);

    // Calculate increments for each workspace-month group
    const incrementalData: typeof mockData = [];
    
    Object.values(grouped).forEach(monthData => {
      // Sort by date within each month
      const sortedData = [...monthData].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      sortedData.forEach((item, index) => {
        // For compute resources, calculate incremental usage
        let incrementalCompute = [...item.compute];
        
        if (index > 0) {
          const prevCompute = sortedData[index - 1].compute;
          
          // Calculate incremental compute usage for each resource class
          incrementalCompute = item.compute.map(currentResource => {
            const prevResource = prevCompute.find(p => p.resourceClass === currentResource.resourceClass);
            const prevCredits = prevResource?.credits || 0;
            return {
              ...currentResource,
              credits: Math.max(0, currentResource.credits - prevCredits)
            };
          });
          
          // Add any new resource classes that weren't in previous day
          const newResourceClasses = item.compute.filter(current => 
            !prevCompute.some(prev => prev.resourceClass === current.resourceClass)
          );
          incrementalCompute.push(...newResourceClasses);
        }
        
        incrementalData.push({
          ...item,
          compute: incrementalCompute.filter(resource => resource.credits > 0) // Only include resources with usage
        });
      });
    });
    
    return incrementalData;
  };

  // Get incremental data
  const incrementalData = calculateDailyIncrements(mockData);

  const filteredData = incrementalData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate)
  });

  // Get unique workspace IDs and resource classes
  const workspaceIds = [...new Set(filteredData.map(item => item.workspaceId))];
  const resourceClasses = [...new Set(filteredData.flatMap(item => 
    item.compute.map(compute => compute.resourceClass)
  ))];
  
  // Get unique dates and sort them
  const uniqueDates = [...new Set(filteredData.map(item => item.date))].sort();
  
  // Create formatted data for stacked bar chart
  const formattedData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Initialize all combinations to 0
    workspaceIds.forEach(workspaceId => {
      resourceClasses.forEach(resourceClass => {
        const key = `${workspaceId}-${resourceClass}`;
        dataPoint[key] = 0;
      });
    });
    
    // Add actual data
    const dayEntries = filteredData.filter(item => item.date === date);
    dayEntries.forEach(entry => {
      entry.compute.forEach(compute => {
        const key = `${entry.workspaceId}-${compute.resourceClass}`;
        dataPoint[key] = compute.credits;
      });
    });
    
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

  // Create bars for each workspace-resource combination
  const createBars = () => {
    const bars: any[] = [];
    
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Compute Resource Usage</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-medium text-gray-700">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
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
                return `WS ${parts[0]} - ${parts[1]}`;
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