/**
 * Label templates: `{name}` in an attribute's text is replaced from the
 * values the element has, and a name it does not have stays as written.
 * Pure, node-tested.
 */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
