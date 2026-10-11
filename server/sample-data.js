// sample-data.js
// Default seed data representing CloudCommerce Omni-Engine

const SAMPLE_PROJECT = {
  id: 'proj_cloudcommerce',
  name: 'CloudCommerce Omni-Engine',
  description: 'Enterprise global e-commerce and logistics architecture mapping customer journeys to microservices, databases, and event streams.',
  created_at: new Date().toISOString()
};

const SAMPLE_NODES = [
  // FUNCTIONAL LAYER - Domains
  {
    id: 'fn_domain_identity',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'domain',
    name: 'Identity & Access Domain',
    summary: 'Handles user authentication, session security, role-based permissions, and customer profile management.',
    team: 'Identity Core',
    status: 'production',
    details: {
      owner: 'Sarah Connor (Security Principal)',
      sla: '99.99%',
      compliance: ['SOC2 Type II', 'GDPR Article 17']
    }
  },
  {
    id: 'fn_domain_orders',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'domain',
    name: 'Order Fulfillment Domain',
    summary: 'Orchestrates the order lifecycle from checkout, fraud review, inventory allocation, and fulfillment.',
    team: 'Checkout & Fulfillment Squad',
    status: 'production',
    details: {
      owner: 'Alex Chen (Lead PM)',
      sla: '99.95%',
      volume: '150,000 orders/day'
    }
  },
  {
    id: 'fn_domain_payments',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'domain',
    name: 'Payments & Settlement Domain',
    summary: 'Manages credit card payments, digital wallets, currency conversion, fraud risk screening, and financial ledgers.',
    team: 'FinTech Core',
    status: 'production',
    details: {
      owner: 'Elena Rostova (Staff FinTech Eng)',
      sla: '99.999%',
      compliance: ['PCI-DSS Level 1']
    }
  },
  {
    id: 'fn_domain_inventory',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'domain',
    name: 'Inventory & Warehouse Domain',
    summary: 'Real-time multi-warehouse stock reservation, replenishment triggers, and warehouse pick-and-pack routing.',
    team: 'Supply Chain Engineering',
    status: 'production',
    details: {
      owner: 'Marcus Vance (Logistics Architect)',
      sla: '99.9%'
    }
  },

  // FUNCTIONAL LAYER - User Flows & Business Rules
  {
    id: 'fn_flow_checkout',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'user_flow',
    name: 'Customer Checkout Journey',
    summary: 'End-to-end shopping cart checkout, credit card authorization, stock deduction, and order confirmation.',
    team: 'Checkout & Fulfillment Squad',
    status: 'active',
    details: {
      conversionTarget: '78.5%',
      maxLatency: '1200ms'
    }
  },
  {
    id: 'fn_rule_fraud',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'business_rule',
    name: 'Risk & Fraud Mitigation Rule',
    summary: 'Transactions exceeding $1,000 or originating from velocity-blocked IPs require step-up 3D Secure authentication.',
    team: 'Risk & Compliance',
    status: 'active',
    details: {
      thresholdUSD: 1000,
      action: 'Challenge with 3DS 2.0 or hold for manual review'
    }
  },
  {
    id: 'fn_rule_pci',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'business_rule',
    name: 'PCI-DSS Data Isolation Policy',
    summary: 'Raw credit card numbers must never enter application servers; direct client tokenization via Stripe Elements only.',
    team: 'Security & Governance',
    status: 'enforced',
    details: {
      auditDate: 'Q3 2026',
      vaultProvider: 'Stripe Elements SDK'
    }
  },
  {
    id: 'fn_actor_customer',
    project_id: SAMPLE_PROJECT.id,
    layer: 'functional',
    type: 'actor',
    name: 'Online Consumer',
    summary: 'Authenticated or guest shopper accessing the e-commerce store via Web browser or iOS/Android native app.',
    team: 'Consumer Experience',
    status: 'active',
    details: {
      channels: ['Next.js Web Storefront', 'React Native Mobile App']
    }
  },

  // TECHNICAL LAYER - Services & APIs
  {
    id: 'tech_api_gateway',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Edge API Gateway',
    summary: 'Envoy-based edge gateway handling rate limiting, TLS termination, WAF filtering, and routing to microservices.',
    team: 'Platform Infra',
    status: 'healthy',
    details: {
      techStack: 'Envoy Proxy / Lua / OpenResty',
      endpoints: ['/api/v1/auth/*', '/api/v1/orders/*', '/api/v1/catalog/*'],
      replicas: 12,
      runbook: 'https://wiki.corp/runbooks/edge-gateway'
    }
  },
  {
    id: 'tech_auth_service',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Auth & Session Service',
    summary: 'Validates JWT access tokens, refreshes bearer tokens, checks permission scopes, and manages SSO federations.',
    team: 'Identity Core',
    status: 'healthy',
    details: {
      techStack: 'Go 1.25 / Gin / RS256 JWT',
      endpoints: ['POST /auth/login', 'POST /auth/verify', 'POST /auth/refresh'],
      throughput: '8,500 req/sec',
      runbook: 'https://wiki.corp/runbooks/auth-service'
    }
  },
  {
    id: 'tech_order_service',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Order Orchestrator Service',
    summary: 'Core transactional service managing order state machine (Draft -> PendingPayment -> Paid -> Allocated -> Shipped).',
    team: 'Checkout & Fulfillment Squad',
    status: 'healthy',
    details: {
      techStack: 'Node.js 24 / TypeScript / Fastify / Prisma',
      endpoints: ['POST /orders/checkout', 'GET /orders/:id', 'PATCH /orders/:id/cancel'],
      pattern: 'Saga Orchestrator Pattern',
      runbook: 'https://wiki.corp/runbooks/order-service'
    }
  },
  {
    id: 'tech_payment_service',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Payment Gateway Broker',
    summary: 'Encapsulated PCI-compliant payment gateway wrapper managing Stripe charges, refunds, webhooks, and retry logic.',
    team: 'FinTech Core',
    status: 'healthy',
    details: {
      techStack: 'Java 21 / Spring Boot 3.4 / gRPC',
      endpoints: ['gRPC ChargePayment()', 'gRPC ProcessRefund()'],
      circuitBreaker: 'Resilience4j (500ms timeout)',
      runbook: 'https://wiki.corp/runbooks/payment-broker'
    }
  },
  {
    id: 'tech_inventory_service',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Inventory Allocation Worker',
    summary: 'Consumes order events to atomically lock and reserve stock across regional fulfillment centers.',
    team: 'Supply Chain Engineering',
    status: 'healthy',
    details: {
      techStack: 'Python 3.12 / FastAPI / SQLAlchemy',
      concurrency: 'Pessimistic locking with row-level SELECT FOR UPDATE',
      runbook: 'https://wiki.corp/runbooks/inventory-worker'
    }
  },
  {
    id: 'tech_notification_service',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'service',
    name: 'Notification Dispatcher',
    summary: 'Dispatches asynchronous transactional emails, SMS alerts, and mobile push notifications to shoppers.',
    team: 'Platform Services',
    status: 'healthy',
    details: {
      techStack: 'Go 1.25 / Kafka Consumer Group',
      templates: 'SendGrid Dynamic Email Templates'
    }
  },

  // TECHNICAL LAYER - Databases, Queues & External APIs
  {
    id: 'tech_db_orders',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'database',
    name: 'Orders Relational DB',
    summary: 'Primary ACID relational database holding order headers, line items, transaction logs, and billing addresses.',
    team: 'Checkout & Fulfillment Squad',
    status: 'healthy',
    details: {
      engine: 'PostgreSQL 17 Aurora Multi-AZ',
      tables: ['orders', 'order_items', 'order_status_history', 'invoices'],
      backup: 'Continuous PITR + 35 days snapshot'
    }
  },
  {
    id: 'tech_db_users',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'database',
    name: 'User Identity DB',
    summary: 'Encrypted document repository for user accounts, hashed credentials (Argon2id), MFA secrets, and address book.',
    team: 'Identity Core',
    status: 'healthy',
    details: {
      engine: 'MongoDB 8.0 Enterprise with CSFLE',
      encryption: 'Field-level AES-256-GCM'
    }
  },
  {
    id: 'tech_db_inventory',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'database',
    name: 'Inventory Stock DB',
    summary: 'High-throughput relational ledger for real-time SKU inventory quantities, warehouse bin locations, and safety stocks.',
    team: 'Supply Chain Engineering',
    status: 'healthy',
    details: {
      engine: 'PostgreSQL 17 with TimescaleDB Extension',
      tables: ['inventory_ledger', 'sku_availability', 'warehouse_allocations']
    }
  },
  {
    id: 'tech_cache_redis',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'database',
    name: 'Redis Distributed Cache',
    summary: 'In-memory cache for fast session token verification, rate limit counters, and shopping cart persistence.',
    team: 'Platform Infra',
    status: 'healthy',
    details: {
      engine: 'Redis 7.4 Cluster (3 shards, 6 nodes)',
      ttl: 'Session 24h, Rate limits 60s'
    }
  },
  {
    id: 'tech_kafka_orders',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'queue',
    name: 'Kafka: orders.v1.events',
    summary: 'Partitioned event streaming bus distributing OrderCreated, OrderPaid, and OrderCancelled events to downstream consumers.',
    team: 'Data Platform',
    status: 'healthy',
    details: {
      broker: 'Apache Kafka 3.8 / Strimzi K8s',
      partitions: 16,
      retention: '7 days',
      schema: 'Apache Avro with Confluent Schema Registry'
    }
  },
  {
    id: 'tech_stripe_api',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'external',
    name: 'Stripe Payment Gateway',
    summary: 'External payment processor executing credit card charges, 3D Secure verification, and Apple Pay / Google Pay payouts.',
    team: 'FinTech Core (Vendor Managed)',
    status: 'external_ok',
    details: {
      endpoint: 'https://api.stripe.com/v1/payment_intents',
      contract: 'REST JSON with Idempotency-Key headers'
    }
  },
  {
    id: 'tech_sendgrid_api',
    project_id: SAMPLE_PROJECT.id,
    layer: 'technical',
    type: 'external',
    name: 'SendGrid Email API',
    summary: 'Third-party delivery infrastructure for sending transactional order confirmations and delivery tracking updates.',
    team: 'Platform Services (Vendor Managed)',
    status: 'external_ok',
    details: {
      endpoint: 'https://api.sendgrid.com/v3/mail/send',
      sla: '99.9%'
    }
  }
];

