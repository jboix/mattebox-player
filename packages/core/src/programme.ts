/**
 * The connector step of a load. Each connector source of the list becomes
 * the sources its connector resolves it to, in its place, and a plain
 * source stays as it is. The routing by type is video.js middleware's
 * (`videojs.use(type, …)`); the split between fetching the data and
 * resolving it is pillarbox-apple's asset loader, with one change: data
 * the page already has skips the fetch.
 */
import type {
  Block,
  Connector,
  ConnectorSource,
  PlayerError,
  Programme,
  ProgrammeMetadata,
  ProgrammeSource,
  Resolution,
  Source,
} from './types.js';

/** A connector source failed to resolve. The load reports `error` and stops. */
export class ConnectorFailure extends Error {
  declare readonly error: PlayerError;

  constructor(error: PlayerError) {
    super(error.code);
    this.error = error;
  }
}

function failure(
  code: string,
  type: string,
  id: string | undefined,
  cause?: unknown,
): ConnectorFailure {
  return new ConnectorFailure({
    category: 'connector',
    code,
    fatal: true,
    recoverable: false,
    handler: null,
    context: {
      type,
      ...(id === undefined ? {} : { id }),
      ...(cause === undefined ? {} : { message: String((cause as Error)?.message ?? cause) }),
    },
  });
}

/** What a connector made of one source: the data it fetched or was given, and its resolution. */
export interface Resolved {
  readonly data: unknown;
  readonly resolution: Resolution;
}

/**
 * A resolution made before the load, such as by `preload`, for the
 * connector source of this type, id and data. Undefined when there is none.
 */
export type Take = (
  type: string,
  id: string | undefined,
  data: unknown,
  signal: AbortSignal,
) => Promise<Resolved> | undefined;

/** The id and the data a connector source gives: a plain source of a connector's type names its id by URL. */
export function partsOf(input: ProgrammeSource): { id: string | undefined; data: unknown } {
  if ('url' in input && input.url !== undefined) return { id: input.url, data: undefined };
  const asked = input as ConnectorSource;
  return { id: asked.id, data: asked.data };
}

/** Fetches the data when the source has none, then resolves it. Throws what the connector throws. */
export async function run(
  connector: Connector,
  id: string | undefined,
  given: unknown,
  signal: AbortSignal,
): Promise<Resolved> {
  let data = given;
  if (data === undefined) {
    // A later load already replaced this one: no request for a programme nobody waits for.
    if (signal.aborted) throw new Error('aborted');
    if (id === undefined) throw new Error('a connector source needs an id or data');
    if (connector.fetch === undefined)
      throw new Error(`the ${connector.type} connector takes data only`);
    data = await connector.fetch(id, signal);
  }
  return { data, resolution: await connector.resolve(data, signal) };
}

/** The connector for `source`, or undefined for a source that goes to the handlers as it is. */
export function connectorFor(
  source: ProgrammeSource,
  connectors: readonly Connector[],
): Connector | undefined {
  return source.type === undefined
    ? undefined
    : connectors.find((connector) => connector.type === source.type);
}

/**
 * Resolves `given` into one programme. The first connector source names
 * the programme: its type, id, data, metadata and block. A resolution
 * with a block adds no sources, and the programme's block means nothing
 * loads.
 */
export async function expand(
  given: readonly ProgrammeSource[],
  connectors: readonly Connector[],
  signal: AbortSignal,
  take?: Take,
): Promise<Programme> {
  const sources: Source[] = [];
  let named: {
    type: string;
    id?: string;
    data: unknown;
    metadata?: ProgrammeMetadata;
    block?: Block;
  } | null = null;
  for (const input of given) {
    const connector = connectorFor(input, connectors);
    const url = 'url' in input ? input.url : undefined;
    if (url !== undefined && connector === undefined) {
      sources.push(input as Source);
      continue;
    }
    const asked = input as ConnectorSource;
    if (connector === undefined) throw failure('CONNECTOR_UNKNOWN', asked.type, asked.id);
    // A plain source of a connector's type, as the `src` and `type` attributes give it, names its id by URL.
    const { id, data: given } = partsOf(input);
    let data: unknown;
    let resolution: Resolution;
    try {
      // A preload of the same programme resolved it already. If that failed,
      // the load asks again: the failure may have been the network's.
      const kept = take?.(connector.type, id, given, signal);
      const resolved = await (kept === undefined
        ? run(connector, id, given, signal)
        : kept.catch(() => run(connector, id, given, signal)));
      data = resolved.data;
      resolution = resolved.resolution;
    } catch (cause) {
      // A newer load aborted this one: its own outcome is the one to report.
      if (signal.aborted) throw cause;
      throw failure('CONNECTOR_FAILED', connector.type, id, cause);
    }
    if (named === null) {
      named = {
        type: connector.type,
        ...(id === undefined ? {} : { id }),
        data,
        ...(resolution.metadata === undefined ? {} : { metadata: resolution.metadata }),
        ...(resolution.block === undefined ? {} : { block: resolution.block }),
      };
    }
    if (resolution.block === undefined) sources.push(...resolution.sources);
  }
  if (named !== null && named.block === undefined && sources.length === 0) {
    throw failure('CONNECTOR_NO_SOURCE', named.type, named.id);
  }
  return { given, sources, ...(named ?? {}) };
}
