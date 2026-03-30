import React from 'react';
    import { Bug } from 'lucide-react';

    const DebugDemoPage = () => {
      return (
        <div className="container mx-auto p-8">
          <div className="max-w-2xl mx-auto text-center">
            <Bug className="mx-auto h-16 w-16 text-rose-500 mb-4" />
            <h1 className="text-4xl font-bold gradient-text mb-2">Debug Demo Page</h1>
            <p className="text-lg text-gray-600">
              This is a placeholder page for demo debugging tools.
            </p>
            <p className="mt-4 text-gray-500">
              You can add any components or information here to help with debugging during development.
            </p>
          </div>
        </div>
      );
    };

    export default DebugDemoPage;