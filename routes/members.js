const express = require('express');
const db = require('./../modules/connect-db');
const upload = require('./../modules/upload-imgs');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const nodemailer = require("nodemailer");

const router = express.Router();

// 7-11 api
const GetData = require('../controllers/get_controller');
const getData = new GetData();

// 全台7-11店家資料
// router.get('/711/api', getData.getStroes); 
router.get('/city/api',async(req,res)=>{
    const taiwan=require('../data/store_id.json');
    return res.json(taiwan.result)
})
// 區域資料
router.get('/711-areas/api/:id', getData.getAreas); 
// 某市某區店家資料
router.get('/711-oneareastores/api', getData.getAreaStores); 


async function getListData(req, res){
    const perPage = 5; // 每一頁最多幾筆
    // 用戶要看第幾頁
    let page = req.query.page ? parseInt(req.query.page) : 1;
    if(page<1){
        return res.redirect('/members/list');
    }
    
    const conditions = {};  // 傳到 ejs 的條件
    let search = req.query.search ? req.query.search : '';
    search = search.trim(); // 去掉頭尾空白
    let sqlWhere = ' WHERE 1 ';
    if(search){
        sqlWhere += ` AND \`name\` LIKE ${db.escape('%'+search+'%')} `;
        conditions.search = search;
    }

    // 輸出
    const output = {
        // success: false,
        perPage,
        page,
        totalRows: 0,
        totalPages: 0,
        rows: [],
        conditions
    };

    const t_sql = `SELECT COUNT(1) num FROM members ${sqlWhere} `;
    // return res.send(t_sql); // 除錯用
    const [rs1] = await db.query(t_sql);
    const totalRows = rs1[0].num;
    // let totalPages = 0;
    if(totalRows) {
        output.totalPages = Math.ceil(totalRows/perPage);
        output.totalRows = totalRows;
        if(page > output.totalPages){
            // 到最後一頁
            return res.redirect(`/members/list?page=${output.totalPages}`);
        }

        // const sql = `SELECT * FROM \`members\` ${sqlWhere} ORDER BY sid DESC LIMIT ${perPage*(page-1)}, ${perPage} `;
        const sql =`SELECT * FROM \`members\` ${sqlWhere} ORDER BY m_sid DESC`;
        const [rs2] = await db.query(sql);
        rs2.forEach(el=>{
            let str = res.locals.toDateString(el.birthday);
            if(str === 'Invalid date'){
                el.birthday = '沒有輸入資料';
            } else {
                el.birthday = str;
            }

        });
        output.rows = rs2;
    }

    return output.rows;
}
// async function getorderData(req, res){

//     // 輸出
//     const output = {
//         // success: false,
//         // perPage,
//         // page,
//         // totalRows: 0,
//         // totalPages: 0,
//         rows: [],
//         // conditions
//     };
//     // return res.json('123');
//     // let sqlWhere = ' WHERE 1 ';
//     // const t_sql = `SELECT COUNT(1) num FROM members ${sqlWhere} `;
//     // // return res.send(t_sql); // 除錯用
//     // const [rs1] = await db.query(t_sql);
//     // const totalRows = rs1[0].num;


//     const sql ="SELECT m.`m_sid`,m.`email`,o.`amount`,o.`order_sid`,o.`order_date`,tp.`room_sid`,tp.`start`,tp.`end` FROM `members` m JOIN `orders` o ON m.`m_sid`=o.`users_sid` JOIN `orders_details_live` tp ON o.`order_sid`=tp.`orders_sid` ORDER BY m.`m_sid` DESC";

//         /* 
//         SELECT * FROM `members` m
//         JOIN `orders` o
//         ON m.m_sid=o.users_sid
//         JOIN `order_details_products` tp
//         ON o.sid=tp.order_sid
//         ORDER BY m.m_sid DESC
//         */
    
//     const [rs2] = await db.query(sql);
//     rs2.forEach(el=>{
//         // let str = res.locals.toDateString(el.birthday);
//         let str2 = res.locals.toDatetimeString(el.order_date);
//         if(str2 === 'Invalid date'){
//             el.order_date = '沒有輸入資料';
//         } else {
//             // el.birthday = str;
//             el.order_date = str2;
//         }
//     });
//     return res.json(rs2)
    
    
    
