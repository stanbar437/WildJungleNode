require("dotenv").config();
const fetch = require("node-fetch");
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MysqlStore = require("express-mysql-session")(session);
const multer = require("multer");
const moment = require("moment-timezone");
const nodemailer = require("nodemailer");
// const upload = multer({ dest: 'tmp_uploads/' })
const upload = require(__dirname + "/modules/upload-imgs");
const fs = require("fs").promises;
const db = require("./modules/connect-db");
const sessionStore = new MysqlStore({}, db);
const app = express();
const jwt = require("jsonwebtoken");
const corsOptions = {
  credentials: true,
  origin: function (origin, cb) {
    cb(null, true);
    //都沒有錯誤，都允許
  },
};
// 聊天機器人連線
const server = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: {} });
let panda_total = 0;
let bear_total = 0;
io.on("connection", (socket) => {
  console.log('第一間人數',panda_total)
  console.log('第二間人數',bear_total)
  socket.emit("connection", panda_total, bear_total);
  console.log(`id ${socket.id} is connected`);
  let currentRoom = "";
  socket.on("join", (room, cb) => {
    if (room === "北極熊的告解室") {
      panda_total = panda_total + 1;
    } else if (room === "大熊的告解室") {
      bear_total = bear_total + 1;
    }
    // console.log(panda_total)
    currentRoom = room;
    socket.join(room);
    cb(`你已進入${room}`);
  });
  socket.on("room message", (msg) => {
    socket.to(currentRoom).emit("room message", msg);
  });
  // 以下程式碼拿來呈現離線用
  socket.on("disconnect", () => {
    if(currentRoom==='北極熊的告解室'){
      if (panda_total > 0) {
        panda_total = panda_total - 1;
      } else {
        panda_total = 0;
      }
    }else if(currentRoom==='大熊的告解室'){
      if (bear_total > 0) {
        bear_total = bear_total - 1;
      } else {
        bear_total = 0;
      }
    }
    console.log("user disconnected");
  });
});

require("./routes/members");

app.use(cors(corsOptions));

app.set("view engine", "ejs");
// app.get('/a.html', (req, res)=>{
//     res.send(`<h2>動態內容</h2><p>${Math.random()}</p>`)
// });

//Top-Level middleware
app.use(express.urlencoded({ extended: false })); // application/x-www-form-urlencoded
app.use(express.json()); // application/json
app.use(express.static("public"));
app.use("/joi", express.static("node_modules/joi/dist/"));

app.use(
  session({
    saveUninitialized: false,
    resave: false,
    secret: "qwerqwer", //加密用字串
    store: sessionStore,
    cookie: {
      maxAge: 1200000,
      //domain:'.alan.com'
    }, //存活時間 單位是毫秒（20分鐘）
  })
);

app.use("/roomplatform", require("./routes/roomplatform"));

//自訂的middleware
app.use((req, res, next) => {
  res.locals.alan = "哈囉";
  //template helper functions 樣板輔助函示
  res.locals.toDateString = (date) => moment(date).format("YYYY-MM-DD");
  res.locals.toDatetimeString = (date) =>
    moment(date).format("YYYY-MM-DD HH:mm:ss");

  // JWT
  res.locals.auth = null;
  let auth = req.get("Authorization");
  if (auth && auth.indexOf("Bearer ") === 0) {
    auth = auth.slice(7);
    try {
      const payload = jwt.verify(auth, process.env.JWT_KEY);
      res.locals.auth = payload;
    } catch (ex) {
      console.log(ex);
    }
  }

  next();
});

app.get("/", (req, res) => {
  res.render("home", { name: "WildJungle" });
});
// 定義路由

app.use("/roomplatform", require("./routes/roomplatform"));

app.use("/members", require("./routes/members"));

// 首頁

app.get("/home-products", async (req, res) => {
  const sql =
    "SELECT `ProductsName`,`ProductsPrice`,`PicName` FROM `products` JOIN `productspic` on products.ProductsPic = productspic.ProductsPic";

  const [results] = await db.query(sql);

  res.json(results);
});

