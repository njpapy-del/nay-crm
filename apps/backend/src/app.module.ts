import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProductsModule } from './modules/products/products.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CallsModule } from './modules/calls/calls.module';
import { SupervisionModule } from './modules/supervision/supervision.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ContactListModule } from './modules/lists/contact-list.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ImportsModule } from './modules/imports/imports.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { RecyclingModule } from './modules/recycling/recycling.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { CallLogsModule } from './modules/call-logs/call-logs.module';
import { SalesModule } from './modules/sales/sales.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { QualificationsModule } from './modules/qualifications/qualifications.module';
import { AgentStatusModule } from './modules/agent-status/agent-status.module';
import { PlanningModule } from './modules/planning/planning.module';
import { StorageModule } from './modules/storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './modules/queue/queue.module';
import { AiAnalyticsModule } from './modules/ai-analytics/ai-analytics.module';
import { WorkersModule } from './modules/workers/workers.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('jwt.secret'),
        signOptions: { expiresIn: cfg.get('jwt.expiresIn') },
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProductsModule,
    QuotesModule,
    InvoicesModule,
    CampaignsModule,
    LeadsModule,
    AppointmentsModule,
    CallsModule,
    SupervisionModule,
    RealtimeModule,
    ContactListModule,
    ContactsModule,
    ImportsModule,
    BlacklistModule,
    RecyclingModule,
    RecordingsModule,
    CallLogsModule,
    SalesModule,
    AgendaModule,
    SessionsModule,
    ActivityLogModule,
    KpiModule,
    AnalyticsModule,
    ReportingModule,
    ChatbotModule,
    TenantsModule,
    SubscriptionsModule,
    BillingModule,
    PermissionsModule,
    ScriptsModule,
    QualificationsModule,
    AgentStatusModule,
    PlanningModule,
    StorageModule,
    RedisModule,
    QueueModule,
    AiAnalyticsModule,
    WorkersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