//     const resultData = [];

//     const dict = {};
//     for(let i of rs2){
//         dict[i.o_sid] = i;
//         // 訂單編號
//     }

    
//     let ar1= [];
//     for(let i of rs2){
//         const parent = dict[i.order_sid];
//             if(! parent.list) {
//                 parent.list = [];
//             }
//         // console.log('parent--',parent);
//         // 每個{}在array的哪個位置
        

//         resultData.push(parent);
//         console.log(parent);
//         // let pLength = Object.keys(parent).length;
//         // console.log('object長度:',pLength);
//         // console.log('array長度:',rs2.length);
//         // let p= i.product_sid;
//         // console.log('p:',p);
        
//         // console.log(i["order_sid"]);
    
        
//         // if(parent["order_sid"]!=parent["order_sid"]){

//         // }else{

//         // }
        
//         const ps={};
//         ps["order_sid"]=i.order_sid;
//         ps["product_sid"]=i.product_sid;
//         ps["product_price"]=i.product_price;
//         ps["product_quantity"]=i.product_quantity;
//         console.log('ps--',ps);
        

//         // parent.list.push('7');
        
//         if(parent.order_sid==ps.order_sid){
//             parent.list.push(ps);
//             // resultData.push(ps);
//         }
//         // for(let k of parent)

//         // switch(i.o_sid){
//         //     case 111:
//         //         parent.list={'order_sid':i.order_sid,'order_date':i.order_date,'product_sid':i.product_sid};
//         //         resultData.push(i);
//         //     break;
            
//         // }
//     }
//     // list塞入要的資料

//     // console.log(resultData);
//     // output.rows = orderObj;
//     // output.rows = rs2;
//     output.rows = resultData;

//     // }

//     return output.rows;
// }

async function getsidData(req,res){
    const output={
        success:false,
        error:''
    }
    const sid=req.params.sid;

    if(res.locals.auth && res.locals.auth.m_sid){
        // console.log(res.locals.auth.m_sid);
        // SELECT m.`m_sid`,m.`email`,m.`m_name`,m.`password`,m.`birthday`,m.`m_address`,g.`img` FROM `members` m LEFT JOIN `grade` g ON m.`grade_sid`=g.`grade_sid` WHERE m.`m_sid`=8
        const sql=`SELECT m.m_sid,m.email,m.m_name,m.gender,m.password,m.birthday,m.m_address,g.img FROM members m LEFT JOIN grade g ON m.grade_sid=g.grade_sid WHERE m.m_sid=${res.locals.auth.m_sid}`
        const [rs]=await db.query(sql);
        if(!rs.length){
            // console.log(rs);
            output.error='沒有此筆資料';
        }
        // rs[0].birthday=rs[0].birthday.split('T')[0];
        output.success=true;
        output.info=rs[0];
        return output;
    }else{
        output.error='沒有授權';
        return output;
    }

    
    

    return output;
}



// 取得房型訂單資料
router.get('/api/orders', async (req, res) => {
    const sql ="SELECT m.`m_sid`,m.`email`,o.`amount`,o.`order_sid`,o.`order_date`,tp.`room_sid`,tp.`start`,tp.`end` FROM `members` m JOIN `orders` o ON m.`m_sid`=o.`users_sid` JOIN `orders_details_live` tp ON o.`order_sid`=tp.`orders_sid` ORDER BY m.`m_sid` DESC";
    const [rs2] = await db.query(sql);
    rs2.forEach(el=>{
        // let str = res.locals.toDateString(el.birthday);
        let str2 = res.locals.toDatetimeString(el.order_date);
        if(str2 === 'Invalid date'){
            el.order_date = '沒有輸入資料';
        } else {
            el.order_date = str2;
        }
    });

    return res.json(rs2)
})

