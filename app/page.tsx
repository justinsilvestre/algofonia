"use client";

import { useState } from "react";
import { useAccelerometer } from "./useAccelerometer";

export default function Home() {
  const [sliderValues, setSliderValues] = useState({
    slider1: 50,
    slider2: 30,
  });

  const { state: accelerometer, requestPermission } = useAccelerometer();

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

        {/* Accelerometer Monitor */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Accelerometer</h2>
            {accelerometer.hasPermission === null && (
              <button
                onClick={requestPermission}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
              >
                Enable
              </button>
            )}
            {accelerometer.hasPermission === false && (
              <span className="text-red-400 text-sm">Denied</span>
            )}
            {accelerometer.hasPermission === true && (
              <span className="text-green-400 text-sm">● Active</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">X</div>
              <div className="text-lg font-mono text-white">
                {accelerometer.x.toFixed(2)}
              </div>
            </div>
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">Y</div>
              <div className="text-lg font-mono text-white">
                {accelerometer.y.toFixed(2)}
              </div>
            </div>
            <div className="bg-white/10 rounded p-3">
              <div className="text-xs text-gray-300 mb-1">Z</div>
              <div className="text-lg font-mono text-white">
                {accelerometer.z.toFixed(2)}
              </div>
            </div>
          </div>

          {!accelerometer.supported && (
            <div className="mt-3 text-center text-yellow-400 text-sm">
              Accelerometer not supported on this device
            </div>
          )}
        </div>

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
