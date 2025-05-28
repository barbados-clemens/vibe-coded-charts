import React from 'react';
import {ExecutionCreditsChart} from './components/ExecutionCreditsChart';
import {RunCountChart} from "./components/RunCountChart.tsx";
import {ComputeResourceChart} from "./components/ComputeResourceChart.tsx";
import {ContributorChart} from "./components/ContributorChart.tsx";
import {MonthlySummaryChart} from "./components/MonthlySummaryChart.tsx";
import {TaskDurationChart} from "./components/TaskDurationChart.tsx";
import {WeeklyTimeSavedChart} from "./components/WeeklyTimeSavedChart.tsx";
import { mockWorkspaceUsageData, mockOrgContribData, mockDailyTaskStats, mockWorkspaceTimeSaved } from './data/mockData';

function App() {
    return (
        <div className="min-h-screen bg-gray-100 p-8 flex flex-col gap-10 mx-auto">
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Execution Credits Analysis</h1>
                <ExecutionCreditsChart data={mockWorkspaceUsageData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Run Count Analysis</h1>
                <RunCountChart data={mockWorkspaceUsageData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Compute Resource Analysis</h1>
                <ComputeResourceChart data={mockWorkspaceUsageData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Contributor Analysis</h1>
                <ContributorChart data={mockOrgContribData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Monthly Summary</h1>
                <MonthlySummaryChart data={mockWorkspaceUsageData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Task Duration Analysis</h1>
                <TaskDurationChart data={mockDailyTaskStats} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Workspace Time Saved</h1>
                <WeeklyTimeSavedChart data={mockWorkspaceTimeSaved} />
            </div>
        </div>
    );
}

export default App;