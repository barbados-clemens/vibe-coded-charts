import React from 'react';
// Import JSON files directly
import workspaceCreditUsageData from '../data/dumps/workspace-credit-usage.json';
import taskStatisticsData from '../data/dumps/task-statistics.json';
import workspaceRunCountsData from '../data/dumps/workspace-run-counts.json';

// Example component using raw MongoDB data
export function MongoDataDashboard() {
  // Calculate some basic metrics from raw data
  const totalCredits = workspaceCreditUsageData.reduce((sum, item) => sum + (item.executionCredits || 0), 0);
  const totalRuns = workspaceCreditUsageData.reduce((sum, item) => sum + (item.runCount || 0), 0);
  
  // Calculate average cache hit rates from task statistics
  const avgLocalCacheHit = taskStatisticsData.length > 0 
    ? taskStatisticsData.reduce((sum, task) => sum + (task.cacheStatusRatio?.localCacheHit || 0), 0) / taskStatisticsData.length
    : 0;
  
  const avgRemoteCacheHit = taskStatisticsData.length > 0
    ? taskStatisticsData.reduce((sum, task) => sum + (task.cacheStatusRatio?.remoteCacheHit || 0), 0) / taskStatisticsData.length
    : 0;

  // Get workspace breakdown
  const workspaceBreakdown = workspaceCreditUsageData.reduce((acc, item) => {
    if (!acc[item.workspaceId]) {
      acc[item.workspaceId] = { credits: 0, runs: 0 };
    }
    acc[item.workspaceId].credits += item.executionCredits || 0;
    acc[item.workspaceId].runs += item.runCount || 0;
    return acc;
  }, {} as Record<string, { credits: number; runs: number }>);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">MongoDB Data Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700">Total Credits</h3>
          <p className="text-3xl font-bold text-blue-600">{totalCredits.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Last 30 days</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700">Total Runs</h3>
          <p className="text-3xl font-bold text-green-600">{totalRuns.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Last 30 days</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700">Local Cache Hit Rate</h3>
          <p className="text-3xl font-bold text-purple-600">{(avgLocalCacheHit * 100).toFixed(1)}%</p>
          <p className="text-sm text-gray-500">Average across tasks</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700">Remote Cache Hit Rate</h3>
          <p className="text-3xl font-bold text-orange-600">{(avgRemoteCacheHit * 100).toFixed(1)}%</p>
          <p className="text-sm text-gray-500">Average across tasks</p>
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Data Summary</h3>
          <div className="space-y-2 text-sm">
            <p>Workspace Credit Usage: <span className="font-mono">{workspaceCreditUsageData.length} records</span></p>
            <p>Task Statistics: <span className="font-mono">{taskStatisticsData.length} records</span></p>
            <p>Workspace Run Counts: <span className="font-mono">{workspaceRunCountsData.length} records</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Date Range</h3>
          <div className="space-y-2 text-sm">
            {workspaceCreditUsageData.length > 0 && (
              <>
                <p>Latest: <span className="font-mono">{new Date(workspaceCreditUsageData[0].date).toLocaleDateString()}</span></p>
                <p>Oldest: <span className="font-mono">{new Date(workspaceCreditUsageData[workspaceCreditUsageData.length - 1].date).toLocaleDateString()}</span></p>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Workspaces</h3>
          <div className="space-y-2 text-sm">
            <p>Total: <span className="font-mono">{Object.keys(workspaceBreakdown).length}</span></p>
            <p>Most Active: <span className="font-mono text-xs">
              {Object.entries(workspaceBreakdown)
                .sort(([,a], [,b]) => b.runs - a.runs)[0]?.[0]?.slice(-8) || 'N/A'}
            </span></p>
          </div>
        </div>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Workspace Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Workspace Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Workspace ID</th>
                  <th className="text-right p-2">Credits</th>
                  <th className="text-right p-2">Runs</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(workspaceBreakdown)
                  .sort(([,a], [,b]) => b.credits - a.credits)
                  .slice(0, 8)
                  .map(([workspaceId, data]) => (
                  <tr key={workspaceId} className="border-b">
                    <td className="p-2 font-mono text-xs">{workspaceId.slice(-8)}</td>
                    <td className="p-2 text-right">{data.credits.toLocaleString()}</td>
                    <td className="p-2 text-right">{data.runs.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Task Statistics */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Recent Task Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Project</th>
                  <th className="text-left p-2">Target</th>
                  <th className="text-right p-2">Count</th>
                  <th className="text-right p-2">Cache %</th>
                </tr>
              </thead>
              <tbody>
                {taskStatisticsData.slice(0, 10).map((task, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 truncate max-w-32">{task.projectName}</td>
                    <td className="p-2 truncate max-w-24">{task.target}</td>
                    <td className="p-2 text-right">{task.totalCount}</td>
                    <td className="p-2 text-right">
                      {((task.cacheStatusRatio?.localCacheHit || 0) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Raw Data Access Examples */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Direct JSON Import Usage</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium">Import JSON files directly:</h4>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`// Import raw MongoDB JSON dumps directly
import workspaceCreditUsageData from '../data/dumps/workspace-credit-usage.json';
import taskStatisticsData from '../data/dumps/task-statistics.json';
import workspaceRunCountsData from '../data/dumps/workspace-run-counts.json';`}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium">Access MongoDB fields directly:</h4>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`// Use raw MongoDB field names
const totalCredits = workspaceCreditUsageData.reduce((sum, item) => 
  sum + (item.executionCredits || 0), 0);

const avgCacheHit = taskStatisticsData.reduce((sum, task) => 
  sum + (task.cacheStatusRatio?.localCacheHit || 0), 0) / taskStatisticsData.length;

// Date filtering (if needed)
const recentData = workspaceCreditUsageData.filter(item => 
  new Date(item.date) > new Date('2025-06-01'));`}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium">Available MongoDB fields:</h4>
            <div className="bg-white p-3 rounded text-xs overflow-x-auto">
              <p><strong>workspace-credit-usage.json:</strong> {workspaceCreditUsageData.length > 0 ? Object.keys(workspaceCreditUsageData[0]).join(', ') : 'No data'}</p>
              <p><strong>task-statistics.json:</strong> {taskStatisticsData.length > 0 ? Object.keys(taskStatisticsData[0]).join(', ') : 'No data'}</p>
              <p><strong>workspace-run-counts.json:</strong> {workspaceRunCountsData.length > 0 ? Object.keys(workspaceRunCountsData[0]).join(', ') : 'No data'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}