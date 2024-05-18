import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import moment from 'moment';

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.post("/payment", async (req, res) => {
    //parameters
    const partnerCode = "MOMO";
    const accessKey = "F8BBA842ECF85";
    const secretkey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const requestId = `${partnerCode}${new Date().getTime()}`; // Chuỗi ngẫu nhiên để phân biệt các request 
    const orderId = requestId; // Mã đặt đơn
    const orderInfo = "pay with MoMo"; // Tên order
    const redirectUrl = "https://momo.vn/return"; // Page trả về sau khi xong
    const ipnUrl = "https://callback.url/notify";
    const amount = "50000"; // Số tiền
    const requestType = "captureWallet"; // Phương thức thanh toán
    const extraData = ""; //pass empty value if your merchant does not have stores

    //before sign HMAC SHA256 with format
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    //signature
    const signature = crypto.createHmac('sha256', secretkey)
        .update(rawSignature)
        .digest('hex');

    try {
        //json object send to MoMo endpoint
        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount,
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            extraData,
            requestType,
            signature,
            lang: 'en'
        };

        const result = await axios.post('https://test-payment.momo.vn/v2/gateway/api/create', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return res.status(200).json(result.data)
    } catch (error) {
        console.error('Error:', error.message);
    }
});

server.listen(1412, () => {
    console.log("Server run in post 1412");
});
