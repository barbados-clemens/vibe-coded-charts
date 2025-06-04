import React, { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  DataItem,
  IncrementalDataItem,
  HeatmapDayData,
  calculateIncrements,
  createHeatmapData,
  createLineChartData,
  getColorIntensity,
  getUniqueWorkspaceIds,
  filterByDateRange,
  getWorkspaceColor,
  HEATMAP_COLORS
} from '../utils/chartUtils';


interface ExecutionCreditsChartProps {
  data: DataItem[];
  // Optional pre-processed data for server-side rendering
  incrementalData?: IncrementalDataItem[];
  heatmapData?: Record<number, ReturnType<typeof createHeatmapData>>;
}

// Helper function to format heatmap tooltip
const formatHeatmapTooltip = (dayData: HeatmapDayData): string => {
  const dateStr = format(dayData.date, 'MMM dd, yyyy');
  if (dayData.workspaceDetails.length === 0) {
    return `${dateStr}: No activity`;
  }
  
  const workspaceLines = dayData.workspaceDetails
    .map(detail => `Workspace ${detail.workspaceId.slice(-4)}: ${detail.value} credits`)
    .join('\n');
  
  return `${dateStr}:\nTotal: ${dayData.value} credits\n${workspaceLines}`;
};

export function ExecutionCreditsChart({ 
  data, 
  incrementalData: providedIncrementalData,
  heatmapData: providedHeatmapData 
}: ExecutionCreditsChartProps) {
  // Initialize state
  const [currentDate, setCurrentDate] = useState(() => new UTCDate(data[0]?.date || new Date()));
  const [currentYear, setCurrentYear] = useState(() => new UTCDate(data[0]?.date || new Date()).getUTCFullYear());

  // Use provided incremental data or calculate it
  const incrementalData = useMemo(
    () => providedIncrementalData || calculateIncrements('executionCredits')(data),
    [data, providedIncrementalData]
  );

  // Filter data for current month
  const monthlyData = useMemo(() => {
    const startOfMonth = new UTCDate(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
    const endOfMonth = new UTCDate(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0);
    return filterByDateRange(startOfMonth, endOfMonth)(incrementalData);
  }, [incrementalData, currentDate]);

  // Get workspace IDs and prepare chart data
  const workspaceIds = useMemo(() => getUniqueWorkspaceIds(monthlyData), [monthlyData]);
  const lineChartData = useMemo(
    () => createLineChartData('executionCredits', workspaceIds)(monthlyData),
    [monthlyData, workspaceIds]
  );

  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Use provided heatmap data or calculate it
  const heatmapWeeks = useMemo(
    () => providedHeatmapData?.[currentYear] || createHeatmapData(incrementalData, currentYear, 'executionCredits'),
    [incrementalData, currentYear, providedHeatmapData]
  );
  
  // Calculate max credits for color intensity
  const maxCredits = useMemo(
    () => Math.max(
      ...heatmapWeeks
        .flat()
        .filter((day): day is HeatmapDayData => day !== null)
        .map(day => day.value),
      1
    ),
    [heatmapWeeks]
  );

  const handlePrevYear = () => {
    setCurrentYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(prev => prev + 1);
  };


  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Execution Credits"
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {workspaceIds.map(workspaceId => (
          <div key={workspaceId} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: getWorkspaceColor(workspaceId, workspaceIds) }}
            />
            <span className="text-sm text-gray-600">
              Workspace {workspaceId.slice(-4)}
            </span>
          </div>
        ))}
      </div>
      
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineChartData}>
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
            {workspaceIds.map(workspaceId => {
              const color = getWorkspaceColor(workspaceId, workspaceIds);
              return (
                <Line 
                  key={workspaceId}
                  type="monotone" 
                  dataKey={workspaceId} 
                  stroke={color} 
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* GitHub-style Heatmap Chart */}
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <ChartNavigation
          title="Annual Credits Usage"
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
                {heatmapWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((dayData, dayIndex) => {
                      if (!dayData) {
                        return <div key={dayIndex} className="w-3 h-3" />;
                      }
                      
                      const intensity = getColorIntensity(maxCredits)(dayData.value);
                      const tooltipText = formatHeatmapTooltip(dayData);
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`w-3 h-3 rounded-sm ${HEATMAP_COLORS.green[intensity]} hover:ring-2 hover:ring-gray-400 cursor-pointer`}
                          title={tooltipText}
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
            {HEATMAP_COLORS.green.map((colorClass, index) => (
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
