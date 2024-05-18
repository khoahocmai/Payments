import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config.js';

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.post("/payment", async (req, res) => {
    //parameters
    var accessKey = process.env.MOMO_ACCESS_KEY;
    var secretKey = process.env.MOMO_SECRET_KEY;
    var orderInfo = 'pay with MoMo';
    var partnerCode = 'MOMO';
    var redirectUrl = 'https://facebook.com/';
    var ipnUrl = 'https://e17b-14-227-26-149.ngrok-free.app/callback';
    var requestType = "payWithMethod";
    var amount = '10000';
    var orderId = partnerCode + new Date().getTime();
    var requestId = orderId;
    var extraData = '';
    // var paymentCode = 'T8Qii53fAXyUftPV3m9ysyRhEanUs9KlOPfHgpMR0ON50U10Bh+vZdpJU7VY4z+Z2y77fJHkoDc69scwwzLuW5MzeUKTwPo3ZMaB29imm6YulqnWfTkgzqRaion+EuD7FN9wZ4aXE1+mRt0gHsU193y+yxtRgpmY7SDMU9hCKoQtYyHsfFR5FUAOAKMdw2fzQqpToei3rnaYvZuYaxolprm9+/+WIETnPUDlxCYOiw7vPeaaYQQH0BF0TxyU3zu36ODx980rJvPAgtJzH1gUrlxcSS1HQeQ9ZaVM1eOK/jl8KJm6ijOwErHGbgf/hVymUQG65rHU2MWz9U8QUjvDWA==';
    var orderGroupId = '';
    var autoCapture = true;
    var lang = 'vi';

    //before sign HMAC SHA256 with format
    //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
    var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
    //puts raw signature
    console.log("--------------------RAW SIGNATURE----------------")
    console.log(rawSignature)
    //signature
    var signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');
    console.log("--------------------SIGNATURE----------------")
    console.log(signature)

    //json object send to MoMo endpoint
    const requestBody = JSON.stringify({
        partnerCode: partnerCode,
        partnerName: "Test",
        storeId: "MomoTestStore",
        requestId: requestId,
        amount: amount,
        orderId: orderId,
        orderInfo: orderInfo,
        redirectUrl: redirectUrl,
        ipnUrl: ipnUrl,
        lang: lang,
        requestType: requestType,
        autoCapture: autoCapture,
        extraData: extraData,
        orderGroupId: orderGroupId,
        signature: signature
    });

    // Option for axios
    const options = {
        method: "POST",
        url: "https://test-payment.momo.vn/v2/gateway/api/create",
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        },
        data: requestBody
    }

    let result
    try {
        result = await axios(options)
        return res.status(200).json(result.data)
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            message: "Server error"
        })
    }
});

server.post("/callback", async (req, res) => {
    // API này do momo tự động gọi bằng ipnUrl ở trên /payment
    console.log("Callback: ");
    console.log(req.body);
    // Update order trong database

    return res.status(200).json(req.body);
});

server.post("/order-status/:order_id", async (req, res) => {
    const orderId = req.params.order_id
    const rawSignature = `accessKey=${process.env.MOMO_ACCESS_KEY}&orderId=${orderId}&partnerCode=MOMO&requestId=${orderId}`

    const signature = crypto
        .createHmac("sha256", process.env.MOMO_SECRET_KEY)
        .update(rawSignature)
        .digest('hex');

    const requestBody = JSON.stringify({
        partnerCode: "MOMO",
        requestId: orderId,
        orderId: orderId,
        signature: signature,
        lang: 'vi'
    })

    // Option for axios
    const options = {
        method: "POST",
        url: "https://test-payment.momo.vn/v2/gateway/api/query",
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        },
        data: requestBody
    }

    let result
    try {
        result = await axios(options)
        return res.status(200).json(result.data)
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            message: "Server error"
        })
    }
})

server.listen(1412, () => {
    console.log("Server run in post 1412");
});

// THÔNG TIN TEST THẺ ATM
// No	Tên	                    Số thẻ	         Hạn ghi trên thẻ	OTP	    Trường hợp test
// 1	NGUYEN VAN A	9704 0000 0000 0018	         03 /07	        OTP	    Thành công
// 2	NGUYEN VAN A	9704 0000 0000 0026	         03 /07	        OTP	    Thẻ bị khóa
// 3	NGUYEN VAN A	9704 0000 0000 0034	         03 /07	        OTP	    Nguồn tiền không đủ
// 4	NGUYEN VAN A	9704 0000 0000 0042	         03 /07	        OTP	    Hạn mức thẻ

// THÔNG TIN TEST CREDIT CARDS
// No	Name	                Number	         Card Expdate	    CVC	    OTP	    Test Case
// 1	NGUYEN VAN A	5200 0000 0000 1096	        05 / 25	        111	    OTP	    Card Successful
// 2	NGUYEN VAN A	5200 0000 0000 1104	        05 / 25	        111	    OTP	    Card failed
// 2	NGUYEN VAN A	4111 1111 1111 1111	        05 / 25	        111	    No OTP	Card Successful