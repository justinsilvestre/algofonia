export type VisualsInterface<T> = {
  state: T;
  onResize: () => void;
  onPositionsUpdate?: (positions: VisitorPosition[]) => void; // Optional function to update positions
  start: () => void;
  stop: () => void;
};

export type VisitorPosition = {
  personId: number;
  x: number;
  y: number;
  handsRaised: boolean;
};
