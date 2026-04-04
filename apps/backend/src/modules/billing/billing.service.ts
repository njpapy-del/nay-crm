import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe');
type StripeInstance = InstanceType<typeof StripeLib>;

@Injectable()
export class BillingService {
  private stripe: StripeInstance | null = null;
  private readonly logger = new Logger(BillingService.name);

  constructor(private config: ConfigService, private prisma: PrismaService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new StripeLib(key, { apiVersion: '2025-03-31.basil' });
      this.logger.log('Stripe activé');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY non configuré — billing désactivé');
    }
  }

  get isEnabled() { return !!this.stripe; }

  async getOrCreateCustomer(tenantId: string): Promise<string> {
    if (!this.stripe) throw new Error('Stripe non configuré');
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const customer = await this.stripe.customers.create({ name: tenant?.name, metadata: { tenantId } });
    if (sub) {
      await this.prisma.subscription.update({ where: { tenantId }, data: { stripeCustomerId: customer.id } });
    }
    return customer.id;
  }

  async createCheckoutSession(tenantId: string, planCode: string, returnUrl: string) {
    if (!this.stripe) throw new Error('Stripe non configuré');
    const customerId = await this.getOrCreateCustomer(tenantId);
    const priceId = this.config.get<string>(`STRIPE_PRICE_${planCode.toUpperCase()}`);
    if (!priceId) throw new Error(`Prix Stripe non configuré pour ${planCode}`);
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}/account/subscription?success=1`,
      cancel_url: `${returnUrl}/account/subscription?cancelled=1`,
      metadata: { tenantId, planCode },
    });
  }

  async createPortalSession(tenantId: string, returnUrl: string) {
    if (!this.stripe) throw new Error('Stripe non configuré');
    const customerId = await this.getOrCreateCustomer(tenantId);
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${returnUrl}/account/subscription`,
    });
  }

  async handleWebhook(payload: Buffer, sig: string) {
    if (!this.stripe) throw new Error('Stripe non configuré');
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(payload, sig, secret);
    } catch (e: any) {
      throw new Error(`Webhook invalide: ${e.message}`);
    }
    await this._processEvent(event);
    return { received: true };
  }

  private async _processEvent(event: any) {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        const tenantId = stripeSub.metadata?.tenantId;
        if (!tenantId) break;
        const status = stripeSub.status === 'active' ? 'ACTIVE'
          : stripeSub.status === 'past_due' ? 'PAST_DUE'
          : stripeSub.status === 'canceled' ? 'CANCELLED' : 'SUSPENDED';
        await this.prisma.subscription.updateMany({
          where: { tenantId },
          data: { status, stripeSubId: stripeSub.id, currentPeriodEnd: new Date(stripeSub.current_period_end * 1000) },
        });
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object;
        const sub = await this.prisma.subscription.findFirst({ where: { stripeCustomerId: inv.customer } });
        if (sub) {
          await this.prisma.billingInvoice.create({
            data: {
              subscriptionId: sub.id,
              amount: inv.amount_paid / 100,
              currency: inv.currency.toUpperCase(),
              status: 'PAID',
              stripeInvoiceId: inv.id,
              paidAt: new Date(),
              periodStart: new Date(inv.period_start * 1000),
              periodEnd: new Date(inv.period_end * 1000),
            },
          });
        }
        break;
      }
      default: break;
    }
  }
}
