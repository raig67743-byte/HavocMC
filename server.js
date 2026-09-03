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
    // Suporta tanto os nomes novos quanto os antigos enviados pelo front
    const nick = req.body.nick || req.body.nickname || 'Jogador';
    const email = req.body.email || 'comprador@gmail.com';
    const rawPrice = req.body.valor || req.body.price;
    const descricao = req.body.descricao || req.body.itemTitle || `HavocMC - ${nick}`;

    // Garante que o valor seja numérico com 2 casas decimais
    const priceNum = parseFloat(rawPrice);

    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: "Valor inválido para o pagamento" });
    }

    // Formatação limpa do e-mail para evitar erro de validação
    const cleanEmail = (email && email.includes('@')) ? email.trim().toLowerCase() : 'comprador@gmail.com';

    const body = {
      transaction_amount: priceNum,
      description: descricao,
      payment_method_id: 'pix',
      payer: { 
        email: cleanEmail,
        first_name: nick
      },
      metadata: { 
        nickname: nick, 
        email: cleanEmail,
        item: descricao 
      }
    };

    const response = await payment.create({ body });

    res.json({
      id: response.id,
      qr_code: response.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) {
    console.error("Erro MP Details:", error.cause || error);
    res.status(500).json({ error: "Erro ao gerar PIX", details: error });
  }
});

app.post('/webhook', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment' || req.query.topic === 'payment') {
    try {
      const paymentId = data ? data.id : req.query.id;

      if (paymentId) {
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === 'approved') {
          const nick = paymentInfo.metadata?.nickname || "Não informado";
          const item = paymentInfo.metadata?.item || "Produto HavocMC";
          const valor = paymentInfo.transaction_amount;

          if (process.env.DISCORD_WEBHOOK_URL) {
            await axios.post(process.env.DISCORD_WEBHOOK_URL, {
              embeds: [{
                title: "🎉 Nova Compra Aprovada!",
                color: 3066993,
                fields: [
                  { name: "Jogador", value: nick, inline: true },
                  { name: "Produto", value: item, inline: true },
                  { name: "Valor", value: `R$ ${valor}`, inline: true }
                ],
                timestamp: new Date()
              }]
            });
          }
        }
      }
    } catch (err) {
      console.error("Erro no Webhook:", err);
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
