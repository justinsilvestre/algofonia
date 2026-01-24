import { ReactNode } from "react";

export function ChannelDisplay({
  title,
  boxContents,
  bottom,
  className = "",
}: {
  title: string;
  boxContents: ReactNode;
  bottom: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} p-2 border border-white/30 rounded-lg`}>
      <h4 className="m-0 mb-1 text-center font-mono">{title}</h4>

      {/* Display Area */}
      <div className="mb-4 rounded-lg p-3 shadow-sm border border-gray-800 bg-gray-900/30">
        {boxContents}
      </div>

      {/* Sliders */}
      <div className="space-y-2">{bottom}</div>
    </div>
  );
}
export function ChannelDisplayItem({
  className,
  label,
  value,
}: {
  className?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-300">{label}</label>
      <div className="value font-mono">{value}</div>
    </div>
  );
}
