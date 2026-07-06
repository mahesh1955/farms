export async function onRequestPost(context) {
  try {
    // 1. Grab the form data sent from your website input fields
    const { farmId, paidAmount, paidDate, paidTransaction } = await context.request.json();

    if (!farmId || !paidAmount) {
      return new Response(JSON.stringify({ error: "Farm ID and Paid Amount are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Fetch the current lease amount and existing advance paid for this farm
    const farmRecord = await context.env.DB.prepare(
      "SELECT lease_amount, advance_paid FROM FarmLeases WHERE farms = ?"
    ).bind(farmId).first();

    if (!farmRecord) {
      return new Response(JSON.stringify({ error: "Farm not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Calculate your new financial figures
    const newAdvancePaid = Number(farmRecord.advance_paid) + Number(paidAmount);
    const newBalanceRemaining = Number(farmRecord.lease_amount) - newAdvancePaid;

    // 4. Update your Cloudflare D1 database row with the transaction details
    await context.env.DB.prepare(`
      UPDATE FarmLeases 
      SET 
        advance_paid = ?, 
        balance_remaining = ?, 
        paid_amount = ?, 
        paid_date = ?, 
        paid_transaction = ?
      WHERE farms = ?
    `).bind(
      newAdvancePaid, 
      newBalanceRemaining, 
      paidAmount, 
      paidDate, 
      paidTransaction, 
      farmId
    ).run();

    return new Response(JSON.stringify({ success: true, message: "Payment recorded successfully!" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}