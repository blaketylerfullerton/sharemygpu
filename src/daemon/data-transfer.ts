// Chunked data transfer over gRPC — implemented in Phase 5
export class DataTransfer {
  async send(_data: Buffer, _peerId: string): Promise<void> {
    throw new Error('Not implemented: Phase 5');
  }

  async receive(_transferId: string): Promise<Buffer> {
    throw new Error('Not implemented: Phase 5');
  }
}
