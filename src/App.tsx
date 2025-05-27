import React from 'react';
import {ExecutionCreditsChart} from './components/ExecutionCreditsChart';
import {RunCountChart} from "./components/RunCountChart.tsx";
import {ComputeResourceChart} from "./components/ComputeResourceChart.tsx";
import { mockData } from './data/mockData';

function App() {
    return (
        <div className="min-h-screen bg-gray-100 p-8 flex flex-col gap-10 mx-auto">
            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Execution Credits Analysis</h1>
                <ExecutionCreditsChart data={mockData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Run Count Analysis</h1>
                <RunCountChart data={mockData} />
            </div>

            <div className="max-w-6xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Compute Resource Analysis</h1>
                <ComputeResourceChart data={mockData} />
            </div>
        </div>
    );
}

export default App;