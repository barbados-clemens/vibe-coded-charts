import React, { useState, useMemo } from "react";
import {
  format,
  addMonths,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  getWeek,
  getYear,
  intervalToDuration,
} from "date-fns";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
} from "recharts";
import { UTCDate } from "@date-fns/utc";
import { ChartNavigation } from "./ChartNavigation";
import { CIPipelineExecution } from "./CIPipelineExecutionsChart";
import { calculateCIPEMetrics, MinimalCIPE } from "../utils/pipelineMetrics";

interface TTGResult {
  branch: string;
  firstCipeStartTime: Date;
  firstSuccessfulCipeEndTime: Date;
  ttgMinutes: number;
  cipesUntilGreen: number;
  weekStart: Date;
}

interface TimeToGreenChartProps {
  data: CIPipelineExecution[];
}

type OutlierThreshold = "none" | "p95" | "p99" | "p99.9" | "3std";

export function TimeToGreenChart({ data }: TimeToGreenChartProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return new UTCDate(data[0]?.createdAt || new Date());
  });

  const [outlierThreshold, setOutlierThreshold] =
    useState<OutlierThreshold>("none");

  // Function to filter outliers from TTG results
  const filterOutliers = (
    ttgResults: TTGResult[],
    threshold: OutlierThreshold,
  ): TTGResult[] => {
    if (threshold === "none" || ttgResults.length === 0) {
      return ttgResults;
    }

    const ttgMinutes = ttgResults
      .map((r) => r.ttgMinutes)
      .sort((a, b) => a - b);
    let upperLimit: number;

    switch (threshold) {
      case "p95":
        upperLimit = ttgMinutes[Math.floor(ttgMinutes.length * 0.95)];
        break;
      case "p99":
        upperLimit = ttgMinutes[Math.floor(ttgMinutes.length * 0.99)];
        break;
      case "p99.9":
        upperLimit = ttgMinutes[Math.floor(ttgMinutes.length * 0.999)];
        break;
      case "3std":
        const mean =
          ttgMinutes.reduce((sum, val) => sum + val, 0) / ttgMinutes.length;
        const variance =
          ttgMinutes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          ttgMinutes.length;
        const stdDev = Math.sqrt(variance);
        upperLimit = mean + 3 * stdDev;
        break;
      default:
        return ttgResults;
    }

    return ttgResults.filter((result) => result.ttgMinutes <= upperLimit);
  };

  // Calculate TTG data for the current month
  const { ttgData, originalCount, filteredCount } = useMemo(() => {
    // Filter data for current month and exclude main/master branches
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    let longCount = 0;
    const filteredData = data.filter((item) => {
      const itemDate = new UTCDate(item.createdAt);
      const duration = intervalToDuration({
        start: itemDate,
        end: new UTCDate(item.completedAt),
      });

      if (duration.hours > 2) {
        console.log(item.branch, duration);
        longCount++;
      }
      return (
        itemDate.getUTCMonth() === 6 &&
        itemDate.getUTCDate() > 7 &&
        itemDate.getUTCDate() < 21 &&
        isSameMonth(itemDate, currentDate) &&
        item.status !== "IN_PROGRESS" &&
        !["main", "master"].includes(item.branch.toLowerCase()) &&
        !isNaN(Number(item.branch)) &&
        item.branch !== "" &&
        item?.vcsContext !== null &&
        (!duration.hours || duration.hours < 2)
      );
    });

    console.log(longCount);

    // Group by branch
    const branchGroups = new Map<string, CIPipelineExecution[]>();
    for (const cipe of filteredData) {
      if (!branchGroups.has(cipe.branch)) {
        branchGroups.set(cipe.branch, []);
      }
      branchGroups.get(cipe.branch)!.push(cipe);
    }

    // Sort CIPEs within each branch by createdAt
    for (const [branch, cipes] of branchGroups) {
      cipes.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }

    // Filter out branches that never became successful
    const successfulBranchGroups = new Map<string, CIPipelineExecution[]>();
    for (const [branch, branchCipes] of branchGroups) {
      const hasSuccessfulCipe = branchCipes.some(
        (cipe) => cipe.status === "SUCCEEDED",
      );
      if (hasSuccessfulCipe) {
        successfulBranchGroups.set(branch, branchCipes);
      }
    }

    console.log("TTG Debug - Total branches:", branchGroups.size);
    console.log(
      "TTG Debug - Successful branches:",
      successfulBranchGroups.size,
    );

    // Calculate TTG for each branch
    const ttgResults: TTGResult[] = [];
    for (const [branch, branchCipes] of successfulBranchGroups) {
      const firstCipe = branchCipes[0];
      const firstSuccessfulCipe = branchCipes.find(
        (cipe) => cipe.status === "SUCCEEDED",
      );

      if (firstSuccessfulCipe && firstSuccessfulCipe.completedAt) {
        const firstCipeDate = new UTCDate(firstCipe.createdAt);
        const successfulCipeDate = new UTCDate(firstSuccessfulCipe.completedAt);

        const ttgMs = successfulCipeDate.getTime() - firstCipeDate.getTime();
        const ttgMinutes = Math.round(ttgMs / 1000 / 60);

        // Count how many CIPEs it took to get to green
        const successIndex = branchCipes.findIndex(
          (cipe) => cipe === firstSuccessfulCipe,
        );
        const cipesUntilGreen = successIndex + 1;

        // Determine which week this TTG belongs to (based on first CIPE start time)
        const weekStart = startOfWeek(firstCipeDate, { weekStartsOn: 1 }); // Monday start

        ttgResults.push({
          branch,
          firstCipeStartTime: firstCipeDate,
          firstSuccessfulCipeEndTime: successfulCipeDate,
          ttgMinutes,
          cipesUntilGreen,
          weekStart,
        });
      }
    }

    const originalCount = ttgResults.length;
    const filteredResults = filterOutliers(ttgResults, outlierThreshold);
    const filteredCount = filteredResults.length;

    return {
      ttgData: filteredResults,
      originalCount,
      filteredCount,
    };
  }, [data, currentDate, outlierThreshold]);

  // Group TTG results by week and calculate aggregated metrics
  const weeklyData = useMemo(() => {
    console.log("Debug TTG Chart:");
    console.log("Total TTG results:", ttgData.length);
    console.log("Current date:", currentDate.toString());

    if (ttgData.length === 0) {
      return [];
    }

    // Group TTG data by week key directly from the data
    const weekGroups = new Map<string, TTGResult[]>();

    for (const ttg of ttgData) {
      const weekKey = format(ttg.weekStart, "MMM dd");
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, []);
      }
      weekGroups.get(weekKey)!.push(ttg);
    }

    console.log("Week groups found:", Array.from(weekGroups.keys()));

    // Convert to array and sort by week start date
    const weeklyResults = Array.from(weekGroups.entries()).map(
      ([weekKey, weekTTGs]) => {
        const weekStart = weekTTGs[0].weekStart; // Use the actual week start from data
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

        // Calculate statistics for this week using the pipeline metrics utility
        const ttgMinutes = weekTTGs.map((r) => r.ttgMinutes);
        const cipesUntilGreen = weekTTGs.map((r) => r.cipesUntilGreen);

        // Convert TTG results to MinimalCIPE format for the utility
        const minimalCipes: MinimalCIPE[] = weekTTGs.map((ttg) => ({
          createdAt: ttg.firstCipeStartTime.toISOString(),
          completedAt: ttg.firstSuccessfulCipeEndTime.toISOString(),
          status: "SUCCEEDED", // All TTG results are successful by definition
        }));

        // Calculate metrics using the utility
        const weekMetrics = calculateCIPEMetrics(minimalCipes);
        const stats = weekMetrics.overall;

        // Convert from milliseconds to minutes for display
        const avgTTGMinutes =
          ttgMinutes.reduce((sum, val) => sum + val, 0) / ttgMinutes.length;
        const medianTTGMinutes = Math.round(stats.median / 1000 / 60);
        const p95TTGMinutes = Math.round(stats.p95 / 1000 / 60);
        const avgCipesUntilGreen =
          cipesUntilGreen.reduce((sum, val) => sum + val, 0) /
          cipesUntilGreen.length;

        const result = {
          week: weekKey,
          fullWeek: `${format(weekStart, "MMM dd")} - ${format(weekEnd, "MMM dd")}`,
          avgTTGMinutes: Math.round(avgTTGMinutes),
          medianTTGMinutes,
          totalPRs: weekTTGs.length,
          avgCipesUntilGreen: Math.round(avgCipesUntilGreen * 10) / 10,
          p95TTGMinutes,
          weekStartDate: weekStart, // Add this for sorting
        };

        return result;
      },
    );

    // Sort by week start date and return
    const sortedResults = weeklyResults.sort(
      (a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime(),
    );

    console.log("Final weekly data length:", sortedResults.length);
    return sortedResults;
  }, [ttgData, currentDate]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    console.log("TTG Summary - Total PRs:", ttgData.length);

    if (ttgData.length === 0) {
      return {
        totalPRs: 0,
        avgTTGMinutes: 0,
        medianTTGMinutes: 0,
        p95TTGMinutes: 0,
        avgCipesUntilGreen: 0,
      };
    }

    // Convert all TTG results to MinimalCIPE format for the utility
    const allMinimalCipes: MinimalCIPE[] = ttgData.map((ttg) => ({
      createdAt: ttg.firstCipeStartTime.toISOString(),
      completedAt: ttg.firstSuccessfulCipeEndTime.toISOString(),
      status: "SUCCEEDED",
    }));

    // Calculate overall metrics using the utility
    const overallMetrics = calculateCIPEMetrics(allMinimalCipes);
    const overallStats = overallMetrics.overall;

    // Calculate manual averages for comparison
    const allTTGs = ttgData.map((r) => r.ttgMinutes);
    const allCipes = ttgData.map((r) => r.cipesUntilGreen);

    const stats = {
      totalPRs: ttgData.length,
      avgTTGMinutes: Math.round(
        allTTGs.reduce((sum, val) => sum + val, 0) / allTTGs.length,
      ),
      medianTTGMinutes: Math.round(overallStats.median / 1000 / 60),
      p95TTGMinutes: Math.round(overallStats.p95 / 1000 / 60),
      avgCipesUntilGreen:
        Math.round(
          (allCipes.reduce((sum, val) => sum + val, 0) / allCipes.length) * 10,
        ) / 10,
    };

    console.log("Summary stats:", stats);
    return stats;
  }, [ttgData]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.fullWeek}</p>

          <div className="space-y-1 text-sm">
            <p className="font-medium">CIPEs Analyzed: {data.totalPRs}</p>
            {data.totalPRs > 0 && (
              <>
                <p className="text-blue-600">
                  Avg TTG: {data.avgTTGMinutes} min
                </p>
                <p className="text-green-600">
                  Median TTG: {data.medianTTGMinutes} min
                </p>
                <p className="text-purple-600">
                  P95 TTG: {data.p95TTGMinutes} min
                </p>
                <p className="text-gray-600">
                  Avg CIPEs to Green: {data.avgCipesUntilGreen}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg">
      <ChartNavigation
        title="Time to Green Analysis"
        subtitle={`Workspace: ${data[0]?.workspaceId.slice(-8) || "All"}`}
        displayValue={format(currentDate, "MMMM yyyy")}
        onPrevious={handlePrevMonth}
        onNext={handleNextMonth}
      />

      {/* Outlier Threshold Selector */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Outlier Threshold:
          </label>
          <select
            value={outlierThreshold}
            onChange={(e) =>
              setOutlierThreshold(e.target.value as OutlierThreshold)
            }
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="none">None (include all data)</option>
            <option value="p95">P95 (remove top 5%)</option>
            <option value="p99">P99 (remove top 1%)</option>
            <option value="p99.9">P99.9 (remove top 0.1%)</option>
            <option value="3std">3 Standard Deviations</option>
          </select>
          {outlierThreshold !== "none" && (
            <span className="text-xs text-blue-600 italic">
              {originalCount - filteredCount} CIPEs filtered out (
              {filteredCount} of {originalCount} remaining)
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {summaryStats.totalPRs}
            </div>
            <div className="text-sm text-gray-600">
              {outlierThreshold === "none" ? "Total CIPEs" : "CIPEs (filtered)"}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {summaryStats.avgTTGMinutes}
            </div>
            <div className="text-sm text-gray-600">Avg TTG (min)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {summaryStats.medianTTGMinutes}
            </div>
            <div className="text-sm text-gray-600">Median TTG (min)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {summaryStats.p95TTGMinutes}
            </div>
            <div className="text-sm text-gray-600">P95 TTG (min)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {summaryStats.avgCipesUntilGreen}
            </div>
            <div className="text-sm text-gray-600">Avg CIPEs to Green</div>
          </div>
        </div>
      </div>

      {weeklyData.length > 0 ? (
        <>
          {/* TTG Bar Chart with Trend Line */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Weekly Time to Green (Minutes)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="week"
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280" }}
                    label={{
                      value: "Minutes",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Bar
                    dataKey="medianTTGMinutes"
                    fill="#10b981"
                    name="Median TTG"
                  />
                  <Bar
                    dataKey="avgTTGMinutes"
                    fill="#3b82f6"
                    name="Average TTG"
                  />
                  <Bar dataKey="p95TTGMinutes" fill="#8b5cf6" name="P95 TTG" />
                  <Line
                    type="monotone"
                    dataKey="avgTTGMinutes"
                    stroke="#1e40af"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: "#1e40af", strokeWidth: 2, r: 4 }}
                    name="Average TTG Trend"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CIPE Count Bar Chart */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Weekly CIPE Count
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="week"
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fill: "#6b7280" }}
                    label={{
                      value: "CIPE Count",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  <Bar dataKey="totalPRs" fill="#3b82f6" name="CIPE Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No CIPE data for this period</p>
            <p className="text-sm">Try navigating to a different time period</p>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      {summaryStats.totalPRs > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Time to Green Insights
            {outlierThreshold !== "none" && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                (outliers filtered: {outlierThreshold})
              </span>
            )}
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            {summaryStats.avgTTGMinutes <= 60 && (
              <p className="text-green-700">
                🚀 Excellent! Average TTG under 1 hour
              </p>
            )}
            {summaryStats.avgTTGMinutes > 60 &&
              summaryStats.avgTTGMinutes <= 180 && (
                <p className="text-blue-600">
                  ✅ Good TTG performance - Average under 3 hours
                </p>
              )}
            {summaryStats.avgTTGMinutes > 180 &&
              summaryStats.avgTTGMinutes <= 480 && (
                <p className="text-yellow-600">
                  ⚠️ TTG could be improved - Average over 3 hours
                </p>
              )}
            {summaryStats.avgTTGMinutes > 480 && (
              <p className="text-red-600">
                🚨 High TTG - Consider optimizing CI performance and feedback
                loops
              </p>
            )}
            {summaryStats.avgCipesUntilGreen <= 2 && (
              <p className="text-green-700">
                💚 Low retry rate - Most PRs succeed quickly
              </p>
            )}
            {summaryStats.avgCipesUntilGreen > 3 && (
              <p className="text-orange-600">
                🔄 High retry rate - Consider improving test reliability
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
