import React from 'react';

export default function DSASplitLayout({ questionPanel, codePanel }) {
  return (
    <div className="h-full p-4 lg:p-6 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6">
      <div className="w-full lg:w-1/2 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px] lg:min-h-0">
          {questionPanel}
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
        {codePanel}
      </div>
    </div>
  );
}
