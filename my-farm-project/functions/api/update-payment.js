export default {
  async fetch(request, env, ctx) {
    // Enable Cross-Origin Resource Sharing (CORS) so your frontend can communicate with it
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight OPTIONS requests from the browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Route for updating payments
    if (request.method === "POST" && url.pathname === "/api/update-payment") {
      try {
        const { farmId, paidAmount, paidDate, paidTransaction } = await request.json();

        if (!farmId || !paidAmount) {
          return new Response(JSON.stringify({ error: "Farm ID and Paid Amount are required." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 1. Fetch current metrics
        const farmRecord = await env.DB.prepare(
          "SELECT lease_amount, advance_paid FROM FarmLeases WHERE farms = ?"
        ).bind(farmId).first();

        if (!farmRecord) {
          return new Response(JSON.stringify({ error: "Farm not found." }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 2. Perform financial calculations
        const newAdvancePaid = Number(farmRecord.advance_paid) + Number(paidAmount);
        const newBalanceRemaining = Number(farmRecord.lease_amount) - newAdvancePaid;

        // 3. Update the D1 Database
        await env.DB.prepare(`
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
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Default response for unmatched paths
    return new Response("Not Found", { status: 404 });
  }
};