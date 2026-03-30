import React from 'react';

const InterestsTags = ({ interests }) => {
  if (!interests || interests.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Interests</h3>
      <div className="flex flex-wrap gap-2">
        {interests.map((interest, idx) => (
          <span
            key={idx}
            className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border border-gray-200"
          >
            {interest}
          </span>
        ))}
      </div>
    </div>
  );
};

export default InterestsTags;