router.get('/login', async (req, res)=>{
    res.json('login');
});
// 登入
router.post('/login', async (req, res)=>{
    // return res.json(req.body);
    const {email,password}=req.body;
    const [rs] = await db.query(`SELECT * FROM members WHERE email=?`,[email]);
    // 有加密密碼，故無法由SQL同時判斷密碼是否符合

    const output = {
        success: false,
        error: '',
        info: null,
        token: '',
        code: 0,
    };
    if(! rs.length){
        output.error='帳密錯誤';
        output.code=401;
        return res.json(output);
    }else{
        // 比對密碼
        const row=rs[0];
        const compareResuly=await bcrypt.compare(password, row.password);
        if(! compareResuly){
            output.error='帳密錯誤';
            output.code=402;
            return res.json(output);
        }else{

            // 是否驗證過信件
            if(!row.check_email){
                output.error='請至您的信箱，收取驗證信';
                output.code=452;
                return res.json(output);
            }else{
                output.success = true;
                output.token = jwt.sign({m_sid:row.m_sid, email}, process.env.JWT_KEY);
                const sql3=`UPDATE members SET check_code=? WHERE m_sid=?`;
                const [rs3]=await db.query(sql3,[output.token,row.m_sid])
                output.account = {
                    m_sid: row.m_sid,
                    email: row.email,
                    m_name: row.m_name,
                };
                return res.json(output);
            }
        }
    }
    // return res.json(output);
});

// 取得對應sid的會員資料
router.get('/edit/:sid', async (req, res)=>{
    res.json(await getsidData(req, res));
});

// 修改
router.post('/edit/:sid', async (req, res)=>{
    // return res.json(req.body)
    const output={
        success:false,
        error:'',
        info:''
    }
    console.log(res.locals.auth);
    // 取得前端帶來的token解密
    // {m_sid:row.m_sid, email}
    if(res.locals.auth && res.locals.auth.email){
        // return res.json({success:true, info:res.locals.auth.email})
        let {name,gender,password,birthday,address}=req.body
        const email=res.locals.auth.email;
        const m_sid=res.locals.auth.m_sid;

        // 取原先資料庫加密過後的密碼
        const selectPass="SELECT password FROM members WHERE m_sid="+`${m_sid}`
        const [rs1]=await db.query(selectPass);
        // console.log(selectPass)
        // console.log(rs1[0])
        
        if(password===""){
            // return res.json(birthday)
            const [rs]=await db.query(`UPDATE members SET m_name=?,gender=?,birthday=?,m_address=?  WHERE m_sid=${m_sid}`,[name,gender,birthday,address])
            // return res.json(rs)
            // return res.json(req.body)
            if(rs.changedRows!==0){
                output.success=true;
                output.status=500;
                return res.json(output)
            }else{
                output.error='沒有變更'
                output.status=501;
                return res.json(output)
            }


        }else{
            // 進來有值先比對
            // return res.json(password)
            if(bcrypt.compareSync(password,rs1[0].password)){
                // 密碼相同就不更新密碼
                // return res.json(password)
                const [rs2]=await db.query(`UPDATE members SET m_name=?,gender=?,birthday=?,m_address=?  WHERE m_sid=${m_sid}`,[name,gender,birthday,address])
                // return res.json(rs)
                if(rs2.changedRows!==0){
                    output.success=true;
                    output.info='提醒! 已更新，但密碼相同';
                    output.status=600;
                    return res.json(output);
                }else{
                    output.error='沒有變更'
                    output.status=601;
                    return res.json(output);
                }

                
            }else{
                // 比對為不同密碼就加密
                password=bcrypt.hashSync(password);
                // return res.json(password)
                const [rs3]=await db.query(`UPDATE members SET m_name=?,gender=?,password=?,birthday=?,m_address=?  WHERE m_sid=${m_sid}`,[name,gender,password,birthday,address])
                // return res.json(rs)
                if(rs3.changedRows!==0){
                    output.success=true;
                    output.status=300;
                    return res.json(output)
                }else{
                    output.error='沒有變更'
                    output.status=301;
                    return res.json(output)
                }
            }

        }

        
    } else {
       return res.json({success: false, error: '沒有授權'});
    }
    // return res.json(req.body)
    
    
        
    // res.json(rs)
    // res.json(output)
});

