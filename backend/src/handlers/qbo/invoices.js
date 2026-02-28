/**
 * GET  /qbo/invoices       — list invoices
 * POST /qbo/invoices       — create invoice from a Ledge order
 */

const { qbo } = require('../../lib/qbo');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function mapInvoice(inv) {
  return {
    id:         inv.Id,
    syncToken:  inv.SyncToken,
    num:        inv.DocNumber || `INV-${inv.Id}`,
    customer:   inv.CustomerRef?.name || 'Unknown',
    customerId: inv.CustomerRef?.value,
    date:       inv.TxnDate,
    dueDate:    inv.DueDate,
    total:      inv.TotalAmt,
    balance:    inv.Balance,
    status:     inv.Balance === 0 ? 'paid' : (inv.Balance < inv.TotalAmt ? 'partial' : 'open'),
    lineItems:  (inv.Line || [])
      .filter(l => l.DetailType === 'SalesItemLineDetail')
      .map(l => ({
        name:  l.SalesItemLineDetail?.ItemRef?.name || l.Description || '',
        qty:   l.SalesItemLineDetail?.Qty || 1,
        price: l.SalesItemLineDetail?.UnitPrice || 0,
        total: l.Amount,
      })),
  };
}

// Build a QBO Invoice body from a Ledge order object
function buildInvoiceBody(order) {
  return {
    CustomerRef: { value: order.qboCustomerId || order.customerId },
    TxnDate:     new Date().toISOString().slice(0, 10),
    DueDate:     order.shipBy || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    DocNumber:   order.num,
    Line: (order.lineItems || []).map(li => ({
      Amount:     li.price * li.qty,
      DetailType: 'SalesItemLineDetail',
      Description: li.name,
      SalesItemLineDetail: {
        ItemRef:    { value: li.qboItemId || '1' },
        UnitPrice:  li.price,
        Qty:        li.qty,
      },
    })),
  };
}

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    if (event.httpMethod === 'POST') {
      const order = JSON.parse(event.body || '{}');
      const body  = buildInvoiceBody(order);
      const res   = await qbo('/invoice', { method: 'POST', body: JSON.stringify(body) });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(mapInvoice(res.Invoice)) };
    }

    // GET — list invoices (most recent 100)
    const res      = await qbo('/query?query=SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS 100');
    const invoices = (res?.QueryResponse?.Invoice || []).map(mapInvoice);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(invoices) };

  } catch (err) {
    console.error('invoices error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