//會員

//購物車
app.post("/carts/order", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const data = req.body.order;
  const data2 = req.body.order_detail_product;
  const data3 = req.body.receive_data;
  const bonus_data = req.body.bonus;
  const m_id = req.body.m_sid;
  bonus_data.pop();
  const o_sql =
    "INSERT INTO `orders`(`m_sid`, `payment_sid`, `amount`, `order_date`,`status`) VALUES (?,?,?,NOW(),?)";

  const results = await db.query(o_sql, [
    data.m_sid,
    data.payment_sid,
    data.amount,
    data.status,
  ]);

  const o_sid = results[0].insertId; //抓最新加入的訂單ID
  const od_sql = `INSERT INTO orders_details_products(order_sid, product_sid,product_name, product_price, product_quantity) VALUES (${o_sid}, ?, ?, ?, ?)`;
  data2.map((v, i) => {
    db.query(od_sql, [
      data2[i].sid,
      data2[i].name,
      data2[i].price,
      data2[i].quantity,
    ]);
  });

  const receive_data_sql = `INSERT INTO receive_data(receive_sid, o_sid, name, phone, email, address, shipment, payment) VALUES (${o_sid},${o_sid},?,?,?,?,?,?)`;
  const result_data = db.query(receive_data_sql, [
    data3.name,
    data3.phone,
    data3.email,
    data3.address,
    data3.delivery,
    data3.payment,
  ]);

  bonus_data.map(async (v, i) => {
    const bonus_sql = `UPDATE bonus_list AS bl SET bl.bonus_status = '已使用' WHERE bl.bonusList_sid = ${v.bonusList_sid} && bl.m_id=${m_id}`;
    const results_bonus = await db.query(bonus_sql);
  });
  output.success = true;
  return res.json(output.success);
});

//紅利搜尋
app.post("/carts/bonus", async (req, res) => {
  const m_id = req.body.m_sid;
  const bonus_sql = `SELECT bonusList_sid,bp.number FROM bonus_list AS bl JOIN bonus_point AS bp on bl.point_id=bp.point_sid where bl.m_id=${m_id} && bl.bonus_status="未使用";`;
  const [results] = await db.query(bonus_sql);
  // console.log(results);
  let temp = 0;

  if (results.length) {
    results.map((v, i) => {
      temp += v.number;
    });
  }
  results.push(temp);
  res.json(results);
});

//訂單查詢
app.post("/carts/order_search", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const m_sid = req.body.m_sid;
  const order_search_sql = `SELECT o.order_sid,odp.product_name,odp.product_price,odp.product_quantity,o.order_date,o.amount,o.status FROM orders as o JOIN orders_details_products as odp on o.order_sid=odp.order_sid WHERE m_sid=${m_sid} ORDER BY o.order_sid DESC ,odp.product_sid ASC`;

  const [results] = await db.query(order_search_sql);
  let new_arr = [];
  results.map((v, i) => {
    if (i == 0) {
      new_arr.push(v);
      // console.log(new_arr);
    } else if (results[i].order_sid !== results[i - 1].order_sid) {
      new_arr.push(v);
    } else if (results[i].order_sid === results[i - 1].order_sid) {
      let update = {
        order_sid: "",
        product_name: "",
        product_price: "",
        product_quantity: "",
        order_date: "",
        amount: "",
        status: "",
      };
      update.order_sid = "none";
      update.product_name = results[i].product_name;
      update.product_price = results[i].product_price;
      update.product_quantity = results[i].product_quantity;
      update.order_date = "none";
      update.amount = "none";
      update.status = "none";
      new_arr.push(update);
    }
  });
  // console.log(typeof new_arr[1].product_name)
  output.success = true;
  return res.json(new_arr);
});
app.post("/carts/order_search2", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const m_sid = req.body.m_sid;
  const order_search_sql = `SELECT o.order_sid,odp.product_name,odp.product_price,odp.product_quantity,o.order_date,o.amount,o.status FROM orders as o JOIN orders_details_products as odp on o.order_sid=odp.order_sid WHERE m_sid=${m_sid} ORDER BY o.order_sid DESC ,odp.product_sid ASC`;

  const [results] = await db.query(order_search_sql);
  let new_arr = [];
  let count = 0;
  results.map((v, i) => {
    if (i == 0) {
      new_arr.push(v);
      // console.log(new_arr);
    } else if (results[i].order_sid !== results[i - 1].order_sid) {
      new_arr.push(v);
      count = 0;
    } else if (results[i].order_sid === results[i - 1].order_sid) {
      const current_index = new_arr.findIndex(
        (el) => el.order_sid == results[i].order_sid
      );
      // console.log(current_index)
      if (count === 0) {
        let b = Array(new_arr[current_index].product_name);
        b.push(results[i].product_name);
        new_arr[current_index].product_name = b;
        count++;
      } else {
        new_arr[current_index].product_name.push(results[i].product_name);
      }
    }
  });
  // console.log(typeof new_arr[1].product_name)
  output.success = true;
  return res.json(new_arr);
});

