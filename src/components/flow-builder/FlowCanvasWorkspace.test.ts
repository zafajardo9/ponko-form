import { describe, expect, it } from "vitest";
import { buildAutoLayout } from "./FlowCanvasWorkspace";

describe("buildAutoLayout", () => {
  it("places connected nodes in breadth-first layers", () => {
    const layout = buildAutoLayout(
      [
        { id: 1, type: "start" },
        { id: 2, type: "form_field" },
        { id: 3, type: "decision" },
        { id: 4, type: "summary" },
      ],
      [
        { sourceNodeId: 1, targetNodeId: 2 },
        { sourceNodeId: 2, targetNodeId: 3 },
        { sourceNodeId: 2, targetNodeId: 4 },
      ],
    );

    expect(layout).toEqual([
      { id: 1, positionX: 120, positionY: 60 },
      { id: 2, positionX: 120, positionY: 210 },
      { id: 3, positionX: 120, positionY: 360 },
      { id: 4, positionX: 400, positionY: 360 },
    ]);
  });

  it("terminates on cycles and keeps disconnected nodes visible", () => {
    const layout = buildAutoLayout(
      [
        { id: 1, type: "start" },
        { id: 2, type: "form_field" },
        { id: 9, type: "summary" },
      ],
      [
        { sourceNodeId: 1, targetNodeId: 2 },
        { sourceNodeId: 2, targetNodeId: 1 },
      ],
    );

    expect(layout).toEqual([
      { id: 1, positionX: 120, positionY: 60 },
      { id: 9, positionX: 400, positionY: 60 },
      { id: 2, positionX: 120, positionY: 210 },
    ]);
  });

  it("returns no layout when a flow has no start node", () => {
    expect(
      buildAutoLayout([{ id: 2, type: "summary" }], []),
    ).toEqual([]);
  });
});
