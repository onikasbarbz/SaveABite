const axios = require("axios");
async function test() {
  try {
    const response = await axios.post(
      "https://dev.khalti.com/api/v2/epayment/initiate/",
      {
        return_url: "http://example.com/",
        website_url: "http://example.com/",
        amount: "1000",
        purchase_order_id: "Order01",
        purchase_order_name: "test",
        customer_info: {
          name: "Ram Bahadur",
          email: "test@khalti.com",
          phone: "9800000001"
        }
      },
      {
        headers: {
          Authorization: "Key live_secret_key_68791341fdd94846a146f0457ff7b455",
          "Content-Type": "application/json"
        }
      }
    );
    console.log(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
test();