//入園票券查詢
app.post("/carts/ticket_search", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const m_sid = req.body.m_sid;
  const ticket_search_sql = `SELECT o.order_sid,odp.product_name,odp.product_price,odp.product_quantity,o.order_date,o.amount,o.status FROM orders as o 
  JOIN orders_details_products as odp 
  ON o.order_sid=odp.order_sid 
  JOIN ticket AS tic 
  ON odp.product_sid=tic.ticket_sid
  WHERE m_sid=${m_sid}
  ORDER BY o.order_sid DESC, odp.product_sid ASC`;

  const [results] = await db.query(ticket_search_sql);
  let new_arr = [];
  let count = 0;
  results.map((v, i) => {
    if (i == 0) {
      new_arr.push(v);
      // console.log(new_arr);
    } else if (results[i].order_sid !== results[i - 1].order_sid) {
      new_arr.push(v);
      count = 0;
    } else if (results[i].order_sid === results[i - 1].order_sid) {
      const current_index = new_arr.findIndex(
        (el) => el.order_sid == results[i].order_sid
      );
      // console.log(current_index)
      if (count === 0) {
        let b = Array(new_arr[current_index].product_name);
        b.push(results[i].product_name);
        new_arr[current_index].product_name = b;
        count++;
      } else {
        new_arr[current_index].product_name.push(results[i].product_name);
      }
    }
  });
  // console.log(typeof new_arr[1].product_name)
  output.success = true;
  return res.json(new_arr);
});

//住宿查詢
app.post("/carts/live_search", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const m_sid = req.body.m_sid;
  const live_search_sql = `SELECT o.order_sid,r.room_name,r.price,odl.room_count,o.order_date,odl.start,odl.end,(odl.room_count*r.price) AS amount,odl.status FROM orders AS o JOIN orders_details_live AS odl ON o.order_sid=odl.orders_sid JOIN roomdetail AS r ON odl.room_sid=r.sid WHERE m_sid=${m_sid} ORDER BY o.order_sid DESC , odl.room_sid ASC`;

  const [results] = await db.query(live_search_sql);
  let new_arr = [];
  let count = 0;
  results.map((v, i) => {
    if (i == 0) {
      new_arr.push(v);
      // console.log(new_arr);
    } else if (results[i].order_sid !== results[i - 1].order_sid) {
      new_arr.push(v);
      count = 0;
    } else if (results[i].order_sid === results[i - 1].order_sid) {
      const current_index = new_arr.findIndex(
        (el) => el.order_sid == results[i].order_sid
      );
      // console.log(current_index)
      if (count === 0) {
        let b = Array(new_arr[current_index].product_name);
        b.push(results[i].product_name);
        new_arr[current_index].product_name = b;
        count++;
      } else {
        new_arr[current_index].product_name.push(results[i].product_name);
      }
    }
  });
  // console.log(typeof new_arr[1].product_name)
  output.success = true;
  return res.json(new_arr);
});

