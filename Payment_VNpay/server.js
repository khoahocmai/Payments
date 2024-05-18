import express from 'express'; // npm install express
import request from 'request'; // npm install request
import moment from 'moment'; // npm install moment
import { createHmac } from 'crypto'; // npm install crypto
import { stringify } from 'qs'; // npm install qs
import cookieParser from 'cookie-parser'; // npm install cookie-parser
import 'dotenv/config.js'; // npm install dotenv

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cookieParser());

server.get('/', function (req, res, next) {
    res.render('orderlist', { title: 'Danh sách đơn hàng' })
});

server.get('/create_payment_url', function (req, res, next) {
    res.render('order', { title: 'Tạo mới đơn hàng', amount: 10000 })
});

server.get('/querydr', function (req, res, next) {
    let desc = 'Truy van ket qua thanh toan';
    res.render('querydr', { title: desc })
});

server.get('/refund', function (req, res, next) {
    let desc = 'Hoàn tiền giao dịch thanh toán';
    res.render('refund', { title: desc })
});

server.post('/payment', function (req, res, next) {

    process.env.TZ = 'Asia/Ho_Chi_Minh';

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');

    const ipAddr = req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        (req.socket ? req.socket.remoteAddress : null);
    const cleanIpAddr = ipAddr ? ipAddr.split(':').pop() : null;

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    let vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const orderId = moment(date).format('DDHHmmss');
    const amount = req.body.amount;
    const bankCode = req.body.bankCode;
    const orderInfo = req.body.orderInfo || "Thanh toan cho ma GD: " + orderId;

    const locale = req.body.language || 'vn';

    const currCode = 'VND';
    let vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: currCode,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: 'other',
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: cleanIpAddr,
        vnp_CreateDate: createDate,
    };
    if (bankCode !== null && bankCode !== '') {
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    var signData = stringify(vnp_Params, { encode: false });
    var hmac = createHmac("sha512", secretKey);
    var signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + stringify(vnp_Params, { encode: false });
    console.log(vnpUrl);
    return res.redirect(vnpUrl);
});

server.get('/vnpay_return', function (req, res, next) {
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    let tmnCode = process.env.VNP_TMN_CODE;
    let secretKey = process.env.VNP_HASH_SECRET;

    let signData = stringify(vnp_Params, { encode: false });
    let hmac = createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
        //Code thêm ở đây để xử lý data trong db (dùng vnp_Params, nó chứa những thông tin từ phần /payment gửi về)
        res.status(200).redirect("https://www.facebook.com/")
    } else {
        res.status(500).redirect("https://www.youtube.com/")
    }
});

server.get('/vnpay_ipn', function (req, res, next) {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    let orderId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let secretKey = process.env.VNP_HASH_SECRET;
    let signData = stringify(vnp_Params, { encode: false });
    let hmac = createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    let paymentStatus = '0'; // Giả sử '0' là trạng thái khởi tạo giao dịch, chưa có IPN. Trạng thái này được lưu khi yêu cầu thanh toán chuyển hướng sang Cổng thanh toán VNPAY tại đầu khởi tạo đơn hàng.
    //let paymentStatus = '1'; // Giả sử '1' là trạng thái thành công bạn cập nhật sau IPN được gọi và trả kết quả về nó
    //let paymentStatus = '2'; // Giả sử '2' là trạng thái thất bại bạn cập nhật sau IPN được gọi và trả kết quả về nó

    let checkOrderId = true; // Mã đơn hàng "giá trị của vnp_TxnRef" VNPAY phản hồi tồn tại trong CSDL của bạn
    let checkAmount = true; // Kiểm tra số tiền "giá trị của vnp_Amout/100" trùng khớp với số tiền của đơn hàng trong CSDL của bạn
    if (secureHash === signed) { //kiểm tra checksum
        if (checkOrderId) {
            if (checkAmount) {
                if (paymentStatus == "0") { //kiểm tra tình trạng giao dịch trước khi cập nhật tình trạng thanh toán
                    if (rspCode == "00") {
                        //thanh cong
                        //paymentStatus = '1'
                        // Ở đây cập nhật trạng thái giao dịch thanh toán thành công vào CSDL của bạn
                        res.status(200).json({ RspCode: '00', Message: 'Success' })
                    }
                    else {
                        //that bai
                        //paymentStatus = '2'
                        // Ở đây cập nhật trạng thái giao dịch thanh toán thất bại vào CSDL của bạn
                        res.status(200).json({ RspCode: '00', Message: 'Success' })
                    }
                }
                else {
                    res.status(200).json({ RspCode: '02', Message: 'This order has been updated to the payment status' })
                }
            }
            else {
                res.status(200).json({ RspCode: '04', Message: 'Amount invalid' })
            }
        }
        else {
            res.status(200).json({ RspCode: '01', Message: 'Order not found' })
        }
    }
    else {
        res.status(200).json({ RspCode: '97', Message: 'Checksum failed' })
    }
});

