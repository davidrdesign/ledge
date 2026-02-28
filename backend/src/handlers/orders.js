/**
 * GET  /orders        — list orders (optional ?status= filter)
 * GET  /orders/{id}   — single order
 * PUT  /orders/{id}   — update order status
 */
const { cartrover } = require('../lib/cartrover');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
};

// Map CartRover order_status values to Ledge's status keys
const STATUS_MAP = {
  new:        'new',
  New:        'new',
  processing: 'processing',
  Processing: 'processing',
  at_wms:     'processing',
  ready:      'ready',
  Ready:      'ready',
  shipped:    'shipped',
  Shipped:    'shipped',
  completed:  'shipped',
};

function mapOrder(o) {
  const placed  = o.order_date   || o.placed_at   || o.created_at || '';
  const shipBy  = o.ship_by_date || o.ship_by     || '';
  return {
    id:       o.order_id   || o.id,
    num:      o.order_number || `ORD-${o.order_id || o.id}`,
    customer: o.bill_to_name || o.customer_name || o.customer || 'Unknown',
    channel:  o.order_source || o.channel || 'Direct',
    items:    Array.isArray(o.line_items) ? o.line_items.length : (o.item_count ?? o.items ?? 0),
    total:    parseFloat(o.order_total   || o.total || 0),
    placed:   placed ? new Date(placed).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '',
    shipBy:   shipBy ? new Date(shipBy).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '',
    status:   STATUS_MAP[o.order_status] || STATUS_MAP[o.status] || 'new',
    lineItems: (o.line_items || []).map(li => ({
      name:  li.item_name  || li.name  || li.sku,
      sku:   li.sku        || li.item_sku || '',
      qty:   li.quantity   || li.qty   || 1,
      price: parseFloat(li.unit_price || li.price || 0),
    })),
    // preserve raw fields for write-back
    _raw: {
      order_id:     o.order_id || o.id,
      order_number: o.order_number,
    },
  };
}

// ── GET /orders ─────────────────────────────────────────────────────────────
async function listOrders(event) {
  const status = event.queryStringParameters?.status;
  const path   = status
    ? `/v1/merchant/orders?order_status=${encodeURIComponent(status)}`
    : '/v1/merchant/orders';

  const data   = await cartrover(path);
  const orders = Array.isArray(data) ? data : (data.orders || [data]);
  return orders.map(mapOrder);
}

// ── GET /orders/{id} ─────────────────────────────────────────────────────────
async function getOrder(id) {
  const data = await cartrover(`/v1/merchant/orders?order_id=${encodeURIComponent(id)}`);
  const arr  = Array.isArray(data) ? data : (data.orders || [data]);
  return arr.length ? mapOrder(arr[0]) : null;
}

// ── PUT /orders/{id} ─────────────────────────────────────────────────────────
async function updateOrder(id, body) {
  const payload = {
    order_id:     id,
    order_status: body.status || body.order_status,
    ...(body.tracking_number ? { tracking_number: body.tracking_number } : {}),
    ...(body.carrier         ? { carrier: body.carrier }                 : {}),
  };
  return cartrover('/v1/merchant/orders', {
    method: 'PUT',
    body:   JSON.stringify(payload),
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const id = event.pathParameters?.id;

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const result = await updateOrder(id, body);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
    }

    if (id) {
      const order = await getOrder(id);
      if (!order) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Order not found' }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify(order) };
    }

    const orders = await listOrders(event);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(orders) };

  } catch (err) {
    console.error('orders error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, code: err.errorCode }),
    };
  }
};