// 註冊
router.post('/signup', upload.none(),async (req, res)=>{
    // return res.json(req.body)
    const output={
            success:false,
            error:''
        };

    const sql2="SELECT email FROM members WHERE 1"
    const [rs2]=await db.query(sql2)
    let newAr=[]

    rs2.forEach((el)=>{
        if(el.email===req.body.email){
        newAr.push(el)
        }
    })
    
    // return res.json(newAr[0].email)
    // return res.json(newAr.length)

    // 沒有相同帳號的話
    if(!newAr.length){

        try{
            const sql = "INSERT INTO members ( `email`, `m_name`,`gender` ,`birthday`,`password`,`grade_sid`,`check_code`,`check_email`) VALUES (?,?,?,?,?,?,?,?)";
            
            const [result]=await db.query(sql,[
                req.body.email,
                req.body.name,
                req.body.gender,
                req.body.birthday || '',
                bcrypt.hashSync(req.body.password),
                1,
                '',
                0
            ]);
            console.log('result:',result);
            output.success=!!result.affectedRows;
            output.result=result;
            console.log('resultID:',result.insertId);
        }catch(error){
            console.log('error:',error)
            output.error='無法註冊'
        }
        // 可成功註冊就寄信給用戶
        if(output.success){
            // return res.json(req.body)
            // 成功註冊先將token記錄在資料庫
            const sql1 = "UPDATE `members` SET `check_code`=? WHERE `m_sid`=?";
            let newCode=jwt.sign({"m_sid":output.result.insertId,"email":req.body.email},process.env.JWT_KEY)
            const [rs1]=await db.query(sql1,[newCode,output.result.insertId]);

            let testAccount = await nodemailer.createTestAccount();
            let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true, // true for 465, false for other ports
                auth: {
                user: process.env.TYSU_SENDEMAIL, // Gmail 帳號
                pass:process.env.TYSU_SENDEMAIL_PASS, // Gmail 的應用程式的密碼
                },
            });
            // 讓用戶驗證
            let info = await transporter.sendMail({
                from: '"Wild Jungle" <wildjungle2022@gmail.com>', // 發送者
                to: req.body.email, // 收件者(req.body.email)
                subject: "Welcome! 歡迎您加入 Wild Jungle", // 主旨
                text: `Hello ${req.body.name}! 歡迎您加入Wild Jungle會員，前往驗證並登入`, // 預計會顯示的文字
                html: `<h3>Hello ${req.body.name}! 歡迎您加入Wild Jungle會員，<a href="http://localhost:3000/members/confirm?id=${newCode}">前往驗證</a>並登入</h3>`, // html body 實際顯示出來的結果
            });
            
            console.log("Message sent: %s", info.messageId);
            
        }

    }else{
        // 有相同帳號的話
        output.error='已有此帳號'
    }

    res.json(output);

});

// 驗證
router.get('/confirm', async (req, res)=>{
    const output={
        success:false,
        error:''
    }
    if(res.locals.auth && res.locals.auth.m_sid){
        console.log(res.locals.auth);
        // return res.json(req.headers)
        const sql=`SELECT check_code FROM members WHERE m_sid=${res.locals.auth.m_sid}`
        const [rs]=await db.query(sql);
        if(!rs.length){
            output.error='沒有此會員資料'
            return res.json(output);
        }else{
            const sql2=`UPDATE members SET check_email=1 WHERE m_sid=${res.locals.auth.m_sid}`;
            const [rs2]=await db.query(sql2);
            if(!rs2){
                output.error='啥狀況';
                return res.json(output);
            }else{
                output.success=true;
                output.info='WELCOME　TO　JOIN　US';
                return res.json(output);
            }
        }
    }else{
        // return res.json(req.headers)
            output.error='您沒有得到授權/沒有此會員資料';
            return res.json(output);
    }
    // return res.json(output);
});

// 登出
router.get('/logout', async (req, res)=>{

    if(res.locals.auth && res.locals.auth.m_sid){
        localStorage.removeItem('admin_account');
        localStorage.removeItem('admin_token');
    }else{

    }
});


