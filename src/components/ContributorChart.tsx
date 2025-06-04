import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  ContributorDataItem,
  ProcessedContributor,
  TooltipProps,
  processContributorData,
  calculateContributorStats,
  generateChartColors
} from '../utils/chartUtils';

interface ContributorChartProps {
  data: ContributorDataItem[];
  // Optional pre-processed data for server-side rendering
  processedData?: ProcessedContributor[][];
}

// Custom tooltip component
interface CustomTooltipProps extends TooltipProps {
  contributorData: ProcessedContributor[];
}

const CustomTooltip = ({ active, payload, label, contributorData }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const contributorInfo = contributorData.find((c) => c.contributor === label);
    
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-sm">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <p className="text-sm text-gray-600 mb-2">
          CI Pipeline Executions: {payload[0].value}
        </p>
        {contributorInfo && contributorInfo.executions.length > 0 && (
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

export function ContributorChart({ 
  data, 
  processedData: providedProcessedData 
}: ContributorChartProps) {
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);

  // Process all periods data once or use provided data
  const allPeriodsData = useMemo(() => {
    if (providedProcessedData) return providedProcessedData;
    return data.map(period => processContributorData(period));
  }, [data, providedProcessedData]);

  // Get current period data
  const currentPeriodData = useMemo(() => 
    data[currentPeriodIndex] || null,
    [data, currentPeriodIndex]
  );

  // Get contributor data for current period
  const contributorData = useMemo(() => 
    allPeriodsData[currentPeriodIndex] || [],
    [allPeriodsData, currentPeriodIndex]
  );

  // Calculate statistics
  const stats = useMemo(() => 
    calculateContributorStats(contributorData),
    [contributorData]
  );

  // Generate colors
  const colors = useMemo(() => 
    generateChartColors(contributorData.length),
    [contributorData.length]
  );

  // Check for unknown contributors
  const hasUnknownContributors = useMemo(() => 
    contributorData.some(c => c.contributor.toLowerCase() === 'unknown'),
    [contributorData]
  );

  // Navigation handlers
  const handlePrevMonth = () => setCurrentPeriodIndex(prev => Math.max(0, prev - 1));
  const handleNextMonth = () => setCurrentPeriodIndex(prev => Math.min(data.length - 1, prev + 1));

  // Get period display format
  const getPeriodDisplay = () => {
    if (!currentPeriodData) return 'No Data';
    return format(new UTCDate(currentPeriodData.periodStart), 'MMM yyyy');
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Contributor Pipeline Executions"
        displayValue={getPeriodDisplay()}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Warning Banner for Unknown Contributors */}
      {hasUnknownContributors && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Data Collection Issue Detected
              </h3>
              <p className="text-sm text-yellow-700">
                Some pipeline executions are attributed to 'unknown' contributors. This may indicate an issue with user identification during pipeline execution. 
                Consider checking your CI/CD configuration or authentication setup to ensure proper contributor attribution.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.contributorCount}</div>
            <div className="text-sm text-gray-500">Contributors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalExecutions}</div>
            <div className="text-sm text-gray-500">Total Executions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgPerContributor}</div>
            <div className="text-sm text-gray-500">Avg per Contributor</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.mostActive}</div>
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
              <Tooltip content={
                <CustomTooltip contributorData={contributorData} />
              } />
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