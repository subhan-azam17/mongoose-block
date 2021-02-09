var express = require('express')
var bodyParser  = require('body-parser')
var morgan = require('morgan')
var Blockchain = require('./blockchain')
var request = require('request');
var fetch = require('node-fetch');

var nodePort = process.argv[2]
console.log(nodePort)


var blockchain = new Blockchain();

var app  = express();
app.use(bodyParser.json())
app.use(morgan('dev'))

//Fetch Complete Blockchain
app.get('/blockchain',(req,res)=>{
	res.json(blockchain)
})


//Broadcast new Transaction

app.post('/txAndBroadcast',(req,res)=>{
	// if clauses
	var txData = blockchain.createNewTx(req.body.amount,req.body.sender,req.body.receiver)
	blockchain.addTxToMemPool(txData)
	var promises = [];
	blockchain.networkNodes.forEach((nodeurl)=>{
		var apiRequest2 = {
			method:'POST',
			uri:nodeurl+'/addTx',
			body:{txData:txData},
			json:true
		}
		promises.push(request(apiRequest2))
	})
	Promise.all(promises).then((data)=>{
		res.json({"msg":"Txs Broadcast Successfully"})
	})

})

app.post('/addTx',(req,res)=>{
	var txData = req.body.txData
	blockchain.addTxToMemPool(txData)
	console.log("New Transaction Received")
	res.json({"msg":"New Transaction Received"})

})
// app.post('/generateTx',(req,res)=>{
//  console.log(req.body)
//  var tx  = blockchain.createNewTx(req.body.amount,req.body.sender,req.body.receiver)
//  res.json({"success":true,"message":"Tx added in mempool will be add in blockheigh "+blockchain.chain.length,'tx':tx})
// })

app.get('/mineAndBroadcast',(req,res)=>{
	var block = blockchain.createNewBlock();
	var reward = blockchain.createNewTx(12,"00000",blockchain.nodeAddress)
	blockchain.addTxToMemPool(reward)
	var promises = [];
	blockchain.networkNodes.forEach((nodeurl)=>{
		var apiRequest2 = {
			method:'POST',
			uri:nodeurl+'/receive-new-block',
			body:{blockData:block},
			json:true
		}
		promises.push(request(apiRequest2))
	})
	Promise.all(promises).then((data)=>{
		var promises2 = [];
		blockchain.networkNodes.forEach((nodeurl)=>{
			var apiRequest2 = {
				method:'POST',
				uri:nodeurl+'/addTx',
				body:{txData:reward},
				json:true
			}
			promises2.push(request(apiRequest2))
		})
		Promise.all(promises2).then((data)=>{
			res.json({"msg":"Block Mined and Broadcast Successfully"})
		})
		
	})
	res.json({'success':true,'msg':'Block Mined Successfully','block':block})
})

app.post('/receive-new-block',(req,res)=>{
	var block = req.body.blockData;
	var index = blockchain.chain.length;
	var latest = blockchain.chain[index-1];
	if(latest.hash == block.previousHash && index == block.height ){
		blockchain.chain.push(block)
		blockchain.memPool = []
		res.json({"msg":"New Block Received"})
	}else{
		res.json({"msg":"Block Rejected"})
	}
})

app.post('/register-node',(req,res)=>{
	var newNetworkNode = req.body.newNodeUrl
	if(blockchain.networkNodes.indexOf(newNetworkNode) == -1 && newNetworkNode != blockchain.currentNodeURL){
		blockchain.networkNodes.push(newNetworkNode)
		res.json({"msg":"Node Registered Successfully"});
	}else{
		res.json({"msg":"Registeration Failed"})
	}
})

app.post('/register-node-bulk',(req,res)=>{
	var bulkNodes = req.body.bulkNodes;
	bulkNodes.forEach((nodeUrl,index)=>{
		if(blockchain.networkNodes.indexOf(nodeUrl) == -1 && nodeUrl != blockchain.currentNodeURL){
			blockchain.networkNodes.push(nodeUrl)
		}
	})
	res.json({"msg":"Bulk Registration Done!"})
})

