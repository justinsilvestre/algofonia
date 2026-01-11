import { describe, it, expect } from "vitest";
import { getOrientationControlFromEvent } from "./getOrientationControlFromEvent";

describe("getOrientationControlFromEvent", () => {
  it("converts alpha values correctly to around", () => {
    expect({
      0: getOrientationControlFromEvent(0, 0).around,
      90: getOrientationControlFromEvent(90, 0).around,
      180: getOrientationControlFromEvent(180, 0).around,
      270: getOrientationControlFromEvent(270, 0).around,
      360: getOrientationControlFromEvent(360, 0).around,
    }).toEqual({
      0: 0,
      90: 100,
      180: 0,
      270: 100,
      360: 0,
    });
  });

  // BETA:
  // (0 = on back, 90 = upright, 180 = facing down, -90 = upside down):
  // FRONT TO BACK
  // (50 = on back, 100 = upright, 50 = facing down, 0 = upside down)

  it("converts beta values correctly to frontToBack", () => {
    expect({
      "-135": getOrientationControlFromEvent(-0, 135).frontToBack,
      "-90": getOrientationControlFromEvent(-0, 90).frontToBack,
      "-45": getOrientationControlFromEvent(-0, 45).frontToBack,
      0: getOrientationControlFromEvent(0, 0).frontToBack,
      45: getOrientationControlFromEvent(0, 45).frontToBack,
      90: getOrientationControlFromEvent(0, 90).frontToBack,
      135: getOrientationControlFromEvent(0, 135).frontToBack,
      180: getOrientationControlFromEvent(0, 180).frontToBack,
    }).toEqual({
      0: 0,
      45: 50,
      90: 100,
      135: 50,
      180: 0,
      "-135": 50,
      "-90": 100,
      "-45": 50,
    });
  });
});
