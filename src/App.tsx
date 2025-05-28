import React from 'react';
import {ExecutionCreditsChart} from './components/ExecutionCreditsChart';
import {RunCountChart} from "./components/RunCountChart.tsx";
import {ComputeResourceChart} from "./components/ComputeResourceChart.tsx";
import {ContributorChart} from "./components/ContributorChart.tsx";
import { mockWorkspaceUsageData, mockOrgContribData } from './data/mockData';

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
        </div>
    );
}

export default App;