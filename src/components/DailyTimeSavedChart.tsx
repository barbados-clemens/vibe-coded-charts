import React, { useState } from 'react';
import { format, addYears, isSameYear } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';

export type DailyTimeSavedDataItem = {
  workspaceId: string;
  date: string;
  timeSaved: number;
};

interface DailyTimeSavedChartProps {
  data: DailyTimeSavedDataItem[];
}

export function DailyTimeSavedChart({ data }: DailyTimeSavedChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0]?.date || new Date())
  });

  // Filter data for current year
  const filteredData = data.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameYear(itemDate, currentDate);
  });

  // Process data to create chart-friendly format with proper date formatting
  const chartData = filteredData
    .map(item => ({
      date: item.date,
      dateDisplay: format(new UTCDate(item.date), 'MMM dd'),
      monthDisplay: format(new UTCDate(item.date), 'MMM'),
      timeSavedHours: item.timeSaved / (1000 * 60 * 60), // Convert ms to hours
      timeSavedMs: item.timeSaved,
      workspaceId: item.workspaceId
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handlePrevYear = () => {
    setCurrentDate(prev => addYears(prev, -1));
  };

  const handleNextYear = () => {
    setCurrentDate(prev => addYears(prev, 1));
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <p className="text-sm text-blue-600">
            Time Saved: {data.timeSavedHours.toFixed(1)} hours
          </p>
          <p className="text-xs text-gray-500">
            ({data.timeSavedMs.toLocaleString()} ms)
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate summary statistics
  const totalTimeSavedMs = filteredData.reduce((sum, item) => sum + item.timeSaved, 0);
  const totalTimeSavedHours = totalTimeSavedMs / (1000 * 60 * 60);
  const avgTimeSavedHours = filteredData.length > 0 ? totalTimeSavedHours / filteredData.length : 0;
  const maxTimeSavedHours = Math.max(...filteredData.map(item => item.timeSaved / (1000 * 60 * 60)), 0);
  const daysWithData = filteredData.filter(item => item.timeSaved > 0).length;

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Daily Time Saved"
        displayValue={format(currentDate, 'yyyy')}
        onPrevious={handlePrevYear}
        onNext={handleNextYear}
      />
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
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
        </div>
      </div>

      {/* Time saved equivalents info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Time Saved Context</h4>
        <div className="text-xs text-gray-600">
          <p>Total time saved this year is equivalent to:</p>
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
              <XAxis 
                dataKey="dateDisplay" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval="preserveStartEnd"
                tickFormatter={(value, index) => {
                  // Show only every 30th day to reduce clutter
                  if (index % 30 === 0) return value;
                  return '';
                }}
              />
              <YAxis 
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Time Saved (hours)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="timeSavedHours" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
                connectNulls={false}
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
      {filteredData.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Performance Insights</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {totalTimeSavedHours > 1000 && (
              <p className="text-green-700">🎉 Excellent caching performance! Over 1,000 hours saved this year.</p>
            )}
            {daysWithData < filteredData.length && (
              <p className="text-yellow-600">⚠️ Some days show no time savings - consider optimizing cache strategies.</p>
            )}
            {avgTimeSavedHours > 5 && (
              <p className="text-blue-600">📈 Consistently strong performance with {avgTimeSavedHours.toFixed(1)} hours saved per day on average.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}