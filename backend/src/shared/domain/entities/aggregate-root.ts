import { DomainEvent } from '../events/domain-event'

/**
 * Base class for all Aggregate Roots.
 * Holds a collection of uncommitted domain events.
 */
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = []

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents]
    this._domainEvents = []
    return events
  }

  public hasDomainEvents(): boolean {
    return this._domainEvents.length > 0
  }
}
