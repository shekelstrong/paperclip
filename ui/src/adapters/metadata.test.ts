import { describe, expect, it } from "vitest";
import {
  isEnabledAdapterType,
  isValidAdapterType,
  isVisualAdapterChoice,
  listAdapterOptions,
} from "./metadata";
import type { UIAdapterModule } from "./types";

const externalAdapter: UIAdapterModule = {
  type: "external_test",
  label: "Внешний тест",
  parseStdoutLine: () => [],
  ConfigFields: () => null,
  buildAdapterConfig: () => ({}),
};

describe("метаданные адаптера", () => {
  it("внешние адаптеры по умолчанию включены", () => {
    expect(isEnabledAdapterType("external_test")).toBe(true);

    expect(
      listAdapterOptions((type) => type, [externalAdapter]),
    ).toEqual([
      {
        value: "external_test",
        label: "external_test",
        comingSoon: false,
        hidden: false,
        experimental: false,
      },
    ]);
  });

  it("оставляет скрытые встроенные адаптеры помеченными", () => {
    expect(isEnabledAdapterType("process")).toBe(false);
    expect(isEnabledAdapterType("http")).toBe(false);
  });

  it("оставляет ACPX выбираемым вручную", () => {
    expect(isEnabledAdapterType("acpx_local")).toBe(true);
    expect(isValidAdapterType("acpx_local")).toBe(true);
    expect(isVisualAdapterChoice("acpx_local")).toBe(false);

    expect(
      listAdapterOptions((type) => type, [
        {
          ...externalAdapter,
          type: "acpx_local",
        },
      ]),
    ).toEqual([
      {
        value: "acpx_local",
        label: "acpx_local",
        comingSoon: false,
        hidden: false,
        experimental: true,
      },
    ]);
  });
});
