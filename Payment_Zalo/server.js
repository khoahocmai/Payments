import express from "express"; // npm install express
import axios from 'axios'; // npm install axios
import CryptoJS from 'crypto-js'; // npm install crypto-js
import moment from 'moment'; // npm install moment
import qs from 'qs'; // npm install qs
import 'dotenv/config.js'; // npm install dotenv

const server = express()
server.use(express.json())
server.use(express.urlencoded({ extended: true }))

server.post("/payment", async (req, res) => {
    const userData = req.body
    const appId = process.env.ZALOPAY_APP_ID
    const key1 = process.env.ZALOPAY_KEY1
    const endpoint = process.env.ZALOPAY_ENDPOINT

    const embed_data = {
        redirecturl: "https://www.facebook.com"
    };

    const items = [{}];
    const transID = Math.floor(Math.random() * 1000000);
    const order = { // See page: 'https://docs.zalopay.vn/v2/general/overview.html#tao-don-hang_thong-tin-don-hang' For more details
        app_id: appId,
        app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
        app_user: userData.name,
        app_time: Date.now(), // miliseconds
        expire_duration_seconds: 900,
        item: JSON.stringify(items),
        embed_data: JSON.stringify(embed_data),
        amount: 10000,
        description: `Payment for the order #${transID}`,
        bank_code: "",
        callback_url: "https://656d-14-161-14-251.ngrok-free.app/callback"
    };

    // appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const data = appId + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
    order.mac = CryptoJS.HmacSHA256(data, key1).toString();

    try {
        const result = await axios.post(endpoint, null, { params: order })
        return res.status(200).json(result.data)
    } catch (error) {
        console.log(error.message);
    }
})

server.post('/callback', (req, res) => {
    const key2 = process.env.ZALOPAY_KEY2
    let result = {};

    try {
        let dataStr = req.body.data;
        let reqMac = req.body.mac;

        let mac = CryptoJS.HmacSHA256(dataStr, key2).toString();
        console.log("mac =", mac);


        // kiểm tra callback hợp lệ (đến từ ZaloPay server)
        if (reqMac !== mac) {
            // callback không hợp lệ
            result.return_code = -1;
            result.return_message = "mac not equal";
        }
        else { // sửa thêm code đoạn này để update database
            // thanh toán thành công
            // merchant cập nhật trạng thái cho đơn hàng
            let dataJson = JSON.parse(dataStr, key2);
            console.log("update order's status = success where app_trans_id =", dataJson["app_trans_id"]);

            result.return_code = 1;
            result.return_message = "success";
        }
    } catch (ex) {
        result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
        result.return_message = ex.message;
    }

    // thông báo kết quả cho ZaloPay server
    res.json(result);
});

server.post("/order-status/:app_trans_id", async (req, res) => {
    const app_trans_id = req.params.app_trans_id

    const appId = process.env.ZALOPAY_APP_ID
    const key1 = process.env.ZALOPAY_KEY1

    let postData = {
        app_id: appId,
        app_trans_id: app_trans_id, // Input your app_trans_id
    }

    let data = postData.app_id + "|" + postData.app_trans_id + "|" + key1; // appid|app_trans_id|key1
    postData.mac = CryptoJS.HmacSHA256(data, key1).toString();


    let postConfig = {
        method: 'post',
        url: "https://sb-openapi.zalopay.vn/v2/query",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: qs.stringify(postData)
    };


    try {
        const result = await axios(postConfig)
        return res.status(200).json(result.data)
    } catch (error) {
        console.log(error.message);
    }
})

server.listen(1412, () => {
    console.log("Server run in post 1412")
})

//Thông tin thẻ test
// 1. Thông tin thẻ Visa, Master, JCB
// Số thẻ	4111111111111111
// Tên	NGUYEN VAN A
// Ngày hết hạn	01/25
// Mã CVV	123
// 2. Danh sách thẻ ATM (test với bank SBI)
// 2.1. Thẻ hợp lệ

// STT	Số thẻ	Tên chủ thẻ	Ngày phát hành
// 1	9704540000000062	NGUYEN VAN A	1018
// 2	9704540000000070	NGUYEN VAN A	1018
// 3	9704540000000088	NGUYEN VAN A	1018
// 4	9704540000000096	NGUYEN VAN A	1018
// 5	9704541000000094	NGUYEN VAN A	1018
// 6	9704541000000078	NGUYEN VAN A	1018
// 2.2. Thẻ bị mất/đánh cắp

// STT	Số thẻ	Tên chủ thẻ	Ngày phát hành
// 1	9704540000000013	NGUYEN VAN A	1018
// 2	9704540000000021	NGUYEN VAN A	1018
// 3	9704541000000029	NGUYEN VAN A	1018
// 4	9704541000000052	NGUYEN VAN A	1018
// 5	9704541000000060	NGUYEN VAN A	1018
// 6	9704541000000086	NGUYEN VAN A	1018
// 2.3. Thẻ bị timeout

// STT	Số thẻ	Tên chủ thẻ	Ngày phát hành
// 1	9704540000000039	NGUYEN VAN A	1018
// 2	9704541000000037	NGUYEN VAN A	1018
// 3	9704540000000054	NGUYEN VAN A	1018
// 2.4. Thẻ hết tiền

// STT	Số thẻ	Tên chủ thẻ	Ngày phát hành
// 1	9704540000000047	NGUYEN VAN A	1018
// 2	9704541000000011	NGUYEN VAN A	1018
// 3	9704541000000045	NGUYEN VAN A	1018