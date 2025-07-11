import React from 'react';
import {ExecutionCreditsChart} from './components/ExecutionCreditsChart';
import {RunCountChart} from "./components/RunCountChart.tsx";
import {ComputeResourceChart} from "./components/ComputeResourceChart.tsx";
import {ContributorChart} from "./components/ContributorChart.tsx";
import {MonthlySummaryChart} from "./components/MonthlySummaryChart.tsx";
import {DailyTimeSavedChart} from "./components/DailyTimeSavedChart.tsx";
import {TaskDurationAnalysisChart} from "./components/TaskDurationAnalysisChart.tsx";
import {TargetFailureAnalysisChart} from "./components/TargetFailureAnalysisChart.tsx";
import HighResolutionTargetFailureChart from "./components/HighResolutionTargetFailureChart.tsx";
import {CIPipelineExecutionsChart} from "./components/CIPipelineExecutionsChart.tsx";
import {TimeToGreenChart} from "./components/TimeToGreenChart.tsx";
import {MongoDataDashboard} from "./components/MongoDataDashboard.tsx";

// Import MongoDB JSON data
import workspaceCreditUsageData from './data/dumps/workspace-credit-usage.json';
import taskStatisticsData from './data/dumps/task-statistics.json';
import organizationContributorsData from './data/dumps/organization-contributors.json';
import ciPipelineExecutionsData from './data/dumps/ci-pipeline-executions.json';
import runsData from './data/dumps/runs.json';

function App() {
    // Transform MongoDB data to component format
    const transformedWorkspaceData = workspaceCreditUsageData.map((item) => ({
        id: `${item.workspaceId}-${item.date}`,
        organizationId: item.organizationId,
        workspaceId: item.workspaceId,
        compute: item.compute || [],
        runCount: item.runCount || 0,
        executionCredits: item.executionCredits || 0,
        date: item.date
    }));

    // Transform task statistics to time saved data
    const transformedTimeSavedData = taskStatisticsData.map(task => {
        const localCacheHitMs = task.averageDuration?.localCacheHitMs || 0;
        const remoteCacheHitMs = task.averageDuration?.remoteCacheHitMs || 0;
        const cacheMissMs = task.averageDuration?.cacheMissMs || 0;
        
        const localCacheHitRatio = task.cacheStatusRatio?.localCacheHit || 0;
        const remoteCacheHitRatio = task.cacheStatusRatio?.remoteCacheHit || 0;
        
        const totalCount = task.totalCount || 0;
        
        // Calculate time saved: (cache miss time - cache hit time) * hit count
        const localTimeSaved = Math.max(0, (cacheMissMs - localCacheHitMs) * (localCacheHitRatio * totalCount));
        const remoteTimeSaved = Math.max(0, (cacheMissMs - remoteCacheHitMs) * (remoteCacheHitRatio * totalCount));
        
        return {
            date: task.date,
            workspaceId: task.workspaceId,
            timeSaved: Math.round(localTimeSaved + remoteTimeSaved), // Component expects 'timeSaved', not 'timeSavedMs'
            totalCount: task.totalCount,
            cacheStatusRatio: task.cacheStatusRatio
        };
    }).filter(item => item.timeSaved > 0);

    // Transform organization contributors for contributor chart
    const transformedContributorData = organizationContributorsData.length > 0 
        ? [{
            id: 'org-contributors',
            organizationId: organizationContributorsData[0]?.organizationId || '',
            periodEnd: organizationContributorsData[0]?.date || '',
            periodStart: organizationContributorsData[organizationContributorsData.length - 1]?.date || '',
            contributors: organizationContributorsData.reduce((acc, item) => {
                const contributorId = `contributor-${item.contributorCount}`;
                acc[contributorId] = Array.from({length: item.contributorCount || 0}, (_, i) => ({
                    ciPipelineExecutionId: `exec-${i}`,
                    triggeredAt: item.date
                }));
                return acc;
            }, {} as Record<string, Array<{ciPipelineExecutionId: string; triggeredAt: string}>>)
        }]
        : [];

    return (
        <div className="min-h-screen bg-gray-100 p-8 flex flex-col gap-10 mx-auto">
            {/* MongoDB Data Dashboard */}
            {/*<div className="max-w-6xl">*/}
            {/*    <MongoDataDashboard />*/}
            {/*</div>*/}

            {/*<div className="max-w-6xl">*/}
            {/*    <h1 className="text-3xl font-bold text-gray-900 mb-8">Execution Credits Analysis</h1>*/}
            {/*    <ExecutionCreditsChart data={transformedWorkspaceData} />*/}
            {/*</div>*/}

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Run Count Analysis</h1>
                <RunCountChart data={transformedWorkspaceData} />
            </div>

            {/*<div className="max-w-6xl">*/}
            {/*    <h1 className="text-3xl font-bold text-gray-900 mb-8">Compute Resource Analysis</h1>*/}
            {/*    <ComputeResourceChart data={transformedWorkspaceData} />*/}
            {/*</div>*/}

            {/*<div className="max-w-6xl">*/}
            {/*    <h1 className="text-3xl font-bold text-gray-900 mb-8">Contributor Analysis</h1>*/}
            {/*    <ContributorChart data={transformedContributorData} />*/}
            {/*</div>*/}

            {/*<div className="max-w-6xl">*/}
            {/*    <h1 className="text-3xl font-bold text-gray-900 mb-8">Monthly Summary</h1>*/}
            {/*    <MonthlySummaryChart data={transformedWorkspaceData} />*/}
            {/*</div>*/}
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Daily Time Saved</h1>
                <DailyTimeSavedChart data={transformedTimeSavedData} />
            </div>
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Task Duration Analysis</h1>
                <TaskDurationAnalysisChart data={taskStatisticsData} />
            </div>
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">CI Target Failure Analysis</h1>
                <TargetFailureAnalysisChart data={taskStatisticsData} />
            </div>
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">High Resolution Target Failure Analysis</h1>
                <HighResolutionTargetFailureChart data={runsData} />
            </div>
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">CI Pipeline Executions</h1>
                <CIPipelineExecutionsChart data={ciPipelineExecutionsData} />
            </div>
            
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Time to Green Analysis</h1>
                <TimeToGreenChart data={ciPipelineExecutionsData} />
            </div>
        </div>
    );
}

export default App;