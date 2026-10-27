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
    const id = url ?? asked.id;
    let data = url === undefined ? asked.data : undefined;
    let resolution: Resolution;
    try {
      if (data === undefined) {
        // A later load already replaced this one: no request for a programme nobody waits for.
        if (signal.aborted) throw new Error('aborted');
        if (id === undefined) throw new Error('a connector source needs an id or data');
        if (connector.fetch === undefined)
          throw new Error(`the ${connector.type} connector takes data only`);
        data = await connector.fetch(id, signal);
      }
      resolution = await connector.resolve(data, signal);
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
