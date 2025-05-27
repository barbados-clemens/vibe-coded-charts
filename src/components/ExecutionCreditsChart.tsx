import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { mockData } from '../data/mockData';
import { UTCDate } from "@date-fns/utc";


export function ExecutionCreditsChart() {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(mockData[0].date)
  });

  const filteredData = mockData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate)
  });

  // Get unique workspace IDs
  const workspaceIds = [...new Set(filteredData.map(item => item.workspaceId))];
  
  // Get unique dates and sort them
  const uniqueDates = [...new Set(filteredData.map(item => item.date))].sort();
  
  // Create formatted data with each workspace as a separate property
  const formattedData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Add each workspace's credits for this date
    workspaceIds.forEach(workspaceId => {
      const workspaceEntry = filteredData.find(item => 
        item.date === date && item.workspaceId === workspaceId
      );
      dataPoint[workspaceId] = workspaceEntry?.executionCredits || 0;
    });
    
    return dataPoint;
  });

  // Define colors for different workspaces
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  console.log(filteredData)

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Execution Credits</h2>
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
      
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {workspaceIds.map((workspaceId, index) => (
          <div key={workspaceId} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-sm text-gray-600">
              Workspace {workspaceId.slice(-4)}
            </span>
          </div>
        ))}
      </div>
      
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem'
              }}
            />
            {workspaceIds.map((workspaceId, index) => (
              <Line 
                key={workspaceId}
                type="monotone" 
                dataKey={workspaceId} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