app.post('/register-and-broadcast',(req,res)=>{
	var newNodeURL = req.body.newNodeurl;
	if(blockchain.networkNodes.indexOf(newNodeURL) == -1 && newNodeURL != blockchain.currentNodeURL){
		blockchain.networkNodes.push(newNodeURL)
		var promises = [];
		blockchain.networkNodes.forEach((nodeurl)=>{
			var apiRequest2 = {
				method:'POST',
				url:nodeurl+'/register-node-bulk',
				body:{bulkNodes:[...blockchain.networkNodes,blockchain.currentNodeURL]},
				json:true
			}
			promises.push(request(apiRequest2))
		})
		Promise.all(promises).then((data)=>{
			res.json({"msg":"Nodes Broadcast Successfully"})
		})

	}else{
		res.json({"msg":"Registeration Failed"})
	}

})

app.get('/consensus', (req,res)=>{
	var promises = [];
	blockchain.networkNodes.forEach(nodeurl =>{
		var fetch1 = fetch(nodeurl+'/blockchain').then(data=>data.json())
		promises.push(fetch1)
 	})
	Promise.all(promises).then((blockchains) =>{
		var currentLongestChainLength = blockchain.chain.length;
		var longestChain = null
		var updatedMempool = null
		blockchains.forEach((item)=>{
			if(item.chain.length > currentLongestChainLength){
				if(blockchain.chainIsValid(item.chain)){
					longestChain = item.chain;
					updatedMempool = item.mempool;
					currentLongestChainLength = item.chain.length
				}
			}
		})
		if(longestChain){
			blockchain.chain = longestChain
			blockchain.memPool = updatedMempool
			res.json({"msg":"Blockchain Updated Successfully"})
 		}
 		else{
 			res.json({"msg":"Your Blockchain is already upto date!!"})
 		}
	})
});

app.get('/block',(req,res)=>{
	res.json(blockchain.chain)
})

app.get('/blockByHeight/:height',(req,res)=>{
	var height = parseInt(req.params.height)
	var me = null 
	blockchain.chain.forEach((element)=>{
		if(height == element.height){
			me = element
		}
	})
	res.json(me)
})


app.get('/blockByHash/:hash',(req,res)=>{
	var hash = req.params.hash
	var me = null 
	blockchain.chain.forEach((element)=>{
		if(hash == element.hash){
			me = element
		}
	})
	res.json(me)
})


app.get('/txdata/:txhash',(req,res)=>{
	var transections = req.params.txhash
	var me = null 
	var confirmations  = null
	var pro = null
	var height = blockchain.chain.length+1
	blockchain.chain.forEach((element)=>{
		element.transactions.forEach((TA)=>{
			confirmations = element.height+1
			if(transections == TA.txHash){
				me = TA
				pro = height-confirmations
			}

		})
		
	})
	res.json({"Transection":me,"comfirmations":pro,"msg":true})
})

app.get('/pendingtx',(req,res)=>{
	mem = blockchain.memPool.length;
	me = blockchain.memPool;
	res.json({"Pending Transectios No=>":mem,"All Pending Transections":me})	
})




app.get('/address/:name',(req,res)=>{
	var transections = req.params.name
	var me = null
	blockchain.chain.forEach((element)=>{
		element.transactions.forEach((TA)=>{
			if(transections == TA.sender){
				me = TA
			}if(transections == TA.receiver){
				me = TA
			}

		})
		
	})
	res.json(me)
})

// app.get('/txdata/:txhash',(req,res)=>{
// 	var transections = req.params.txhash
// 	var me = null 
// 	blockchain.chain.forEach((element)=>{
// 		element.transactions.forEach((TA)=>{
// 			if(transections == TA.txHash){
// 				me = TA
// 			}

// 		})
		
// 	})
// 	res.json(me)
// })





app.listen(nodePort,()=>{
	console.log('Server Started port listening on '+ nodePort)
})