server.post('/querydr', function (req, res, next) {

    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();

    let vnp_TmnCode = process.env.VNP_TMN_CODE;
    let secretKey = process.env.VNP_HASH_SECRET;
    let vnp_Api = process.env.VNP_API;

    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;

    let vnp_RequestId = moment(date).format('HHmmss');
    let vnp_Version = '2.1.0';
    let vnp_Command = 'querydr';
    let vnp_OrderInfo = 'Truy van GD ma:' + vnp_TxnRef;

    let ipAddr = req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        (req.socket ? req.socket.remoteAddress : null);
    const cleanIpAddr = ipAddr ? ipAddr.split(':').pop() : null;

    let currCode = 'VND';
    let vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');

    let data = vnp_RequestId + "|" + vnp_Version + "|" + vnp_Command + "|" + vnp_TmnCode + "|" + vnp_TxnRef + "|" + vnp_TransactionDate + "|" + vnp_CreateDate + "|" + cleanIpAddr + "|" + vnp_OrderInfo;

    let hmac = createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(Buffer.from(data, 'utf-8')).digest("hex");

    let dataObj = {
        'vnp_RequestId': vnp_RequestId,
        'vnp_Version': vnp_Version,
        'vnp_Command': vnp_Command,
        'vnp_TmnCode': vnp_TmnCode,
        'vnp_TxnRef': vnp_TxnRef,
        'vnp_OrderInfo': vnp_OrderInfo,
        'vnp_TransactionDate': vnp_TransactionDate,
        'vnp_CreateDate': vnp_CreateDate,
        'vnp_IpAddr': vnp_IpAddr,
        'vnp_SecureHash': vnp_SecureHash
    };
    // /merchant_webapi/api/transaction
    request({
        url: vnp_Api,
        method: "POST",
        json: true,
        body: dataObj
    }, function (error, response, body) {
        console.log(response);
    });

});

server.post('/refund', function (req, res, next) {

    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();

    let vnp_TmnCode = process.env.VNP_TMN_CODE;
    let secretKey = process.env.VNP_HASH_SECRET;
    let vnp_Api = process.env.VNP_API;

    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;
    let vnp_Amount = req.body.amount * 100;
    let vnp_TransactionType = req.body.transType;
    let vnp_CreateBy = req.body.user;

    let currCode = 'VND';

    let vnp_RequestId = moment(date).format('HHmmss');
    let vnp_Version = '2.1.0';
    let vnp_Command = 'refund';
    let vnp_OrderInfo = 'Hoan tien GD ma:' + vnp_TxnRef;

    let ipAddr = req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        (req.socket ? req.socket.remoteAddress : null);
    const cleanIpAddr = ipAddr ? ipAddr.split(':').pop() : null;


    let vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');

    let vnp_TransactionNo = '0';

    let data = vnp_RequestId + "|" + vnp_Version + "|" + vnp_Command + "|" + vnp_TmnCode + "|" + vnp_TransactionType + "|" + vnp_TxnRef + "|" + vnp_Amount + "|" + vnp_TransactionNo + "|" + vnp_TransactionDate + "|" + vnp_CreateBy + "|" + vnp_CreateDate + "|" + cleanIpAddr + "|" + vnp_OrderInfo;
    let hmac = crypto.createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(Buffer.from(data, 'utf-8')).digest("hex");

    let dataObj = {
        'vnp_RequestId': vnp_RequestId,
        'vnp_Version': vnp_Version,
        'vnp_Command': vnp_Command,
        'vnp_TmnCode': vnp_TmnCode,
        'vnp_TransactionType': vnp_TransactionType,
        'vnp_TxnRef': vnp_TxnRef,
        'vnp_Amount': vnp_Amount,
        'vnp_TransactionNo': vnp_TransactionNo,
        'vnp_CreateBy': vnp_CreateBy,
        'vnp_OrderInfo': vnp_OrderInfo,
        'vnp_TransactionDate': vnp_TransactionDate,
        'vnp_CreateDate': vnp_CreateDate,
        'vnp_IpAddr': cleanIpAddr,
        'vnp_SecureHash': vnp_SecureHash
    };

    request({
        url: vnp_Api,
        method: "POST",
        json: true,
        body: dataObj
    }, function (error, response, body) {
        console.log(response);
    });

});
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

server.listen(1412, () => {
    console.log("Server run in post 1412");
});

// Thông tin thẻ test
// #	Thông tin thẻ	Ghi chú
// 1
// Ngân hàng: NCB
// Số thẻ: 9704198526191432198
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:07/15
// Mật khẩu OTP:123456
// Thành công
// 2
// Ngân hàng: NCB
// Số thẻ: 9704195798459170488
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:07/15
// Thẻ không đủ số dư
// 3
// Ngân hàng: NCB
// Số thẻ: 9704192181368742
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:07/15
// Thẻ chưa kích hoạt
// 4
// Ngân hàng: NCB
// Số thẻ: 9704193370791314
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:07/15
// Thẻ bị khóa
// 5
// Ngân hàng: NCB
// Số thẻ: 9704194841945513
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:07/15
// Thẻ bị hết hạn
// 6
// Loại thẻ quốc tếVISA (No 3DS)
// Số thẻ: 4456530000001005
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 7
// Loại thẻ quốc tếVISA (3DS)
// Số thẻ: 4456530000001096
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 8
// Loại thẻ quốc tếMasterCard (No 3DS)
// Số thẻ: 5200000000001005
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 9
// Loại thẻ quốc tếMasterCard (3DS)
// Số thẻ: 5200000000001096
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 10
// Loại thẻ quốc tếJCB (No 3DS)
// Số thẻ: 3337000000000008
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 11
// Loại thẻ quốc tếJCB (3DS)
// Số thẻ: 3337000000200004
// CVC/CVV: 123
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:12/24
// Email:test@gmail.com
// Địa chỉ:22 Lang Ha
// Thành phố:Ha Noi
// Thành công
// 12
// Loại thẻ ATM nội địaNhóm Bank qua NAPAS
// Số thẻ: 9704000000000018
// Số thẻ: 9704020000000016
// Tên chủ thẻ:NGUYEN VAN A
// Ngày phát hành:03/07
// OTP:otp
// Thành công
// 12
// Loại thẻ ATM nội địaEXIMBANK
// Số thẻ: 9704310005819191
// Tên chủ thẻ:NGUYEN VAN A
// Ngày hết hạn:10/26
// Thành công