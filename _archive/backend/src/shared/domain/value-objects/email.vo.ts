const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Email {
  private constructor(private readonly _value: string) {
    if (!EMAIL_REGEX.test(_value)) throw new Error(`Invalid email: ${_value}`)
  }

  static from(value: string): Email {
    return new Email(value.trim().toLowerCase())
  }

  get value(): string { return this._value }
  equals(other: Email): boolean { return this._value === other._value }
  toString(): string { return this._value }
}