// 取得等級的json檔
router.get('/grade/list', async (req, res)=>{
    const sql="SELECT * FROM grade"
    const [rs]=await db.query(sql);
    res.json(rs)
});

// 取得商品列表
router.get('/product-like', async (req, res)=>{
    const sql="SELECT `ProductSid`,`ProductsName`,`ProductsPrice`,`ProductsMainPic` FROM `products`"
    const [rs]=await db.query(sql);

    return res.json(rs)
});

router.get('/product-like-info/:m_id', async (req, res)=>{
    const output={
        success: false,
        error:''
    }
    const sql="SELECT p_id FROM favorite WHERE m_id=?"
    const [rs]=await db.query(sql,[req.params.m_id]);

    if(!rs.length){
        output.error='沒有已加入收藏的內容'
    }else{
        const pId=rs.map((v,i)=>{
            return v.p_id
        })
        const pIdtoString=pId.map((v,i)=>{
            return v.split(',')
        })
        // 資料庫已收藏的商品
        const someCombined=pIdtoString.reduce(
            function(a, b) {
                return a.concat(b);
            },
            []
            );
        // console.log(someCombined)
        output.success=true;
        output.info=someCombined;
        return res.json(output);
    }
    return res.json(output)
});

// router.post('/product-like', async (req, res)=>{
//     const output={
//         success: false,
//         error:''
//     }
//     const {p_id,add_time,m_id}=req.body;
//     // return res.json(p_id.split(','))
//     const sql2="SELECT p_id,add_time,m_id FROM favorite WHERE m_id=?"
//     const [rs2]=await db.query(sql2,[m_id]);
//     // return res.json(rs2)
//     if(!rs2.length){
        
//         try{
//             const sql="INSERT INTO `favorite`(`p_id`, `add_time`, `m_id`) VALUES (?,?,?) "
//             const [rs]=await db.query(sql,[p_id,add_time,m_id]);
//         // INSERT INTO `favorite`(`p_id`, `add_time`, `m_id`) VALUES ('1,5','2022/04/06',3)
    
//             return res.json(rs)
//         }catch(err){
//             console.log(err)
//             return res.json(err)
//         }
//     }else{
//         // return res.json(rs2)
//         const newLike=p_id.split(',')
//         const a1=rs2.map((v,i)=>{
//             return v.p_id
//         })
//         const b2=a1.map((v,i)=>{
//             return v.split(',')
//         })
//         // 資料庫已收藏的商品
//         const someCombined=b2.reduce(
//             function(a, b) {
//               return a.concat(b);
//             },
//             []
//           );
//         // return res.json(someCombined);
        
//         let kk=[] //找出相同項目
//         let otherEl=[]
//         if(someCombined.length>newLike.length){
//             someCombined.forEach((v)=>{
//                 newLike.forEach((el)=>{
//                     // console.log(v,el)
//                     if(v===el){
//                         kk.push(el)
//                     }
//                 })
//             })
            
//         }else{
//             newLike.forEach((v)=>{
//                 someCombined.forEach((el)=>{
//                     // console.log(v,el)
//                     if(v===el){
//                         kk.push(el)
//                     }
//                 })
//             })
//         }
//         let zz=[]
//         if(kk.length!==0){
            
//             output.error='有項目已加入過'
//             output.info=kk;
//         }else{
//             output.success=true;
//             output.info='加入成功';
//         }
//         return res.json(zz)

//         // return res.json(rs2[0].p_id.split(','))
//         // const sql3="INSERT INTO `favorite`(`p_id`, `add_time`, `m_id`) VALUES (?,?,?) "
//         //     const [rs3]=await db.query(sql,[p_id,add_time,m_id]);
//     }
    
// });

// 增加信用卡資料

