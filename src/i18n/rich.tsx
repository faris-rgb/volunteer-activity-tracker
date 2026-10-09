// Helpers for dictionary texts. Plain module: safe for client and server components.

import { Fragment, type ReactNode } from "react";

/** Replaces {name} placeholders in a text (for plain strings such as metadata and messages). */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

/** Renders a text: **bold** parts become <strong>, {name} placeholders are replaced by `values`. */
export function rich(text: string, values: Record<string, ReactNode> = {}, boldClassName?: string): ReactNode {
  return text.split(/(\*\*.+?\*\*|\{\w+\})/g).map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className={boldClassName}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name !== undefined && name in values) return <Fragment key={index}>{values[name]}</Fragment>;
    return part;
  });
}
