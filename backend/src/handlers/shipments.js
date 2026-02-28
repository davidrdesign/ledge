/**
 * GET /shipments
 * Derives shipment records from CartRover's shipped/fulfilled orders.
 */
const { cartrover } = require('../lib/cartrover');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// Map CartRover shipment status to Ledge's status keys
function getShipStatus(o) {
  const s = (o.order_status || '').toLowerCase();
  if (s === 'delivered')         return 'delivered';
  if (s === 'shipped')           return 'transit';
  if (s === 'out_for_delivery')  return 'out';
  return 'label';
}

function mapShipment(o) {
  const ship = o.shipment || o;
  return {
    id:       o.order_id   || o.id,
    tracking: ship.tracking_number || o.tracking_number || '—',
    order:    o.order_number || `ORD-${o.order_id || o.id}`,
    customer: o.ship_to_name || o.customer_name || o.customer || 'Unknown',
    carrier:  ship.carrier  || o.carrier  || 'Unknown',
    service:  ship.service_type || o.service_type || '—',
    weight:   ship.weight   ? `${ship.weight} lb` : '—',
    shipped:  o.ship_date
      ? new Date(o.ship_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })
      : '—',
    eta:      o.estimated_delivery
      ? new Date(o.estimated_delivery).toLocaleDateString('en-US', { month:'short', day:'numeric' })
      : '—',
    status:   getShipStatus(o),
  };
}

module.exports.handler = async () => {
  try {
    // Pull all shipped/fulfilled orders and present them as shipments
    const data  = await cartrover('/v1/merchant/orders?order_status=shipped');
    const orders = Array.isArray(data) ? data : (data.orders || [data]);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(orders.map(mapShipment)),
    };
  } catch (err) {
    console.error('shipments error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, code: err.errorCode }),
    };
  }
};