router.post('/creditcard/add', async (req, res)=>{
    // return res.json(req.body)
    const output ={
        success:false,
        error:'',
    }
    if(res.locals.auth && res.locals.auth.email){
        const{number,name,expiry,cvc}=req.body;
        const sql="INSERT INTO `credit_card`(`credit_num`,`credit_name`, `credit_date`, `credit_code`,`m_id`) VALUES (?,?,?,?,?)"
        const [rs]=await db.query(sql,[number,name,expiry,cvc,res.locals.auth.m_sid]);
        // return res.json(rs);
        if(!rs.insertId){
            output.error='沒有新增'
            return res.json(output);
        }else{
            output.success=true;
            output.info=rs.insertId
            return res.json(output);
        }
    }
    
    return res.json(rs)
});

// 取得信用卡資料
// 123456 // $2a$10$9nFkUVAoDtY1CdMo1JbWre/C.v3G0XJp9mkWevOHG8CFmWivHiSCy
router.get('/creditcard/:sid', async (req, res)=>{
    const output={
        success:false,
        error:'',
        info:''
    }
    if(res.locals.auth && res.locals.auth.email){
        const sid=req.params.sid;
        const sql=`SELECT * FROM credit_card WHERE m_id=${sid} ORDER BY credit_sid DESC`
        const [rs]=await db.query(sql);

        if(!rs.length){
            output.error='尚未設定';
            return res.json(output);
        }else{
            let newObj={}
            rs.map((v,i)=>{
                return newObj.m_sid=v.m_id
            })
            let list=[]
            rs.map((v,i)=>{
                list.push({"credit_sid":v.credit_sid,"credit_num":v.credit_num,"credit_name":v.credit_name,"credit_date":v.credit_date,"credit_code":v.credit_code})
            })
            newObj.list=list
            output.success=true;
            output.info=newObj;
            return res.json(output);
        }
        
        // {
        //     "m_sid": 8,
        //     "list": [
        //         {
        //             "credit_sid": 1,
        //             "credit_num": "562178451234",
        //             "credit_date": "0227",
        //             "credit_code": 756
        //         },
        //         {
        //             "credit_sid": 4,
        //             "credit_num": "562178451234",
        //             "credit_date": "1224",
        //             "credit_code": 756
        //         }
        //     ]
        // }

    }else{
        return res.json({success: false, error: '沒有授權'});
    
    }
    
});

