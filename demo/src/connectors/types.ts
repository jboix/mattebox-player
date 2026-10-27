/**
 * What the demo knows of each connector besides the connector itself: a
 * name for the picker, programmes to try, and how to find more.
 */
import type { Connector } from '@mattebox/player';

/** A programme to try, as a connector's own listing names it. */
export interface Example {
  readonly id: string;
  readonly title: string;
  /** Such as `live`, or why it will not play here. */
  readonly note?: string;
}

export interface DemoConnector {
  readonly connector: Connector;
  /** The broadcaster, for the picker. */
  readonly name: string;
  /** What an id looks like, for the input's placeholder. */
  readonly placeholder: string;
  /** Programmes to try: from the broadcaster's listing, or a fixed list where it has none open. */
  examples(signal: AbortSignal): Promise<readonly Example[]>;
  /** A search over the broadcaster's catalogue, in one of `units`. */
  readonly search?: (
    query: string,
    unit: string,
    signal: AbortSignal,
  ) => Promise<readonly Example[]>;
  /** The catalogues a search can look in, such as SRG SSR's business units. */
  readonly units?: readonly string[];
}

/** The JSON at `url`, or an error that names the status. */
export async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return (await response.json()) as T;
}
