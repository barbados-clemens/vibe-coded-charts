import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface ChartNavigationProps {
  title: string;
  displayValue: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function ChartNavigation({ title, displayValue, onPrevious, onNext }: ChartNavigationProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-4">
        <button
          onClick={onPrevious}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-lg font-medium text-gray-700">
          {displayValue}
        </span>
        <button
          onClick={onNext}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}