const SAMPLE_EDGES = [
  {
    id: 'edge_actor_checkout',
    project_id: SAMPLE_PROJECT.id,
    source: 'fn_actor_customer',
    target: 'fn_flow_checkout',
    type: 'participates_in',
    label: 'Initiates Checkout',
    summary: 'Customer places items in cart and begins checkout flow.'
  },
  {
    id: 'edge_flow_gateway',
    project_id: SAMPLE_PROJECT.id,
    source: 'fn_flow_checkout',
    target: 'tech_api_gateway',
    type: 'initiates',
    label: 'Dispatches HTTP',
    summary: 'Browser issues POST /api/v1/orders/checkout'
  },
  {
    id: 'edge_gw_auth',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_api_gateway',
    target: 'tech_auth_service',
    type: 'calls',
    label: 'Verify JWT (mTLS)',
    summary: 'Gateway queries Auth Service to authenticate bearer token.'
  },
  {
    id: 'edge_auth_redis',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_auth_service',
    target: 'tech_cache_redis',
    type: 'reads_from',
    label: 'Check Session Cache',
    summary: 'Validates token revocation and active session state in Redis.'
  },
  {
    id: 'edge_auth_db',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_auth_service',
    target: 'tech_db_users',
    type: 'reads_from',
    label: 'Query Profile & Scopes',
    summary: 'Fetches user security clearance and customer account details.'
  },
  {
    id: 'edge_gw_orders',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_api_gateway',
    target: 'tech_order_service',
    type: 'calls',
    label: 'Route Order Request',
    summary: 'Proxies checkout payload with X-User-Id header to Order Service.'
  },
  {
    id: 'edge_orders_db',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_order_service',
    target: 'tech_db_orders',
    type: 'writes_to',
    label: 'Persist Order (ACID)',
    summary: 'Inserts pending order record with line items into PostgreSQL.'
  },
  {
    id: 'edge_orders_payment',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_order_service',
    target: 'tech_payment_service',
    type: 'calls',
    label: 'gRPC Charge()',
    summary: 'Synchronous internal RPC to authorize and capture payment.'
  },
  {
    id: 'edge_payment_fraud',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_payment_service',
    target: 'fn_rule_fraud',
    type: 'enforces_rule',
    label: 'Check Risk Score',
    summary: 'Evaluates transaction against $1,000 threshold and velocity rules.'
  },
  {
    id: 'edge_payment_pci',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_payment_service',
    target: 'fn_rule_pci',
    type: 'complies_with',
    label: 'PCI Tokenization Check',
    summary: 'Ensures only tokenized card secrets pass through payment payload.'
  },
  {
    id: 'edge_payment_stripe',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_payment_service',
    target: 'tech_stripe_api',
    type: 'calls',
    label: 'Create PaymentIntent',
    summary: 'Transmits encrypted token to Stripe API over TLS 1.3.'
  },
  {
    id: 'edge_orders_kafka',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_order_service',
    target: 'tech_kafka_orders',
    type: 'publishes_to',
    label: 'Emit OrderCreated Event',
    summary: 'Publishes OrderCreated event with orderId, items, and total amount.'
  },
  {
    id: 'edge_kafka_inventory',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_kafka_orders',
    target: 'tech_inventory_service',
    type: 'consumes_from',
    label: 'Stream Order Events',
    summary: 'Inventory worker subscribes to order event stream for stock reservation.'
  },
  {
    id: 'edge_inventory_db',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_inventory_service',
    target: 'tech_db_inventory',
    type: 'writes_to',
    label: 'Update Ledger (SQL)',
    summary: 'Executes atomic deduction from available inventory stock.'
  },
  {
    id: 'edge_kafka_notifications',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_kafka_orders',
    target: 'tech_notification_service',
    type: 'consumes_from',
    label: 'Trigger Customer Email',
    summary: 'Notification dispatcher consumes order event for email delivery.'
  },
  {
    id: 'edge_notifications_sendgrid',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_notification_service',
    target: 'tech_sendgrid_api',
    type: 'calls',
    label: 'Send Email via API',
    summary: 'Invokes SendGrid REST API with dynamic order summary template.'
  },
  {
    id: 'edge_map_identity',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_auth_service',
    target: 'fn_domain_identity',
    type: 'implements',
    label: 'Implements Domain',
    summary: 'Auth Service provides technical capabilities for Identity Domain.'
  },
  {
    id: 'edge_map_orders',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_order_service',
    target: 'fn_domain_orders',
    type: 'implements',
    label: 'Implements Domain',
    summary: 'Order Service provides technical capabilities for Orders Domain.'
  },
  {
    id: 'edge_map_payments',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_payment_service',
    target: 'fn_domain_payments',
    type: 'implements',
    label: 'Implements Domain',
    summary: 'Payment Broker implements the Payments Domain.'
  },
  {
    id: 'edge_map_inventory',
    project_id: SAMPLE_PROJECT.id,
    source: 'tech_inventory_service',
    target: 'fn_domain_inventory',
    type: 'implements',
    label: 'Implements Domain',
    summary: 'Inventory Worker implements the Warehouse Logistics Domain.'
  }
];

