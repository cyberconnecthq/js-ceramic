import type { DID } from 'dids'
import { Stream, StreamHandler, CeramicCommit, AnchorStatus } from './stream'
import { CreateOpts, LoadOpts, PublishOpts, UpdateOpts } from './streamopts'
import { StreamID, CommitID } from '@ceramicnetwork/streamid'
import { LoggerProvider } from './logger-provider'
import { GenesisCommit } from '.'

/**
 * Describes Ceramic pinning functionality
 */
export interface PinApi {
  /**
   * Pin stream
   * @param streamId - Stream ID
   * @param force - If true, re-pins all stream content even if the node already believes the stream
   +  to be pinned.
   */
  add(streamId: StreamID, force?: boolean): Promise<void>

  /**
   * Unpin stream
   * @param streamId - Stream ID
   * @param opts - can be set to make the node publish the stream's current tip before unpinning it,
   *   giving other nodes on the network one last chance to capture the stream's current state before
   *   this node forgets about it.
   */
  rm(streamId: StreamID, opts?: PublishOpts): Promise<void>

  /**
   * List pinned streams
   * @param streamId - Stream ID for filtering
   */
  ls(streamId?: StreamID): Promise<AsyncIterable<string>>
}

/**
 * Describes DID provider instance
 */
export type { DIDProvider } from 'dids'

interface CeramicCommon {
  loggerProvider?: LoggerProvider
}

/**
 * Interface for an object that contains a DID that can be used to sign Ceramic commits.
 * Any implementation of CeramicAPI will match this interface, though if no CeramicAPI instance is
 * available users can provide any object containing an authenticated DID instance.
 */
export interface CeramicSigner extends CeramicCommon {
  did: DID | undefined

  [index: string]: any // allow arbitrary properties
}

/**
 * Describes Ceramic node API
 */
export interface CeramicApi extends CeramicSigner {
  pin: PinApi
  // loggerProvider: LoggerProvider; // TODO uncomment once logger is available on http-client

  /**
   * Register Stream handler
   * @param streamHandler - StreamHandler instance
   */
  addStreamHandler<T extends Stream>(streamHandler: StreamHandler<T>): void

  /**
   * Create Stream from genesis commit
   * @param type - Stream type
   * @param genesis - Genesis commit
   * @param opts - Initialization options
   */
  createStreamFromGenesis<T extends Stream>(
    type: number,
    genesis: any,
    opts?: CreateOpts
  ): Promise<T>

  /**
   * Loads Stream instance
   * @param streamId - Stream ID
   * @param opts - Initialization options
   */
  loadStream<T extends Stream>(streamId: StreamID | CommitID | string, opts?: LoadOpts): Promise<T>

  /**
   * Load all stream commits by stream ID
   * @param streamId - Stream ID
   */
  loadStreamCommits(streamId: StreamID | string): Promise<Array<Record<string, any>>>

  /**
   * Load all stream types instances for given multiqueries
   * @param queries - Array of MultiQueries
   * @param timeout - Timeout in milliseconds
   */
  multiQuery(queries: Array<MultiQuery>, timeout?: number): Promise<Record<string, Stream>>

  /**
   * Applies commit on the existing stream
   * @param streamId - Stream ID
   * @param commit - Commit to be applied
   * @param opts - Initialization options
   */
  applyCommit<T extends Stream>(
    streamId: StreamID | string,
    commit: CeramicCommit,
    opts?: CreateOpts | UpdateOpts
  ): Promise<T>

  /**
   * Requests an anchor for the given StreamID if the Stream isn't already anchored.
   * Returns the new AnchorStatus for the Stream.
   * @param streamId
   * @param opts used to load the current Stream state
   */
  requestAnchor(streamId: StreamID | string, opts?: LoadOpts): Promise<AnchorStatus>

  /**
   * Sets the DID instance that will be used to author commits to stream. The DID instance
   * also includes the DID Resolver that will be used to verify commits from others.
   * @param did
   */
  setDID(did: DID): Promise<void>

  /**
   * @returns An array of the CAIP-2 chain IDs of the blockchains that are supported for anchoring
   * stream.
   */
  getSupportedChains(): Promise<Array<string>>

  /**
   * Closes Ceramic instance
   */
  close(): Promise<void> // gracefully close the ceramic instance
}

export interface MultiQuery {
  /**
   * The genesis content for the queried stream. Useful in cases where the stream might not exist and you want to avoid timing out trying to load the genesis commit from IPFS.
   */
  genesis?: GenesisCommit
  /**
   * The StreamID of the stream to load
   */
  streamId: CommitID | StreamID | string

  /**
   * An array of paths used to look for linked stream
   */
  paths?: Array<string>

  /**
   * Load a previous version of the stream based on unix timestamp
   */
  atTime?: number
}