//收件人資料
app.post("/carts/receive_data", async (req, res) => {
  const output = {
    success: false,
    error: "",
    info: "",
  };
  const m_id = req.body.m_sid;
  const m_name = req.body.m_name;
  const receive_data_sql = `SELECT order_sid,order_date FROM orders WHERE m_sid=${m_id} ORDER BY order_date DESC LIMIT 1`;
  const [results] = await db.query(receive_data_sql);
  const temp =
    "A" +
    results[0].order_date.slice(0, 10).split("-").join("") +
    "" +
    results[0].order_sid;
  output.success = true;

  let testAccount = await nodemailer.createTestAccount();
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.TYSU_SENDEMAIL, // Gmail 帳號
      pass: process.env.TYSU_SENDEMAIL_PASS, // Gmail 的應用程式的密碼
    },
  });

  // 讓用戶驗證
  let info = await transporter.sendMail({
    from: '"Wild Jungle" <wildjungle2022@gmail.com>', // 發送者
    to: "wildjungle2022@gmail.com", // 收件者(req.body.email)
    subject: `WildJungle感謝您的訂購`, // 主旨
    text: `Dear ${m_name} 貴賓，非常感謝您訂購WildJungle的商品，我們會盡快為您出貨`, // 預計會顯示的文字
    html: `<h3>Dear ${m_name} 貴賓，非常感謝您訂購WildJungle的商品，我們會盡快為您出貨</h3>`, // html body 實際顯示出來的結果
  });

  res.json(temp);
});

//登出後寫進資料庫
// app.post("/carts/inserttodb", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//     info: "",
//   };
//   const m_sid = req.body.m_sid;
//   let temp1 = req.body.cart_temp1;
//   let temp2 = req.body.cart_temp2;
//   let temp3 = req.body.cart_temp3;
//   let temp4 = req.body.cart_temp4;

//   if (temp1.length == 0) {
//     temp1 = 0;
//   } else {
//     const intodb1 = `INSERT INTO cart_temp1(m_sid, sid, image, name, price, quantity) VALUES (${m_sid},?,?,?,?,?)`;
//     temp1.map(async (v, i) => {
//       await db.query(intodb1, [v.sid, v.image, v.name, v.price, v.quantity]);
//     });
//   }

//   if (temp2.length == 0) {
//     temp2 = 0;
//     // const intodb2 = `INSERT INTO cart_temp2(m_sid, sid, image, name, price, quantity,seats) VALUES (${m_sid},?,?,?,?,?,?)`;
//     // temp2.map(async (v, i) => {
//     //   await db.query(intodb2, [
//     //     v.sid,
//     //     v.image,
//     //     v.name,
//     //     v.price,
//     //     v.quantity,
//     //     v.seats,
//     //   ]);
//     // });
//   }

//   if (temp3.length == 0) {
//     temp3 = 0;
//   } else {
//     const intodb3 = `INSERT INTO cart_temp3(m_sid, sid, image, name, price, quantity) VALUES (${m_sid},?,?,?,?,?)`;
//     temp3.map(async (v, i) => {
//       await db.query(intodb3, [v.sid, v.image, v.name, v.price, v.quantity]);
//     });
//   }

//   if (temp1.length == 0) {
//     temp4 = 0;
//   } else {
//     const intodb4 = `INSERT INTO cart_temp4(m_sid, sid, image, name, price, quantity,start,end) VALUES (${m_sid},?,?,?,?,?,?,?)`;
//     temp4.map(async (v, i) => {
//       await db.query(intodb4, [
//         v.sid,
//         v.image,
//         v.name,
//         v.price,
//         v.quantity,
//         v.start,
//         v.end,
//       ]);
//     });
//   }
//   output.success = true;
//   return res.json(output.success);
// });

//登入後移出資料庫_1
// app.post("/carts/removetodb_1", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//     info: "",
//   };
//   const m_sid = req.body.m_sid;

//   const finddb = `SELECT m_sid,sid,image,name,price,quantity FROM cart_temp1 WHERE m_sid=${m_sid};`;
//   const [results] = await db.query(finddb);
//   const removedb = `DELETE FROM cart_temp1 WHERE m_sid=${m_sid}`;
//   const results_del = await db.query(removedb);

