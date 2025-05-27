import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mockData } from '../data/mockData';
import { UTCDate, utc } from "@date-fns/utc";


export function ExecutionCreditsChart() {
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with UTC date from first data point
    return new UTCDate(mockData[0].date)
  });

  const filteredData = mockData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate, {in: utc})
  });

  const formattedData = filteredData.map(item => ({
    date: format(new UTCDate(item.date), 'MMM dd', { timeZone: 'UTC' }),
    credits: item.executionCredits,
  }));

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new UTCDate(
        prev.getUTCFullYear(),
        prev.getUTCMonth() === 0 ? 12 : prev.getUTCMonth() - 1,
        1
      );
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new UTCDate(
        prev.getUTCFullYear(),
        prev.getUTCMonth() === 11 ? 0 : prev.getUTCMonth() + 1,
        1
      );
      return newDate;
    });
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Execution Credits</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-medium text-gray-700">
            {format(currentDate, 'MMMM yyyy', { timeZone: 'UTC' })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
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
            <Line 
              type="monotone" 
              dataKey="credits" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}