var mongoose = require('mongoose')
var Schema = mongoose.Schema;




var transactionSchema = new Schema({
    timestamp:{
        type:Number,


    },
    amount:{
        type:Number,

    },receiver:{
        type:String,

    },
    sender:{
        type:String,

    },txHash:{
        type:String,

    }


    
})

var BlockSchema = new Schema({
    height:{
        type:Number,
    },
    timestamp:{
        type:Number,
    },
    transections:{
        type:transactionSchema,
    },
    previouseHash:{
        type:String,
    },
    hash:{
        type:String,
    },
    nonce:{
        type:Number,
    }
    

})

const Block = new mongoose.model('Block',BlockSchema)




module.exports = Block