//   output.success = true;
//   return res.json(results);
// });

// //登入後移出資料庫_2
// app.post("/carts/removetodb_2", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//     info: "",
//   };
//   const m_sid = req.body.m_sid;

//   const finddb = `SELECT * FROM cart_temp2 WHERE m_sid=${m_sid};`;
//   const results = await db.query(finddb);
//   const removedb =`DELETE FROM cart_temp2 WHERE m_sid=${m_sid}`
//   const results_del= await db.query(removedb);

//   output.success = true;
//   return res.json(results);
// });

//登入後移出資料庫_3
// app.post("/carts/removetodb_3", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//     info: "",
//   };
//   const m_sid = req.body.m_sid;

//   const finddb = `SELECT * FROM cart_temp3 WHERE m_sid=${m_sid};`;
//   const results = await db.query(finddb);
//   const removedb =`DELETE FROM cart_temp3 WHERE m_sid=${m_sid}`
//   const results_del= await db.query(removedb);

//   if(results==undefined){
//     results=0;
//   }

//   output.success = true;
//   return res.json(results);
// });

// //登入後移出資料庫_4
// app.post("/carts/removetodb_4", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//     info: "",
//   };
//   const m_sid = req.body.m_sid;

//   const finddb = `SELECT * FROM cart_temp4 WHERE m_sid=${m_sid};`;
//   const results = await db.query(finddb);
//   const removedb =`DELETE FROM cart_temp4 WHERE m_sid=${m_sid}`
//   const results_del= await db.query(removedb);

// output.success = true;
// return res.json(results);
// });

//活動
app.post("/activity", async (req, res) => {
  sql = `SELECT seat FROM animal_seats WHERE time= '${req.body.sid}' `;
  const [results] = await db.query(sql);
  res.json(results);
});

