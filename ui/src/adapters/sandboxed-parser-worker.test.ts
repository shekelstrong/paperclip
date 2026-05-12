import { describe, expect, it } from "vitest";

import { getWorkerBootstrapSource } from "./sandboxed-parser-worker";

describe("загрузчик изолированного парсера", () => {
  it("отключает дочерние воркеры", () => {
    const source = getWorkerBootstrapSource();

    expect(source).toContain("self.Worker = _undefined");
    expect(source).toContain("self.SharedWorker = _undefined");
    expect(source).toContain("self.Blob = _undefined");
    expect(source).toContain("self.RTCPeerConnection = _undefined");
    expect(source).toContain("self.RTCDataChannel = _undefined");
    expect(source).toContain('"createObjectURL"');
    expect(source).toContain('"revokeObjectURL"');
  });

  it("выполняет парсер в строгом режиме", () => {
    expect(getWorkerBootstrapSource()).toContain('\\"use strict\\";\\n{\\n" + msg.source');
  });

  it("does not include the unused parse_batch protocol branch", () => {
    expect(getWorkerBootstrapSource()).not.toContain("parse_batch");
  });
});
