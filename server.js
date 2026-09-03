const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

app.post('/criar-pagamento', async (req, res) => {
  try {
    const { itemTitle, price, nickname } = req.body;

    const body = {
      transaction_amount: Number(price),
      description: `Rank ${itemTitle} - HavocMC`,
      payment_method_id: 'pix',
      payer: { email: 'cliente@havocmc.com' },
      metadata: { nickname: nickname, item: itemTitle }
    };

    const response = await payment.create({ body });
    
    res.json({
      qr_code: response.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

app.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    try {
      const paymentInfo = await payment.get({ id: data.id });
      
      if (paymentInfo.status === 'approved') {
        const nick = paymentInfo.metadata.nickname;
        const item = paymentInfo.metadata.item;
        const valor = paymentInfo.transaction_amount;

        await axios.post(process.env.DISCORD_WEBHOOK_URL, {
          embeds: [{
            title: "🎉 Nova Compra Aprovada!",
            color: 3066993,
            fields: [
              { name: "Jogador", value: nick || "Não informado", inline: true },
              { name: "Produto", value: item || "Item", inline: true },
              { name: "Valor", value: `R$ ${valor}`, inline: true }
            ]
          }]
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
