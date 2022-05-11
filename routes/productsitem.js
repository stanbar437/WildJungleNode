const express = require("express");
const db = require("../modules/connect-db");
const upload = require("./../modules/upload-imgs");
const router = express.Router();

// async function getListData(req, res) {

//     const output = {
//         //success:false,
//         perpage,
//         page,
//         totalRows: 0,
//         totalPages: 0,
//         rows: [],
//         conditions
//     };

//     const t_sql = `SELECT COUNT(1) num FROM product_item ${sqlWhere}`;
//     //return res.send(t_sql); // 除錯用
//     const [rs1] = await db.query(t_sql);
//     const totalRows = rs1[0].num;
//     //let totalPages = 0;
//     if (totalRows) {
//         output.totalPages = Math.ceil(totalRows / perpage);
//         output.totalRows = totalRows;
//         if (page > output.totalPages) {
//             return res.redirect(`product-item/list?page=${output.totalpages}`);
//         }

//         const sql = `SELECT * FROM \`product_item\` ${sqlWhere} ORDER BY sid DESC LIMIT ${perpage * (page - 1)},${perpage}`;

//         const [rs2] = await db.query(sql);
//         rs2.forEach(el => {
//             let str = res.locals.toDateString(el.create_at);
//             if (str == 'Invaild date') {
//                 el.create_at = '沒有輸入資料';
//             } else {
//                 el.create_at = str;
//             };
//         });
//         output.rows = rs2;
//     }
//     return output;
// }
router.get("/add1", async (req, res) => {
  const sql = "SELECT * FROM `productsreview` WHERE 1";

  const [results, fields] = await db.query(sql);

  res.json(results);
});

router.post("/add", async (req, res) => {
  const output = {
    success: false,
    error: "",
  };
  const sql =
    "INSERT INTO `productsreview` ( `ProductsReview`, `ReviewStar`, `Review`, `memberSid`, `ReviewDate`) VALUES ( ?, ?,  ?, ?,current_timestamp())";

  const [result] = await db.query(sql, [
    req.body.ProductsReview || null,
    req.body.ReviewStar || null,
    req.body.Review || null,
    req.body.memberSid || null,
    req.body.ReviewDate || null,
  ]);

  console.log(result);
  output.success = !!result.affectedRows;
  output.result = result;
  res.json(output);
});

router.get("/delete/:sid", async (req, res) => {
  const sql = "DELETE FROM productsreview WHERE ReviewSid = ?";
  const [result] = await db.query(sql, [req.params.sid]);
  res.json(result);
});

// router.get("/edit/:sid", async (req, res) => {
//   const sql = "SELECT * FROM product_item WHERE sid = ?";
//   const [rs] = await db.query(sql, [req.params.sid]);
//   if (!rs.length) {
//     return res.redirect("/product-item/list");
//   }
//   res.render("product-item/edit", rs[0]);
// });

// router.post("/edit/:sid", async (req, res) => {
//   const output = {
//     success: false,
//     error: "",
//   };
//   const sql = "UPDATE `product_item` SET ? WHERE sid =?";
//   const [result] = await db.query(sql, [req.body, req.params.sid]);

//   console.log(result);
//   output.success = !!result.changedRows;
//   output.result = result;
//   res.json(output);
// });
module.exports = router;