const SAMPLE_FLOWS = [
  {
    id: 'flow_checkout_e2e',
    project_id: SAMPLE_PROJECT.id,
    name: 'Customer Checkout & Payment Processing Flow',
    description: 'Step-by-step trace showing synchronous HTTP/gRPC calls and asynchronous Kafka event propagation from cart submission to fulfillment and email dispatch.',
    steps: [
      {
        order: 1,
        title: 'Customer Submits Order',
        source: 'fn_actor_customer',
        target: 'tech_api_gateway',
        description: 'Customer clicks "Place Order" in the web application; encrypted HTTPS POST is sent to Edge API Gateway.'
      },
      {
        order: 2,
        title: 'Gateway Authenticates Request',
        source: 'tech_api_gateway',
        target: 'tech_auth_service',
        description: 'API Gateway extracts Bearer JWT and calls Auth Service to validate token authenticity and user permissions.'
      },
      {
        order: 3,
        title: 'Fast Session Cache Verification',
        source: 'tech_auth_service',
        target: 'tech_cache_redis',
        description: 'Auth Service checks Redis cache to verify the token is not revoked or blacklisted (< 2ms latency).'
      },
      {
        order: 4,
        title: 'Route to Order Orchestrator',
        source: 'tech_api_gateway',
        target: 'tech_order_service',
        description: 'With valid auth claims, Gateway forwards the order payload to the internal Order Service.'
      },
      {
        order: 5,
        title: 'Create Order Record in PostgreSQL',
        source: 'tech_order_service',
        target: 'tech_db_orders',
        description: 'Order Service persists the initial order header and line items with status PENDING_PAYMENT.'
      },
      {
        order: 6,
        title: 'Invoke Payment Broker via gRPC',
        source: 'tech_order_service',
        target: 'tech_payment_service',
        description: 'Order Service makes a synchronous gRPC call to Payment Gateway Broker with an Idempotency-Key.'
      },
      {
        order: 7,
        title: 'Evaluate Fraud & PCI Rules',
        source: 'tech_payment_service',
        target: 'fn_rule_fraud',
        description: 'Payment Service runs automated risk check; transactions over $1,000 trigger enhanced fraud verification.'
      },
      {
        order: 8,
        title: 'Charge Customer Card on Stripe',
        source: 'tech_payment_service',
        target: 'tech_stripe_api',
        description: 'Payment Service transmits tokenized card details to Stripe API; Stripe confirms funds capture.'
      },
      {
        order: 9,
        title: 'Publish OrderCreated Event to Kafka',
        source: 'tech_order_service',
        target: 'tech_kafka_orders',
        description: 'Order status transitions to PAID, and Order Service publishes an event to Kafka topic orders.v1.events.'
      },
      {
        order: 10,
        title: 'Inventory Worker Deducts Stock',
        source: 'tech_kafka_orders',
        target: 'tech_inventory_service',
        description: 'Inventory Worker consumes the Kafka event, locks stock ledger rows, and commits warehouse allocation.'
      },
      {
        order: 11,
        title: 'Send Confirmation Email to Customer',
        source: 'tech_kafka_orders',
        target: 'tech_notification_service',
        description: 'Notification Dispatcher consumes the event and triggers SendGrid API to deliver the confirmation email.'
      }
    ]
  }
];

module.exports = {
  SAMPLE_PROJECT,
  SAMPLE_NODES,
  SAMPLE_EDGES,
  SAMPLE_FLOWS
};
