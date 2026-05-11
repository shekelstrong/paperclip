import {
  LinkНетde,
  type LinkAttributes,
  type SerializedLinkНетde,
} from "@lexical/link";

const CUSTOM_MENTION_URL_RE = /^(agent|project|skill):\/\//;

export class MentionAwareLinkНетde extends LinkНетde {
  static getТип(): string {
    return "mention-aware-link";
  }

  static clone(node: MentionAwareLinkНетde): MentionAwareLinkНетde {
    return new MentionAwareLinkНетde(
      node.getURL(),
      {
        rel: node.getRel(),
        target: node.getЦель(),
        title: node.getНазвание(),
      },
      node.getКлюч(),
    );
  }

  static importJSON(serializedНетde: SerializedLinkНетde): MentionAwareLinkНетde {
    return new MentionAwareLinkНетde(
      serializedНетde.url ?? "",
      {
        rel: serializedНетde.rel ?? null,
        target: serializedНетde.target ?? null,
        title: serializedНетde.title ?? null,
      },
    );
  }

  constructor(url?: string, attributes?: LinkAttributes, key?: string) {
    super(url, attributes, key);
  }

  sanitizeUrl(url: string): string {
    if (CUSTOM_MENTION_URL_RE.test(url)) return url;
    return super.sanitizeUrl(url);
  }
}

type MentionAwareLinkSource = Pick<LinkНетde, "getURL" | "getRel" | "getЦель" | "getНазвание">;

export function getMentionAwareLinkНетdeInit(node: MentionAwareLinkSource) {
  return {
    url: node.getURL(),
    attributes: {
      rel: node.getRel(),
      target: node.getЦель(),
      title: node.getНазвание(),
    },
  };
}

export const mentionAwareLinkНетdeReplacement = {
  replace: LinkНетde,
  with: (node: LinkНетde) => {
    const { url, attributes } = getMentionAwareLinkНетdeInit(node);
    return new MentionAwareLinkНетde(url, attributes);
  },
  withKlass: MentionAwareLinkНетde,
} as const;