//商品
app.get("/products", async (req, res) => {
  const sql = "SELECT * FROM `products` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//商品的標籤
app.get("/productslabel", async (req, res) => {
  const sql = "SELECT * FROM `productslabel` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//商品圖片
app.get("/productspic", async (req, res) => {
  const sql = "SELECT * FROM `productspic` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//商品評價星星

app.get("/productsreview", async (req, res) => {
  const sql = "SELECT * FROM `productsreview` ORDER BY `ReviewSid` DESC ";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

app.get("/productsmemberreview", async (req, res) => {
  const sql =
    "SELECT `m_name` ,`m_sid` ,`memberSid`, `ProductsReview`FROM `members`, `productsreview`  WHERE `m_sid` = `memberSid` ORDER BY `ReviewSid` DESC";
  //const sql = "SELECT `m_name` ,`m_sid` FROM `members`  WHERE 1";
  const [results, fields] = await db.query(sql);
  res.json(results);
});

app.use("/reviewproducts", require("./routes/productsitem"));

//商品規格
app.get("/productsspec", async (req, res) => {
  const sql = "SELECT * FROM `productsspec` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//商品種類（可能用不到）
app.get("/productstype", async (req, res) => {
  const sql = "SELECT * FROM `productstype` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

// 遊戲
app.get("/game", async (req, res) => {
  const sql1 = "SELECT q.* FROM `question` q ORDER BY rand() LIMIT 10";
  const [rs1] = await db.query(sql1);
  //rs1 會得到陣列包著隨機十筆物件（題目）
  const q_ids = rs1.map((r) => r.sid);
  // q_ids紀錄抓出來的題目編號,接著用WHERE IN 抓 answer 的資料
  const sql2 = `SELECT * FROM  \`answer\` WHERE question_sid IN (${q_ids.join(
    ","
  )}) `; 
  const [rs2] = await db.query(sql2);
  let new_arr = {
    answer0: { list: [] },
    answer1: { list: [] },
    answer2: { list: [] },
    answer3: { list: [] },
    answer4: { list: [] },
    answer5: { list: [] },
    answer6: { list: [] },
    answer7: { list: [] },
    answer8: { list: [] },
    answer9: { list: [] },
  };
  // rs2的陣列長度是40（10題題目搭配40個選項）,所以i無法拿來用
  rs2.map((v, i) => {
    // 塞入正確答案與對應的題號
    if (v.question_sid === q_ids[0] && v.yesno === "right") {
      new_arr.answer0.yes = v.acontent;
      new_arr.answer0.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[1] && v.yesno === "right") {
      new_arr.answer1.yes = v.acontent;
      new_arr.answer1.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[2] && v.yesno === "right") {
      new_arr.answer2.yes = v.acontent;
      new_arr.answer2.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[3] && v.yesno === "right") {
      new_arr.answer3.yes = v.acontent;
      new_arr.answer3.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[4] && v.yesno === "right") {
      new_arr.answer4.yes = v.acontent;
      new_arr.answer4.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[5] && v.yesno === "right") {
      new_arr.answer5.yes = v.acontent;
      new_arr.answer5.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[6] && v.yesno === "right") {
      new_arr.answer6.yes = v.acontent;
      new_arr.answer6.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[7] && v.yesno === "right") {
      new_arr.answer7.yes = v.acontent;
      new_arr.answer7.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[8] && v.yesno === "right") {
      new_arr.answer8.yes = v.acontent;
      new_arr.answer8.question_sid = v.question_sid;
    } else if (v.question_sid === q_ids[9] && v.yesno === "right") {
      new_arr.answer9.yes = v.acontent;
      new_arr.answer9.question_sid = v.question_sid;
    }
    // 在list中放入所有選項
    if (v.question_sid === q_ids[0]) {
      new_arr.answer0.list.push(v.acontent);
    } else if (v.question_sid === q_ids[1]) {
      new_arr.answer1.list.push(v.acontent);
    } else if (v.question_sid === q_ids[2]) {
      new_arr.answer2.list.push(v.acontent);
    } else if (v.question_sid === q_ids[3]) {
      new_arr.answer3.list.push(v.acontent);
    } else if (v.question_sid === q_ids[4]) {
      new_arr.answer4.list.push(v.acontent);
    } else if (v.question_sid === q_ids[5]) {
      new_arr.answer5.list.push(v.acontent);
    } else if (v.question_sid === q_ids[6]) {
      new_arr.answer6.list.push(v.acontent);
    } else if (v.question_sid === q_ids[7]) {
      new_arr.answer7.list.push(v.acontent);
    } else if (v.question_sid === q_ids[8]) {
      new_arr.answer8.list.push(v.acontent);
    } else if (v.question_sid === q_ids[9]) {
      new_arr.answer9.list.push(v.acontent);
    }
  });
  // console.log(new_arr);
    for (let j = 0; j < 10; j++) {
      if (new_arr.answer0.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer0.list;
        rs1[j].yes = new_arr.answer0.yes;
      }
      if (new_arr.answer1.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer1.list;
        rs1[j].yes = new_arr.answer1.yes;
      }
      if (new_arr.answer2.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer2.list;
        rs1[j].yes = new_arr.answer2.yes;
      }
      if (new_arr.answer3.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer3.list;
        rs1[j].yes = new_arr.answer3.yes;
      }
      if (new_arr.answer4.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer4.list;
        rs1[j].yes = new_arr.answer4.yes;
      }
      if (new_arr.answer5.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer5.list;
        rs1[j].yes = new_arr.answer5.yes;
      }
      if (new_arr.answer6.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer6.list;
        rs1[j].yes = new_arr.answer6.yes;
      }
      if (new_arr.answer7.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer7.list;
        rs1[j].yes = new_arr.answer7.yes;
      }
      if (new_arr.answer8.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer8.list;
        rs1[j].yes = new_arr.answer8.yes;
      }
      if (new_arr.answer9.question_sid === rs1[j].sid) {
        rs1[j].answers = new_arr.answer9.list;
        rs1[j].yes = new_arr.answer9.yes;
      }
    }
  // 整理好傳前端的rs1會同時保有原本question資料表的key再加上所有選項與正確答案
  res.json(rs1);
  // const sql2 = "SELECT q.`sid`,`name`,`qcontent`,`acontent`,`yesno` FROM (SELECT q.* FROM `question` q ORDER BY rand() LIMIT 10)q JOIN `answer` WHERE `question_sid` = q.`sid` LIMIT 40;";
  // const [results] = await db.query(sql);
});
app.post("/game-points", async (req, res) => {
  const sql =
    "INSERT INTO `bonus_list` ( `point_id`, `getTime_start`,`getTime_end` ,`bonus_status`,`m_id`) VALUES (?,?,?,?,?)";
  const [result, fields] = await db.query(sql, [
    req.body.point_id || "",
    req.body.getTime_start,
    req.body.getTime_end,
    req.body.bonus_status,
    req.body.m_id,
  ]);
  const output = {
    id: 0,
    info: "",
  };
  const sql2 =
    "SELECT bp.number FROM bonus_point bp JOIN bonus_list bl ON bp.point_sid =bl.point_id WHERE bl.bonusList_sid=?";
  const [rs2] = await db.query(sql2, [result.insertId]);

  output.id = result.insertId;

  output.info = rs2[0];
  output.info["getTime_start"] = req.body.getTime_start;
  output.info["getTime_end"] = req.body.getTime_end;
  output.info["bonus_status"] = req.body.bonus_status;
  output.info["m_id"] = req.body.m_id;

  return res.json(output);
  // res.json('success')
});
app.post("/chatbot", async (req, res) => {
  let output = {
    success: false,
    results: {
      respond: "抱歉，我聽不懂你在說什麼?\n您可以點選專人客服為您服務。",
    },
  };
  const message = req.body.request;
  let sql = "";
  console.log(message); //檢查用，正式時可刪除
  if (
    message.indexOf("你好") !== -1 ||
    message.indexOf("妳好") !== -1 ||
    message.indexOf("午安") !== -1 ||
    message.indexOf("早安") !== -1 ||
    message.indexOf("晚安") !== -1
  ) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%你好%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("地址") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%地址%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("票價") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%票價%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("紅利") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%紅利%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("志工") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%志工%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("園區") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%園區%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("點數") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%點數%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (
    message.indexOf("開放時間") !== -1 ||
    message.indexOf("幾點開門") !== -1 ||
    message.indexOf("營業") !== -1
  ) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%開放時間%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }
  if (message.indexOf("住宿") !== -1 || message.indexOf("房型") !== -1) {
    sql = "SELECT `respond` FROM `chatbot` WHERE `request` LIKE '%住宿資訊%'";
    const [results] = await db.query(sql);
    output.success = true;
    output.results = results[0];
  }

  res.json(output);
});
//遊戲
app.get("/roomdetail", async (req, res) => {
  const sql = "SELECT * FROM `roomdetail` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//住宿
app.get("/room-comments-list", async (req, res) => {
  const sql =
    "SELECT roomplatform.sid , roomplatform.service_score , roomplatform.clean_score , roomplatform.comfort_score , roomplatform.facility_score , roomplatform.cpValue_score, roomplatform.comments , members.m_name , orders_details_live.start  , orders_details_live.end, roomdetail.room_name FROM roomplatform JOIN members on roomplatform.m_sid = members.m_sid JOIN orders_details_live on roomplatform.order_detail_live_sid = orders_details_live.sid JOIN roomdetail on orders_details_live.room_sid = roomdetail.sid";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

//熱門活動一覽
app.get("/popularevents", async (req, res) => {
  const sql = "SELECT * FROM `animal_activity` ORDER BY `actDate` ASC";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

//住宿
app.get("/tour", async (req, res) => {
  const sql = "SELECT * FROM `address_1` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});
//園區導覽
app.get("/chatbot", async (req, res) => {
  const sql = "SELECT * FROM `chatbot` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

// 放在所有路由的後面
app.use((req, res) => {
  res.status(404).send(`<h2>404-找不到網頁</h2>`);
  // 設定狀態碼
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`server started: ${port} -`, new Date());
});
server.listen(3001, () => {
  console.log("listening on *:3001");
});
