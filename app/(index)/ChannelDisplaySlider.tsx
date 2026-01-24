export function Slider({
  className,
  min,
  max,
  step,
  notchesCount = 1,
  value,
  onChange,
}: {
  className?: string;
  min: number;
  max: number;
  step: number;
  notchesCount?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className={`${className} appearance-none slider`}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={
        {
          "--steps-count": notchesCount,
        } as React.CSSProperties
      }
    />
  );
}
