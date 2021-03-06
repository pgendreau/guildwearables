const axios = require('axios');
const Web3 = require('web3');
const members = require('./data/members.json');
const items = require('./data/items.json');
const addresses = members.map(m => m.toLowerCase());
const rpc = 'https://polygon-rpc.com/';
const aavegotchi = '0x86935F11C86623deC8a25696E1C19a8659CbF95d';
const abi = require('./data/abi/main.json');
const vaultUrl = 'https://api.thegraph.com/subgraphs/name/froid1911/aavegotchi-vault';
const aavegotchiUrl = 'https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-core-matic';
const queries = [];
const gotchis = [];
const owners = {};

for (let address of addresses) {

    owners[address] = {'gotchis': []};

    // wallet gotchis
    queries.push(axios({
      url: aavegotchiUrl,
      method: 'post',
      data: {
        query: `
          query Gotchis {
            aavegotchis(
              where: {
                owner: "${address}"
              }
            ) {
              id
              equippedWearables
              owner {
                id
              }
            }
          }
        `
      }
    }));

    // vault gotchis
    queries.push(axios({
      url: vaultUrl,
      method: 'post',
      data: {
        query: `
          query vaultGotchis {
            aavegotchis(
              where: {
                owner: "${address}"
              }
            ) {
              owner {
                id
                numGotchis
              }
              id
            }
          }
        `
      }
    }));
};

axios.all(queries).then(axios.spread((...responses) => {
    for (let response of responses) {
      gotchis.push(response.data.data.aavegotchis.map(g => g.id));
      response.data.data.aavegotchis.map(g => owners[g.owner['id']].gotchis.push(g.id));
    };

    const wearables = [];
    for (let address of addresses) {

        // tally wearables
        function count(wearable) {
            if (!wearables[wearable]) { 
                // new wearable
                const name = items[wearable].name;
                const rarity = items[wearable].rarity;
                wearables[wearable] = {
                    'id': wearable,
                    'name': name,
                    'rarity': rarity,
                    'holders': {[address]: 1},
                    'owners': 1,
                    'count': 1
                };
            } else {
                if (!wearables[wearable].holders[address]) { 
                    // new owner
                    wearables[wearable].holders[address] = 1;
                    wearables[wearable].owners += 1;
                } else {
                    wearables[wearable].holders[address] += 1;
                }
                wearables[wearable].count += 1;
            }
        };

        // gotchis wearables
        axios({
            url: aavegotchiUrl,
            method: 'post',
            data: {
              query: `
                query Gotchis {
                  aavegotchis(
                    where: {
                      id_in: [${owners[address].gotchis}]
                    }
                  ) {
                    id
                    equippedWearables
                    owner {
                      id
                    }
                  }
                }
              `
            }
        }).then(response => {
            for (let gotchi of response.data.data.aavegotchis) {
                for (let wearable of gotchi.equippedWearables.filter((w) => w > 0)) {
                    // exclude badges and h1 background
                    if((wearable >= 162 && wearable <= 198) || wearable === 210) continue;
                    count(wearable);
                }
            }

            // users wearables
            const web3 = new Web3(rpc);
            const contract = new web3.eth.Contract(abi, aavegotchi);

            try {
                contract.methods.itemBalances(address.toLowerCase()).call().then((response) => {
                    for (let wearable of response.map((item) => item[0])) {
                        // exclude potions
                        if (wearable >= 126 && wearable <= 129) continue;
                        count(wearable);
                    }

                    if (address == addresses[addresses.length - 1]) {
                        const filtered = wearables.filter(a => a != null);
                        const sorted = filtered.sort((a, b) => b.owners - a.owners);
                        console.log(JSON.stringify(sorted, null, 4));
                    }
                });

            } catch (error) {
                console.log('error: ', error);
            };

        }).catch(error => {
            console.log('error: ', error);
        });
    };
})).catch(errors => {
  console.log('error: ', errors);
});
