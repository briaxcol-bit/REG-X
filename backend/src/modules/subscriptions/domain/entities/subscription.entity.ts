import { AggregateRoot } from '@shared/domain/entities/aggregate-root'
import { Money } from '@shared/domain/value-objects/money.vo'
import { DomainEvent } from '@shared/domain/events/domain-event'
import { v4 as uuidv4 } from 'uuid'

export type SubscriptionPlan   = 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
export type BillingCycle       = 'MONTHLY' | 'ANNUAL'
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'

export interface PlanLimits {
  maxBranches:     number
  maxCashiers:     number
  maxProducts:     number
  maxUsers:        number
  offlineMode:     boolean
  apiAccess:       boolean
  advancedReports: boolean
  marketplace:     boolean
  customModules:   boolean
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE:         { maxBranches: 1, maxCashiers: 1,  maxProducts: 100,  maxUsers: 2,  offlineMode: false, apiAccess: false, advancedReports: false, marketplace: false, customModules: false },
  BASIC:        { maxBranches: 1, maxCashiers: 3,  maxProducts: 1000, maxUsers: 5,  offlineMode: true,  apiAccess: false, advancedReports: false, marketplace: true,  customModules: false },
  PROFESSIONAL: { maxBranches: 5, maxCashiers: 10, maxProducts: 10000,maxUsers: 20, offlineMode: true,  apiAccess: true,  advancedReports: true,  marketplace: true,  customModules: false },
  ENTERPRISE:   { maxBranches: -1,maxCashiers: -1, maxProducts: -1,   maxUsers: -1, offlineMode: true,  apiAccess: true,  advancedReports: true,  marketplace: true,  customModules: true  },
}

export interface SubscriptionProps {
  id:             string
  tenantId:       string
  plan:           SubscriptionPlan
  billingCycle:   BillingCycle
  status:         SubscriptionStatus
  price:          Money
  trialEndsAt?:   Date
  currentPeriodStart: Date
  currentPeriodEnd:   Date
  cancelledAt?:   Date
  cancelReason?:  string
  features:       string[]
  createdBy:      string
  createdAt:      Date
  updatedAt:      Date
}

class SubscriptionCreatedEvent extends DomainEvent {
  constructor(public readonly payload: { subscriptionId: string; tenantId: string; plan: string }) {
    super('subscription.created')
  }
}

class SubscriptionRenewedEvent extends DomainEvent {
  constructor(public readonly payload: { subscriptionId: string; tenantId: string; newPeriodEnd: string }) {
    super('subscription.renewed')
  }
}

export class Subscription extends AggregateRoot {
  private constructor(private readonly props: SubscriptionProps) { super() }

  static create(params: Omit<SubscriptionProps, 'id' | 'createdAt' | 'updatedAt'>): Subscription {
    const sub = new Subscription({
      ...params,
      id:        uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    sub.addDomainEvent(new SubscriptionCreatedEvent({
      subscriptionId: sub.id,
      tenantId:       sub.tenantId,
      plan:           sub.plan,
    }))
    return sub
  }

  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription(props)
  }

  renew(newPeriodEnd: Date): void {
    this.props.currentPeriodStart = this.props.currentPeriodEnd
    this.props.currentPeriodEnd   = newPeriodEnd
    this.props.status             = 'ACTIVE'
    this.props.updatedAt          = new Date()
    this.addDomainEvent(new SubscriptionRenewedEvent({
      subscriptionId: this.id,
      tenantId:       this.tenantId,
      newPeriodEnd:   newPeriodEnd.toISOString(),
    }))
  }

  cancel(reason: string): void {
    this.props.status       = 'CANCELLED'
    this.props.cancelledAt  = new Date()
    this.props.cancelReason = reason
    this.props.updatedAt    = new Date()
  }

  isExpired(): boolean   { return new Date() > this.props.currentPeriodEnd }
  isTrial():   boolean   { return this.props.status === 'TRIAL' }

  getLimits(): PlanLimits { return PLAN_LIMITS[this.props.plan] }

  get id():         string             { return this.props.id }
  get tenantId():   string             { return this.props.tenantId }
  get plan():       SubscriptionPlan   { return this.props.plan }
  get status():     SubscriptionStatus { return this.props.status }
  get limits():     PlanLimits         { return this.getLimits() }
  get currentPeriodEnd(): Date         { return this.props.currentPeriodEnd }
}
