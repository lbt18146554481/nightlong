import { describe, expect, it } from "vitest";
import {
  approximateCoordinate,
  districtIdFromLabel,
  nearestHongKongDistrict,
} from "../../src/lib/hk-location";

describe("Hong Kong location helpers", () => {
  it("finds the nearest district for a coordinate in Sha Tin", () => {
    expect(nearestHongKongDistrict(22.386, 114.197)?.id).toBe("sha_tin");
  });

  it("does not infer a Hong Kong district outside Hong Kong", () => {
    expect(nearestHongKongDistrict(51.5072, -0.1276)).toBeNull();
  });

  it("recognises stored district labels in all supported languages", () => {
    expect(districtIdFromLabel("Sha Tin")).toBe("sha_tin");
    expect(districtIdFromLabel("沙田区")).toBe("sha_tin");
    expect(districtIdFromLabel("沙田區")).toBe("sha_tin");
  });

  it("removes precise coordinate detail before storage", () => {
    expect(approximateCoordinate(22.387123)).toBe(22.39);
    expect(approximateCoordinate(114.195345)).toBe(114.2);
  });
});
