const Web3 = require('web3');

const networkConnectionUrl = process.env.NETWORK_URL_ON_ETHEREUM;
const votingContractAddress = process.env.VOTING_CONTRACT_ADDRESS;
const startBlock = process.env.START_BLOCK_ON_ETHEREUM;
const endBlock = process.env.END_BLOCK_ON_ETHEREUM;
const VOTING_ABI = [{"anonymous":false,"inputs":[{"indexed":true,"name":"voter","type":"address"},{"indexed":false,"name":"nodes_list","type":"bytes20[]"},{"indexed":false,"name":"vote_counter","type":"uint256"}],"name":"Vote","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"stakeholder","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"delegation_counter","type":"uint256"}],"name":"Delegate","type":"event"},{"constant":false,"inputs":[{"name":"nodes_list","type":"address[]"}],"name":"vote","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"}],"name":"delegate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]

async function getVoteEvents(tokenContract) {
    let options = {
        fromBlock: startBlock,
        toBlock: endBlock
    };

    let mapActivistToVote = {};
    let votes = [];
    try {
        let events = await tokenContract.getPastEvents('Vote', options);
        for (let i = events.length-1; i >= 0;i--) {
            let event = events[i];
            //console.log(event);
            let activistAddress = getAddressFromTopic(event, TOPIC_FROM_ADDR);//event.returnValues['0'];
            let currentActivistIndex = mapActivistToVote[activistAddress];
            if (typeof currentActivistIndex === 'number' && isObjectNewerThanTx(votes[currentActivistIndex], event) ) {
                continue;
            }
            let obj = generateVoteObject(event.blockNumber, event.transactionIndex, event.transactionHash, activistAddress, getCandidates(event), event.event);

            if(typeof currentActivistIndex === 'number') {
                votes[currentActivistIndex] = obj;
            } else {
                mapActivistToVote[activistAddress] = votes.length;
                votes.push(obj);
            }
        }

        return votes;
    } catch (error) {
        console.log(error);
        return [];
    }
}

const TOPIC_FROM_ADDR = 1;
function getAddressFromTopic(event, i) {
    let topic = event.raw.topics[i];
    return '0x' + topic.substring(26)
}

function getCandidates(event) {
    return event.returnValues.nodes_list;
}

function isObjectNewerThanTx(latestDelegate, event) {
    return latestDelegate.block > event.blockNumber ||
        (latestDelegate.block > event.blockNumber && latestDelegate.transactionIndex > event.transactionIndex)
}

function generateVoteObject(block, transactionIndex, txHash, activistAddress, candidateAddresses, method) {
    return {
        block, transactionIndex, txHash, activistAddress, candidateAddresses, method
    }
}

async function main() {
    let web3 = await new Web3(new Web3.providers.HttpProvider(networkConnectionUrl));
    let contract = await new web3.eth.Contract(VOTING_ABI, votingContractAddress);
     return await getVoteEvents(contract);
}

main()
    .then(results => {
        console.log(JSON.stringify(results, null, 2));
    }).catch(console.error);