import React, { useState } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';

export type ContributorDataItem = {
  id: string;
  organizationId: string;
  periodEnd: string;
  periodStart: string;
  contributors: Record<string, Array<{
    ciPipelineExecutionId: string;
    triggeredAt: string;
    title: string;
  }> | undefined>;
};

interface ContributorChartProps {
  data: ContributorDataItem[];
}

export function ContributorChart({ data }: ContributorChartProps) {
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);

  // Get current period data directly by index
  const currentPeriodData = data[currentPeriodIndex] || null;

  // Process contributor data for the current period
  const contributorData = currentPeriodData ? 
    Object.entries(currentPeriodData.contributors)
      .filter(([, executions]) => executions && executions.length > 0) // Filter out undefined/empty
      .map(([contributor, executions]) => ({
        contributor,
        ciPipelineExecutions: executions!.length,
        executions: executions!
      })).sort((a, b) => b.ciPipelineExecutions - a.ciPipelineExecutions) : [];

  // Debug: Log the current data
  console.log('Current period index:', currentPeriodIndex);
  console.log('Current period data:', currentPeriodData);
  console.log('Contributor data:', contributorData);

  // Generate distinct colors for contributors
  const generateColors = (count: number) => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
      '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#059669'
    ];
    
    // If we need more colors than available, generate additional ones
    const result = [];
    for (let i = 0; i < count; i++) {
      if (i < colors.length) {
        result.push(colors[i]);
      } else {
        // Generate a color using golden angle for good distribution
        const hue = (i * 137.508) % 360;
        result.push(`hsl(${hue}, 70%, 50%)`);
      }
    }
    return result;
  };

  const colors = generateColors(contributorData.length);

  const handlePrevMonth = () => {
    setCurrentPeriodIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextMonth = () => {
    setCurrentPeriodIndex(prev => Math.min(data.length - 1, prev + 1));
  };

  // Custom tooltip to show execution details
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const contributorInfo = contributorData.find(c => c.contributor === label);
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-sm">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <p className="text-sm text-gray-600 mb-2">
            CI Pipeline Executions: {payload[0].value}
          </p>
          {contributorInfo && contributorInfo.executions.length <= 5 && (
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">Recent executions:</p>
              {contributorInfo.executions.slice(0, 3).map((execution, index) => (
                <p key={index} className="truncate">
                  • {format(new Date(execution.triggeredAt), 'MMM dd, HH:mm')}
                </p>
              ))}
              {contributorInfo.executions.length > 3 && (
                <p>... and {contributorInfo.executions.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Get period display format
  const getPeriodDisplay = () => {
    if (!currentPeriodData) return 'No Data';
    
    const start = format(new UTCDate(currentPeriodData.periodStart), 'MMM yyyy');
    return start;
  };

  // Calculate total executions
  const totalExecutions = contributorData.reduce((sum, contributor) => sum + contributor.ciPipelineExecutions, 0);

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Contributor Pipeline Executions"
        displayValue={getPeriodDisplay()}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{contributorData.length}</div>
            <div className="text-sm text-gray-500">Contributors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalExecutions}</div>
            <div className="text-sm text-gray-500">Total Executions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {contributorData.length > 0 ? Math.round(totalExecutions / contributorData.length) : 0}
            </div>
            <div className="text-sm text-gray-500">Avg per Contributor</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {contributorData.length > 0 ? contributorData[0].ciPipelineExecutions : 0}
            </div>
            <div className="text-sm text-gray-500">Most Active</div>
          </div>
        </div>
      </div>

      {contributorData.length > 0 ? (
        <div className="h-[600px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={contributorData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="contributor"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
                label={{ value: 'CI Pipeline Executions', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ciPipelineExecutions" radius={[4, 4, 0, 0]}>
                {contributorData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No contributor data for this period</p>
            <p className="text-sm">Try navigating to a different time period</p>
          </div>
        </div>
      )}

      {/* Top Contributors List */}
      {contributorData.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top Contributors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {contributorData.map((contributor, index) => (
              <div key={contributor.contributor} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colors[index] }}
                />
                <span className="font-medium text-gray-900 truncate">
                  {contributor.contributor}
                </span>
                <span className="text-gray-500">
                  ({contributor.ciPipelineExecutions})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}