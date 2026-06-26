import { v4 as uuidv4 } from 'uuid'

export abstract class DomainEvent {
  public readonly eventId: string
  public readonly occurredAt: Date
  public readonly eventName: string

  constructor(eventName: string) {
    this.eventId    = uuidv4()
    this.occurredAt = new Date()
    this.eventName  = eventName
  }
}
