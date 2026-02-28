/**
 * GET  /qbo/bills          — list vendor bills
 * POST /qbo/bills          — create bill from a Ledge purchase order
 */

const { qbo } = require('../../lib/qbo');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function mapBill(bill) {
  return {
    id:        bill.Id,
    syncToken: bill.SyncToken,
    num:       bill.DocNumber || `BILL-${bill.Id}`,
    vendor:    bill.VendorRef?.name || 'Unknown',
    vendorId:  bill.VendorRef?.value,
    date:      bill.TxnDate,
    dueDate:   bill.DueDate,
    total:     bill.TotalAmt,
    balance:   bill.Balance,
    status:    bill.Balance === 0 ? 'paid' : (bill.Balance < bill.TotalAmt ? 'partial' : 'open'),
    lineItems: (bill.Line || [])
      .filter(l => l.DetailType === 'AccountBasedExpenseLineDetail' || l.DetailType === 'ItemBasedExpenseLineDetail')
      .map(l => ({
        description: l.Description || '',
        amount:      l.Amount,
        account:     l.AccountBasedExpenseLineDetail?.AccountRef?.name
                     || l.ItemBasedExpenseLineDetail?.ItemRef?.name || '',
      })),
  };
}

// Build a QBO Bill body from a Ledge purchase order object
function buildBillBody(po) {
  return {
    VendorRef: { value: po.qboVendorId || po.vendorId },
    TxnDate:   new Date().toISOString().slice(0, 10),
    DueDate:   po.expected || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    DocNumber: po.num,
    Line: (po.lineItems || []).map(li => ({
      Amount:     li.unit * li.qty,
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: li.name,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: po.qboExpenseAccountId || '7' }, // default expense account
      },
    })),
  };
}

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    if (event.httpMethod === 'POST') {
      const po   = JSON.parse(event.body || '{}');
      const body = buildBillBody(po);
      const res  = await qbo('/bill', { method: 'POST', body: JSON.stringify(body) });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(mapBill(res.Bill)) };
    }

    // GET — list bills (most recent 100)
    const res   = await qbo('/query?query=SELECT * FROM Bill ORDERBY MetaData.LastUpdatedTime DESC MAXRESULTS 100');
    const bills = (res?.QueryResponse?.Bill || []).map(mapBill);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(bills) };

  } catch (err) {
    console.error('bills error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
