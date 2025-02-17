import { PinStore } from '../pin-store'
import { StateStore } from '../state-store'
import CID from 'cids'
import {
  AnchorStatus,
  SignatureStatus,
  Stream,
  PinningBackend,
  StreamState,
  CommitType,
  TestUtils,
} from '@ceramicnetwork/common'
import { RunningState } from '../../state-management/running-state'

let stateStore: StateStore
let pinning: PinningBackend
const NETWORK = 'fakeNetwork'

beforeEach(() => {
  stateStore = {
    open: jest.fn(),
    close: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(),
    load: jest.fn(),
  }
  pinning = {
    id: 'test',
    open: jest.fn(),
    close: jest.fn(),
    pin: jest.fn(),
    unpin: jest.fn(),
    ls: jest.fn(),
    info: jest.fn(),
  }
})

const state: StreamState = {
  type: 0,
  content: { num: 0 },
  metadata: {
    controllers: [''],
  },
  signature: SignatureStatus.GENESIS,
  anchorStatus: AnchorStatus.NOT_REQUESTED,
  log: [
    { cid: new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D'), type: CommitType.GENESIS },
  ],
}

class FakeType extends Stream {
  makeReadOnly() {
    throw new Error('Method not implemented.')
  }
}

test('#open', async () => {
  const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
  pinStore.open(NETWORK)
  expect(stateStore.open).toBeCalledWith(NETWORK)
  expect(pinning.open).toBeCalled()
})

test('#close', async () => {
  const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
  await pinStore.close()
  expect(stateStore.close).toBeCalled()
  expect(pinning.close).toBeCalled()
})

describe('#add', () => {
  test('save and pin', async () => {
    const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
    const runningState = new RunningState(state, false)
    const runningStateSpy = jest.spyOn(runningState, 'markAsPinned')
    await pinStore.add(runningState)
    expect(stateStore.save).toBeCalledWith(runningState)
    expect(pinning.pin).toBeCalledTimes(1)
    expect(pinning.pin.mock.calls[0][0].toString()).toEqual(state.log[0].cid.toString())
    expect(runningStateSpy).toBeCalledTimes(1)
    expect(runningState.pinnedCommits).toEqual(new Set(state.log.map(({ cid }) => cid.toString())))
  })

  test('save and pin proof without path', async () => {
    const stateWithProof = Object.assign({}, state, {
      log: [
        { cid: new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D') },
        { cid: new CID('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm') },
      ],
    })
    const proofCID = new CID('QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR')
    const proofRootCID = new CID('QmNPqfxJDLPJFMhkUexLv431HNTfQBqh45unLg8ByBfa7h')
    const retrieve = jest.fn(async (cid) => {
      if (cid.equals(stateWithProof.log[1].cid)) {
        return {
          proof: proofCID,
        }
      }
    })
    const resolve = jest.fn(async (query: string) => {
      if (query === `${proofCID}/root`) {
        return proofRootCID
      }
    })
    const pinStore = new PinStore(stateStore, pinning, retrieve, resolve)
    const runningState = new RunningState(stateWithProof, false)
    const runningStateSpy = jest.spyOn(runningState, 'markAsPinned')
    await pinStore.add(runningState)
    expect(stateStore.save).toBeCalledWith(runningState)
    expect(pinning.pin).toBeCalledTimes(4)
    expect(pinning.pin.mock.calls[0][0].toString()).toEqual(stateWithProof.log[0].cid.toString())
    expect(pinning.pin.mock.calls[1][0].toString()).toEqual(stateWithProof.log[1].cid.toString())
    expect(pinning.pin.mock.calls[2][0].toString()).toEqual(proofCID.toString())
    expect(pinning.pin.mock.calls[3][0].toString()).toEqual(proofRootCID.toString())
    expect(runningStateSpy).toBeCalledTimes(1)
    expect(runningState.pinnedCommits).toEqual(
      new Set(stateWithProof.log.map(({ cid }) => cid.toString()))
    )
  })

  test('save and pin proof with path', async () => {
    const stateWithProof = Object.assign({}, state, {
      log: [
        { cid: new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D') },
        { cid: new CID('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm') },
      ],
    })
    const proofCID = new CID('QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR')
    const leftCID = new CID('QmdC5Hav9zdn2iS75reafXBq1PH4EnqUmoxwoxkS5QtuME')
    const rightCID = new CID('QmcyyLvDzCrduuvGVUQEh1DzFvM7UWGfc9sUg87PjjYCw7')
    const proofRootCID = new CID('QmNPqfxJDLPJFMhkUexLv431HNTfQBqh45unLg8ByBfa7h')
    const retrieve = jest.fn(async (cid) => {
      if (cid.equals(stateWithProof.log[1].cid)) {
        return {
          proof: proofCID,
          path: 'L/R',
        }
      }
    })
    const resolve = jest.fn(async (query: string) => {
      if (query === `${proofCID}/root`) {
        return proofRootCID
      } else if (query === `${proofCID}/root/L`) {
        return leftCID
      } else if (query === `${proofCID}/root/L/R`) {
        return rightCID
      }
    })
    const pinStore = new PinStore(stateStore, pinning, retrieve, resolve)
    const runningState = new RunningState(stateWithProof, false)
    const runningStateSpy = jest.spyOn(runningState, 'markAsPinned')
    await pinStore.add(runningState)
    expect(stateStore.save).toBeCalledWith(runningState)
    expect(pinning.pin).toBeCalledTimes(6)
    expect(pinning.pin.mock.calls[0][0].toString()).toEqual(stateWithProof.log[0].cid.toString())
    expect(pinning.pin.mock.calls[1][0].toString()).toEqual(stateWithProof.log[1].cid.toString())
    expect(pinning.pin.mock.calls[2][0].toString()).toEqual(proofCID.toString())
    expect(pinning.pin.mock.calls[3][0].toString()).toEqual(proofRootCID.toString())
    expect(pinning.pin.mock.calls[4][0].toString()).toEqual(leftCID.toString())
    expect(pinning.pin.mock.calls[5][0].toString()).toEqual(rightCID.toString())
    expect(runningStateSpy).toBeCalledTimes(1)
    expect(runningState.pinnedCommits).toEqual(
      new Set(stateWithProof.log.map(({ cid }) => cid.toString()))
    )
  })

  test('save and pin only new commits', async () => {
    const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
    const toBeUpdatedState = Object.assign({}, state)
    const runningState = new RunningState(toBeUpdatedState, true)
    const runningStateSpy = jest.spyOn(runningState, 'markAsPinned')
    Object.assign(toBeUpdatedState, {
      log: [
        { cid: new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D') },
        { cid: new CID('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm') },
        { cid: new CID('QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR') },
      ],
    })
    await pinStore.add(runningState)
    expect(stateStore.save).toBeCalledWith(runningState)
    expect(pinning.pin).toBeCalledTimes(2)
    expect(pinning.pin.mock.calls[0][0].toString()).toEqual(toBeUpdatedState.log[1].cid.toString())
    expect(pinning.pin.mock.calls[1][0].toString()).toEqual(toBeUpdatedState.log[2].cid.toString())
    expect(runningStateSpy).toBeCalledTimes(1)
    expect(runningState.pinnedCommits).toEqual(
      new Set(toBeUpdatedState.log.map(({ cid }) => cid.toString()))
    )
  })

  test('save and pin all commits using force', async () => {
    const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
    const toBeUpdatedState = Object.assign({}, state)
    const runningState = new RunningState(toBeUpdatedState, true)
    const runningStateSpy = jest.spyOn(runningState, 'markAsPinned')
    Object.assign(toBeUpdatedState, {
      log: [
        { cid: new CID('QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D') },
        { cid: new CID('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm') },
        { cid: new CID('QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR') },
      ],
    })
    await pinStore.add(runningState, true)
    expect(stateStore.save).toBeCalledWith(runningState)
    expect(pinning.pin).toBeCalledTimes(3)
    expect(pinning.pin.mock.calls[0][0].toString()).toEqual(toBeUpdatedState.log[0].cid.toString())
    expect(pinning.pin.mock.calls[1][0].toString()).toEqual(toBeUpdatedState.log[1].cid.toString())
    expect(pinning.pin.mock.calls[2][0].toString()).toEqual(toBeUpdatedState.log[2].cid.toString())
    expect(runningStateSpy).toBeCalledTimes(1)
    expect(runningState.pinnedCommits).toEqual(
      new Set(toBeUpdatedState.log.map(({ cid }) => cid.toString()))
    )
  })
})

test('#rm', async () => {
  const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
  const stream = new FakeType(TestUtils.runningState(state), {})
  const runningState = new RunningState(state, true)
  await pinStore.rm(runningState)
  expect(stateStore.remove).toBeCalledWith(stream.id)
  expect(pinning.unpin).toBeCalledWith(state.log[0].cid)
})

test('#ls', async () => {
  const pinStore = new PinStore(stateStore, pinning, jest.fn(), jest.fn())
  const stream = new FakeType(TestUtils.runningState(state), {})
  const list = ['1', '2', '3']
  stateStore.list = jest.fn(async () => list)
  const result = await pinStore.ls(stream.id)
  expect(result).toEqual(list)
  expect(stateStore.list).toBeCalledWith(stream.id)
})
