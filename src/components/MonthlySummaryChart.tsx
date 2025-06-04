import React, { useState } from 'react';
import { format, addMonths, isSameMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from './ChartNavigation';
import {
  DataItem,
  calculateIncrements,
  calculateComputeIncrements,
  getUniqueWorkspaceIds,
  getUniqueResourceClasses,
  WORKSPACE_COLORS
} from '../utils/chartUtils';

interface MonthlySummaryChartProps {
  data: DataItem[];
}

export function MonthlySummaryChart({ data }: MonthlySummaryChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0].date)
  });

  // Get incremental data for both execution credits and compute resources
  const incrementalExecutionData = calculateIncrements('executionCredits')(data);
  const incrementalComputeData = calculateComputeIncrements(data);

  // Filter data for current month
  const filteredExecutionData = incrementalExecutionData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate);
  });

  const filteredComputeData = incrementalComputeData.filter(item => {
    const itemDate = new UTCDate(item.date);
    return isSameMonth(itemDate, currentDate);
  });

  // Get unique identifiers
  const workspaceIds = getUniqueWorkspaceIds(filteredExecutionData);
  const resourceClasses = getUniqueResourceClasses(filteredComputeData);

  // Process execution credits data (outer ring)
  const executionCreditsData = workspaceIds.map((workspaceId, index) => {
    const totalCredits = filteredExecutionData
      .filter(item => item.workspaceId === workspaceId)
      .reduce((sum, item) => sum + item.executionCredits, 0);
    
    return {
      name: `Workspace ${workspaceId.slice(-4)}`,
      value: totalCredits,
      workspaceId: workspaceId,
      color: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]
    };
  }).filter(item => item.value > 0);

  // Process compute resources data (inner ring)
  const computeResourceColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  const computeResourcesData = resourceClasses.map((resourceClass, index) => {
    const totalCredits = filteredComputeData
      .reduce((sum, item) => {
        const resourceUsage = item.compute
          .filter(compute => compute.resourceClass === resourceClass)
          .reduce((computeSum, compute) => computeSum + compute.credits, 0);
        return sum + resourceUsage;
      }, 0);
    
    return {
      name: resourceClass.split('/')[1] || resourceClass,
      fullName: resourceClass,
      value: totalCredits,
      color: computeResourceColors[index % computeResourceColors.length]
    };
  }).filter(item => item.value > 0);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Custom tooltips
  const ExecutionTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            Execution Credits: {data.value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const ComputeTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.fullName}</p>
          <p className="text-sm text-gray-600">
            Compute Credits: {data.value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate totals
  const totalExecutionCredits = executionCreditsData.reduce((sum, item) => sum + item.value, 0);
  const totalComputeCredits = computeResourcesData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Monthly Summary: Credits vs Resources"
        displayValue={format(currentDate, 'MMMM yyyy')}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />
      
      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalExecutionCredits.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Execution Credits</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalComputeCredits.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Compute Credits</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{workspaceIds.length}</div>
            <div className="text-sm text-gray-500">Active Workspaces</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{resourceClasses.length}</div>
            <div className="text-sm text-gray-500">Resource Classes</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Execution Credits Chart */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Execution Credits by Workspace</h3>
          {executionCreditsData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={executionCreditsData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {executionCreditsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ExecutionTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: { color: string }) => (
                      <span style={{ color: entry.color }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500">
              <p>No execution credit data for this period</p>
            </div>
          )}
        </div>

        {/* Compute Resources Chart */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Compute Credits by Resource Class</h3>
          {computeResourcesData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={computeResourcesData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {computeResourcesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ComputeTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: { color: string }) => (
                      <span style={{ color: entry.color }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500">
              <p>No compute resource data for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Execution Credits Breakdown */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Execution Credits Breakdown</h4>
          <div className="space-y-2">
            {executionCreditsData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {item.value.toLocaleString()} 
                  <span className="text-gray-500 ml-1">
                    ({((item.value / totalExecutionCredits) * 100).toFixed(1)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Compute Resources Breakdown */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Compute Credits Breakdown</h4>
          <div className="space-y-2">
            {computeResourcesData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.fullName}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {item.value.toLocaleString()}
                  <span className="text-gray-500 ml-1">
                    ({((item.value / totalComputeCredits) * 100).toFixed(1)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}