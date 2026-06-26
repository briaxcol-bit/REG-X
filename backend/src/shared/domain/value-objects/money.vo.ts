/**
 * Value Object: Money
 * Immutable monetary value with currency.
 */
export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string,
  ) {
    if (_amount < 0) throw new Error(`Money amount cannot be negative: ${_amount}`)
    if (!_currency || _currency.length !== 3) throw new Error(`Invalid currency code: ${_currency}`)
  }

  static of(amount: number, currency: string): Money {
    return new Money(Math.round(amount * 100) / 100, currency.toUpperCase())
  }

  static zero(currency: string): Money {
    return new Money(0, currency.toUpperCase())
  }

  get amount(): number { return this._amount }
  get currency(): string { return this._currency }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(Math.round((this._amount + other._amount) * 100) / 100, this._currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(Math.round((this._amount - other._amount) * 100) / 100, this._currency)
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this._amount * factor * 100) / 100, this._currency)
  }

  percentage(percent: number): Money {
    return this.multiply(percent / 100)
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this._amount > other._amount
  }

  isZero(): boolean { return this._amount === 0 }

  toJSON() { return { amount: this._amount, currency: this._currency } }

  toString() { return `${this._currency} ${this._amount.toFixed(2)}` }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Currency mismatch: ${this._currency} vs ${other._currency}`)
    }
  }
}
