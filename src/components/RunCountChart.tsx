import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  DataItem,
  calculateDailyIncrements,
  createHeatmapData,
  createLineChartData,
  getColorIntensity,
  getUniqueWorkspaceIds,
  WORKSPACE_COLORS,
  HEATMAP_COLORS
} from '../utils/chartUtils';

interface RunCountChartProps {
  data: DataItem[];
}

export function RunCountChart({ data }: RunCountChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(data[0].date)
  });
  
  const [currentYear, setCurrentYear] = useState(() => {
    return new UTCDate(data[0].date).getUTCFullYear()
  });

  // Get incremental data
  const incrementalData = calculateDailyIncrements(data, 'runCount');

  const filteredData = incrementalData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate)
  });

  // Get unique workspace IDs and formatted data
  const workspaceIds = getUniqueWorkspaceIds(filteredData);
  const formattedData = createLineChartData(filteredData, 'runCount');

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Heatmap data processing
  const weeksArray = createHeatmapData(incrementalData, currentYear, 'runCount');
  
  // Calculate max run count for color intensity
  const maxRunCount = Math.max(...weeksArray.flat().filter(Boolean).map(day => day!.value), 1);

  const handlePrevYear = () => {
    setCurrentYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(prev => prev + 1);
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Run Count"
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {workspaceIds.map((workspaceId, index) => (
          <div key={workspaceId} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length] }}
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
                stroke={WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]} 
                strokeWidth={2}
                dot={{ fill: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length], strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* GitHub-style Heatmap Chart */}
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <ChartNavigation
          title="Annual Run Count"
          displayValue={currentYear.toString()}
          onPrevious={handlePrevYear}
          onNext={handleNextYear}
        />

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
                      
                      const intensity = getColorIntensity(dayData.value, maxRunCount);

                      // Create detailed tooltip text
                      const createTooltip = () => {
                        const dateStr = format(dayData.date, 'MMM dd, yyyy');
                        if (dayData.workspaceDetails.length === 0) {
                          return `${dateStr}: No runs`;
                        }
                        
                        const workspaceLines = dayData.workspaceDetails
                          .map(detail => `Workspace ${detail.workspaceId.slice(-4)}: ${detail.value} runs`)
                          .join('\n');
                        
                        return `${dateStr}:\nTotal: ${dayData.value} runs\n${workspaceLines}`;
                      };
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`w-3 h-3 rounded-sm ${HEATMAP_COLORS.blue[intensity]} hover:ring-2 hover:ring-gray-400 cursor-pointer`}
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
            {HEATMAP_COLORS.blue.map((colorClass, index) => (
              <div key={index} className={`w-3 h-3 rounded-sm ${colorClass}`} />
            ))}
          </div>
          <div className="text-xs text-gray-500">
            More
          </div>
        </div>
      </div>
    </div>
  );
}