// 刪除信用卡資料
router.get('/creditcard/delete/:card', async (req, res)=>{
    console.log(req.params.card)
    // return res.json('params',req.params.card)
    const output={
        success:false,
        error:''
    }

    const sql=`DELETE FROM credit_card WHERE credit_sid=${req.params.card}`;
    const [rs]=await db.query(sql);
    // console.log(rs)
    // return res.json(rs)
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



// 房間的訂單資料
router.get('/orders/:sid', async (req, res)=>{
    const output={
        success:false,
        error:'',
        info:''
    }
    // if(res.locals.auth && res.locals.auth.email){
        const sid=req.params.sid;
        const sql=`SELECT * FROM orders WHERE m_sid=${sid}`
        const [rs]=await db.query(sql);
        // return res.json(rs)

        // "SELECT m.`m_sid`, o.`amount`, o.`order_sid`, o.`order_date`, tl.`room_count`, tl.`start`,tl.`end`, rd.`room_name`, rd.`price`, p.`method` FROM `members` m JOIN `orders` o ON m.`m_sid`=o.`m_sid` JOIN `orders_details_live` tl ON o.`order_sid`=tl.`orders_sid` JOIN `roomdetail` rd ON rd.`sid`=tl.`room_sid` JOIN `payment` p ON p.`payment_sid`=o.`payment_sid` ORDER BY m.`m_sid` DESC"
        const sql2 =`SELECT m.\`m_sid\`, o.\`amount\`, o.\`order_sid\`, o.\`order_date\`, tl.\`room_count\`, tl.\`start\`,tl.\`end\`, rd.\`room_name\`, rd.\`price\`, p.\`method\` FROM \`members\` m JOIN \`orders\` o ON m.\`m_sid\`=o.\`m_sid\` JOIN \`orders_details_live\` tl ON o.\`order_sid\`=tl.\`orders_sid\` JOIN \`roomdetail\` rd ON rd.\`sid\`=tl.\`room_sid\` JOIN \`payment\` p ON p.\`payment_sid\`=o.\`payment_sid\` WHERE m.\`m_sid\`=${sid} ORDER BY m.\`m_sid\` DESC `;
        const [rs2] = await db.query(sql2);
        // [{
        //         "m_sid": 1,
        //         "amount": 9000,
        //         "order_sid": 1,
        //         "order_date": "2021-10-24",
        //         "room_count": 2,
        //         "start": "2021-11-29",
        //         "end": "2021-12-01",
        //         "room_name": "冰原3人房型",
        //         "price": "4500",
        //         "method": "現金"
        // }]

        // rs2.forEach(el=>{
        //     // let str = res.locals.toDateString(el.birthday);
        //     let str2 = res.locals.toDatetimeString(el.order_date);
        //     if(str2 === 'Invalid date'){
        //         el.order_date = '沒有輸入資料';
        //     } else {
        //         el.order_date = str2;
        //     }
        // });

        return res.json(rs2)




    // }else{
    //     return res.json({success: false, error: '沒有授權'});
    
    // }
    
});

// 忘記密碼處理
router.post('/forgotpass', async (req, res)=>{
    const output={
        success:false,
        error:'',
        info:''
    }
    const {email} =req.body;
    // console.log(typeof(email))
    // return res.json(req.body.email)
    const sql=`SELECT m_sid,email FROM members WHERE 1`;
    const [rs]=await db.query(sql);
    const newArr= rs.map((v,i)=>{
        return v.email
    })
    const yesno=newArr.filter((v)=>{
        return v===email
    })
    // console.log(yesno)
    if(email===''){
            return res.json(output);
    }else{
        if(yesno.length!==0){
            output.success=true;
            output.info='好的，已發送mail，請至您的信箱查看';

            const sql1 = "UPDATE `members` SET `check_code`=? WHERE `m_sid`=?";
            let newCode=jwt.sign({"m_sid":rs.m_sid,"email":email},process.env.JWT_KEY)
            const [rs1]=await db.query(sql1,[newCode,rs.m_sid]);
            // console.log(rs1)
            let testAccount = await nodemailer.createTestAccount();
            let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true, // true for 465, false for other ports
                auth: {
                user: process.env.TYSU_SENDEMAIL, // Gmail 帳號
                pass:process.env.TYSU_SENDEMAIL_PASS, // Gmail 的應用程式的密碼
                },
            });
            // 讓用戶驗證
            let info = await transporter.sendMail({
                from: '"Wild Jungle" <wildjungle2022@gmail.com>', // 發送者
                to: req.body.email, // 收件者(req.body.email)
                subject: "Wild Jungle 通知:請儘速變更您的密碼", // 主旨
                text: `您剛才操作忘記密碼步驟，收到驗證信請儘速變更您的密碼`, // 預計會顯示的文字
                html: `<h3>您剛才操作忘記密碼步驟，收到驗證信請儘速變更您的密碼</h3><h4><a href="http://localhost:3000/members/password-change?auth=${newCode}">前往驗證</a>並登入</h4>`, // html body 實際顯示出來的結果
            });
            
            console.log("Message sent: %s", info.messageId);


            return res.json(output);
        }else{
            output.error='此帳號沒有註冊過';
            return res.json(output);
        }
    }
        
        
 
    
    

    // console.log(newArr)
    return res.json('測試')
});

// 更改密碼
router.post('/changepass', async (req, res)=>{
    const output={
        success:false,
        error:''
    }    

    if(res.locals.auth && res.locals.auth.email){
        // SELECT password FROM members WHERE email=?
        const sql2=`SELECT password FROM members WHERE email=?`
        const [rs2]=await db.query(sql2,[res.locals.auth.email]);
        // return res.json(rs2)
        
        // 沒有找到密碼
        if(!rs2.length){
            output.error='沒有資料'
            return res.json(output);
        }else{
            // console.log(req.body.password)
            // console.log(rs2[0].password)
            
            if(bcrypt.compareSync(req.body.password,rs2[0].password)){
                output.error='不可與上一次的密碼相同'
                return res.json(output);
            }else{

                const newPass=bcrypt.hashSync(req.body.password);
                // UPDATE members SET password=? WHERE m_sid=?
                const sql=`UPDATE members SET password=? WHERE email=?`
                const [rs]=await db.query(sql,[newPass,res.locals.auth.email]);

                if(rs.changedRows!==0){
                    output.success=true;
                    output.error='已更改成功，請重新登入';
                    return res.json(output);
                }else{
                    output.error='變更失敗';
                    return res.json(output);
                }
            }
        }

    }else{
        output.error='沒有授權';
        return res.json(output);
    }
});


