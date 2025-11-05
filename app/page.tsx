"use client";

import { useState } from "react";

export default function Home() {
  const [sliderValues, setSliderValues] = useState({
    slider1: 50,
    slider2: 30,
  });

  const handleButtonPress = (buttonNumber: number) => {
    console.log(`Button ${buttonNumber} pressed`);
    // Button functionality will be added later
  };

  const handleSliderChange = (sliderName: string, value: number) => {
    setSliderValues((prev) => ({
      ...prev,
      [sliderName]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Algofonia
        </h1>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => handleButtonPress(num)}
              className={`
                h-20 rounded-lg font-semibold text-white text-lg
                bg-linear-to-r from-cyan-500 to-blue-500
                hover:from-cyan-600 hover:to-blue-600
                active:scale-95 transition-all duration-150
                shadow-lg hover:shadow-xl
                ${num === 5 ? "col-span-2" : ""}
              `}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-6">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Control 1: {sliderValues.slider1}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValues.slider1}
              onChange={(e) =>
                handleSliderChange("slider1", parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-2">
              Control 2: {sliderValues.slider2}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValues.slider2}
              onChange={(e) =>
                handleSliderChange("slider2", parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
