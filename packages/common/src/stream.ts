import type CID from 'cids'
import cloneDeep from 'lodash.clonedeep'
import type { Context } from './context'
import { StreamID } from '@ceramicnetwork/streamid'
import type { CommitID } from '@ceramicnetwork/streamid'
import type { DagJWS, DagJWSResult } from 'dids'
import { Observable } from 'rxjs'
import type { RunningStateLike } from './running-state-like'
import type { CeramicApi } from './ceramic-api'
import { LoadOpts, SyncOptions } from './streamopts'

/**
 * Describes signature status
 */
export enum SignatureStatus {
  GENESIS,
  PARTIAL,
  SIGNED,
}

/**
 * Describes all anchor statuses
 */
export enum AnchorStatus {
  NOT_REQUESTED,
  PENDING,
  PROCESSING,
  ANCHORED,
  FAILED,
}

export interface CommitHeader {
  controllers: Array<string>
  family?: string
  schema?: string
  tags?: Array<string>

  [index: string]: any // allow support for future changes
}

export interface GenesisHeader extends CommitHeader {
  unique?: string
  forbidControllerChange?: boolean
}

export type GenesisCommit = {
  header: GenesisHeader
  data?: any
}

export interface RawCommit {
  id: CID
  header?: CommitHeader
  data: any
  prev: CID
}

export interface AnchorProof {
  chainId: string
  blockNumber: number
  blockTimestamp: number
  txHash: CID
  root: CID
}

export interface AnchorCommit {
  id: CID
  prev: CID
  proof: CID
  path: string
}

export type SignedCommit = DagJWS

export type SignedCommitContainer = DagJWSResult

export type CeramicCommit =
  | AnchorCommit
  | GenesisCommit
  | RawCommit
  | SignedCommit
  | SignedCommitContainer

/**
 * Stream metadata
 */
export interface StreamMetadata {
  controllers: Array<string>
  family?: string
  schema?: string
  tags?: Array<string>
  forbidControllerChange?: boolean

  [index: string]: any // allow arbitrary properties
}

/**
 * Stream information about the next iteration
 */
export interface StreamNext {
  content?: any
  controllers?: Array<string>
  metadata?: StreamMetadata
}

export enum CommitType {
  GENESIS,
  SIGNED,
  ANCHOR,
}

export interface LogEntry {
  cid: CID
  type: CommitType
  timestamp?: number
}

/**
 * Includes additional fields that significantly reduce the number of IPFS lookups required while processing commits.
 */
export interface CommitData extends LogEntry {
  commit: any
  envelope?: DagJWS
  proof?: AnchorProof
  /**
   * Do not time-check a signature.
   */
  disableTimecheck?: boolean
}

/**
 * Stream state
 */
export interface StreamState {
  type: number
  content: any
  next?: StreamNext
  metadata: StreamMetadata
  signature: SignatureStatus
  anchorStatus: AnchorStatus
  anchorScheduledFor?: number // only present when anchor status is pending
  anchorProof?: AnchorProof // the anchor proof of the latest anchor, only present when anchor status is anchored
  log: Array<LogEntry>
}

/**
 * Describes object which stores StreamState.
 *
 * Note: the interface should be removed once we refactor streams.
 *
 */
export interface StreamStateHolder {
  id: StreamID
  state: StreamState
}

/**
 * Describes common stream attributes
 */
export abstract class Stream extends Observable<StreamState> implements StreamStateHolder {
  constructor(protected readonly state$: RunningStateLike, private _context: Context) {
    super((subscriber) => {
      state$.subscribe(subscriber)
    })
  }

  get id(): StreamID {
    return new StreamID(this.state$.value.type, this.state$.value.log[0].cid)
  }

  get api(): CeramicApi {
    return this._context.api
  }

  get metadata(): StreamMetadata {
    const { next, metadata } = this.state$.value
    return cloneDeep(next?.metadata ?? metadata)
  }

  get content(): any {
    const { next, content } = this.state$.value
    return cloneDeep(next?.content ?? content)
  }

  get controllers(): Array<string> {
    return this.metadata.controllers
  }

  get tip(): CID {
    return this.state$.value.log[this.state$.value.log.length - 1].cid
  }

  get commitId(): CommitID {
    return this.id.atCommit(this.tip)
  }

  /**
   * Lists available commits
   */
  get allCommitIds(): Array<CommitID> {
    return this.state$.value.log.map(({ cid }) => this.id.atCommit(cid))
  }

  /**
   * Lists available commits that correspond to anchor commits
   */
  get anchorCommitIds(): Array<CommitID> {
    return this.state$.value.log
      .filter(({ type }) => type === CommitType.ANCHOR)
      .map(({ cid }) => this.id.atCommit(cid))
  }

  get state(): StreamState {
    return cloneDeep(this.state$.value)
  }

  async sync(opts: LoadOpts = {}): Promise<void> {
    opts = { sync: SyncOptions.PREFER_CACHE, ...opts }
    const stream = await this.api.loadStream(this.id, opts)
    this.state$.next(stream.state)
  }

  async requestAnchor(): Promise<AnchorStatus> {
    return this.api.requestAnchor(this.id)
  }

  /**
   * Makes this stream read-only. After this has been called any future attempts to call
   * mutation methods on the instance will throw.
   */
  abstract makeReadOnly(): void

  /**
   * True if 'makeReadOnly()' has been called previously.
   */
  abstract isReadOnly: boolean
}

/**
 * Stream decorator
 * @constructor
 */
export function StreamStatic<T>() {
  return <U extends T>(constructor: U): any => {
    constructor
  }
}

/**
 * Stream static signatures
 */
export interface StreamConstructor<T extends Stream> {
  /**
   * Constructor signature
   * @param state$ - Stream state
   * @param context - Ceramic context
   */
  new (state$: RunningStateLike, context: Context): T
}

/**
 * Describes stream type handler functionality
 */
export interface StreamHandler<T extends Stream> {
  /**
   * The ID number of the streamtype. This is specified by the table within CIP-59.
   */
  type: number

  /**
   * The string name of the streamtype
   */
  name: string

  /**
   * The constructor used to instantiate an instance of the handled streamtype.
   */
  stream_constructor: StreamConstructor<T>

  /**
   * Applies commit to the stream (genesis|signed|anchored)
   * @param commitData - Commit data
   * @param context - Ceramic context
   * @param state - Stream state
   */
  applyCommit(commitData: CommitData, context: Context, state?: StreamState): Promise<StreamState>
}
