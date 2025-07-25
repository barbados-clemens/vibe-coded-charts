import React, { useState, useMemo } from "react";
import {
  format,
  addDays,
  isSameDay,
  startOfDay,
  endOfDay,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  AreaChart,
  Area,
} from "recharts";
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from "./ChartNavigation";

export interface CIPipelineExecution {
  workspaceId: string;
  ciExecutionId: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  status: string;
  cancellationRequested: string | null;
  runGroups: Array<{
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
}

interface CIPipelineExecutionsChartProps {
  data: CIPipelineExecution[];
}

export function CIPipelineExecutionsChart({
  data,
}: CIPipelineExecutionsChartProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new UTCDate(data[0]?.createdAt || new Date());
  });

  // Filter out IN_PROGRESS and get data for current month
  const filteredData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return data.filter((item) => {
      const itemDate = new UTCDate(item.createdAt);
      return (
        item.status !== "IN_PROGRESS" &&
        itemDate >= monthStart &&
        itemDate <= monthEnd &&
        item?.vcsContext !== null
      );
    });
  }, [data, currentMonth]);

  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDaysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [monthStart, monthEnd]);

  // Create chart data with daily aggregation
  const chartData = useMemo(() => {
    return allDaysInMonth.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      // Get all CIPEs for this day
      const dayData = filteredData.filter((item) => {
        const itemDate = new UTCDate(item.createdAt);
        return itemDate >= dayStart && itemDate <= dayEnd;
      });

      if (dayData.length === 0) {
        return {
          date: format(day, "MMM dd"),
          fullDate: day.toISOString(),
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          cancelledCount: 0,
          timeoutCount: 0,
          successRate: 0,
          avgDuration: 0,
        };
      }

      // Count by status
      const statusCounts = dayData.reduce(
        (acc, item) => {
          switch (item.status) {
            case "SUCCEEDED":
              acc.successCount++;
              break;
            case "FAILED":
              acc.failedCount++;
              break;
            case "CANCELLED":
              acc.cancelledCount++;
              break;
            case "TIMEOUT":
              acc.timeoutCount++;
              break;
          }
          // Calculate duration if completedAt exists
          if (item.completedAt) {
            const duration =
              new Date(item.completedAt).getTime() -
              new Date(item.createdAt).getTime();
            acc.totalDuration += duration;
          }
          return acc;
        },
        {
          successCount: 0,
          failedCount: 0,
          cancelledCount: 0,
          timeoutCount: 0,
          totalDuration: 0,
        },
      );

      const totalCount = dayData.length;
      const successRate =
        totalCount > 0 ? (statusCounts.successCount / totalCount) * 100 : 0;
      const avgDuration =
        totalCount > 0
          ? statusCounts.totalDuration / totalCount / 1000 / 60
          : 0; // Convert to minutes

      // Calculate percentages for stacked area chart
      const successPercentage =
        totalCount > 0 ? (statusCounts.successCount / totalCount) * 100 : 0;
      const failedPercentage =
        totalCount > 0 ? (statusCounts.failedCount / totalCount) * 100 : 0;
      const cancelledPercentage =
        totalCount > 0 ? (statusCounts.cancelledCount / totalCount) * 100 : 0;
      const timeoutPercentage =
        totalCount > 0 ? (statusCounts.timeoutCount / totalCount) * 100 : 0;

      return {
        date: format(day, "MMM dd"),
        fullDate: day.toISOString(),
        totalCount,
        ...statusCounts,
        successRate,
        avgDuration,
        // Percentage values for stacked area chart
        successPercentage,
        failedPercentage,
        cancelledPercentage,
        timeoutPercentage,
      };
    });
  }, [allDaysInMonth, filteredData]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = chartData.reduce(
      (acc, day) => {
        acc.totalPipelines += day.totalCount;
        acc.successCount += day.successCount;
        acc.failedCount += day.failedCount;
        acc.cancelledCount += day.cancelledCount;
        acc.timeoutCount += day.timeoutCount;
        acc.daysWithData += day.totalCount > 0 ? 1 : 0;
        acc.maxDayPipelines = Math.max(
          acc.maxDayPipelines,
          day.totalCount,
        );
        return acc;
      },
      {
        totalPipelines: 0,
        successCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        timeoutCount: 0,
        daysWithData: 0,
        maxDayPipelines: 0,
      },
    );

    return {
      ...stats,
      overallSuccessRate:
        stats.totalPipelines > 0
          ? (stats.successCount / stats.totalPipelines) * 100
          : 0,
      avgDayPipelines:
        stats.daysWithData > 0
          ? stats.totalPipelines / stats.daysWithData
          : 0,
    };
  }, [chartData]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>

          <div className="space-y-1 text-sm">
            <p className="font-medium">Total Pipelines: {data.totalCount}</p>
            <p className="text-green-600">
              Success: {data.successCount} (
              {data.successPercentage?.toFixed(1) ?? "0.0"}%)
            </p>
            <p className="text-red-600">
              Failed: {data.failedCount} (
              {data.failedPercentage?.toFixed(1) ?? "0.0"}%)
            </p>
            {data.cancelledCount > 0 && (
              <p className="text-yellow-600">
                Cancelled: {data.cancelledCount} (
                {data.cancelledPercentage?.toFixed(1) ?? "0.0"}%)
              </p>
            )}
            {data.timeoutCount > 0 && (
              <p className="text-orange-600">
                Timeout: {data.timeoutCount} (
                {data.timeoutPercentage?.toFixed(1) ?? "0.0"}%)
              </p>
            )}
          </div>

          <div className="mt-2 pt-2 border-t text-sm">
            <p className="font-medium">
              Success Rate: {data.successRate?.toFixed(1) ?? "0.0"}%
            </p>
            <p className="text-gray-600">
              Avg Duration: {data.avgDuration?.toFixed(1) ?? "0.0"} min
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="CI Pipeline Executions (Daily)"
        subtitle={`Workspace: ${data[0]?.workspaceId.slice(-8) || "All"}`}
        displayValue={format(currentMonth, "MMMM yyyy")}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />

      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summaryStats.totalPipelines}
            </div>
            <div className="text-sm text-gray-600">Total Pipelines</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {summaryStats.successCount}
            </div>
            <div className="text-sm text-gray-600">Successful</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {summaryStats.failedCount}
            </div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              {summaryStats.overallSuccessRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {summaryStats.avgDayPipelines.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg per Day</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {summaryStats.maxDayPipelines}
            </div>
            <div className="text-sm text-gray-600">Peak per Day</div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      {(summaryStats.cancelledCount > 0 || summaryStats.timeoutCount > 0) && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
          <div className="flex justify-around text-sm">
            {summaryStats.cancelledCount > 0 && (
              <div className="text-center">
                <span className="font-medium text-gray-700">Cancelled:</span>
                <span className="ml-2 text-yellow-600 font-bold">
                  {summaryStats.cancelledCount}
                </span>
              </div>
            )}
            {summaryStats.timeoutCount > 0 && (
              <div className="text-center">
                <span className="font-medium text-gray-700">Timeout:</span>
                <span className="ml-2 text-orange-600 font-bold">
                  {summaryStats.timeoutCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {chartData.length > 0 ? (
        <>
          {/* Status Distribution Area Chart */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              CIPE Status Distribution Over Time (%)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    interval={2}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280" }}
                    label={{
                      value: "Percentage (%)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                    tickFormatter={(value) =>
                      `${parseFloat(value).toFixed(0)}%`
                    }
                    allowDataOverflow={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Area
                    type="monotone"
                    dataKey="successPercentage"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    name="Success %"
                  />
                  <Area
                    type="monotone"
                    dataKey="failedPercentage"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#ef4444"
                    name="Failed %"
                  />
                  {summaryStats.cancelledCount > 0 && (
                    <Area
                      type="monotone"
                      dataKey="cancelledPercentage"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      name="Cancelled %"
                    />
                  )}
                  {summaryStats.timeoutCount > 0 && (
                    <Area
                      type="monotone"
                      dataKey="timeoutPercentage"
                      stackId="1"
                      stroke="#f97316"
                      fill="#f97316"
                      name="Timeout %"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pipeline Count Chart */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Pipeline Execution Count (Daily)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    interval={2}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280" }}
                    label={{
                      value: "Pipeline Count",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Bar
                    dataKey="successCount"
                    stackId="status"
                    fill="#10b981"
                    name="Success"
                  />
                  <Bar
                    dataKey="failedCount"
                    stackId="status"
                    fill="#ef4444"
                    name="Failed"
                  />
                  {summaryStats.cancelledCount > 0 && (
                    <Bar
                      dataKey="cancelledCount"
                      stackId="status"
                      fill="#f59e0b"
                      name="Cancelled"
                    />
                  )}
                  {summaryStats.timeoutCount > 0 && (
                    <Bar
                      dataKey="timeoutCount"
                      stackId="status"
                      fill="#f97316"
                      name="Timeout"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No pipeline data for this period</p>
            <p className="text-sm">Try navigating to a different time period</p>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      {chartData.length > 0 && summaryStats.totalPipelines > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Monthly Pipeline Performance Insights
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            {summaryStats.overallSuccessRate >= 95 && (
              <p className="text-green-700">
                🚀 Excellent pipeline reliability! Success rate above 95%
              </p>
            )}
            {summaryStats.overallSuccessRate >= 85 &&
              summaryStats.overallSuccessRate < 95 && (
                <p className="text-blue-600">
                  ✅ Good pipeline performance with{" "}
                  {summaryStats.overallSuccessRate.toFixed(1)}% success rate
                </p>
              )}
            {summaryStats.overallSuccessRate < 85 && (
              <p className="text-yellow-600">
                ⚠️ Pipeline success rate below 85% - Consider investigating
                failure patterns
              </p>
            )}
            {summaryStats.overallSuccessRate < 75 && (
              <p className="text-red-600">
                🚨 Critical: Pipeline success rate below 75% - Immediate
                attention required
              </p>
            )}
            {summaryStats.timeoutCount > summaryStats.totalPipelines * 0.05 && (
              <p className="text-orange-600">
                ⏱️ High timeout rate detected - Check pipeline duration limits
              </p>
            )}
            {summaryStats.maxDayPipelines > 100 && (
              <p className="text-purple-600">
                📊 High daily volume detected:{" "}
                {summaryStats.maxDayPipelines} pipelines in a single day
              </p>
            )}
            {summaryStats.daysWithData > 0 && (
              <p className="text-gray-700">
                📈 Pipeline activity in {summaryStats.daysWithData} of{" "}
                {allDaysInMonth.length} days (
                {(
                  (summaryStats.daysWithData /
                    allDaysInMonth.length) *
                  100
                ).toFixed(0)}
                % coverage)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

