import { FileTree } from "./FileTree";
import type { FileTreeProps } from "./FileTree";

export function PackageFileTree({ wrapЯрлыки = false, ...props }: FileTreeProps) {
  return <FileTree {...props} wrapЯрлыки={wrapЯрлыки} />;
}

export {
  FRONTMATTER_FIELD_LABELS,
  buildFileTree,
  collectВсеПутьs,
  countФайлы,
  parseFrontmatter,
} from "./FileTree";
export type {
  FileTreeBadge,
  FileTreeBadgeVariant,
  FileTreeEmptyState,
  FileTreeОшибкаState,
  FileTreeНетde,
  FileTreeProps,
  FileTreeTone,
  FrontmatterData,
} from "./FileTree";
