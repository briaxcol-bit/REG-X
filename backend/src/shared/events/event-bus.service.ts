import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DomainEvent } from '@shared/domain/events/domain-event'
import { AggregateRoot } from '@shared/domain/entities/aggregate-root'

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>
  publishAll(events: DomainEvent[]): Promise<void>
  publishFromAggregate(aggregate: AggregateRoot): Promise<void>
}

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name)

  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`Publishing event: ${event.eventName} [${event.eventId}]`)
    this.emitter.emit(event.eventName, event)
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)))
  }

  async publishFromAggregate(aggregate: AggregateRoot): Promise<void> {
    const events = aggregate.pullDomainEvents()
    if (events.length > 0) await this.publishAll(events)
  }
}
