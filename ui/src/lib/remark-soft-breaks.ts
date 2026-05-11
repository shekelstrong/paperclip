type MarkdownНетde = {
  type?: unknown;
  value?: unknown;
  children?: unknown;
};

type MarkdownTextНетde = {
  type: "text";
  value: string;
};

type MarkdownBreakНетde = {
  type: "break";
};

type MarkdownРодительНетde = {
  children: MarkdownTreeНетde[];
};

type MarkdownTreeНетde = MarkdownTextНетde | MarkdownBreakНетde | (MarkdownНетde & { children?: MarkdownTreeНетde[] });

function isРодительНетde(value: unknown): value is MarkdownРодительНетde {
  return typeof value === "object" && value !== null && Array.isArray((value as MarkdownНетde).children);
}

function buildSoftBreakReplacement(value: string): Array<MarkdownTextНетde | MarkdownBreakНетde> {
  const parts = value.split("\n");
  const replacement: Array<MarkdownTextНетde | MarkdownBreakНетde> = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.length > 0) {
      replacement.push({ type: "text", value: part });
    }
    if (index < parts.length - 1) {
      replacement.push({ type: "break" });
    }
  }

  return replacement.length > 0 ? replacement : [{ type: "text", value: "" }];
}

function transformНетde(node: MarkdownTreeНетde) {
  if (!isРодительНетde(node)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (child?.type === "text" && typeof child.value === "string" && child.value.includes("\n")) {
      const replacement = buildSoftBreakReplacement(child.value);
      node.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
      continue;
    }

    transformНетde(child);
  }
}

export function remarkSoftBreaks() {
  return (tree: MarkdownTreeНетde) => {
    transformНетde(tree);
  };
}