// 取得會員點數資訊
router.get('/bonus/list/:sid', async (req, res)=>{
    const output={
        success:false,
        error:''
    }

    const sql="SELECT bl.bonusList_sid,bl.getTime_start,bl.getTime_end,bl.bonus_status,bp.name,bp.number,bp.limitDate FROM bonus_list bl JOIN bonus_point bp ON bl.point_id=bp.point_sid WHERE bl.m_id=? ORDER BY bonusList_sid DESC"
    const [rs]=await db.query(sql,[req.params.sid]);
    if(!rs.length){
        output.error='沒有獲得的點數'
    }else{
        output.success=true
        output.info=rs
    }
    return res.json(output)

    
});





// 便利商店配送設定
router.post('/convenience-store', async (req, res)=>{
    const output={
        success:false,
        error:''
    }
    const {city,area,store,m_sid}=req.body;

    
        const sql2="SELECT \`city\`,\`area\`,\`store_name\` FROM \`convenience_store\` WHERE \`m_id\`=?";
        const [rs2]=await db.query(sql2,[m_sid]);
        // return res.json(rs2);
        let ar=[];
        rs2.forEach(el=>{
            // console.log(el)
            if(el.store_name===store){
                ar.push(el);
            }
        })
        // return res.json(ar);

        if(!ar.length){
            try{
                // INSERT INTO convenience_store(city, area, store_name,m_id) VALUES ('台北市','新莊區','新莊','8')
                const sql=`INSERT INTO \`convenience_store\`(\`city\`, \`area\`, \`store_name\`, \`m_id\`) VALUES (?,?,?,?)`
                const [rs]=await db.query(sql,[city,area,store,m_sid]);
                console.log(rs)
                // return res.json(rs);
                if(!rs.insertId){
                    output.error='加入失敗'
                    return res.json(output)
                }else{
                    const sql2="SELECT `store_sid`,`store_name` FROM `convenience_store` WHERE `store_sid`=?"
                    const [rs2]=await db.query(sql2,[rs.insertId]);
                    // return res.json(rs2)
                    output.success=true;
                    output.error='加入成功';
                    output.info=rs2;
                    return res.json(output)
                }
            }catch(ex){
                console.log(ex);
                output.error=ex || '儲存失敗';
                return res.json(output)
            }
            
        }else{
            output.error='已有設定過唷!'
            return res.json(output);
        }

        
    
});

// 取得會員設定的超商資訊
router.get('/convenience-store', async (req, res)=>{
    const output={
        success:false,
        error:'',
        info:[]
    }
    const sql="SELECT store_sid,store_name FROM convenience_store WHERE m_id=?"
    const [rs]=await db.query(sql,[req.query.m_id]);
    // return res.json(rs)
    if(!rs.length){
        output.error='尚未設定'
        return res.json(output)
    }else{
        output.success=true;
        output.info=rs;
        return res.json(output)
    }
    // return res.json(output)
});

// 刪除會員設定的超商資訊
router.post('/convenience-store-delete',async (req,res)=>{
    const output={
        success:false,
        error:''
    }
    const {store_sid}=req.body;
    console.log(store_sid)
    // return res.json(store_sid)
    
        
        const sql=`DELETE FROM convenience_store WHERE store_sid=${store_sid}`;
        const [rs]=await db.query(sql);
        // return res.json(rs);
        if(rs.affectedRows!==0){
            output.success=true;
            output.error="已刪除成功";
            return res.json(output);
        }else{
            output.error='沒有此筆資料'
            return res.json(output);
        }
    
})




module.exports = router;