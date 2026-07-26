import { v4 as uuidv4, validate as isUuid } from 'uuid'

export class TenantId {
  private constructor(private readonly _value: string) {
    if (!isUuid(_value)) throw new Error(`Invalid TenantId: ${_value}`)
  }

  static create(): TenantId { return new TenantId(uuidv4()) }
  static from(value: string): TenantId { return new TenantId(value) }

  get value(): string { return this._value }
  equals(other: TenantId): boolean { return this._value === other._value }
  toString(): string { return this._value }
}
