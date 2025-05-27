import React, { useState } from 'react';
import { format, addMonths, isSameMonth, startOfYear, endOfYear, eachDayOfInterval, getDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { mockData } from '../data/mockData';
import { UTCDate } from "@date-fns/utc";

export function RunCountChart() {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(mockData[0].date)
  });
  
  const [currentYear, setCurrentYear] = useState(() => {
    return new UTCDate(mockData[0].date).getUTCFullYear()
  });

  // Function to calculate daily incremental run counts from cumulative data
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
        let dailyIncrement = item.runCount;
        
        // If not the first day of the month, subtract previous day's cumulative total
        if (index > 0) {
          dailyIncrement = item.runCount - sortedData[index - 1].runCount;
        }
        
        incrementalData.push({
          ...item,
          runCount: Math.max(0, dailyIncrement) // Ensure no negative values
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

  // Get unique workspace IDs
  const workspaceIds = [...new Set(filteredData.map(item => item.workspaceId))];
  
  // Get unique dates and sort them
  const uniqueDates = [...new Set(filteredData.map(item => item.date))].sort();
  
  // Create formatted data with each workspace as a separate property
  const formattedData = uniqueDates.map(date => {
    const dataPoint: any = {
      date: format(new UTCDate(date), 'MMM dd'),
    };
    
    // Add each workspace's incremental run count for this date
    workspaceIds.forEach(workspaceId => {
      const workspaceEntry = filteredData.find(item => 
        item.date === date && item.workspaceId === workspaceId
      );
      dataPoint[workspaceId] = workspaceEntry?.runCount || 0;
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

  // Heatmap data processing
  const yearStart = startOfYear(new UTCDate(currentYear, 0, 1));
  const yearEnd = endOfYear(new UTCDate(currentYear, 11, 31));
  const allDaysInYear = eachDayOfInterval({ start: yearStart, end: yearEnd });
  
  // Group incremental data by date and sum all workspaces for each day
  const dailyTotals = incrementalData
    .filter(item => new UTCDate(item.date).getUTCFullYear() === currentYear)
    .reduce((acc, item) => {
      const dateKey = item.date.split('T')[0]; // Get date part only
      acc[dateKey] = (acc[dateKey] || 0) + item.runCount;
      return acc;
    }, {} as Record<string, number>);

  // Create detailed daily data for tooltips
  const dailyDetailsByDate = incrementalData
    .filter(item => new UTCDate(item.date).getUTCFullYear() === currentYear)
    .reduce((acc, item) => {
      const dateKey = item.date.split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      if (item.runCount > 0) { // Only include days with actual usage
        acc[dateKey].push({
          workspaceId: item.workspaceId,
          runCount: item.runCount
        });
      }
      return acc;
    }, {} as Record<string, Array<{ workspaceId: string; runCount: number }>>);

  // Create heatmap grid with proper week alignment
  const firstDayOfYear = getDay(yearStart); // 0 = Sunday, 1 = Monday, etc.
  const weeksArray: Array<Array<{ date: Date; runCount: number; dateStr: string; workspaceDetails: Array<{ workspaceId: string; runCount: number }> } | null>> = [];
  
  // Add padding days for the first week
  let currentWeek: Array<{ date: Date; runCount: number; dateStr: string; workspaceDetails: Array<{ workspaceId: string; runCount: number }> } | null> = [];
  for (let i = 0; i < firstDayOfYear; i++) {
    currentWeek.push(null);
  }
  
  // Add all days of the year
  allDaysInYear.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const runCount = dailyTotals[dateKey] || 0;
    const workspaceDetails = dailyDetailsByDate[dateKey] || [];
    
    currentWeek.push({
      date,
      runCount,
      dateStr: dateKey,
      workspaceDetails
    });
    
    // If week is complete (7 days), start a new week
    if (currentWeek.length === 7) {
      weeksArray.push([...currentWeek]);
      currentWeek = [];
    }
  });
  
  // Add the last partial week if it exists
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeksArray.push(currentWeek);
  }

  // Calculate max run count for color intensity
  const maxRunCount = Math.max(...Object.values(dailyTotals), 1);

  // Get color intensity (0-4 levels like GitHub)
  const getColorIntensity = (runCount: number) => {
    if (runCount === 0) return 0;
    const ratio = runCount / maxRunCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const handlePrevYear = () => {
    setCurrentYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(prev => prev + 1);
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Run Count</h2>
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

      {/* GitHub-style Heatmap Chart */}
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Annual Run Count</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevYear}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-md font-medium text-gray-700">
              {currentYear}
            </span>
            <button
              onClick={handleNextYear}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Month labels */}
            <div className="flex mb-2 ml-8">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                <div key={month} className="text-xs text-gray-500 w-16 text-left">
                  {index % 1 === 0 ? month : ''}
                </div>
              ))}
            </div>

            {/* Day labels and heatmap */}
            <div className="flex">
              {/* Day of week labels */}
              <div className="flex flex-col gap-1 mr-2 text-xs text-gray-500 justify-start pt-1">
                <div className="h-3"></div>
                <div className="h-3">Mon</div>
                <div className="h-3"></div>
                <div className="h-3">Wed</div>
                <div className="h-3"></div>
                <div className="h-3">Fri</div>
                <div className="h-3"></div>
              </div>

              {/* Heatmap squares */}
              <div className="flex gap-1">
                {weeksArray.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((dayData, dayIndex) => {
                      if (!dayData) {
                        return <div key={dayIndex} className="w-3 h-3" />;
                      }
                      
                      const intensity = getColorIntensity(dayData.runCount);
                      const colors = [
                        'bg-gray-100', // 0 - no activity
                        'bg-blue-200', // 1 - low
                        'bg-blue-300', // 2 - medium-low  
                        'bg-blue-500', // 3 - medium-high
                        'bg-blue-700'  // 4 - high
                      ];

                      // Create detailed tooltip text
                      const createTooltip = () => {
                        const dateStr = format(dayData.date, 'MMM dd, yyyy');
                        if (dayData.workspaceDetails.length === 0) {
                          return `${dateStr}: No runs`;
                        }
                        
                        const workspaceLines = dayData.workspaceDetails
                          .map(detail => `  Workspace ${detail.workspaceId.slice(-4)}: ${detail.runCount} runs`)
                          .join('\n');
                        
                        return `${dateStr}:\nTotal: ${dayData.runCount} runs\n${workspaceLines}`;
                      };
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`w-3 h-3 rounded-sm ${colors[intensity]} hover:ring-2 hover:ring-gray-400 cursor-pointer`}
                          title={createTooltip()}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-gray-500">
            Less
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-blue-200" />
            <div className="w-3 h-3 rounded-sm bg-blue-300" />
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <div className="w-3 h-3 rounded-sm bg-blue-700" />
          </div>
          <div className="text-xs text-gray-500">
            More
          </div>
        </div>
      </div>
    </div>
  );
}