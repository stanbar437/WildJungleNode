const express = require("express");
const db = require("./../modules/connect-db");
const upload = require("./../modules/upload-imgs");

const router = express.Router();

//海洋房資料

router.get("/room-comments-oceanlist", async (req, res) => {
  const sql =
    "SELECT roomplatform.sid , roomplatform.service_score , roomplatform.clean_score , roomplatform.comfort_score , roomplatform.facility_score , roomplatform.cpValue_score, roomplatform.comments , members.m_name , orders_details_live.start  , orders_details_live.end, roomdetail.room_name FROM roomplatform JOIN members on roomplatform.m_sid = members.m_sid JOIN orders_details_live on roomplatform.order_detail_live_sid = orders_details_live.sid JOIN roomdetail on orders_details_live.room_sid = roomdetail.sid WHERE roomdetail.sid=1 ORDER BY roomplatform.sid DESC";

  const [results] = await db.query(sql);

  res.json(results);
});

//冰原房資料

router.get("/room-comments-icelist", async (req, res) => {
  const sql =
    "SELECT roomplatform.sid , roomplatform.service_score , roomplatform.clean_score , roomplatform.comfort_score , roomplatform.facility_score , roomplatform.cpValue_score, roomplatform.comments , members.m_name , orders_details_live.start  , orders_details_live.end, roomdetail.room_name FROM roomplatform JOIN members on roomplatform.m_sid = members.m_sid JOIN orders_details_live on roomplatform.order_detail_live_sid = orders_details_live.sid JOIN roomdetail on orders_details_live.room_sid = roomdetail.sid WHERE roomdetail.sid=2 ORDER BY roomplatform.sid DESC";

  const [results] = await db.query(sql);

  res.json(results);
});

//夜行房資料

router.get("/room-comments-nocturnallist", async (req, res) => {
  const sql =
    "SELECT roomplatform.sid , roomplatform.service_score , roomplatform.clean_score , roomplatform.comfort_score , roomplatform.facility_score , roomplatform.cpValue_score, roomplatform.comments , members.m_name , orders_details_live.start  , orders_details_live.end, roomdetail.room_name FROM roomplatform JOIN members on roomplatform.m_sid = members.m_sid JOIN orders_details_live on roomplatform.order_detail_live_sid = orders_details_live.sid JOIN roomdetail on orders_details_live.room_sid = roomdetail.sid WHERE roomdetail.sid=3 ORDER BY roomplatform.sid DESC";

  const [results] = await db.query(sql);

  res.json(results);
});

//熱帶房資料

router.get("/room-comments-tropicallist", async (req, res) => {
  const sql =
    "SELECT roomplatform.sid , roomplatform.service_score , roomplatform.clean_score , roomplatform.comfort_score , roomplatform.facility_score , roomplatform.cpValue_score, roomplatform.comments , members.m_name , orders_details_live.start  , orders_details_live.end, roomdetail.room_name FROM roomplatform JOIN members on roomplatform.m_sid = members.m_sid JOIN orders_details_live on roomplatform.order_detail_live_sid = orders_details_live.sid JOIN roomdetail on orders_details_live.room_sid = roomdetail.sid WHERE roomdetail.sid=4 ORDER BY roomplatform.sid DESC";

  const [results] = await db.query(sql);

  res.json(results);
});

//商品資料

router.get("/home-products", async (req, res) => {
  const sql =
    "SELECT `ProductsName`,`ProductsPrice`,`ProductsMainPic` FROM `products` JOIN `productspic` on products.ProductsPic = productspic.ProductsPic";

  const [results] = await db.query(sql);

  res.json(results);
});

//是否為會員與訂購人

router.post("/room-order", async (req, res) => {
  const sql =
    "SELECT * FROM `orders` LEFT JOIN orders_details_live ON orders.order_sid = orders_details_live.orders_sid WHERE m_sid = ?";

  const [result] = await db.query(sql, [req.body.m_sid]);

  res.json(result);
});

router.post("/room-comments-post", async (req, res) => {
  const output = {
    success: false,
    error: "",
  };
  try {
    const sql =
      "INSERT INTO `roomplatform`(`service_score`, `clean_score`, `comfort_score`, `facility_score`, `cpValue_score`, `comments` , `m_sid`,`order_sid` , `order_detail_live_sid`) VALUES (?,?,?,?,?,?,?,?,?)";

    const [result] = await db.query(sql, [
      req.body.serve,
      req.body.clean,
      req.body.comfort,
      req.body.facility,
      req.body.cpValue,
      req.body.commentTextarea,
      req.body.m_sid,
      req.body.order_sid,
      req.body.order_detail_live_sid,
    ]);

    if (!!result.length) {
      output.error = "無法成功";
      return res.json(output);
    } else {
      console.log(result);
      output.success = true;
      output.result = result;
      // res.json(output);
      return res.json(result);
    }
  } catch (er) {
    return res.json(er);
  }
  // return res.json(output);
});


//刪除
router.get('/room-comments/delete/:sid', async (req, res)=>{
  console.log(req.params.sid)
  const output={
      success:false,
      error:''
  }

  const sql=`DELETE FROM roomplatform WHERE sid=${req.params.sid}`;
  const [rs]=await db.query(sql);
  if(rs.affectedRows===0){
      output.error='沒有此筆資料'
      return res.json(output)
  }else{
      output.success=true;
      output.error='刪除成功'
      return res.json(output)
  }
  return res.json(output)
});



module.exports = router;
