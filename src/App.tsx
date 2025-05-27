import React from 'react';
import { ExecutionCreditsChart } from './components/ExecutionCreditsChart';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Execution Credits Analysis</h1>
        <ExecutionCreditsChart />
      </div>
    </div>
  );
}

export default App;